-- 1. Extend staking_plans with new admin-editable fields
ALTER TABLE public.staking_plans
  ADD COLUMN IF NOT EXISTS fixed_amount NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Reuse existing touch_updated_at() trigger function
DROP TRIGGER IF EXISTS staking_plans_touch_updated_at ON public.staking_plans;
CREATE TRIGGER staking_plans_touch_updated_at
BEFORE UPDATE ON public.staking_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Seed deposit address settings (admin manages from Admin Settings)
INSERT INTO public.system_settings (key, value)
VALUES (
  'deposit_addresses',
  jsonb_build_object(
    'BTC', jsonb_build_object('address', '', 'enabled', true,  'network', 'Bitcoin'),
    'ETH', jsonb_build_object('address', '', 'enabled', true,  'network', 'ERC-20'),
    'USDT',jsonb_build_object('address', '', 'enabled', true,  'network', 'TRC-20'),
    'USDC',jsonb_build_object('address', '', 'enabled', true,  'network', 'ERC-20'),
    'SOL', jsonb_build_object('address', '', 'enabled', true,  'network', 'Solana'),
    'TRX', jsonb_build_object('address', '', 'enabled', true,  'network', 'Tron'),
    'XRP', jsonb_build_object('address', '', 'enabled', true,  'network', 'XRP Ledger')
  )
)
ON CONFLICT (key) DO NOTHING;