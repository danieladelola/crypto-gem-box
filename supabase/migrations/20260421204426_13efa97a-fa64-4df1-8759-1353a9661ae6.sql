
-- Extend deposits table for USD-first funding
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS usd_amount NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS pay_coin TEXT,
  ADD COLUMN IF NOT EXISTS pay_amount NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS rate_used NUMERIC(28,8),
  ADD COLUMN IF NOT EXISTS fee_pct NUMERIC(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd_credited NUMERIC(28,8);

-- Replace deposit status change handler: credit USD on approval
CREATE OR REPLACE FUNCTION public.handle_deposit_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  credit NUMERIC(28,8);
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    -- Determine USD credit: prefer explicit usd_credited, then usd_amount, then legacy amount in coin*rate
    credit := COALESCE(NEW.usd_credited, NEW.usd_amount, 0);

    IF credit > 0 THEN
      INSERT INTO public.fiat_balances (user_id, currency, available)
      VALUES (NEW.user_id, 'USD', credit)
      ON CONFLICT (user_id, currency)
      DO UPDATE SET available = public.fiat_balances.available + credit;

      -- Persist the credited amount for audit
      NEW.usd_credited := credit;

      INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
      VALUES (NEW.user_id, 'deposit', 'USD', credit, NEW.id, 'approved',
              format('Deposit approved: %s USD funded via %s', credit, COALESCE(NEW.pay_coin, NEW.coin)));
    ELSE
      -- Legacy fallback: credit the crypto wallet (preserves old behavior)
      INSERT INTO public.wallet_balances (user_id, coin, available)
      VALUES (NEW.user_id, NEW.coin, NEW.amount)
      ON CONFLICT (user_id, coin) DO UPDATE
        SET available = public.wallet_balances.available + NEW.amount;

      INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
      VALUES (NEW.user_id, 'deposit', NEW.coin, NEW.amount, NEW.id, 'approved', 'Deposit approved');
    END IF;

    NEW.processed_at := now();

  ELSIF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    INSERT INTO public.transaction_history (user_id, type, coin, amount, ref_id, status, description)
    VALUES (NEW.user_id, 'deposit',
            COALESCE(NEW.pay_coin, NEW.coin),
            COALESCE(NEW.pay_amount, NEW.amount),
            NEW.id, 'rejected', 'Deposit rejected');
    NEW.processed_at := now();
  END IF;

  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS deposits_status_change ON public.deposits;
CREATE TRIGGER deposits_status_change
BEFORE UPDATE ON public.deposits
FOR EACH ROW
EXECUTE FUNCTION public.handle_deposit_status_change();

-- Seed deposit settings if missing
INSERT INTO public.system_settings (key, value)
VALUES ('deposit', '{"enabled": true, "fee_pct": 0, "min_usd": 10, "max_usd": 100000}'::jsonb)
ON CONFLICT (key) DO NOTHING;
