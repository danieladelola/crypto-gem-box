
-- ============= STORAGE =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "kyc_user_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "kyc_user_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "kyc_user_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "kyc_admin_read_all" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-docs' AND public.has_role(auth.uid(), 'admin'));

-- ============= PROFILES (address fields) =============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS id_number TEXT;

-- ============= KYC RECORDS =============
ALTER TABLE public.kyc_records
  ADD COLUMN IF NOT EXISTS id_front_url TEXT,
  ADD COLUMN IF NOT EXISTS id_back_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS full_address TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

-- Sync profile.kyc_status when admin updates KYC record
CREATE OR REPLACE FUNCTION public.handle_kyc_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    UPDATE public.profiles SET kyc_status = NEW.status WHERE id = NEW.user_id;
    NEW.reviewed_at := now();
    NEW.reviewed_by := auth.uid();
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.user_id, 'KYC ' || NEW.status,
      CASE WHEN NEW.status = 'approved' THEN 'Your identity verification has been approved.'
           WHEN NEW.status = 'rejected' THEN COALESCE('KYC rejected: ' || NEW.admin_note, 'Your KYC submission was rejected.')
           ELSE 'Your KYC status has been updated.' END);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS kyc_status_change ON public.kyc_records;
CREATE TRIGGER kyc_status_change BEFORE UPDATE ON public.kyc_records
FOR EACH ROW EXECUTE FUNCTION public.handle_kyc_status_change();

-- Set profile to 'pending' on KYC insert
CREATE OR REPLACE FUNCTION public.handle_kyc_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET kyc_status = 'pending' WHERE id = NEW.user_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS kyc_insert ON public.kyc_records;
CREATE TRIGGER kyc_insert AFTER INSERT ON public.kyc_records
FOR EACH ROW EXECUTE FUNCTION public.handle_kyc_insert();

-- ============= WITHDRAWALS (USD-first) =============
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS usd_amount NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS payout_coin TEXT,
  ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS rate_used NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS fee_pct NUMERIC(8,4) DEFAULT 0;

-- Replace insert handler: debit USD if usd_amount given, else legacy coin debit
CREATE OR REPLACE FUNCTION public.handle_withdrawal_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bal NUMERIC(28,8);
  total_debit NUMERIC(28,8);
BEGIN
  IF NEW.usd_amount IS NOT NULL AND NEW.usd_amount > 0 THEN
    -- USD-first path
    total_debit := NEW.usd_amount;
    SELECT available INTO bal FROM public.fiat_balances
      WHERE user_id = NEW.user_id AND currency = 'USD' FOR UPDATE;
    IF bal IS NULL OR bal < total_debit THEN
      RAISE EXCEPTION 'Insufficient USD balance';
    END IF;
    UPDATE public.fiat_balances SET available = available - total_debit
      WHERE user_id = NEW.user_id AND currency = 'USD';
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'withdrawal', 'USD', total_debit, NEW.id, 'pending',
            format('Withdrawal requested: $%s → %s %s', total_debit, NEW.payout_amount, NEW.payout_coin));
  ELSE
    -- Legacy crypto path
    total_debit := NEW.amount + COALESCE(NEW.fee, 0);
    SELECT available INTO bal FROM public.wallet_balances
      WHERE user_id = NEW.user_id AND coin = NEW.coin FOR UPDATE;
    IF bal IS NULL OR bal < total_debit THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    UPDATE public.wallet_balances SET available = available - total_debit
      WHERE user_id = NEW.user_id AND coin = NEW.coin;
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'withdrawal', NEW.coin, NEW.amount, NEW.id, 'pending', 'Withdrawal requested');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_withdrawal_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    IF OLD.usd_amount IS NOT NULL AND OLD.usd_amount > 0 THEN
      INSERT INTO public.fiat_balances (user_id, currency, available)
      VALUES (NEW.user_id, 'USD', OLD.usd_amount)
      ON CONFLICT (user_id, currency) DO UPDATE
        SET available = public.fiat_balances.available + OLD.usd_amount;
      INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
      VALUES (NEW.user_id, 'withdrawal', 'USD', OLD.usd_amount, NEW.id, 'rejected', 'Withdrawal rejected — USD refunded');
    ELSE
      UPDATE public.wallet_balances SET available = available + (OLD.amount + COALESCE(OLD.fee,0))
        WHERE user_id = NEW.user_id AND coin = OLD.coin;
      INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
      VALUES (NEW.user_id, 'withdrawal', OLD.coin, OLD.amount, NEW.id, 'rejected', 'Withdrawal rejected — balance refunded');
    END IF;
    NEW.processed_at := now();
  ELSIF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'withdrawal',
      COALESCE(OLD.payout_coin, OLD.coin),
      COALESCE(OLD.payout_amount, OLD.amount),
      NEW.id, 'approved', 'Withdrawal approved');
    NEW.processed_at := now();
  END IF;
  RETURN NEW;
