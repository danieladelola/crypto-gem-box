import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExchangeDialog } from "@/components/ExchangeDialog";
import { useBalances } from "@/hooks/useBalances";
import { useFiatBalance } from "@/hooks/useFiatBalance";
import { useCoinList } from "@/hooks/useCoinList";
import { useExchangeSettings } from "@/hooks/useExchangeSettings";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

export default function Exchange() {
  const { user } = useAuth();
  const { data: balances = [] } = useBalances();
  const { data: usdBalance = 0 } = useFiatBalance();
  const { data: coins = [] } = useCoinList();
  const { data: settings } = useExchangeSettings();
  const [dialog, setDialog] = useState<{ open: boolean; mode: "buy" | "sell" | "swap"; coin: string }>({
    open: false, mode: "buy", coin: "BTC",
  });
  const [search, setSearch] = useState("");

  const { data: history = [] } = useQuery({
    queryKey: ["exchange-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("exchange_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    const list = coins.filter((c) => !c.disabled);
    if (!s) return list.slice(0, 24);
    return list.filter((c) => c.symbol.toLowerCase().includes(s) || c.name.toLowerCase().includes(s)).slice(0, 50);
  }, [coins, search]);

  const totalPortfolio = useMemo(() => {
    let v = usdBalance;
    for (const b of balances) {
      const coin = coins.find((c) => c.symbol === b.coin);
      v += (coin?.current_price ?? 0) * (b.available + b.staked);
    }
    return v;
  }, [balances, coins, usdBalance]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Exchange</h1>
          <p className="text-muted-foreground">Buy, sell and swap crypto instantly at live rates.</p>
        </div>
        <div className="flex gap-2">
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

      {/* Balance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-card border-border/60">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">USD Balance</div>
            <div className="text-2xl font-bold flex items-center gap-2 mt-1">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              {usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/60">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Total Portfolio</div>
            <div className="text-2xl font-bold mt-1">${totalPortfolio.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/60">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Exchange Fee</div>
            <div className="text-2xl font-bold mt-1">{settings?.fee_pct ?? 0.5}%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Min ${settings?.min_usd ?? 1} · Max ${settings?.max_usd?.toLocaleString() ?? "100,000"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Searchable asset grid */}
      <Card className="bg-gradient-card border-border/60">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>Markets</CardTitle>
          <Input
            placeholder="Search any coin (e.g. Solana, ARB, doge)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-72"
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-xl border border-border/60 bg-background/40 p-4 hover:border-primary/40 transition">
                <div className="flex items-center gap-3">
                  <img src={c.image} alt={c.symbol} className="h-9 w-9 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {c.symbol}
                      {c.market_cap_rank && <span className="text-[10px] text-muted-foreground">#{c.market_cap_rank}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.name}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">${c.current_price?.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button size="sm" className="bg-gradient-primary h-8" onClick={() => setDialog({ open: true, mode: "buy", coin: c.symbol })}>Buy</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setDialog({ open: true, mode: "sell", coin: c.symbol })}>Sell</Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-8">No coins match your search.</div>}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>Recent exchanges</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">No exchanges yet — make your first trade above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">From</th>
                    <th className="text-left py-2">To</th>
                    <th className="text-right py-2">Rate</th>
                    <th className="text-right py-2">Fee</th>
                    <th className="text-right py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((t: any) => (
                    <tr key={t.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 capitalize">
                          {t.kind === "buy" ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : t.kind === "sell" ? <TrendingDown className="h-3.5 w-3.5 text-destructive" /> : <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />}
                          {t.kind}
                        </span>
                      </td>
                      <td className="py-3">{Number(t.from_amount).toFixed(6)} {t.from_asset}</td>
                      <td className="py-3">{Number(t.to_amount).toFixed(6)} {t.to_asset}</td>
                      <td className="py-3 text-right">{Number(t.rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                      <td className="py-3 text-right">{Number(t.fee_amount).toFixed(6)}</td>
                      <td className="py-3 text-right text-muted-foreground">{format(new Date(t.created_at), "MMM d, p")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ExchangeDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        defaultMode={dialog.mode}
        defaultCoin={dialog.coin}
      />
    </div>
  );
}
