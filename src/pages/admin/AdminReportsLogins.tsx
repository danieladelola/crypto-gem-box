import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays, isAfter, startOfWeek, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, LogIn, Search } from "lucide-react";

interface LoginRow {
  id: string;
  user_id: string;
  ip: string | null;
  user_agent: string | null;
  at: string;
  email?: string;
}

const PAGE_SIZE = 25;

export default function AdminReportsLogins() {
  const [search, setSearch] = useState("");
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-logins", days],
    queryFn: async (): Promise<LoginRow[]> => {
      const since = days === "all" ? null : subDays(new Date(), parseInt(days, 10)).toISOString();
      let q = supabase.from("login_history").select("*").order("at", { ascending: false }).limit(1000);
      if (since) q = q.gte("at", since);
      const { data: logs } = await q;
      const userIds = Array.from(new Set((logs ?? []).map((l: any) => l.user_id)));
      let emails: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,email").in("id", userIds);
        (profs ?? []).forEach((p: any) => { emails[p.id] = p.email; });
      }
      return (logs ?? []).map((l: any) => ({ ...l, email: emails[l.user_id] }));
    },
  });

  const filtered = useMemo(() => rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.email ?? "").toLowerCase().includes(s) || r.user_id.includes(s) || (r.ip ?? "").includes(s);
  }), [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const weekStart = startOfWeek(new Date());
    return {
      total: filtered.length,
      uniqueUsers: new Set(filtered.map((r) => r.user_id)).size,
      today: filtered.filter((r) => isAfter(new Date(r.at), todayStart)).length,
      week: filtered.filter((r) => isAfter(new Date(r.at), weekStart)).length,
    };
  }, [filtered]);

  function deviceLabel(ua?: string | null) {
    if (!ua) return "Unknown";
    if (/iPhone|iPad/.test(ua)) return "iOS";
    if (/Android/.test(ua)) return "Android";
    if (/Mac OS X/.test(ua)) return "macOS";
    if (/Windows/.test(ua)) return "Windows";
    if (/Linux/.test(ua)) return "Linux";
    return "Other";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><LogIn className="h-6 w-6 text-primary" /> Logins Report</h1>
        <p className="text-muted-foreground text-sm">Monitor user account access activity.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total logins" value={stats.total} />
        <Stat label="Unique users" value={stats.uniqueUsers} />
        <Stat label="Today" value={stats.today} />
        <Stat label="This week" value={stats.week} />
      </div>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader className="space-y-3">
          <CardTitle>Login history</CardTitle>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by email, user, or IP…" className="pl-9" />
            </div>
            <Select value={days} onValueChange={(v) => { setDays(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">IP</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No logins recorded.</TableCell></TableRow>
                ) : pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{format(new Date(r.at), "MMM d, yyyy p")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="hidden md:table-cell text-sm truncate max-w-[220px]">{r.email ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{r.ip ?? "—"}</TableCell>
                    <TableCell className="text-xs">{deviceLabel(r.user_agent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages} • {filtered.length} records</span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <Card className="bg-gradient-card border-border/60">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl md:text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
