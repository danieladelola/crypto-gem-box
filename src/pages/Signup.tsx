import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Rocket, Coins, BarChart3 } from "lucide-react";
import { z } from "zod";
import authHero from "@/assets/auth-hero.jpg";

const schema = z.object({
  full_name: z.string().trim().min(2, "Name too short").max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

export default function Signup() {
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: parsed.data.full_name },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Redirecting…");
    setTimeout(() => nav("/app"), 800);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: Image / brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-hero p-10">
        <img
          src={authHero}
          alt="Join Vura crypto platform"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/50 to-primary/30" />

        <Link to="/" className="relative inline-flex items-center gap-2 text-foreground">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-2xl">Vura</span>
        </Link>

        <div className="relative space-y-6 text-foreground">
          <h2 className="text-4xl font-bold leading-tight max-w-md">
            Start your crypto journey in minutes.
          </h2>
          <p className="text-foreground/70 max-w-md">
            Buy, sell, stake and grow your portfolio with a platform engineered for clarity and speed.
          </p>
          <ul className="space-y-3 text-sm text-foreground/80">
            <li className="flex items-center gap-3"><Rocket className="h-4 w-4 text-primary" /> Instant onboarding & deposits</li>
            <li className="flex items-center gap-3"><Coins className="h-4 w-4 text-primary" /> Stake top assets with competitive APY</li>
            <li className="flex items-center gap-3"><BarChart3 className="h-4 w-4 text-primary" /> Pro-grade charts and live markets</li>
          </ul>
        </div>

        <p className="relative text-xs text-foreground/50">© {new Date().getFullYear()} Vura. All rights reserved.</p>
      </div>

      {/* Right: Form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">Vura</span>
            </Link>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground">Start trading and staking in minutes.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-primary shadow-elegant">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already a member?{" "}
              <Link to="/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
