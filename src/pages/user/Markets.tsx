import { useState } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TradingViewWidget from "@/components/TradingViewWidget";

export default function Markets() {
  const { data: markets = [], isLoading } = useMarkets(undefined, 100);
  const [q, setQ] = useState("");
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const filtered = markets.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()) || c.symbol.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Markets</h1>
          <p className="text-muted-foreground">Live prices, updated every minute.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search asset..." className="pl-9" />
        </div>
      </div>

      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-3 px-4">Asset</th>
                <th className="text-right py-3 px-4">Price</th>
                <th className="text-right py-3 px-4">24h</th>
                <th className="text-right py-3 px-4">Market Cap</th>
                <th className="text-right py-3 px-4">Volume</th>
                <th className="text-right py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr>}
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img src={c.image} alt={c.name} className="h-7 w-7 rounded-full" />
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground uppercase">{c.symbol}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">${c.current_price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                  <td className={`py-3 px-4 text-right ${c.price_change_percentage_24h >= 0 ? "text-success" : "text-destructive"}`}>
                    {c.price_change_percentage_24h >= 0 ? "+" : ""}{c.price_change_percentage_24h?.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right text-muted-foreground">${(c.market_cap / 1e9).toFixed(2)}B</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">${(c.total_volume / 1e6).toFixed(1)}M</td>
                  <td className="py-3 px-4 text-right">
                    <Button size="sm" variant="outline" onClick={() => setChartSymbol(`BINANCE:${c.symbol.toUpperCase()}USDT`)}>
                      Chart
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!chartSymbol} onOpenChange={(o) => !o && setChartSymbol(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{chartSymbol}</DialogTitle></DialogHeader>
          {chartSymbol && <TradingViewWidget symbol={chartSymbol} height={500} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
