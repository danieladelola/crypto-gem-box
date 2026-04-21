import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCoinList } from "@/hooks/useCoinList";
import { useDepositSettings } from "@/hooks/useDepositSettings";
import { useFiatBalance } from "@/hooks/useFiatBalance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetSelector, AssetOption } from "@/components/AssetSelector";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Copy, ArrowDownToLine, DollarSign, Wallet } from "lucide-react";
import { format } from "date-fns";

export default function Deposit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: settings } = useDepositSettings();
  const { data: usdBalance = 0 } = useFiatBalance("USD");
  const { data: coins = [] } = useCoinList();

  const [usdAmount, setUsdAmount] = useState("");
  const [payCoin, setPayCoin] = useState<AssetOption | null>(null);
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);

  // Fallback: pre-pick BTC once coins load
  if (!payCoin && coins.length) {
    const btc = coins.find((c) => c.symbol === "BTC") ?? coins[0];
    setPayCoin({ symbol: btc.symbol, name: btc.name, image: btc.image, current_price: btc.current_price });
  }

  // Fetch the deposit address admins set for this coin (if any)
  const { data: assetRow } = useQuery({
    queryKey: ["asset-row", payCoin?.symbol],
    enabled: !!payCoin,
    queryFn: async () => {
      const { data } = await supabase
        .from("market_assets")
        .select("symbol,deposit_address")
        .eq("symbol", payCoin!.symbol)
        .maybeSingle();
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["my-deposits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const usd = parseFloat(usdAmount) || 0;
  const feePct = settings?.fee_pct ?? 0;
  const feeUsd = usd * (feePct / 100);
  const netUsd = Math.max(0, usd - feeUsd);
  const rate = payCoin?.current_price ?? 0; // USD per 1 unit of coin
  const payAmount = useMemo(() => (rate > 0 ? usd / rate : 0), [usd, rate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings?.enabled) return toast.error("Deposits are currently disabled");
    if (!payCoin) return toast.error("Choose a payment coin");
    if (!usd || usd <= 0) return toast.error("Enter a USD amount");
    if (usd < settings.min_usd) return toast.error(`Minimum deposit is $${settings.min_usd}`);
    if (usd > settings.max_usd) return toast.error(`Maximum deposit is $${settings.max_usd}`);
    if (rate <= 0) return toast.error("Live rate unavailable, try again");

    setBusy(true);
    const { error } = await supabase.from("deposits").insert({
      user_id: user!.id,
      coin: payCoin.symbol,           // legacy column = pay coin
      amount: payAmount,              // legacy column = crypto amount sent
      pay_coin: payCoin.symbol,
      pay_amount: payAmount,
      usd_amount: usd,
      rate_used: rate,
      fee_pct: feePct,
      usd_credited: netUsd,
      tx_hash: tx || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Deposit submitted. Awaiting admin approval.");
    setUsdAmount("");
    setTx("");
    qc.invalidateQueries({ queryKey: ["my-deposits"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Fund your USD balance</h1>
          <p className="text-muted-foreground">
            Pay with crypto — we credit the equivalent USD to your main wallet.
          </p>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-primary" /> New deposit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Amount to fund (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="any"
                    min={settings?.min_usd ?? 0}
                    required
                    value={usdAmount}
                    onChange={(e) => setUsdAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-9 h-12 text-lg font-semibold"
                  />
                </div>
                {settings && (
                  <p className="text-xs text-muted-foreground">
                    Min ${settings.min_usd} • Max ${settings.max_usd.toLocaleString()}
                    {settings.fee_pct > 0 ? ` • Fee ${settings.fee_pct}%` : ""}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Pay with</Label>
                <AssetSelector
                  value={payCoin?.symbol ?? ""}
                  onChange={(o) => setPayCoin(o)}
                  includeFiat={false}
                  placeholder="Select payment coin"
                />
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You pay</span>
                  <span className="font-medium">
                    {payAmount > 0 ? payAmount.toFixed(8) : "—"} {payCoin?.symbol ?? ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span>{rate > 0 ? `1 ${payCoin?.symbol} ≈ $${rate.toLocaleString()}` : "—"}</span>
                </div>
                {feePct > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee ({feePct}%)</span>
                    <span>${feeUsd.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border/60 pt-2 font-semibold">
                  <span>You receive (credited)</span>
                  <span className="text-emerald-500">${netUsd.toFixed(2)} USD</span>
                </div>
              </div>

              {assetRow?.deposit_address ? (
                <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
                  <div className="text-xs text-muted-foreground mb-1">
                    Send {payAmount > 0 ? payAmount.toFixed(8) : ""} {payCoin?.symbol} to:
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate">{assetRow.deposit_address}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(assetRow.deposit_address!);
                        toast.success("Address copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500">
                  No deposit address on file for {payCoin?.symbol}. Contact support for instructions, then submit your request below.
                </div>
              )}

              <div className="space-y-2">
                <Label>Transaction hash (optional)</Label>
                <Input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="0x..." />
              </div>

              <Button
                type="submit"
                disabled={busy || !settings?.enabled}
                className="w-full bg-gradient-primary h-11"
              >
                {busy ? "Submitting…" : `Fund $${usd ? netUsd.toFixed(2) : "0.00"} USD`}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/60">
          <CardHeader>
            <CardTitle>Deposit history</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No deposits yet.</div>
            ) : (
              <div className="space-y-2">
                {history.map((d: any) => {
                  const usdShown = d.usd_credited ?? d.usd_amount;
                  const payShown = d.pay_amount ?? d.amount;
                  const payCoinShown = d.pay_coin ?? d.coin;
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-background/40"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {usdShown != null ? (
                            <>+${Number(usdShown).toFixed(2)} USD</>
                          ) : (
                            <>{Number(payShown).toFixed(6)} {payCoinShown}</>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          via {Number(payShown).toFixed(6)} {payCoinShown} ·{" "}
                          {format(new Date(d.created_at), "MMM d, yyyy p")}
                        </div>
                      </div>
                      <StatusBadge status={d.status} />
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
