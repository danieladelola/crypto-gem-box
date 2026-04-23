import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Bell, Search } from "lucide-react";

interface NotifRow {
  id: string;
  user_id: string | null;
  title: string;
  body: string | null;
  broadcast: boolean;
  read: boolean;
  created_at: string;
  recipient_email?: string;
}

const PAGE_SIZE = 25;

export default function AdminReportsNotifications() {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all"); // all | broadcast | targeted
  const [readState, setReadState] = useState("all"); // all | read | unread
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-notifications", days],
    queryFn: async (): Promise<NotifRow[]> => {
      const since = days === "all" ? null : subDays(new Date(), parseInt(days, 10)).toISOString();
      let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(1000);
      if (since) q = q.gte("created_at", since);
      const { data: notifs } = await q;
      const userIds = Array.from(new Set((notifs ?? []).map((n: any) => n.user_id).filter(Boolean)));
      const emails: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,email").in("id", userIds);
        (profs ?? []).forEach((p: any) => { emails[p.id] = p.email; });
      }
      return (notifs ?? []).map((n: any) => ({ ...n, recipient_email: n.user_id ? emails[n.user_id] : undefined }));
    },
  });

  const filtered = useMemo(() => rows.filter((r) => {
    if (scope === "broadcast" && !r.broadcast) return false;
    if (scope === "targeted" && r.broadcast) return false;
    if (readState === "read" && !r.read) return false;
    if (readState === "unread" && r.read) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(r.title.toLowerCase().includes(s) || (r.body ?? "").toLowerCase().includes(s) || (r.recipient_email ?? "").toLowerCase().includes(s))) return false;
    }
    return true;
  }), [rows, scope, readState, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: filtered.length,
    broadcast: filtered.filter((r) => r.broadcast).length,
    targeted: filtered.filter((r) => !r.broadcast).length,
    unread: filtered.filter((r) => !r.read).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Bell className="h-6 w-6 text-primary" /> Notifications Report</h1>
        <p className="text-muted-foreground text-sm">Review every notification dispatched by the system.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={stats.total} />
        <Stat label="Broadcast" value={stats.broadcast} />
        <Stat label="Targeted" value={stats.targeted} />
        <Stat label="Unread" value={stats.unread} />
      </div>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader className="space-y-3">
          <CardTitle>Notification history</CardTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search title, body, recipient…" className="pl-9" />
            </div>
            <Select value={scope} onValueChange={(v) => { setScope(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All scopes</SelectItem>
                <SelectItem value="broadcast">Broadcast only</SelectItem>
                <SelectItem value="targeted">Targeted only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={readState} onValueChange={(v) => { setReadState(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
              </SelectContent>
            </Select>
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
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Body</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Read</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No notifications match.</TableCell></TableRow>
                ) : pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{format(new Date(r.created_at), "MMM d, p")}</TableCell>
                    <TableCell className="font-medium text-sm">{r.title}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground line-clamp-2 max-w-[320px]">{r.body ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.broadcast ? <Badge variant="outline">All users</Badge> : (r.recipient_email ?? r.user_id?.slice(0, 8) + "…")}</TableCell>
                    <TableCell><Badge variant={r.broadcast ? "default" : "outline"}>{r.broadcast ? "Broadcast" : "Targeted"}</Badge></TableCell>
                    <TableCell><Badge variant={r.read ? "outline" : "default"}>{r.read ? "Read" : "Unread"}</Badge></TableCell>
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
