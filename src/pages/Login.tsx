import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

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
    // Log login history
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero">
      <Card className="w-full max-w-md bg-card/90 backdrop-blur border-border/60 shadow-elegant">
        <CardHeader className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 justify-center mb-4">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">Vura</span>
          </Link>
          <CardTitle>{admin ? "Admin Sign In" : "Welcome back"}</CardTitle>
          <CardDescription>
            {admin ? "Restricted access — administrators only." : "Sign in to your Vura account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            {admin && (
              <p className="text-center text-xs text-muted-foreground">
                User?{" "}
                <Link to="/login" className="text-primary hover:underline">Use the user login</Link>
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
