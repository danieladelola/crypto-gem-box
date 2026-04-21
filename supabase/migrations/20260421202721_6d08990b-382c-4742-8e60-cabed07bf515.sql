-- =========================================
-- Fiat balances (USD)
-- =========================================
CREATE TABLE public.fiat_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  available NUMERIC(28,8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, currency)
);

ALTER TABLE public.fiat_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY fb_self_select ON public.fiat_balances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY fb_admin_all ON public.fiat_balances
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER fb_touch BEFORE UPDATE ON public.fiat_balances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed USD row for existing users
INSERT INTO public.fiat_balances (user_id, currency, available)
SELECT id, 'USD', 0 FROM public.profiles
ON CONFLICT DO NOTHING;

-- Update handle_new_user to also seed USD
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, email_verified)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email_confirmed_at IS NOT NULL)
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'admin@vura.pro' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  FOR m IN SELECT symbol FROM public.market_assets WHERE active = true LOOP
    INSERT INTO public.wallet_balances (user_id, coin, available, staked)
    VALUES (NEW.id, m.symbol, 0, 0)
    ON CONFLICT (user_id, coin) DO NOTHING;
  END LOOP;

  INSERT INTO public.fiat_balances (user_id, currency, available)
  VALUES (NEW.id, 'USD', 0)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- =========================================
-- Exchange transactions
-- =========================================
CREATE TABLE public.exchange_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL, -- 'buy' | 'sell' | 'swap'
  from_asset TEXT NOT NULL,   -- 'USD' or coin symbol
  to_asset TEXT NOT NULL,
  from_amount NUMERIC(28,8) NOT NULL,
  to_amount NUMERIC(28,8) NOT NULL,
  rate NUMERIC(28,8) NOT NULL,           -- price of from in to (to_amount before fee = from_amount * rate)
  fee_amount NUMERIC(28,8) NOT NULL DEFAULT 0,  -- denominated in to_asset
  fee_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed', -- completed | failed | pending
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exchange_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ex_self_select ON public.exchange_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ex_admin_all ON public.exchange_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- Atomic exchange RPC (runs as SECURITY DEFINER, all-or-nothing)
-- =========================================
CREATE OR REPLACE FUNCTION public.execute_exchange(
  _from_asset TEXT,
  _to_asset TEXT,
  _from_amount NUMERIC,
  _rate NUMERIC,
  _fee_pct NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  gross_to NUMERIC(28,8);
  fee_amt NUMERIC(28,8);
  net_to NUMERIC(28,8);
  kind TEXT;
  bal NUMERIC(28,8);
  tx_id UUID;
  ex_enabled BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _from_asset = _to_asset THEN RAISE EXCEPTION 'Assets must differ'; END IF;
  IF _from_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _rate <= 0 THEN RAISE EXCEPTION 'Invalid rate'; END IF;

  -- Check exchange enabled
  SELECT COALESCE((value->>'enabled')::boolean, true) INTO ex_enabled
    FROM public.system_settings WHERE key = 'exchange';
  IF ex_enabled IS FALSE THEN RAISE EXCEPTION 'Exchange is disabled'; END IF;

  -- Verify both assets allowed (USD always allowed; crypto must exist & active)
  IF _from_asset <> 'USD' AND NOT EXISTS (
    SELECT 1 FROM public.market_assets WHERE symbol = _from_asset AND active = true
  ) THEN RAISE EXCEPTION 'Asset % not available', _from_asset; END IF;
  IF _to_asset <> 'USD' AND NOT EXISTS (
    SELECT 1 FROM public.market_assets WHERE symbol = _to_asset AND active = true
  ) THEN RAISE EXCEPTION 'Asset % not available', _to_asset; END IF;

  gross_to := _from_amount * _rate;
  fee_amt := gross_to * (_fee_pct / 100.0);
  net_to := gross_to - fee_amt;

  IF _from_asset = 'USD' AND _to_asset <> 'USD' THEN
    kind := 'buy';
  ELSIF _from_asset <> 'USD' AND _to_asset = 'USD' THEN
    kind := 'sell';
  ELSE
    kind := 'swap';
  END IF;

  -- Debit FROM
  IF _from_asset = 'USD' THEN
    SELECT available INTO bal FROM public.fiat_balances WHERE user_id = uid AND currency = 'USD' FOR UPDATE;
    IF bal IS NULL OR bal < _from_amount THEN RAISE EXCEPTION 'Insufficient USD balance'; END IF;
    UPDATE public.fiat_balances SET available = available - _from_amount
      WHERE user_id = uid AND currency = 'USD';
  ELSE
    SELECT available INTO bal FROM public.wallet_balances WHERE user_id = uid AND coin = _from_asset FOR UPDATE;
    IF bal IS NULL OR bal < _from_amount THEN RAISE EXCEPTION 'Insufficient % balance', _from_asset; END IF;
    UPDATE public.wallet_balances SET available = available - _from_amount
      WHERE user_id = uid AND coin = _from_asset;
  END IF;

  -- Credit TO
  IF _to_asset = 'USD' THEN
    INSERT INTO public.fiat_balances (user_id, currency, available)
    VALUES (uid, 'USD', net_to)
    ON CONFLICT (user_id, currency) DO UPDATE SET available = public.fiat_balances.available + net_to;
  ELSE
    INSERT INTO public.wallet_balances (user_id, coin, available, staked)
    VALUES (uid, _to_asset, net_to, 0)
    ON CONFLICT (user_id, coin) DO UPDATE SET available = public.wallet_balances.available + net_to;
  END IF;

  -- Record exchange
  INSERT INTO public.exchange_transactions (
    user_id, kind, from_asset, to_asset, from_amount, to_amount, rate, fee_amount, fee_pct, status
  )
  VALUES (uid, kind, _from_asset, _to_asset, _from_amount, net_to, _rate, fee_amt, _fee_pct, 'completed')
  RETURNING id INTO tx_id;

  -- Add to transaction history (one row summarising)
  INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
  VALUES (
    uid,
    kind,
    _to_asset,
    net_to,
    tx_id,
    'completed',
    format('%s %s -> %s %s', _from_amount, _from_asset, net_to, _to_asset)
  );

  RETURN tx_id;
END;
$$;

-- =========================================
-- Storage: avatars bucket
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================
-- Default exchange settings
-- =========================================
INSERT INTO public.system_settings (key, value)
VALUES ('exchange', '{"enabled": true, "fee_pct": 0.5, "min_usd": 1, "max_usd": 100000}'::jsonb)
ON CONFLICT (key) DO NOTHING;
