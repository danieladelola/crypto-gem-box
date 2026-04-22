import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFiatBalance } from "@/hooks/useFiatBalance";
import { useCoinList } from "@/hooks/useCoinList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetSelector, AssetOption } from "@/components/AssetSelector";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { ArrowUpFromLine, DollarSign, Wallet } from "lucide-react";
import { format } from "date-fns";

export default function Withdraw() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: usdBalance = 0 } = useFiatBalance("USD");
  const { data: coins = [] } = useCoinList();

  const [usdAmount, setUsdAmount] = useState("");
  const [payoutCoin, setPayoutCoin] = useState<AssetOption | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!payoutCoin && coins.length) {
      const btc = coins.find((c) => c.symbol === "BTC") ?? coins[0];
      setPayoutCoin({ symbol: btc.symbol, name: btc.name, image: btc.image, current_price: btc.current_price });
    }
  }, [coins, payoutCoin]);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("*");
      const map: Record<string, any> = {};
      (data ?? []).forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["my-withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const usd = parseFloat(usdAmount) || 0;
  const feePct = Number(settings?.withdrawal_fee_pct ?? 0);
  const feeUsd = (usd * feePct) / 100;
  const netUsd = Math.max(0, usd - feeUsd);
  const rate = payoutCoin?.current_price ?? 0;
  const payoutAmount = useMemo(() => (rate > 0 ? netUsd / rate : 0), [netUsd, rate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!payoutCoin) return toast.error("Choose payout coin");
    if (!usd || usd <= 0) return toast.error("Enter a USD amount");
    if (usd > usdBalance) return toast.error("Insufficient USD balance");
    if (!address.trim()) return toast.error("Enter destination address");
    if (rate <= 0) return toast.error("Live rate unavailable, try again");
    setBusy(true);
    const { error } = await supabase.from("withdrawals").insert({
      user_id: user!.id,
      coin: payoutCoin.symbol,           // legacy mirror
      amount: payoutAmount,              // legacy mirror
      fee: 0,
      address: address.trim(),
      usd_amount: usd,
      payout_coin: payoutCoin.symbol,
      payout_amount: payoutAmount,
      rate_used: rate,
      fee_pct: feePct,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal request submitted. Awaiting approval.");
    setUsdAmount(""); setAddress("");
    qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["fiat-balance"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Withdraw</h1>
          <p className="text-muted-foreground">Cash out from your USD balance — paid in the crypto of your choice.</p>
        </div>
        <Card className="bg-gradient-card border-border/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">USD balance</div>
              <div className="font-bold">${usdBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle className="flex items-center gap-2"><ArrowUpFromLine className="h-4 w-4 text-primary" /> New withdrawal</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" step="any" required value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} placeholder="0.00" className="pl-9 h-12 text-lg font-semibold" />
                </div>
                <button type="button" onClick={() => setUsdAmount(String(usdBalance))} className="text-xs text-muted-foreground hover:text-foreground">
                  Available: ${usdBalance.toFixed(2)}
                </button>
              </div>

              <div className="space-y-2">
                <Label>Payout in</Label>
                <AssetSelector value={payoutCoin?.symbol ?? ""} onChange={setPayoutCoin} includeFiat={false} placeholder="Select payout coin" />
              </div>

              <div className="space-y-2">
                <Label>Destination address</Label>
                <Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder={`${payoutCoin?.symbol ?? ""} wallet address`} />
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span>{rate > 0 ? `1 ${payoutCoin?.symbol} ≈ $${rate.toLocaleString()}` : "—"}</span></div>
                {feePct > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee ({feePct}%)</span><span>${feeUsd.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between border-t border-border/60 pt-2 font-semibold">
                  <span>You receive</span>
                  <span className="text-emerald-500">{payoutAmount > 0 ? payoutAmount.toFixed(8) : "—"} {payoutCoin?.symbol}</span>
                </div>
              </div>

              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary h-11">
                {busy ? "Submitting…" : `Withdraw $${usd ? usd.toFixed(2) : "0.00"}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle>Withdrawal history</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No withdrawals yet.</div>
            ) : (
              <div className="space-y-2">
                {history.map((w: any) => {
                  const usdShown = w.usd_amount;
                  const payoutShown = w.payout_amount ?? w.amount;
                  const payoutCoinShown = w.payout_coin ?? w.coin;
                  return (
                    <div key={w.id} className="p-3 rounded-lg border border-border/60 bg-background/40">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {usdShown != null ? <>-${Number(usdShown).toFixed(2)} USD</> : <>{Number(payoutShown).toFixed(6)} {payoutCoinShown}</>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            → {Number(payoutShown).toFixed(6)} {payoutCoinShown} · {w.address}
                          </div>
                        </div>
                        <StatusBadge status={w.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{format(new Date(w.created_at), "MMM d, yyyy p")}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
