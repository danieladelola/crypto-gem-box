-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.tx_status AS ENUM ('pending', 'approved', 'rejected', 'completed', 'cancelled');
CREATE TYPE public.kyc_status AS ENUM ('none', 'pending', 'approved', 'rejected');
CREATE TYPE public.stake_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE public.trade_status AS ENUM ('open', 'closed', 'cancelled');
CREATE TYPE public.trade_side AS ENUM ('buy', 'sell', 'long', 'short');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  mobile_verified BOOLEAN NOT NULL DEFAULT false,
  banned BOOLEAN NOT NULL DEFAULT false,
  kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ MARKET ASSETS ============
CREATE TABLE public.market_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  coingecko_id TEXT,
  deposit_address TEXT,
  icon_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.market_assets ENABLE ROW LEVEL SECURITY;

-- ============ WALLET BALANCES ============
CREATE TABLE public.wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coin TEXT NOT NULL,
  available NUMERIC(28,8) NOT NULL DEFAULT 0 CHECK (available >= 0),
  staked NUMERIC(28,8) NOT NULL DEFAULT 0 CHECK (staked >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, coin)
);
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

-- ============ DEPOSITS ============
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coin TEXT NOT NULL,
  amount NUMERIC(28,8) NOT NULL CHECK (amount > 0),
  tx_hash TEXT,
  proof_url TEXT,
  status public.tx_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- ============ WITHDRAWALS ============
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coin TEXT NOT NULL,
  amount NUMERIC(28,8) NOT NULL CHECK (amount > 0),
  fee NUMERIC(28,8) NOT NULL DEFAULT 0,
  address TEXT NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- ============ STAKING ============
CREATE TABLE public.staking_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  coin TEXT NOT NULL,
  apy NUMERIC(6,2) NOT NULL,
  lock_days INT NOT NULL,
  min_amount NUMERIC(28,8) NOT NULL DEFAULT 0,
  max_amount NUMERIC(28,8),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staking_plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.staking_plans(id) ON DELETE RESTRICT,
  coin TEXT NOT NULL,
  amount NUMERIC(28,8) NOT NULL CHECK (amount > 0),
  apy NUMERIC(6,2) NOT NULL,
  reward_earned NUMERIC(28,8) NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  status public.stake_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_stakes ENABLE ROW LEVEL SECURITY;

-- ============ TRADES ============
CREATE TABLE public.trade_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pair TEXT NOT NULL,
  side public.trade_side NOT NULL,
  amount NUMERIC(28,8) NOT NULL,
  entry_price NUMERIC(28,8) NOT NULL,
  exit_price NUMERIC(28,8),
  pnl NUMERIC(28,8),
  status public.trade_status NOT NULL DEFAULT 'open',
  notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
ALTER TABLE public.trade_records ENABLE ROW LEVEL SECURITY;

-- ============ SIGNALS ============
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  pair TEXT NOT NULL,
  side public.trade_side NOT NULL,
  entry NUMERIC(28,8) NOT NULL,
  target NUMERIC(28,8),
  stop NUMERIC(28,8),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (signal_id, user_id)
);
ALTER TABLE public.user_signals ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  broadcast BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ HISTORY ============
CREATE TABLE public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  coin TEXT,
  amount NUMERIC(28,8),
  ref_id UUID,
  status public.tx_status,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

-- ============ COPY EXPERTS ============
CREATE TABLE public.copy_experts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  win_rate NUMERIC(5,2),
  followers INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.copy_experts ENABLE ROW LEVEL SECURITY;

-- ============ KYC ============
CREATE TABLE public.kyc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_url TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;

