import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Copy, ArrowDownToLine } from "lucide-react";
import { format } from "date-fns";

export default function Deposit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [coin, setCoin] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: assets = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data } = await supabase.from("market_assets").select("*").eq("active", true).order("sort_order");
      return data ?? [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["my-deposits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("deposits").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const selected = assets.find((a: any) => a.symbol === coin);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    const { error } = await supabase.from("deposits").insert({
      user_id: user!.id, coin, amount: amt, tx_hash: tx || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Deposit request submitted. Awaiting admin approval.");
    setAmount(""); setTx("");
    qc.invalidateQueries({ queryKey: ["my-deposits"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Deposit</h1>
        <p className="text-muted-foreground">Send crypto to your unique address, then submit a request below.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle className="flex items-center gap-2"><ArrowDownToLine className="h-4 w-4 text-primary" /> New deposit</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Coin</Label>
                <Select value={coin} onValueChange={setCoin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assets.map((a: any) => (
                      <SelectItem key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selected?.deposit_address && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <div className="text-xs text-muted-foreground mb-1">Send {coin} to:</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate">{selected.deposit_address}</code>
                    <Button type="button" variant="ghost" size="icon" onClick={() => {
                      navigator.clipboard.writeText(selected.deposit_address);
                      toast.success("Address copied");
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Transaction hash (optional)</Label>
                <Input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="0x..." />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">Submit deposit request</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle>Deposit history</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No deposits yet.</div>
            ) : (
              <div className="space-y-2">
                {history.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-background/40">
                    <div>
                      <div className="font-medium text-sm">{Number(d.amount).toFixed(6)} {d.coin}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(d.created_at), "MMM d, yyyy p")}</div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
