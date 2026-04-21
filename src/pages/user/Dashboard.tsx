import { useMemo } from "react";
import { useBalances } from "@/hooks/useBalances";
import { useMarkets, COIN_TO_GECKO, SUPPORTED_GECKO_IDS } from "@/hooks/useMarkets";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, Coins, Bell } from "lucide-react";
import TradingViewWidget from "@/components/TradingViewWidget";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: balances = [] } = useBalances();
  const { data: markets = [] } = useMarkets(SUPPORTED_GECKO_IDS);

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    markets.forEach((c) => { m[c.id] = c.current_price; });
    return m;
  }, [markets]);

  const totals = useMemo(() => {
    let avail = 0, staked = 0;
    for (const b of balances) {
      const gid = COIN_TO_GECKO[b.coin];
      const p = gid ? priceMap[gid] ?? 0 : 0;
      avail += b.available * p;
      staked += b.staked * p;
    }
    return { avail, staked, total: avail + staked };
  }, [balances, priceMap]);

  const { data: recent = [] } = useQuery({
    queryKey: ["tx-recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
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
        .limit(5);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground">Here's what's happening with your portfolio today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Portfolio (USD)" value={`$${totals.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={Wallet} />
        <StatCard label="Available Balance" value={`$${totals.avail.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={TrendingUp} />
        <StatCard label="Staked Value" value={`$${totals.staked.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={Coins} />
        <StatCard label="Active Stakes" value={stakes.length} icon={Coins} hint="Currently earning rewards" />
      </div>

      {/* Wallets */}
      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>Wallet summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {balances.map((b) => {
              const gid = COIN_TO_GECKO[b.coin];
              const coin = markets.find((m) => m.id === gid);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TradingView */}
        <Card className="lg:col-span-2 bg-gradient-card border-border/60">
          <CardHeader><CardTitle>Advanced market analysis</CardTitle></CardHeader>
          <CardContent>
            <TradingViewWidget symbol="BINANCE:BTCUSDT" height={420} />
          </CardContent>
        </Card>

        {/* Notifications */}
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

      {/* Recent transactions */}
      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>Recent transactions</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No activity yet — make your first deposit to get started.</div>
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
                      <td className="py-3 text-right">{Number(t.amount).toFixed(6)}</td>
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
  );
}
