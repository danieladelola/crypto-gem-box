import { useBalances } from "@/hooks/useBalances";
import { useMarkets, COIN_TO_GECKO, SUPPORTED_GECKO_IDS } from "@/hooks/useMarkets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";

export default function WalletPage() {
  const { user } = useAuth();
  const { data: balances = [] } = useBalances();
  const { data: markets = [] } = useMarkets(SUPPORTED_GECKO_IDS);

  const { data: activity = [] } = useQuery({
    queryKey: ["wallet-activity", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_history").select("*").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Wallet</h1>
        <p className="text-muted-foreground">All your balances in one place.</p>
      </div>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>Holdings</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-3">Asset</th>
                <th className="text-right py-3">Available</th>
                <th className="text-right py-3">Staked</th>
                <th className="text-right py-3">Total</th>
                <th className="text-right py-3">USD Value</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => {
                const gid = COIN_TO_GECKO[b.coin];
                const c = markets.find((m) => m.id === gid);
                const total = b.available + b.staked;
                const usd = (c?.current_price ?? 0) * total;
                return (
                  <tr key={b.id} className="border-b border-border/40 last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {c?.image && <img src={c.image} alt={b.coin} className="h-8 w-8 rounded-full" />}
                        <div>
                          <div className="font-medium">{c?.name ?? b.coin}</div>
                          <div className="text-xs text-muted-foreground">{b.coin}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-right">{b.available.toFixed(8)}</td>
                    <td className="py-3 text-right">{b.staked.toFixed(8)}</td>
                    <td className="py-3 text-right font-medium">{total.toFixed(8)}</td>
                    <td className="py-3 text-right">${usd.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>Wallet activity</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No activity yet.</div>
          ) : (
            <div className="space-y-2">
              {activity.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-background/40">
                  <div>
                    <div className="font-medium text-sm capitalize">{t.type.replace("_", " ")} • {t.coin}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(t.created_at), "MMM d, yyyy p")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{Number(t.amount).toFixed(6)}</div>
                    <StatusBadge status={t.status ?? "completed"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
