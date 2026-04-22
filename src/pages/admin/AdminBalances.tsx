import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Minus, Search, Wallet } from "lucide-react";

export default function AdminBalances() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<any>(null);
  const [mode, setMode] = useState<"credit" | "debit">("credit");
  const [asset, setAsset] = useState("USD");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-bal", q],
    queryFn: async () => {
      let query = supabase.from("profiles").select("id,email,full_name").order("created_at", { ascending: false }).limit(50);
      if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  const { data: balances = [] } = useQuery({
    queryKey: ["admin-target-bal", target?.id],
    enabled: !!target,
    queryFn: async () => {
      const [w, f] = await Promise.all([
        supabase.from("wallet_balances").select("coin,available,staked").eq("user_id", target.id),
        supabase.from("fiat_balances").select("currency,available").eq("user_id", target.id),
      ]);
      const out: { asset: string; available: number; staked?: number }[] = [];
      (f.data ?? []).forEach((r) => out.push({ asset: r.currency, available: Number(r.available) }));
      (w.data ?? []).forEach((r) => out.push({ asset: r.coin, available: Number(r.available), staked: Number(r.staked) }));
      return out.filter((b) => b.available > 0 || (b.staked ?? 0) > 0);
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["admin-target-adj", target?.id],
    enabled: !!target,
    queryFn: async () => {
      const { data } = await supabase
        .from("balance_adjustments")
        .select("*")
        .eq("user_id", target.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  async function submit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a positive amount");
    if (!asset) return toast.error("Choose asset");
    setBusy(true);
    const delta = mode === "credit" ? amt : -amt;
    const { error } = await supabase.rpc("admin_adjust_balance", {
      _target: target.id, _asset: asset, _delta: delta, _reason: reason || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${mode === "credit" ? "Credited" : "Debited"} ${amt} ${asset}`);
    setAmount(""); setReason("");
    qc.invalidateQueries({ queryKey: ["admin-target-bal"] });
    qc.invalidateQueries({ queryKey: ["admin-target-adj"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">User Balances</h1>
        <p className="text-muted-foreground">Search users and credit or debit their USD or crypto balance.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-card border-border/60 lg:col-span-1">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name…" className="pl-9" />
            </div>
            <div className="space-y-1 max-h-[480px] overflow-y-auto">
              {users.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setTarget(u)}
                  className={`w-full text-left p-2 rounded-md hover:bg-background/40 transition ${target?.id === u.id ? "bg-primary/10 border border-primary/30" : "border border-transparent"}`}
                >
                  <div className="text-sm font-medium truncate">{u.full_name || u.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </button>
              ))}
              {users.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center">No users.</div>}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {!target ? (
            <Card className="bg-gradient-card border-border/60">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Wallet className="h-10 w-10 mx-auto mb-2 opacity-40" />
                Select a user to view and adjust their balances.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="bg-gradient-card border-border/60">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <div className="font-semibold">{target.full_name || target.email}</div>
                    <div className="text-xs text-muted-foreground">{target.email}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase mb-2">Current balances</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {balances.length === 0 && <div className="text-sm text-muted-foreground col-span-3">No balances yet.</div>}
                      {balances.map((b) => (
                        <div key={b.asset} className="rounded-md border border-border/60 bg-background/40 p-2">
                          <div className="text-xs text-muted-foreground">{b.asset}</div>
                          <div className="text-sm font-semibold">{b.available.toFixed(b.asset === "USD" ? 2 : 8)}</div>
                          {b.staked != null && b.staked > 0 && (
                            <div className="text-[10px] text-muted-foreground">staked {b.staked.toFixed(8)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border/60 pt-4 space-y-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant={mode === "credit" ? "default" : "outline"} onClick={() => setMode("credit")} className={mode === "credit" ? "bg-success text-success-foreground hover:bg-success/90" : ""}>
                        <Plus className="h-4 w-4 mr-1" />Credit
                      </Button>
                      <Button size="sm" variant={mode === "debit" ? "default" : "outline"} onClick={() => setMode("debit")} className={mode === "debit" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
                        <Minus className="h-4 w-4 mr-1" />Debit
                      </Button>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Asset</Label>
                        <Input value={asset} onChange={(e) => setAsset(e.target.value.toUpperCase())} placeholder="USD, BTC, ETH…" />
                      </div>
                      <div className="space-y-1">
                        <Label>Amount</Label>
                        <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="space-y-1 sm:col-span-1">
                        <Label>&nbsp;</Label>
                        <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary">Apply</Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Reason (audit log)</Label>
                      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., manual deposit credit" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-border/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground uppercase mb-3">Adjustment history</div>
                  {history.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">No adjustments yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((h: any) => (
                        <div key={h.id} className="flex items-center justify-between p-2 rounded-md border border-border/60 bg-background/40 text-sm">
                          <div>
                            <div className="font-medium">
                              {Number(h.delta) > 0 ? "+" : ""}{Number(h.delta).toFixed(h.asset === "USD" ? 2 : 8)} {h.asset}
                            </div>
                            <div className="text-xs text-muted-foreground">{h.reason || "—"}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">{format(new Date(h.created_at), "MMM d, p")}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
