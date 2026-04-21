import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const KEYS = [
  { key: "platform_name", label: "Platform name", type: "text" },
  { key: "support_email", label: "Support email", type: "text" },
  { key: "withdrawal_fee_pct", label: "Withdrawal fee (%)", type: "number" },
  { key: "min_withdrawal", label: "Minimum withdrawal", type: "number" },
];

export default function AdminSettings() {
  const [vals, setVals] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("system_settings").select("*").then(({ data }) => {
      const m: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { m[r.key] = typeof r.value === "string" ? r.value : JSON.stringify(r.value).replace(/^"|"$/g, ""); });
      setVals(m);
    });
  }, []);

  async function save() {
    setBusy(true);
    for (const k of KEYS) {
      const raw = vals[k.key];
      const val = k.type === "number" ? Number(raw) : raw;
      await supabase.from("system_settings").upsert({ key: k.key, value: val, updated_at: new Date().toISOString() });
    }
    setBusy(false);
    toast.success("Settings saved");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Platform-wide configuration.</p>
      </div>
      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {KEYS.map((k) => (
            <div key={k.key} className="space-y-2">
              <Label>{k.label}</Label>
              <Input type={k.type} value={vals[k.key] ?? ""} onChange={(e) => setVals({ ...vals, [k.key]: e.target.value })} />
            </div>
          ))}
          <Button onClick={save} disabled={busy} className="bg-gradient-primary">Save settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
