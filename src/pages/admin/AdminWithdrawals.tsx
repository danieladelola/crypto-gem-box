import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminWithdrawals() {
  const { status } = useParams();
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-wd", status],
    queryFn: async () => {
      let q = supabase.from("withdrawals").select("*").order("created_at", { ascending: false });
      if (status && status !== "all") q = q.eq("status", status as "pending" | "approved" | "rejected");
      const { data: withdrawals } = await q;
      if (!withdrawals?.length) return [];
      const userIds = [...new Set(withdrawals.map((w) => w.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id,email,full_name").in("id", userIds);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return withdrawals.map((w) => ({ ...w, profiles: map.get(w.user_id) }));
    },
  });

  async function update(id: string, newStatus: "approved" | "rejected") {
    const { error } = await supabase.from("withdrawals").update({ status: newStatus }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Withdrawal ${newStatus}`);
    qc.invalidateQueries({ queryKey: ["admin-wd"] });
  }

  const titleMap: Record<string, string> = { pending: "Pending Withdrawals", approved: "Approved Withdrawals", rejected: "Rejected Withdrawals", all: "All Withdrawals" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{titleMap[status ?? "all"]}</h1>
        <p className="text-muted-foreground">Review and process withdrawal requests.</p>
      </div>
      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-right p-3">USD requested</th>
                <th className="text-right p-3">Payout</th>
                <th className="text-left p-3">Address</th>
                <th className="text-right p-3">Status</th>
                <th className="text-right p-3">Date</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w: any) => {
                const usdShown = w.usd_amount;
                const payoutShown = w.payout_amount ?? w.amount;
                const payoutCoinShown = w.payout_coin ?? w.coin;
                return (
                  <tr key={w.id} className="border-b border-border/40 last:border-0">
                    <td className="p-3"><div className="font-medium">{w.profiles?.full_name || "—"}</div><div className="text-xs text-muted-foreground">{w.profiles?.email}</div></td>
                    <td className="p-3 text-right font-medium">{usdShown != null ? `$${Number(usdShown).toFixed(2)}` : "—"}</td>
                    <td className="p-3 text-right">{Number(payoutShown).toFixed(6)} {payoutCoinShown}</td>
                    <td className="p-3 text-xs text-muted-foreground truncate max-w-[160px]">{w.address}</td>
                    <td className="p-3 text-right"><StatusBadge status={w.status} /></td>
                    <td className="p-3 text-right text-muted-foreground">{format(new Date(w.created_at), "MMM d")}</td>
                    <td className="p-3 text-right">
                      {w.status === "pending" && (
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" onClick={() => update(w.id, "approved")} className="bg-success text-success-foreground hover:bg-success/90">Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => update(w.id, "rejected")}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">No records.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