-- ============ SYSTEM SETTINGS ============
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin_select" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- market_assets
CREATE POLICY "market_assets_read_all" ON public.market_assets FOR SELECT USING (true);
CREATE POLICY "market_assets_admin_write" ON public.market_assets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- wallet_balances
CREATE POLICY "wb_self_select" ON public.wallet_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wb_admin_all" ON public.wallet_balances FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- deposits
CREATE POLICY "dep_self_select" ON public.deposits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "dep_self_insert" ON public.deposits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dep_admin_all" ON public.deposits FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- withdrawals
CREATE POLICY "wd_self_select" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wd_self_insert" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wd_admin_all" ON public.withdrawals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- staking_plans
CREATE POLICY "sp_read_all" ON public.staking_plans FOR SELECT USING (true);
CREATE POLICY "sp_admin_all" ON public.staking_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_stakes
CREATE POLICY "us_self_select" ON public.user_stakes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "us_self_insert" ON public.user_stakes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "us_admin_all" ON public.user_stakes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- trade_records
CREATE POLICY "tr_self_select" ON public.trade_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tr_admin_all" ON public.trade_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- signals
CREATE POLICY "sig_read_all" ON public.signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "sig_admin_all" ON public.signals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_signals
CREATE POLICY "usig_self_select" ON public.user_signals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "usig_self_update" ON public.user_signals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "usig_admin_all" ON public.user_signals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- notifications
CREATE POLICY "notif_self_select" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id OR broadcast = true);
CREATE POLICY "notif_self_update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_admin_all" ON public.notifications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- login_history
CREATE POLICY "lh_self_select" ON public.login_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lh_self_insert" ON public.login_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lh_admin_select" ON public.login_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- transaction_history
CREATE POLICY "th_self_select" ON public.transaction_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "th_admin_all" ON public.transaction_history FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- copy_experts
CREATE POLICY "ce_read_all" ON public.copy_experts FOR SELECT USING (true);
CREATE POLICY "ce_admin_all" ON public.copy_experts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- kyc_records
CREATE POLICY "kyc_self_select" ON public.kyc_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "kyc_self_insert" ON public.kyc_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kyc_admin_all" ON public.kyc_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- system_settings
CREATE POLICY "ss_read_all" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "ss_admin_write" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER wb_touch BEFORE UPDATE ON public.wallet_balances FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ NEW USER HANDLER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, email_verified)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email_confirmed_at IS NOT NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Auto-grant admin to the seed admin email
  IF NEW.email = 'admin@vura.pro' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  -- Seed zero balances for active assets
  FOR m IN SELECT symbol FROM public.market_assets WHERE active = true LOOP
    INSERT INTO public.wallet_balances (user_id, coin, available, staked)
    VALUES (NEW.id, m.symbol, 0, 0)
    ON CONFLICT (user_id, coin) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ DEPOSIT APPROVAL ============
CREATE OR REPLACE FUNCTION public.handle_deposit_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    INSERT INTO public.wallet_balances (user_id, coin, available)
    VALUES (NEW.user_id, NEW.coin, NEW.amount)
    ON CONFLICT (user_id, coin) DO UPDATE SET available = public.wallet_balances.available + NEW.amount;

    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'deposit', NEW.coin, NEW.amount, NEW.id, 'approved', 'Deposit approved');

    NEW.processed_at = now();
  ELSIF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'deposit', NEW.coin, NEW.amount, NEW.id, 'rejected', 'Deposit rejected');
    NEW.processed_at = now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER deposits_status_change BEFORE UPDATE ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.handle_deposit_status_change();

-- ============ WITHDRAWAL FLOW ============
-- On request (insert) move balance available -> hold (we just decrement available; reject refunds)
CREATE OR REPLACE FUNCTION public.handle_withdrawal_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bal NUMERIC(28,8);
BEGIN
  SELECT available INTO bal FROM public.wallet_balances WHERE user_id = NEW.user_id AND coin = NEW.coin FOR UPDATE;
  IF bal IS NULL OR bal < (NEW.amount + COALESCE(NEW.fee,0)) THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  UPDATE public.wallet_balances SET available = available - (NEW.amount + COALESCE(NEW.fee,0))
    WHERE user_id = NEW.user_id AND coin = NEW.coin;

  INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
  VALUES (NEW.user_id, 'withdrawal', NEW.coin, NEW.amount, NEW.id, 'pending', 'Withdrawal requested');
  RETURN NEW;
END; $$;

CREATE TRIGGER withdrawals_insert BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.handle_withdrawal_insert();

