import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function AdminDeposits() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-deposits"],
    queryFn: async () => {
      const { data: deposits } = await supabase.from("deposits").select("*").order("created_at", { ascending: false });
      if (!deposits?.length) return [];
      const userIds = [...new Set(deposits.map((d) => d.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id,email,full_name").in("id", userIds);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return deposits.map((d) => ({ ...d, profiles: map.get(d.user_id) }));
    },
  });

  async function update(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("deposits").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Deposit ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-deposits"] });
  }

  const filtered = rows.filter((r: any) => {
    const s = q.toLowerCase();
    return !s || r.coin.toLowerCase().includes(s) || r.profiles?.email?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Deposits</h1>
          <p className="text-muted-foreground">Review and approve user deposits.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coin or email..." className="pl-9" />
        </div>
      </div>
      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-right p-3">USD requested</th>
                <th className="text-left p-3">Pay with</th>
                <th className="text-right p-3">Crypto amount</th>
                <th className="text-right p-3">Rate</th>
                <th className="text-right p-3">USD credited</th>
                <th className="text-left p-3">Tx Hash</th>
                <th className="text-right p-3">Status</th>
                <th className="text-right p-3">Date</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => {
                const payCoin = d.pay_coin ?? d.coin;
                const payAmount = d.pay_amount ?? d.amount;
                const usdReq = d.usd_amount;
                const usdCred = d.usd_credited;
                return (
                  <tr key={d.id} className="border-b border-border/40 last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{d.profiles?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{d.profiles?.email}</div>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {usdReq != null ? `$${Number(usdReq).toFixed(2)}` : "—"}
                    </td>
                    <td className="p-3">{payCoin}</td>
                    <td className="p-3 text-right">{Number(payAmount).toFixed(6)}</td>
                    <td className="p-3 text-right text-xs text-muted-foreground">
                      {d.rate_used ? `$${Number(d.rate_used).toLocaleString()}` : "—"}
                    </td>
                    <td className="p-3 text-right text-emerald-500 font-medium">
                      {usdCred != null ? `$${Number(usdCred).toFixed(2)}` : "—"}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground truncate max-w-[120px]">{d.tx_hash || "—"}</td>
                    <td className="p-3 text-right"><StatusBadge status={d.status} /></td>
                    <td className="p-3 text-right text-muted-foreground">{format(new Date(d.created_at), "MMM d")}</td>
                    <td className="p-3 text-right">
                      {d.status === "pending" && (
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" onClick={() => update(d.id, "approved")} className="bg-success text-success-foreground hover:bg-success/90">Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => update(d.id, "rejected")}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={11} className="p-12 text-center text-muted-foreground">No deposits.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
