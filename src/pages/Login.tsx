import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, ShieldCheck, TrendingUp, Lock } from "lucide-react";
import authHero from "@/assets/auth-hero.jpg";

export default function Login({ admin = false }: { admin?: boolean }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (admin && isAdmin) nav("/admin", { replace: true });
      else if (admin && !isAdmin) {
        // logged in but not admin
      } else nav((loc.state as any)?.from?.pathname ?? "/app", { replace: true });
    }
  }, [user, isAdmin, loading, admin, nav, loc.state]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      supabase.from("login_history").insert({
        user_id: u.id,
        user_agent: navigator.userAgent,
      });
    }
    toast.success("Welcome back!");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: Image / brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-hero p-10">
        <img
          src={authHero}
          alt="Vura crypto trading platform"
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
            {admin ? "Administrative Control Center" : "Trade smarter. Stake stronger."}
          </h2>
          <p className="text-foreground/70 max-w-md">
            {admin
              ? "Manage deposits, withdrawals, users and platform settings from one secure dashboard."
              : "Join thousands of traders building wealth with a platform built for trust, speed and clarity."}
          </p>
          <ul className="space-y-3 text-sm text-foreground/80">
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-primary" /> Bank-grade security & encrypted vaults</li>
            <li className="flex items-center gap-3"><TrendingUp className="h-4 w-4 text-primary" /> Live markets powered by global data</li>
            <li className="flex items-center gap-3"><Lock className="h-4 w-4 text-primary" /> Self-custody options on supported chains</li>
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
            <h1 className="text-3xl font-bold tracking-tight">
              {admin ? "Admin Sign In" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground">
              {admin ? "Restricted access — administrators only." : "Sign in to your Vura account to continue."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-primary shadow-elegant">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
            {!admin && (
              <p className="text-center text-sm text-muted-foreground">
                New here?{" "}
                <Link to="/signup" className="text-primary hover:underline">Create an account</Link>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