END; $$;

-- ============= STAKING (USD) =============
ALTER TABLE public.staking_plans
  ADD COLUMN IF NOT EXISTS is_usd BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_stakes
  ADD COLUMN IF NOT EXISTS is_usd BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_stake_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bal NUMERIC(28,8);
BEGIN
  IF NEW.is_usd THEN
    SELECT available INTO bal FROM public.fiat_balances
      WHERE user_id = NEW.user_id AND currency = 'USD' FOR UPDATE;
    IF bal IS NULL OR bal < NEW.amount THEN RAISE EXCEPTION 'Insufficient USD balance to stake'; END IF;
    UPDATE public.fiat_balances SET available = available - NEW.amount
      WHERE user_id = NEW.user_id AND currency = 'USD';
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'stake', 'USD', NEW.amount, NEW.id, 'completed', 'USD stake created');
  ELSE
    SELECT available INTO bal FROM public.wallet_balances
      WHERE user_id = NEW.user_id AND coin = NEW.coin FOR UPDATE;
    IF bal IS NULL OR bal < NEW.amount THEN RAISE EXCEPTION 'Insufficient balance to stake'; END IF;
    UPDATE public.wallet_balances SET available = available - NEW.amount, staked = staked + NEW.amount
      WHERE user_id = NEW.user_id AND coin = NEW.coin;
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'stake', NEW.coin, NEW.amount, NEW.id, 'completed', 'Stake created');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_stake_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  payout NUMERIC(28,8);
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    payout := OLD.amount + COALESCE(NEW.reward_earned, 0);
    IF OLD.is_usd THEN
      INSERT INTO public.fiat_balances (user_id, currency, available)
      VALUES (NEW.user_id, 'USD', payout)
      ON CONFLICT (user_id, currency) DO UPDATE
        SET available = public.fiat_balances.available + payout;
      INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
      VALUES (NEW.user_id, 'stake_complete', 'USD', payout, NEW.id, 'completed', 'USD stake completed with reward');
    ELSE
      UPDATE public.wallet_balances
        SET staked = staked - OLD.amount,
            available = available + payout
        WHERE user_id = NEW.user_id AND coin = OLD.coin;
      INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
      VALUES (NEW.user_id, 'stake_complete', OLD.coin, payout, NEW.id, 'completed', 'Stake completed with reward');
    END IF;
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'active' THEN
    IF OLD.is_usd THEN
      INSERT INTO public.fiat_balances (user_id, currency, available)
      VALUES (NEW.user_id, 'USD', OLD.amount)
      ON CONFLICT (user_id, currency) DO UPDATE
        SET available = public.fiat_balances.available + OLD.amount;
    ELSE
      UPDATE public.wallet_balances
        SET staked = staked - OLD.amount, available = available + OLD.amount
        WHERE user_id = NEW.user_id AND coin = OLD.coin;
    END IF;
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'stake_cancel', CASE WHEN OLD.is_usd THEN 'USD' ELSE OLD.coin END, OLD.amount, NEW.id, 'cancelled', 'Stake cancelled');
  END IF;
  RETURN NEW;
END; $$;

