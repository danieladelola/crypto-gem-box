import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { UserCircle } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setProfile(data));
  }, [user]);

  async function saveProfile() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name, phone: profile.phone,
    }).eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  }

  async function changePwd() {
    if (pwd.length < 8) return toast.error("Min 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPwd("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and security.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-gradient-card border-border/60">
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={profile?.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={profile?.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email ?? ""} disabled />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={busy} className="bg-gradient-primary">Save profile</Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/60">
            <CardHeader><CardTitle>Security</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>New password</Label>
                <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
              </div>
              <Button onClick={changePwd} disabled={busy} variant="outline">Update password</Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/60">
            <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">In-app alerts</div>
                  <div className="text-sm text-muted-foreground">Get notified about deposits, withdrawals, and signals.</div>
                </div>
                <Switch checked={notif} onCheckedChange={setNotif} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-card border-border/60">
            <CardHeader><CardTitle>Profile photo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Upload or change your profile photo on the Profile page.</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/app/profile"><UserCircle className="h-4 w-4 mr-2" />Open Profile</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