CREATE OR REPLACE FUNCTION public.handle_withdrawal_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    UPDATE public.wallet_balances SET available = available + (NEW.amount + COALESCE(NEW.fee,0))
      WHERE user_id = NEW.user_id AND coin = NEW.coin;
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'withdrawal', NEW.coin, NEW.amount, NEW.id, 'rejected', 'Withdrawal rejected, balance refunded');
    NEW.processed_at = now();
  ELSIF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'withdrawal', NEW.coin, NEW.amount, NEW.id, 'approved', 'Withdrawal approved');
    NEW.processed_at = now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER withdrawals_status_change BEFORE UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.handle_withdrawal_status_change();

-- ============ STAKE FLOW ============
CREATE OR REPLACE FUNCTION public.handle_stake_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bal NUMERIC(28,8);
BEGIN
  SELECT available INTO bal FROM public.wallet_balances WHERE user_id = NEW.user_id AND coin = NEW.coin FOR UPDATE;
  IF bal IS NULL OR bal < NEW.amount THEN
    RAISE EXCEPTION 'Insufficient balance to stake';
  END IF;
  UPDATE public.wallet_balances SET available = available - NEW.amount, staked = staked + NEW.amount
    WHERE user_id = NEW.user_id AND coin = NEW.coin;

  INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
  VALUES (NEW.user_id, 'stake', NEW.coin, NEW.amount, NEW.id, 'completed', 'Stake created');
  RETURN NEW;
END; $$;

CREATE TRIGGER user_stakes_insert BEFORE INSERT ON public.user_stakes
FOR EACH ROW EXECUTE FUNCTION public.handle_stake_insert();

CREATE OR REPLACE FUNCTION public.handle_stake_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    UPDATE public.wallet_balances
      SET staked = staked - NEW.amount,
          available = available + NEW.amount + COALESCE(NEW.reward_earned,0)
      WHERE user_id = NEW.user_id AND coin = NEW.coin;
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'stake_complete', NEW.coin, NEW.amount + COALESCE(NEW.reward_earned,0), NEW.id, 'completed', 'Stake completed with reward');
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'active' THEN
    UPDATE public.wallet_balances
      SET staked = staked - NEW.amount, available = available + NEW.amount
      WHERE user_id = NEW.user_id AND coin = NEW.coin;
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'stake_cancel', NEW.coin, NEW.amount, NEW.id, 'cancelled', 'Stake cancelled');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER user_stakes_status_change BEFORE UPDATE ON public.user_stakes
FOR EACH ROW EXECUTE FUNCTION public.handle_stake_status_change();

-- ============ SEED DATA ============
INSERT INTO public.market_assets (symbol, name, coingecko_id, deposit_address, sort_order) VALUES
  ('BTC',  'Bitcoin',  'bitcoin',  'bc1qvura000demoaddressbtcxxxxxxxxxxxxxxx', 1),
  ('ETH',  'Ethereum', 'ethereum', '0xVuraDemoEthereumAddress0000000000000001', 2),
  ('USDT', 'Tether',   'tether',   '0xVuraDemoUSDTAddressERC2000000000000000', 3),
  ('SOL',  'Solana',   'solana',   'VuraDemoSolanaAddress00000000000000000001', 4),
  ('BNB',  'BNB',      'binancecoin', 'bnb1vurademoaddressbnbxxxxxxxxxxxxxxxx', 5),
  ('XRP',  'XRP',      'ripple',   'rVuraDemoXRPAddress00000000000000000001',  6);

INSERT INTO public.staking_plans (name, coin, apy, lock_days, min_amount, max_amount) VALUES
  ('Flexible BTC', 'BTC', 4.5, 30, 0.001, 1),
  ('30-Day ETH',   'ETH', 6.0, 30, 0.05, 50),
  ('90-Day USDT',  'USDT', 9.0, 90, 50, 100000);

INSERT INTO public.system_settings (key, value) VALUES
  ('platform_name',    '"Vura"'::jsonb),
  ('support_email',    '"support@vura.pro"'::jsonb),
  ('withdrawal_fee_pct', '0.5'::jsonb),
  ('min_withdrawal',   '10'::jsonb),
  ('kyc_required',     'false'::jsonb);

-- ============ ADMIN PROMOTION (idempotent, in case admin signed up before this migration) ============
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'admin@vura.pro'
ON CONFLICT DO NOTHING;