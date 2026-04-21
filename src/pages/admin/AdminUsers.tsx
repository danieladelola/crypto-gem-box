import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const TITLES: Record<string, string> = {
  active: "Active Users", banned: "Banned Users", "email-unverified": "Email Unverified",
  "kyc-pending": "KYC Pending", "with-balance": "Users With Balance", all: "All Users",
};

export default function AdminUsers() {
  const { filter = "all" } = useParams();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-users", filter],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (filter === "active") query = query.eq("banned", false);
      if (filter === "banned") query = query.eq("banned", true);
      if (filter === "email-unverified") query = query.eq("email_verified", false);
      if (filter === "kyc-pending") query = query.eq("kyc_status", "pending");
      const { data } = await query;
      let result = data ?? [];
      if (filter === "with-balance") {
        const { data: bals } = await supabase.from("wallet_balances").select("user_id,available,staked").or("available.gt.0,staked.gt.0");
        const ids = new Set((bals ?? []).map((b: any) => b.user_id));
        result = result.filter((r: any) => ids.has(r.id));
      }
      return result;
    },
  });

  async function toggleBan(id: string, banned: boolean) {
    const { error } = await supabase.from("profiles").update({ banned: !banned }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(banned ? "User unbanned" : "User banned");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  const filtered = rows.filter((r: any) => {
    const s = q.toLowerCase();
    return !s || r.email?.toLowerCase().includes(s) || r.full_name?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{TITLES[filter] ?? "Users"}</h1>
          <p className="text-muted-foreground">{filtered.length} user{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name..." className="pl-9" />
        </div>
      </div>
      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">User</th><th className="text-left p-3">Phone</th>
                <th className="text-right p-3">KYC</th><th className="text-right p-3">Status</th>
                <th className="text-right p-3">Joined</th><th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => (
                <tr key={u.id} className="border-b border-border/40 last:border-0">
                  <td className="p-3"><div className="font-medium">{u.full_name || "—"}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                  <td className="p-3 text-muted-foreground">{u.phone || "—"}</td>
                  <td className="p-3 text-right"><StatusBadge status={u.kyc_status} /></td>
                  <td className="p-3 text-right">{u.banned ? <StatusBadge status="rejected" /> : <StatusBadge status="active" />}</td>
                  <td className="p-3 text-right text-muted-foreground">{format(new Date(u.created_at), "MMM d, yyyy")}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant={u.banned ? "outline" : "destructive"} onClick={() => toggleBan(u.id, u.banned)}>
                      {u.banned ? "Unban" : "Ban"}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No users.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
