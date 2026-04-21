import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetSelector, AssetOption } from "./AssetSelector";
import { useCoinList } from "@/hooks/useCoinList";
import { useBalances } from "@/hooks/useBalances";
import { useFiatBalance } from "@/hooks/useFiatBalance";
import { useExchangeSettings } from "@/hooks/useExchangeSettings";
import { ArrowDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultMode?: "buy" | "sell" | "swap";
  defaultCoin?: string; // crypto symbol to focus
}

export function ExchangeDialog({ open, onOpenChange, defaultMode = "buy", defaultCoin = "BTC" }: Props) {
  const qc = useQueryClient();
  const { data: settings } = useExchangeSettings();
  const { data: coins = [] } = useCoinList();
  const { data: balances = [] } = useBalances();
  const { data: usdBalance = 0 } = useFiatBalance();

  const [from, setFrom] = useState<AssetOption | null>(null);
  const [to, setTo] = useState<AssetOption | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initialize on open
  useEffect(() => {
    if (!open) return;
    const usd: AssetOption = { symbol: "USD", name: "US Dollar", isFiat: true, current_price: 1 };
    const c = coins.find((x) => x.symbol === defaultCoin) ?? coins[0];
    const cryptoOpt: AssetOption | null = c
      ? { symbol: c.symbol, name: c.name, image: c.image, current_price: c.current_price }
      : null;
    if (defaultMode === "buy") { setFrom(usd); setTo(cryptoOpt); }
    else if (defaultMode === "sell") { setFrom(cryptoOpt); setTo(usd); }
    else { setFrom(cryptoOpt); setTo(coins[1] ? { symbol: coins[1].symbol, name: coins[1].name, image: coins[1].image, current_price: coins[1].current_price } : usd); }
    setAmount("");
  }, [open, defaultMode, defaultCoin, coins]);

  const fromUsdPrice = from?.current_price ?? 0;   // USD per 1 unit of FROM
  const toUsdPrice = to?.current_price ?? 0;       // USD per 1 unit of TO
  const rate = useMemo(() => (toUsdPrice > 0 ? fromUsdPrice / toUsdPrice : 0), [fromUsdPrice, toUsdPrice]);

  const amountNum = Number(amount) || 0;
  const grossTo = amountNum * rate;
  const feePct = settings?.fee_pct ?? 0;
  const feeAmount = grossTo * (feePct / 100);
  const netTo = grossTo - feeAmount;
  const usdValue = amountNum * fromUsdPrice;

  const fromBalance = useMemo(() => {
    if (!from) return 0;
    if (from.isFiat) return usdBalance;
    return balances.find((b) => b.coin === from.symbol)?.available ?? 0;
  }, [from, balances, usdBalance]);

  const insufficient = amountNum > fromBalance;
  const belowMin = settings && usdValue > 0 && usdValue < settings.min_usd;
  const aboveMax = settings && usdValue > settings.max_usd;
  const sameAsset = from && to && from.symbol === to.symbol;
  const exchangeOff = settings && !settings.enabled;

  const canSubmit = !!from && !!to && amountNum > 0 && !insufficient && !belowMin && !aboveMax && !sameAsset && !exchangeOff && rate > 0 && !submitting;

  function flip() {
    setFrom(to);
    setTo(from);
    setAmount("");
  }

  async function submit() {
    if (!from || !to || !canSubmit) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("execute_exchange", {
      _from_asset: from.symbol,
      _to_asset: to.symbol,
      _from_amount: amountNum,
      _rate: rate,
      _fee_pct: feePct,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Exchange failed");
      return;
    }
    toast.success(`Exchanged ${amountNum} ${from.symbol} → ${netTo.toFixed(6)} ${to.symbol}`);
    qc.invalidateQueries({ queryKey: ["balances"] });
    qc.invalidateQueries({ queryKey: ["fiat-balance"] });
    qc.invalidateQueries({ queryKey: ["tx-recent"] });
    qc.invalidateQueries({ queryKey: ["exchange-history"] });
    onOpenChange(false);
  }

  const title = defaultMode === "buy" ? "Buy crypto" : defaultMode === "sell" ? "Sell crypto" : "Swap assets";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Live rates from CoinGecko. Fee: {feePct}% · Min ${settings?.min_usd ?? 1} · Max ${settings?.max_usd?.toLocaleString() ?? "100,000"}
          </DialogDescription>
        </DialogHeader>

        {exchangeOff && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm p-3">
            Exchange is currently disabled by admin.
          </div>
        )}

        <div className="space-y-3">
          {/* From */}
          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>You pay</span>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setAmount(String(fromBalance))}
              >
                Balance: {fromBalance.toFixed(6)} {from?.symbol}
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg h-12 flex-1"
              />
              <div className="w-44">
                {from && (
                  <AssetSelector
                    value={from.symbol}
                    onChange={setFrom}
                    excludeSymbol={to?.symbol}
                  />
                )}
              </div>
            </div>
            {usdValue > 0 && <div className="text-xs text-muted-foreground">≈ ${usdValue.toFixed(2)}</div>}
          </div>

          <div className="flex justify-center">
            <Button variant="outline" size="icon" onClick={flip} className="rounded-full h-9 w-9">
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>

          {/* To */}
          <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>You receive</span>
              <span>1 {from?.symbol} ≈ {rate > 0 ? rate.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "–"} {to?.symbol}</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={netTo > 0 ? netTo.toFixed(8) : ""}
                readOnly
                placeholder="0.00"
                className="text-lg h-12 flex-1 bg-background/60"
              />
              <div className="w-44">
                {to && (
                  <AssetSelector
                    value={to.symbol}
                    onChange={setTo}
                    excludeSymbol={from?.symbol}
                  />
                )}
              </div>
            </div>
            {feeAmount > 0 && (
              <div className="text-xs text-muted-foreground">
                Fee ({feePct}%): {feeAmount.toFixed(8)} {to?.symbol}
              </div>
            )}
          </div>

          {insufficient && <div className="text-xs text-destructive">Insufficient {from?.symbol} balance.</div>}
          {belowMin && <div className="text-xs text-destructive">Minimum trade is ${settings?.min_usd}.</div>}
          {aboveMax && <div className="text-xs text-destructive">Maximum trade is ${settings?.max_usd?.toLocaleString()}.</div>}

          <Button onClick={submit} disabled={!canSubmit} className="w-full bg-gradient-primary h-11">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm exchange
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