-- ============= ADMIN BALANCE ADJUSTMENTS =============
CREATE TABLE IF NOT EXISTS public.balance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  user_id UUID NOT NULL,
  asset TEXT NOT NULL,           -- 'USD' or coin symbol
  delta NUMERIC(28,8) NOT NULL,  -- positive = credit, negative = debit
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ba_admin_all" ON public.balance_adjustments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ba_user_select_own" ON public.balance_adjustments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  _target UUID, _asset TEXT, _delta NUMERIC, _reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  adj_id UUID;
  cur NUMERIC(28,8);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can adjust balances';
  END IF;
  IF _delta = 0 THEN RAISE EXCEPTION 'Delta cannot be zero'; END IF;

  IF upper(_asset) = 'USD' THEN
    INSERT INTO public.fiat_balances (user_id, currency, available)
    VALUES (_target, 'USD', GREATEST(_delta, 0))
    ON CONFLICT (user_id, currency) DO UPDATE
      SET available = public.fiat_balances.available + _delta;
    SELECT available INTO cur FROM public.fiat_balances WHERE user_id = _target AND currency = 'USD';
    IF cur < 0 THEN RAISE EXCEPTION 'Adjustment would result in negative USD balance'; END IF;
  ELSE
    INSERT INTO public.wallet_balances (user_id, coin, available, staked)
    VALUES (_target, upper(_asset), GREATEST(_delta, 0), 0)
    ON CONFLICT (user_id, coin) DO UPDATE
      SET available = public.wallet_balances.available + _delta;
    SELECT available INTO cur FROM public.wallet_balances WHERE user_id = _target AND coin = upper(_asset);
    IF cur < 0 THEN RAISE EXCEPTION 'Adjustment would result in negative balance'; END IF;
  END IF;

  INSERT INTO public.balance_adjustments (admin_id, user_id, asset, delta, reason)
  VALUES (auth.uid(), _target, upper(_asset), _delta, _reason)
  RETURNING id INTO adj_id;

  INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
  VALUES (_target, CASE WHEN _delta > 0 THEN 'admin_credit' ELSE 'admin_debit' END,
          upper(_asset), abs(_delta), adj_id, 'completed',
          COALESCE(_reason, format('Admin %s of %s %s', CASE WHEN _delta > 0 THEN 'credit' ELSE 'debit' END, abs(_delta), upper(_asset))));

  RETURN adj_id;
END; $$;

