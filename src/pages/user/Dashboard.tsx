import { useMemo, useState } from "react";
import { useBalances } from "@/hooks/useBalances";
import { useFiatBalance } from "@/hooks/useFiatBalance";
import { useCoinList } from "@/hooks/useCoinList";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, Coins, Bell, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, DollarSign } from "lucide-react";
import TradingViewWidget from "@/components/TradingViewWidget";
import { ExchangeDialog } from "@/components/ExchangeDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: balances = [] } = useBalances();
  const { data: usdBalance = 0 } = useFiatBalance();
  const { data: coins = [] } = useCoinList();
  const [dialog, setDialog] = useState<{ open: boolean; mode: "buy" | "sell" | "swap"; coin: string }>({
    open: false, mode: "buy", coin: "BTC",
  });

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    coins.forEach((c) => { m[c.symbol] = c.current_price; });
    return m;
  }, [coins]);

  const totals = useMemo(() => {
    let avail = usdBalance, staked = 0;
    for (const b of balances) {
      const p = priceMap[b.coin] ?? 0;
      avail += b.available * p;
      staked += b.staked * p;
    }
    return { avail, staked, total: avail + staked };
  }, [balances, priceMap, usdBalance]);

  const { data: recent = [] } = useQuery({
    queryKey: ["tx-recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const { data: stakes = [] } = useQuery({
    queryKey: ["my-stakes-summary", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_stakes")
        .select("*")
        .eq("status", "active");
      return data ?? [];
    },
  });

  // top market preview
  const topCoins = coins.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground">Here's what's happening with your portfolio today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog({ open: true, mode: "buy", coin: "BTC" })} className="bg-gradient-primary">
            <ArrowDownToLine className="h-4 w-4 mr-2" />Buy
          </Button>
          <Button onClick={() => setDialog({ open: true, mode: "sell", coin: "BTC" })} variant="outline">
            <ArrowUpFromLine className="h-4 w-4 mr-2" />Sell
          </Button>
          <Button onClick={() => setDialog({ open: true, mode: "swap", coin: "BTC" })} variant="outline">
            <ArrowLeftRight className="h-4 w-4 mr-2" />Swap
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Portfolio" value={`$${totals.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={Wallet} />
        <StatCard label="USD Balance" value={`$${usdBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={DollarSign} />
        <StatCard label="Staked Value" value={`$${totals.staked.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={Coins} />
        <StatCard label="Active Stakes" value={stakes.length} icon={TrendingUp} hint="Currently earning rewards" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col: chart + wallet + recent */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-gradient-card border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>BTC / USDT</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/app/markets">View markets →</Link></Button>
            </CardHeader>
            <CardContent>
              <TradingViewWidget symbol="BINANCE:BTCUSDT" height={360} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Wallet summary</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/app/wallet">View all →</Link></Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* USD card */}
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                      <DollarSign className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium text-sm">USD</span>
                  </div>
                  <div className="text-sm font-semibold">{usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs text-muted-foreground">Fiat balance</div>
                </div>
                {balances.slice(0, 7).map((b) => {
                  const coin = coins.find((c) => c.symbol === b.coin);
                  const total = b.available + b.staked;
                  const usd = (coin?.current_price ?? 0) * total;
                  return (
                    <div key={b.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {coin?.image && <img src={coin.image} alt={b.coin} className="h-6 w-6 rounded-full" />}
                        <span className="font-medium text-sm">{b.coin}</span>
                      </div>
                      <div className="text-sm font-semibold">{total.toFixed(6)}</div>
                      <div className="text-xs text-muted-foreground">${usd.toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent transactions */}
          <Card className="bg-gradient-card border-border/60">
            <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">No activity yet — make your first deposit or trade above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                      <tr>
                        <th className="text-left py-2">Type</th>
                        <th className="text-left py-2">Coin</th>
                        <th className="text-right py-2">Amount</th>
                        <th className="text-right py-2">Status</th>
                        <th className="text-right py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((t: any) => (
                        <tr key={t.id} className="border-b border-border/40 last:border-0">
                          <td className="py-3 capitalize">{t.type.replace("_", " ")}</td>
                          <td className="py-3">{t.coin}</td>
                          <td className="py-3 text-right">{Number(t.amount ?? 0).toFixed(6)}</td>
                          <td className="py-3 text-right"><StatusBadge status={t.status ?? "completed"} /></td>
                          <td className="py-3 text-right text-muted-foreground">{format(new Date(t.created_at), "MMM d")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right col: quick swap CTA + markets + notifications */}
        <div className="space-y-6">
          <Card className="bg-gradient-primary text-primary-foreground border-0">
            <CardHeader>
              <CardTitle className="text-primary-foreground">Quick swap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-primary-foreground/80">Convert between USD and any of 250+ coins in one click.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setDialog({ open: true, mode: "buy", coin: "BTC" })}>Buy BTC</Button>
                <Button variant="secondary" onClick={() => setDialog({ open: true, mode: "buy", coin: "ETH" })}>Buy ETH</Button>
              </div>
              <Button variant="outline" className="w-full bg-background/10 border-primary-foreground/20 text-primary-foreground hover:bg-background/20" onClick={() => setDialog({ open: true, mode: "swap", coin: "BTC" })}>
                <ArrowLeftRight className="h-4 w-4 mr-2" />Open swap
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Market preview</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/app/exchange">All coins →</Link></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {topCoins.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg p-2 hover:bg-background/40 transition cursor-pointer"
                  onClick={() => setDialog({ open: true, mode: "buy", coin: c.symbol })}>
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={c.image} alt={c.symbol} className="h-7 w-7 rounded-full" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{c.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.name}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold">${c.current_price?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/60">
            <CardHeader className="flex flex-row items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifs.length === 0 && <div className="text-sm text-muted-foreground">No notifications yet.</div>}
              {notifs.map((n: any) => (
                <div key={n.id} className="rounded-lg border border-border/60 p-3 bg-background/40">
                  <div className="font-medium text-sm">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-1">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(n.created_at), "MMM d, p")}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <ExchangeDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        defaultMode={dialog.mode}
        defaultCoin={dialog.coin}
      />
    </div>
  );
}
