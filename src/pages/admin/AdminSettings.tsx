import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings as SettingsIcon, Wallet, Loader2 } from "lucide-react";
import { PAYMENT_COINS } from "@/lib/paymentCoins";
import { useDepositAddresses, DepositAddressMap } from "@/hooks/useDepositAddresses";

const PLATFORM_KEYS = [
  { key: "platform_name", label: "Platform name", type: "text" },
  { key: "support_email", label: "Support email", type: "text" },
  { key: "withdrawal_fee_pct", label: "Withdrawal fee (%)", type: "number" },
  { key: "min_withdrawal", label: "Minimum withdrawal", type: "number" },
];

export default function AdminSettings() {
  const qc = useQueryClient();
  const [vals, setVals] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  const { data: addrs } = useDepositAddresses();
  const [addrForm, setAddrForm] = useState<DepositAddressMap | null>(null);
  const [savingAddrs, setSavingAddrs] = useState(false);

  useEffect(() => {
    if (addrs && !addrForm) setAddrForm(addrs);
  }, [addrs, addrForm]);

  useEffect(() => {
    supabase.from("system_settings").select("*").then(({ data }) => {
      const m: Record<string, any> = {};
      (data ?? []).forEach((r: any) => {
        if (PLATFORM_KEYS.find((k) => k.key === r.key)) {
          m[r.key] = typeof r.value === "string" ? r.value : JSON.stringify(r.value).replace(/^"|"$/g, "");
        }
      });
      setVals(m);
    });
  }, []);

  async function savePlatform() {
    setBusy(true);
    for (const k of PLATFORM_KEYS) {
      const raw = vals[k.key];
      const val = k.type === "number" ? Number(raw) : raw;
      await supabase.from("system_settings").upsert({ key: k.key, value: val, updated_at: new Date().toISOString() });
    }
    setBusy(false);
    toast.success("Platform settings saved");
  }

  async function saveAddresses() {
    if (!addrForm) return;
    setSavingAddrs(true);
    const { error } = await supabase.from("system_settings").upsert({
      key: "deposit_addresses",
      value: addrForm as any,
      updated_at: new Date().toISOString(),
    });
    setSavingAddrs(false);
    if (error) return toast.error(error.message);
    toast.success("Deposit addresses updated");
    qc.invalidateQueries({ queryKey: ["deposit-addresses"] });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground text-sm">Platform-wide configuration and payment infrastructure.</p>
      </div>

      <Tabs defaultValue="platform">
        <TabsList>
          <TabsTrigger value="platform" className="gap-2"><SettingsIcon className="h-4 w-4" />Platform</TabsTrigger>
          <TabsTrigger value="deposit-addresses" className="gap-2"><Wallet className="h-4 w-4" />Deposit Addresses</TabsTrigger>
        </TabsList>

        <TabsContent value="platform" className="mt-6">
          <Card className="bg-gradient-card border-border/60">
            <CardHeader>
              <CardTitle>General configuration</CardTitle>
              <CardDescription>Branding, fees and basic limits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {PLATFORM_KEYS.map((k) => (
                <div key={k.key} className="space-y-2">
                  <Label>{k.label}</Label>
                  <Input type={k.type} value={vals[k.key] ?? ""} onChange={(e) => setVals({ ...vals, [k.key]: e.target.value })} />
                </div>
              ))}
              <Button onClick={savePlatform} disabled={busy} className="bg-gradient-primary">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposit-addresses" className="mt-6">
          <Card className="bg-gradient-card border-border/60">
            <CardHeader>
              <CardTitle>Deposit Address Management</CardTitle>
              <CardDescription>
                Wallet addresses shown to users on the Deposit page for each supported payment coin.
                Updates take effect immediately for new deposits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!addrForm ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
              ) : (
                <div className="space-y-4">
                  {PAYMENT_COINS.map((c) => {
                    const entry = addrForm[c.symbol] ?? { address: "", enabled: true, network: c.defaultNetwork };
                    return (
                      <div key={c.symbol} className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold">{c.symbol} <span className="text-xs text-muted-foreground font-normal">— {c.name}</span></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={entry.enabled}
                              onCheckedChange={(v) => setAddrForm({ ...addrForm, [c.symbol]: { ...entry, enabled: v } })}
                            />
                            <span className="text-xs text-muted-foreground">{entry.enabled ? "Enabled" : "Disabled"}</span>
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-[1fr_180px] gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Wallet address</Label>
                            <Input
                              value={entry.address}
                              onChange={(e) => setAddrForm({ ...addrForm, [c.symbol]: { ...entry, address: e.target.value } })}
                              placeholder={`${c.symbol} deposit address`}
                              className="font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Network</Label>
                            <Input
                              value={entry.network}
                              onChange={(e) => setAddrForm({ ...addrForm, [c.symbol]: { ...entry, network: e.target.value } })}
                              placeholder={c.defaultNetwork}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <Button onClick={saveAddresses} disabled={savingAddrs} className="bg-gradient-primary mt-4">
                    {savingAddrs && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save deposit addresses
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
