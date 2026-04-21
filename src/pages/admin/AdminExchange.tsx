import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCoinList } from "@/hooks/useCoinList";
import { format } from "date-fns";

interface ExchangeCfg {
  enabled: boolean;
  fee_pct: number;
  min_usd: number;
  max_usd: number;
}
interface DepositCfg {
  enabled: boolean;
  fee_pct: number;
  min_usd: number;
  max_usd: number;
}

const DEFAULT_CFG: ExchangeCfg = { enabled: true, fee_pct: 0.5, min_usd: 1, max_usd: 100000 };
const DEFAULT_DEP: DepositCfg = { enabled: true, fee_pct: 0, min_usd: 10, max_usd: 100000 };

export default function AdminExchange() {
  const [cfg, setCfg] = useState<ExchangeCfg>(DEFAULT_CFG);
  const [dep, setDep] = useState<DepositCfg>(DEFAULT_DEP);
  const [busy, setBusy] = useState(false);
  const [busyDep, setBusyDep] = useState(false);
  const [disabledSyms, setDisabledSyms] = useState<Set<string>>(new Set());
  const [txs, setTxs] = useState<any[]>([]);
  const { data: coins = [] } = useCoinList();

  async function load() {
    const [cfgRes, depRes, assetsRes, txRes] = await Promise.all([
      supabase.from("system_settings").select("value").eq("key", "exchange").maybeSingle(),
      supabase.from("system_settings").select("value").eq("key", "deposit").maybeSingle(),
      supabase.from("market_assets").select("symbol,active"),
      supabase.from("exchange_transactions").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (cfgRes.data?.value) setCfg({ ...DEFAULT_CFG, ...(cfgRes.data.value as any) });
    if (depRes.data?.value) setDep({ ...DEFAULT_DEP, ...(depRes.data.value as any) });
    setDisabledSyms(new Set((assetsRes.data ?? []).filter((a: any) => !a.active).map((a: any) => a.symbol.toUpperCase())));
    setTxs(txRes.data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function saveCfg() {
    setBusy(true);
    const { error } = await supabase.from("system_settings").upsert({
      key: "exchange",
      value: cfg as any,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Exchange settings saved");
  }

  async function saveDep() {
    setBusyDep(true);
    const { error } = await supabase.from("system_settings").upsert({
      key: "deposit",
      value: dep as any,
      updated_at: new Date().toISOString(),
    });
    setBusyDep(false);
    if (error) return toast.error(error.message);
    toast.success("Deposit settings saved");
  }

  async function toggleCoin(symbol: string, currentlyDisabled: boolean) {
    const sym = symbol.toUpperCase();
    // does asset row exist?
    const { data: existing } = await supabase.from("market_assets").select("id,active").eq("symbol", sym).maybeSingle();
    if (existing) {
      await supabase.from("market_assets").update({ active: currentlyDisabled }).eq("id", existing.id);
    } else {
      const coin = coins.find((c) => c.symbol === sym);
      await supabase.from("market_assets").insert({
        symbol: sym,
        name: coin?.name ?? sym,
        coingecko_id: coin?.id ?? null,
        icon_url: coin?.image ?? null,
        active: currentlyDisabled,
      });
    }
    const next = new Set(disabledSyms);
    if (currentlyDisabled) next.delete(sym); else next.add(sym);
    setDisabledSyms(next);
    toast.success(`${sym} ${currentlyDisabled ? "enabled" : "disabled"}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Exchange Management</h1>
        <p className="text-muted-foreground">Control fees, limits and which coins are tradable.</p>
      </div>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
            <div>
              <div className="font-medium">Exchange enabled</div>
              <div className="text-sm text-muted-foreground">Disable to block all Buy / Sell / Swap actions.</div>
            </div>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fee percentage (%)</Label>
              <Input type="number" step="0.01" value={cfg.fee_pct} onChange={(e) => setCfg({ ...cfg, fee_pct: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Minimum trade (USD)</Label>
              <Input type="number" value={cfg.min_usd} onChange={(e) => setCfg({ ...cfg, min_usd: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Maximum trade (USD)</Label>
              <Input type="number" value={cfg.max_usd} onChange={(e) => setCfg({ ...cfg, max_usd: Number(e.target.value) })} />
            </div>
          </div>
          <Button onClick={saveCfg} disabled={busy} className="bg-gradient-primary">Save settings</Button>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader>
          <CardTitle>Deposit (USD funding) settings</CardTitle>
          <p className="text-sm text-muted-foreground">Users fund USD by paying with crypto. Control fees, limits, and availability here.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
            <div>
              <div className="font-medium">Deposits enabled</div>
              <div className="text-sm text-muted-foreground">Disable to stop users from creating new deposits.</div>
            </div>
            <Switch checked={dep.enabled} onCheckedChange={(v) => setDep({ ...dep, enabled: v })} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fee percentage (%)</Label>
              <Input type="number" step="0.01" value={dep.fee_pct} onChange={(e) => setDep({ ...dep, fee_pct: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Minimum deposit (USD)</Label>
              <Input type="number" value={dep.min_usd} onChange={(e) => setDep({ ...dep, min_usd: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Maximum deposit (USD)</Label>
              <Input type="number" value={dep.max_usd} onChange={(e) => setDep({ ...dep, max_usd: Number(e.target.value) })} />
            </div>
          </div>
          <Button onClick={saveDep} disabled={busyDep} className="bg-gradient-primary">Save deposit settings</Button>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader>
          <CardTitle>Coin availability</CardTitle>
          <p className="text-sm text-muted-foreground">Top 50 coins shown. Disable to block users from trading them.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {coins.slice(0, 50).map((c) => {
              const off = disabledSyms.has(c.symbol);
              return (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={c.image} alt={c.symbol} className="h-7 w-7 rounded-full" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{c.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.name}</div>
                    </div>
                  </div>
                  <Switch checked={!off} onCheckedChange={() => toggleCoin(c.symbol, off)} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>All exchange transactions</CardTitle></CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No exchanges yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="text-left py-2">User</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">From → To</th>
                    <th className="text-right py-2">Rate</th>
                    <th className="text-right py-2">Fee</th>
                    <th className="text-right py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3 text-xs text-muted-foreground font-mono">{t.user_id.slice(0, 8)}…</td>
                      <td className="py-3 capitalize"><Badge variant="outline">{t.kind}</Badge></td>
                      <td className="py-3">{Number(t.from_amount).toFixed(4)} {t.from_asset} → {Number(t.to_amount).toFixed(4)} {t.to_asset}</td>
                      <td className="py-3 text-right">{Number(t.rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                      <td className="py-3 text-right">{Number(t.fee_amount).toFixed(4)}</td>
                      <td className="py-3 text-right text-muted-foreground">{format(new Date(t.created_at), "MMM d, p")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
