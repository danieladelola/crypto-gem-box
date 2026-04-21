import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowDownToLine, ArrowUpFromLine, Coins, Wallet, Activity } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, pendingW, deps, wds, stakes, profiles, recentTx, recentUsers] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("deposits").select("amount,status"),
        supabase.from("withdrawals").select("amount,status"),
        supabase.from("user_stakes").select("amount").eq("status", "active"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("banned", false),
        supabase.from("transaction_history").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      const totalDep = (deps.data ?? []).filter((d) => d.status === "approved").reduce((s, d) => s + Number(d.amount), 0);
      const totalWd = (wds.data ?? []).filter((d) => d.status === "approved").reduce((s, d) => s + Number(d.amount), 0);
      const totalStaked = (stakes.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
      return {
        users: users.count ?? 0,
        active: profiles.count ?? 0,
        pendingW: pendingW.count ?? 0,
        totalDep, totalWd, totalStaked,
        recentTx: recentTx.data ?? [],
        recentUsers: recentUsers.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Admin overview</h1>
        <p className="text-muted-foreground">Platform-wide stats and recent activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats?.users ?? "—"} icon={Users} />
        <StatCard label="Active Users" value={stats?.active ?? "—"} icon={Activity} />
        <StatCard label="Pending Withdrawals" value={stats?.pendingW ?? "—"} icon={ArrowUpFromLine} />
        <StatCard label="Total Staked" value={(stats?.totalStaked ?? 0).toFixed(4)} icon={Coins} />
        <StatCard label="Total Deposits" value={(stats?.totalDep ?? 0).toFixed(4)} icon={ArrowDownToLine} />
        <StatCard label="Total Withdrawals" value={(stats?.totalWd ?? 0).toFixed(4)} icon={ArrowUpFromLine} />
        <StatCard label="Platform Balance" value={((stats?.totalDep ?? 0) - (stats?.totalWd ?? 0)).toFixed(4)} icon={Wallet} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle>Recent transactions</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats?.recentTx ?? []).map((t: any) => (
                <div key={t.id} className="flex justify-between p-2 border-b border-border/40 text-sm">
                  <div><span className="capitalize">{t.type.replace("_", " ")}</span> • {t.coin}</div>
                  <div className="flex items-center gap-2">
                    <span>{Number(t.amount).toFixed(4)}</span>
                    <StatusBadge status={t.status ?? "completed"} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle>Recent signups</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats?.recentUsers ?? []).map((u: any) => (
                <div key={u.id} className="flex justify-between p-2 border-b border-border/40 text-sm">
                  <div>
                    <div className="font-medium">{u.full_name || u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{format(new Date(u.created_at), "MMM d")}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
