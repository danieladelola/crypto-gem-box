import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoinList } from "@/hooks/useCoinList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Pencil, Trash2, Search, Coins, ChevronsUpDown, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Plan {
  id: string;
  name: string;
  coin: string;
  is_usd: boolean;
  apy: number;
  lock_days: number;
  min_amount: number;
  max_amount: number | null;
  fixed_amount: number | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const DURATION_PRESETS = [7, 14, 30, 60, 90, 180, 365];

const emptyForm = {
  name: "",
  is_usd: false,
  coin: "BTC",
  apy: "",
  lock_days: "30",
  min_amount: "",
  max_amount: "",
  fixed_amount: "",
  description: "",
  active: true,
};

export default function AdminStakingPlans() {
  const qc = useQueryClient();
  const { data: coins = [] } = useCoinList();
  const [search, setSearch] = useState("");
  const [filterCoin, setFilterCoin] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["admin-staking-plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("staking_plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const filtered = plans.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.coin.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCoin !== "all" && p.coin !== filterCoin) return false;
    if (filterStatus === "active" && !p.active) return false;
    if (filterStatus === "inactive" && p.active) return false;
    return true;
  });

  const stats = {
    total: plans.length,
    active: plans.filter((p) => p.active).length,
    inactive: plans.filter((p) => !p.active).length,
    avgApy: plans.length ? (plans.reduce((s, p) => s + Number(p.apy), 0) / plans.length).toFixed(1) : "0",
  };

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(p: Plan) {
    setEditing(p);
    setForm({
      name: p.name,
      is_usd: p.is_usd,
      coin: p.coin,
      apy: String(p.apy),
      lock_days: String(p.lock_days),
      min_amount: String(p.min_amount),
      max_amount: p.max_amount != null ? String(p.max_amount) : "",
      fixed_amount: p.fixed_amount != null ? String(p.fixed_amount) : "",
      description: p.description ?? "",
      active: p.active,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Plan name is required");
    if (!form.is_usd && !form.coin) return toast.error("Choose a crypto type");
    const apy = parseFloat(form.apy);
    const lock = parseInt(form.lock_days, 10);
    const min = parseFloat(form.min_amount);
    const max = form.max_amount ? parseFloat(form.max_amount) : null;
    const fixed = form.fixed_amount ? parseFloat(form.fixed_amount) : null;
    if (!apy || apy <= 0) return toast.error("ROI / APY must be greater than 0");
    if (!lock || lock <= 0) return toast.error("Duration must be greater than 0");
    if (!min || min <= 0) return toast.error("Minimum amount must be greater than 0");
    if (max !== null && max < min) return toast.error("Maximum cannot be less than minimum");
    if (fixed !== null && (fixed < min || (max !== null && fixed > max))) {
      return toast.error("Fixed amount must be within min/max range");
    }

    setBusy(true);
    const payload = {
      name: form.name.trim(),
      coin: form.is_usd ? "USD" : form.coin.toUpperCase(),
      is_usd: form.is_usd,
      apy, lock_days: lock,
      min_amount: min,
      max_amount: max,
      fixed_amount: fixed,
      description: form.description.trim() || null,
      active: form.active,
    };
    const { error } = editing
      ? await supabase.from("staking_plans").update(payload).eq("id", editing.id)
      : await supabase.from("staking_plans").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Plan updated" : "Plan created");
    setDialogOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-staking-plans"] });
    qc.invalidateQueries({ queryKey: ["staking-plans"] });
  }

  async function toggleActive(p: Plan) {
    const { error } = await supabase.from("staking_plans").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`Plan ${!p.active ? "activated" : "deactivated"}`);
    qc.invalidateQueries({ queryKey: ["admin-staking-plans"] });
    qc.invalidateQueries({ queryKey: ["staking-plans"] });
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("staking_plans").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) return toast.error(error.message);
    toast.success("Plan deleted");
    qc.invalidateQueries({ queryKey: ["admin-staking-plans"] });
    qc.invalidateQueries({ queryKey: ["staking-plans"] });
  }

  const uniqueCoins = Array.from(new Set(plans.map((p) => p.coin)));

  return (
    <div className="space-y-6">
      <div className="flex items-start md:items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Staking Plans</h1>
          <p className="text-muted-foreground text-sm">Create and manage staking products available to users.</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-primary">
          <Plus className="h-4 w-4 mr-2" /> Add Staking Plan
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total plans" value={stats.total} />
        <StatCard label="Active" value={stats.active} accent="success" />
        <StatCard label="Inactive" value={stats.inactive} accent="muted" />
        <StatCard label="Avg ROI" value={`${stats.avgApy}%`} accent="primary" />
      </div>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /> All staking plans</CardTitle>
          <div className="grid sm:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or coin…" className="pl-9" />
            </div>
            <Select value={filterCoin} onValueChange={setFilterCoin}>
              <SelectTrigger><SelectValue placeholder="All coins" /></SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All coins</SelectItem>
                {uniqueCoins.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Crypto</TableHead>
                  <TableHead className="hidden md:table-cell">Min</TableHead>
                  <TableHead className="hidden md:table-cell">Max</TableHead>
                  <TableHead className="hidden lg:table-cell">Fixed</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>ROI</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No plans match your filters.</TableCell></TableRow>
                ) : filtered.map((p) => {
                  const unit = p.is_usd ? "USD" : p.coin;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.description && <div className="text-xs text-muted-foreground line-clamp-1 max-w-[240px]">{p.description}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.is_usd ? "USD" : p.coin}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">{Number(p.min_amount).toLocaleString()} {unit}</TableCell>
                      <TableCell className="hidden md:table-cell">{p.max_amount != null ? `${Number(p.max_amount).toLocaleString()} ${unit}` : "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">{p.fixed_amount != null ? `${Number(p.fixed_amount).toLocaleString()} ${unit}` : "—"}</TableCell>
                      <TableCell>{p.lock_days}d</TableCell>
                      <TableCell className="font-semibold text-emerald-500">{p.apy}%</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} />
                          <span className="text-xs text-muted-foreground">{p.active ? "Active" : "Inactive"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit staking plan" : "Add staking plan"}</DialogTitle>
            <DialogDescription>
              Plans appear on the user staking page only when active.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. BTC 30-day Saver" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stake type</Label>
                <div className="flex items-center gap-3 h-10 px-3 rounded-md border border-input">
                  <Switch checked={form.is_usd} onCheckedChange={(v) => setForm({ ...form, is_usd: v })} />
                  <span className="text-sm">{form.is_usd ? "USD stake" : "Crypto stake"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Crypto type {form.is_usd && <span className="text-muted-foreground text-xs">(USD selected)</span>}</Label>
                {form.is_usd ? (
                  <Input value="USD" disabled />
                ) : (
                  <CoinPicker
                    value={form.coin}
                    onChange={(symbol) => setForm({ ...form, coin: symbol })}
                    coins={coins}
                  />
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum amount *</Label>
                <Input type="number" step="any" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Maximum amount</Label>
                <Input type="number" step="any" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} placeholder="leave blank for unlimited" />
              </div>
              <div className="space-y-2">
                <Label>Fixed amount <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="number" step="any" value={form.fixed_amount} onChange={(e) => setForm({ ...form, fixed_amount: e.target.value })} placeholder="single allowed stake size" />
              </div>
              <div className="space-y-2">
                <Label>Duration (days) *</Label>
                <Select value={form.lock_days} onValueChange={(v) => setForm({ ...form, lock_days: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[60]">
                    {DURATION_PRESETS.map((d) => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {!DURATION_PRESETS.includes(parseInt(form.lock_days, 10)) && (
                  <Input type="number" min={1} value={form.lock_days} onChange={(e) => setForm({ ...form, lock_days: e.target.value })} placeholder="custom days" />
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>ROI / APY (%) *</Label>
                <Input type="number" step="any" value={form.apy} onChange={(e) => setForm({ ...form, apy: e.target.value })} placeholder="e.g. 8.5" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short note shown to users…" />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div>
                <div className="font-medium text-sm">Active</div>
                <div className="text-xs text-muted-foreground">Inactive plans are hidden from users.</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy} className="bg-gradient-primary">
              {busy ? "Saving…" : editing ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete staking plan?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Existing user stakes are not affected, but the plan will no longer be available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: any; accent?: "success" | "muted" | "primary" }) {
  const tone = accent === "success" ? "text-emerald-500" : accent === "primary" ? "text-primary" : accent === "muted" ? "text-muted-foreground" : "";
  return (
    <Card className="bg-gradient-card border-border/60">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("text-xl md:text-2xl font-semibold mt-1", tone)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function CoinPicker({ value, onChange, coins }: { value: string; onChange: (s: string) => void; coins: any[] }) {
  const [open, setOpen] = useState(false);
  const selected = coins.find((c) => c.symbol === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between h-10">
          {selected ? (
            <span className="flex items-center gap-2 min-w-0">
              {selected.image && <img src={selected.image} alt={selected.symbol} className="h-5 w-5 rounded-full" />}
              <span className="font-medium">{selected.symbol}</span>
              <span className="text-xs text-muted-foreground truncate">{selected.name}</span>
            </span>
          ) : <span className="text-muted-foreground">Select crypto…</span>}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[60]" align="start">
        <Command>
          <CommandInput placeholder="Search coin…" />
          <CommandList className="max-h-[50vh]">
            <CommandEmpty>No coin found.</CommandEmpty>
            <CommandGroup>
              {coins.slice(0, 250).map((c) => (
                <CommandItem key={c.symbol} value={`${c.symbol} ${c.name}`}
                  onSelect={() => { onChange(c.symbol); setOpen(false); }}>
                  {c.image && <img src={c.image} alt={c.symbol} className="h-5 w-5 rounded-full mr-2" />}
                  <span className="font-medium mr-2">{c.symbol}</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">{c.name}</span>
                  <Check className={cn("ml-2 h-4 w-4", value === c.symbol ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
