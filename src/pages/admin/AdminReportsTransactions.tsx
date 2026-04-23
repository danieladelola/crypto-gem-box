import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, CartesianGrid } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";

interface TxRow {
  id: string;
  user_id: string;
  type: string;
  coin: string | null;
  amount: number | null;
  status: string | null;
  ref_id: string | null;
  description: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;

export default function AdminReportsTransactions() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-tx-history", days],
    queryFn: async (): Promise<TxRow[]> => {
      const since = days === "all" ? null : subDays(new Date(), parseInt(days, 10)).toISOString();
      let q = supabase.from("transaction_history").select("*").order("created_at", { ascending: false }).limit(1000);
      if (since) q = q.gte("created_at", since);
      const { data } = await q;
      return (data ?? []) as TxRow[];
    },
  });

  const filtered = useMemo(() => rows.filter((r) => {
    if (type !== "all" && r.type !== type) return false;
    if (status !== "all" && r.status !== status) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(r.user_id.includes(s) || (r.description ?? "").toLowerCase().includes(s) || (r.coin ?? "").toLowerCase().includes(s) || (r.ref_id ?? "").toLowerCase().includes(s))) return false;
    }
    return true;
  }), [rows, type, status, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const sum = (t: string) => filtered.filter((r) => r.type === t).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return {
      total: filtered.length,
      deposits: filtered.filter((r) => r.type === "deposit").length,
      withdrawals: filtered.filter((r) => r.type === "withdrawal").length,
      tradeVolume: sum("buy") + sum("sell") + sum("swap"),
      stakes: filtered.filter((r) => r.type.startsWith("stake")).length,
      volumeUsd: filtered.filter((r) => r.coin === "USD").reduce((s, r) => s + Number(r.amount ?? 0), 0),
    };
  }, [filtered]);

  const chartData = useMemo(() => {
    const byDay = new Map<string, { date: string; deposits: number; withdrawals: number; trades: number }>();
    const today = startOfDay(new Date());
    const span = days === "all" ? 30 : Math.min(parseInt(days, 10), 30);
    for (let i = span - 1; i >= 0; i--) {
      const d = format(subDays(today, i), "MMM d");
      byDay.set(d, { date: d, deposits: 0, withdrawals: 0, trades: 0 });
    }
    filtered.forEach((r) => {
      const k = format(startOfDay(new Date(r.created_at)), "MMM d");
      const slot = byDay.get(k);
      if (!slot) return;
      if (r.type === "deposit") slot.deposits += Number(r.amount ?? 0);
      else if (r.type === "withdrawal") slot.withdrawals += Number(r.amount ?? 0);
      else if (["buy", "sell", "swap"].includes(r.type)) slot.trades += Number(r.amount ?? 0);
    });
    return Array.from(byDay.values());
  }, [filtered, days]);

  const types = Array.from(new Set(rows.map((r) => r.type)));
  const statuses = Array.from(new Set(rows.map((r) => r.status).filter(Boolean) as string[]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Transactions Report</h1>
        <p className="text-muted-foreground text-sm">All deposits, withdrawals, exchange and staking activity.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total" value={stats.total} />
        <Stat label="Deposits" value={stats.deposits} />
        <Stat label="Withdrawals" value={stats.withdrawals} />
        <Stat label="Stake events" value={stats.stakes} />
        <Stat label="Trade volume" value={`$${stats.tradeVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat label="USD volume" value={`$${stats.volumeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
      </div>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>Volume by day</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="deposits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="withdrawals" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="trades" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader className="space-y-3">
          <CardTitle>Transactions</CardTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search user, coin, ref…" className="pl-9" />
            </div>
            <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All types</SelectItem>
                {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions match.</TableCell></TableRow>
                ) : pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{format(new Date(r.created_at), "MMM d, p")}</TableCell>
                    <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[120px]">{r.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-medium">{r.amount != null ? `${Number(r.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${r.coin ?? ""}` : "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground line-clamp-1 max-w-[260px]">{r.description}</TableCell>
                    <TableCell>{r.status ? <StatusBadge status={r.status} /> : "—"}</TableCell>
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
        <div className="text-lg md:text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
