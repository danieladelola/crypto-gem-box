import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBalances } from "@/hooks/useBalances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Coins, Lock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

export default function Stake() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: balances = [] } = useBalances();

  const { data: plans = [] } = useQuery({
    queryKey: ["staking-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("staking_plans").select("*").eq("active", true).order("apy", { ascending: false });
      return data ?? [];
    },
  });

  const { data: stakes = [] } = useQuery({
    queryKey: ["my-stakes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_stakes").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const active = stakes.filter((s: any) => s.status === "active");
  const completed = stakes.filter((s: any) => s.status !== "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Stake</h1>
        <p className="text-muted-foreground">Lock your crypto and earn rewards.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-card border-border/60"><CardContent className="p-5">
          <div className="text-sm text-muted-foreground">Active stakes</div>
          <div className="text-2xl font-semibold mt-1">{active.length}</div>
        </CardContent></Card>
        <Card className="bg-gradient-card border-border/60"><CardContent className="p-5">
          <div className="text-sm text-muted-foreground">Completed</div>
          <div className="text-2xl font-semibold mt-1">{completed.length}</div>
        </CardContent></Card>
        <Card className="bg-gradient-card border-border/60"><CardContent className="p-5">
          <div className="text-sm text-muted-foreground">Pending rewards</div>
          <div className="text-2xl font-semibold mt-1">
            {active.reduce((s: number, x: any) => s + Number(x.reward_earned ?? 0), 0).toFixed(4)}
          </div>
        </CardContent></Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Available staking plans</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p: any) => (
            <PlanCard key={p.id} plan={p} balance={balances.find((b) => b.coin === p.coin)?.available ?? 0} onStaked={() => {
              qc.invalidateQueries({ queryKey: ["my-stakes"] });
              qc.invalidateQueries({ queryKey: ["balances"] });
            }} />
          ))}
          {plans.length === 0 && <div className="text-sm text-muted-foreground">No plans available right now.</div>}
        </div>
      </div>

      <Card className="bg-gradient-card border-border/60">
        <CardHeader><CardTitle>My stakes</CardTitle></CardHeader>
        <CardContent>
          {stakes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">You haven't staked yet.</div>
          ) : (
            <div className="space-y-2">
              {stakes.map((s: any) => (
                <div key={s.id} className="p-3 rounded-lg border border-border/60 bg-background/40 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{Number(s.amount).toFixed(6)} {s.coin} • {s.apy}% APY</div>
                    <div className="text-xs text-muted-foreground">
                      Started {format(new Date(s.started_at), "MMM d")} • Ends {format(new Date(s.ends_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({ plan, balance, onStaked }: { plan: any; balance: number; onStaked: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function stake() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (amt < Number(plan.min_amount)) return toast.error(`Minimum ${plan.min_amount} ${plan.coin}`);
    if (plan.max_amount && amt > Number(plan.max_amount)) return toast.error(`Maximum ${plan.max_amount} ${plan.coin}`);
    if (amt > balance) return toast.error("Insufficient balance");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const ends = addDays(new Date(), plan.lock_days);
    const { error } = await supabase.from("user_stakes").insert({
      user_id: user!.id, plan_id: plan.id, coin: plan.coin, amount: amt, apy: plan.apy, ends_at: ends.toISOString(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Stake created!");
    setOpen(false); setAmount("");
    onStaked();
  }

  return (
    <Card className="bg-gradient-card border-border/60 hover:border-primary/40 transition">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{plan.name}</div>
          <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">{plan.coin}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /> {plan.apy}% APY</div>
          <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" /> {plan.lock_days} days</div>
        </div>
        <div className="text-xs text-muted-foreground">
          Min: {plan.min_amount} {plan.coin}{plan.max_amount && ` • Max: ${plan.max_amount}`}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="w-full bg-gradient-primary"><Coins className="mr-2 h-4 w-4" /> Stake</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{plan.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Available: {balance.toFixed(6)} {plan.coin}</div>
              <div className="space-y-2">
                <Label>Amount to stake</Label>
                <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <Button onClick={stake} disabled={busy} className="w-full bg-gradient-primary">Confirm stake</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