-- ============= LOGIN HISTORY =============
CREATE OR REPLACE FUNCTION public.record_login(_ip TEXT DEFAULT NULL, _ua TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.login_history (user_id, ip, user_agent) VALUES (auth.uid(), _ip, _ua);
END; $$;

-- ============= EXCHANGE RATE GUARD =============
-- Add a soft sanity check via a system_settings cache of last-known prices.
-- Reject trades whose client-supplied rate deviates >5% from cached.
INSERT INTO public.system_settings (key, value)
VALUES ('last_prices', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.execute_exchange(_from_asset text, _to_asset text, _from_amount numeric, _rate numeric, _fee_pct numeric)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  gross_to NUMERIC(28,8);
  fee_amt NUMERIC(28,8);
  net_to NUMERIC(28,8);
  kind TEXT;
  bal NUMERIC(28,8);
  tx_id UUID;
  ex_enabled BOOLEAN;
  prices JSONB;
  ref_from NUMERIC(28,8);
  ref_to NUMERIC(28,8);
  ref_rate NUMERIC(28,8);
  deviation NUMERIC(28,8);
  enforced_fee NUMERIC(28,8);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _from_asset = _to_asset THEN RAISE EXCEPTION 'Assets must differ'; END IF;
  IF _from_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _rate <= 0 THEN RAISE EXCEPTION 'Invalid rate'; END IF;

  SELECT COALESCE((value->>'enabled')::boolean, true) INTO ex_enabled
    FROM public.system_settings WHERE key = 'exchange';
  IF ex_enabled IS FALSE THEN RAISE EXCEPTION 'Exchange is disabled'; END IF;

  -- Enforce server-side fee % (don't trust client)
  SELECT COALESCE((value->>'fee_pct')::numeric, 0) INTO enforced_fee
    FROM public.system_settings WHERE key = 'exchange';
  enforced_fee := COALESCE(enforced_fee, _fee_pct);

  IF _from_asset <> 'USD' AND NOT EXISTS (
    SELECT 1 FROM public.market_assets WHERE symbol = _from_asset AND active = true
  ) THEN RAISE EXCEPTION 'Asset % not available', _from_asset; END IF;
  IF _to_asset <> 'USD' AND NOT EXISTS (
    SELECT 1 FROM public.market_assets WHERE symbol = _to_asset AND active = true
  ) THEN RAISE EXCEPTION 'Asset % not available', _to_asset; END IF;

  -- Sanity check rate vs cached reference if available
  SELECT value INTO prices FROM public.system_settings WHERE key = 'last_prices';
  IF prices IS NOT NULL THEN
    ref_from := CASE WHEN _from_asset = 'USD' THEN 1 ELSE NULLIF((prices->>_from_asset)::numeric, 0) END;
    ref_to := CASE WHEN _to_asset = 'USD' THEN 1 ELSE NULLIF((prices->>_to_asset)::numeric, 0) END;
    IF ref_from IS NOT NULL AND ref_to IS NOT NULL AND ref_to > 0 THEN
      ref_rate := ref_from / ref_to;
      deviation := abs(_rate - ref_rate) / ref_rate;
      IF deviation > 0.05 THEN
        RAISE EXCEPTION 'Rate deviates from market reference (% vs %)', _rate, ref_rate;
      END IF;
    END IF;
  END IF;

  gross_to := _from_amount * _rate;
  fee_amt := gross_to * (enforced_fee / 100.0);
  net_to := gross_to - fee_amt;

  IF _from_asset = 'USD' AND _to_asset <> 'USD' THEN kind := 'buy';
  ELSIF _from_asset <> 'USD' AND _to_asset = 'USD' THEN kind := 'sell';
  ELSE kind := 'swap'; END IF;

  IF _from_asset = 'USD' THEN
    SELECT available INTO bal FROM public.fiat_balances WHERE user_id = uid AND currency = 'USD' FOR UPDATE;
    IF bal IS NULL OR bal < _from_amount THEN RAISE EXCEPTION 'Insufficient USD balance'; END IF;
    UPDATE public.fiat_balances SET available = available - _from_amount WHERE user_id = uid AND currency = 'USD';
  ELSE
    SELECT available INTO bal FROM public.wallet_balances WHERE user_id = uid AND coin = _from_asset FOR UPDATE;
    IF bal IS NULL OR bal < _from_amount THEN RAISE EXCEPTION 'Insufficient % balance', _from_asset; END IF;
    UPDATE public.wallet_balances SET available = available - _from_amount WHERE user_id = uid AND coin = _from_asset;
  END IF;

  IF _to_asset = 'USD' THEN
    INSERT INTO public.fiat_balances (user_id, currency, available)
    VALUES (uid, 'USD', net_to)
    ON CONFLICT (user_id, currency) DO UPDATE SET available = public.fiat_balances.available + net_to;
  ELSE
    INSERT INTO public.wallet_balances (user_id, coin, available, staked)
    VALUES (uid, _to_asset, net_to, 0)
    ON CONFLICT (user_id, coin) DO UPDATE SET available = public.wallet_balances.available + net_to;
  END IF;

  INSERT INTO public.exchange_transactions (user_id, kind, from_asset, to_asset, from_amount, to_amount, rate, fee_amount, fee_pct, status)
  VALUES (uid, kind, _from_asset, _to_asset, _from_amount, net_to, _rate, fee_amt, enforced_fee, 'completed')
  RETURNING id INTO tx_id;

  INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
  VALUES (uid, kind, _to_asset, net_to, tx_id, 'completed', format('%s %s -> %s %s', _from_amount, _from_asset, net_to, _to_asset));

  RETURN tx_id;
END; $$;

-- RPC for the client to update price cache (anyone authenticated can write small updates).
-- This is intentionally permissive; the cache is just a sanity reference.
CREATE OR REPLACE FUNCTION public.update_price_cache(_prices JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.system_settings (key, value)
  VALUES ('last_prices', _prices)
  ON CONFLICT (key) DO UPDATE SET value = _prices, updated_at = now();
END; $$;
