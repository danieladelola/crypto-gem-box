import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBalances } from "@/hooks/useBalances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { ArrowUpFromLine } from "lucide-react";
import { format } from "date-fns";

export default function Withdraw() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: balances = [] } = useBalances();
  const [coin, setCoin] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

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

  const balance = balances.find((b) => b.coin === coin);
  const feePct = Number(settings?.withdrawal_fee_pct ?? 0);
  const amt = parseFloat(amount) || 0;
  const fee = (amt * feePct) / 100;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!address.trim()) return toast.error("Enter destination address");
    if (!balance || balance.available < amt + fee) return toast.error("Insufficient balance");
    setBusy(true);
    const { error } = await supabase.from("withdrawals").insert({
      user_id: user!.id, coin, amount: amt, fee, address: address.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal request submitted. Awaiting approval.");
    setAmount(""); setAddress("");
    qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["balances"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Withdraw</h1>
        <p className="text-muted-foreground">Request a withdrawal from your wallet.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle className="flex items-center gap-2"><ArrowUpFromLine className="h-4 w-4 text-primary" /> New withdrawal</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Coin</Label>
                <Select value={coin} onValueChange={setCoin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {balances.map((b) => (
                      <SelectItem key={b.coin} value={b.coin}>{b.coin}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {balance && (
                  <div className="text-xs text-muted-foreground">Available: {balance.available.toFixed(8)} {coin}</div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Destination address</Label>
                <Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Wallet address" />
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Fee ({feePct}%)</span><span>{fee.toFixed(8)} {coin}</span></div>
                <div className="flex justify-between font-medium"><span>Total deducted</span><span>{(amt + fee).toFixed(8)} {coin}</span></div>
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">Submit withdrawal</Button>
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
                {history.map((w: any) => (
                  <div key={w.id} className="p-3 rounded-lg border border-border/60 bg-background/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{Number(w.amount).toFixed(6)} {w.coin}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">{w.address}</div>
                      </div>
                      <StatusBadge status={w.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{format(new Date(w.created_at), "MMM d, yyyy p")}</div>
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
