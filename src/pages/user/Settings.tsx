import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { KycForm } from "@/components/KycForm";
import { toast } from "sonner";
import {
  UserCircle, Camera, Loader2, Trash2, Lock, Bell, Shield, MapPin, Settings as SettingsIcon, KeyRound,
} from "lucide-react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "ar", label: "العربية" },
  { value: "zh", label: "中文" },
];

export default function Settings() {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const qc = useQueryClient();

  const [profileForm, setProfileForm] = useState({
    full_name: "", phone: "", dob: "", country: "",
    address_line1: "", address_line2: "", city: "", state: "", postal_code: "",
  });
  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [prefs, setPrefs] = useState({
    email_alerts: true, sms_alerts: false, in_app_alerts: true,
    language: "en", display_currency: "USD",
  });
  const [busy, setBusy] = useState<"profile" | "password" | "prefs" | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        dob: profile.dob ?? "",
        country: profile.country ?? "",
        address_line1: profile.address_line1 ?? "",
        address_line2: profile.address_line2 ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        postal_code: profile.postal_code ?? "",
      });
    }
  }, [profile?.id]);

  const initials = (profile?.full_name || user?.email || "U").split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Image files only");
    if (file.size > 4 * 1024 * 1024) return toast.error("Max 4 MB");
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);
    toast.success("Profile photo updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
    refetch();
  }

  async function removeAvatar() {
    if (!user) return;
    setUploading(true);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setUploading(false);
    toast.success("Profile photo removed");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function saveProfile() {
    if (!user) return;
    setBusy("profile");
    const { error } = await supabase.from("profiles").update({
      full_name: profileForm.full_name.trim() || null,
      phone: profileForm.phone.trim() || null,
      dob: profileForm.dob || null,
      country: profileForm.country.trim() || null,
      address_line1: profileForm.address_line1.trim() || null,
      address_line2: profileForm.address_line2.trim() || null,
      city: profileForm.city.trim() || null,
      state: profileForm.state.trim() || null,
      postal_code: profileForm.postal_code.trim() || null,
    }).eq("id", user.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function changePwd() {
    if (pwd.next.length < 8) return toast.error("Password must be at least 8 characters");
    if (pwd.next !== pwd.confirm) return toast.error("Passwords do not match");
    setBusy("password");
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPwd({ next: "", confirm: "" });
  }

  function savePrefs() {
    setBusy("prefs");
    // Stored locally for now; backend column can be added later.
    localStorage.setItem("vura_prefs", JSON.stringify(prefs));
    setTimeout(() => { setBusy(null); toast.success("Preferences saved"); }, 200);
  }

  const passwordStrength = (() => {
    const p = pwd.next;
    if (!p) return { label: "", color: "" };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const map = ["Weak", "Fair", "Good", "Strong", "Excellent"];
    const colors = ["bg-destructive", "bg-amber-500", "bg-amber-400", "bg-emerald-500", "bg-emerald-400"];
    return { label: map[score], color: colors[score] };
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile, security, KYC and account preferences.</p>
      </div>

      {/* Identity overview banner */}
      <Card className="bg-gradient-card border-border/60">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary/20">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow hover:scale-105 transition">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="font-semibold text-lg truncate">{profile?.full_name || "Unnamed account"}</div>
            <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-3">
              <span className="text-xs text-muted-foreground">KYC:</span>
              <StatusBadge status={profile?.kyc_status ?? "none"} />
              <span className="text-xs text-muted-foreground ml-2">Email:</span>
              <StatusBadge status={profile?.email_verified ? "approved" : "pending"} />
              <span className="text-xs text-muted-foreground ml-2">Account:</span>
              <StatusBadge status={profile?.banned ? "rejected" : "approved"} />
            </div>
          </div>
          {profile?.avatar_url && (
            <Button variant="ghost" size="sm" onClick={removeAvatar} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Remove photo
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap whitespace-nowrap h-auto flex-wrap sm:flex-nowrap">
          <TabsTrigger value="profile" className="gap-2"><UserCircle className="h-4 w-4" />Profile</TabsTrigger>
          <TabsTrigger value="address" className="gap-2"><MapPin className="h-4 w-4" />Address</TabsTrigger>
          <TabsTrigger value="kyc" className="gap-2"><Shield className="h-4 w-4" />KYC</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2"><SettingsIcon className="h-4 w-4" />Preferences</TabsTrigger>
        </TabsList>

        {/* Profile / personal */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          <Card className="bg-gradient-card border-border/60">
            <CardHeader>
              <CardTitle>Personal information</CardTitle>
              <CardDescription>Used across the platform and on official communications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name">
                  <Input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} placeholder="Your legal name" />
                </Field>
                <Field label="Email" hint="Email is managed by your sign-in account.">
                  <Input value={user?.email ?? ""} disabled />
                </Field>
                <Field label="Phone">
                  <Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="+1 555 123 4567" />
                </Field>
                <Field label="Date of birth">
                  <Input type="date" value={profileForm.dob ?? ""} onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })} />
                </Field>
                <Field label="Nationality / Country">
                  <Input value={profileForm.country} onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })} placeholder="e.g. United States" />
                </Field>
                <Field label="Account ID">
                  <Input value={user?.id ?? ""} disabled className="font-mono text-xs" />
                </Field>
              </div>
              <Button onClick={saveProfile} disabled={busy === "profile"} className="bg-gradient-primary">
                {busy === "profile" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address */}
        <TabsContent value="address" className="mt-6">
          <Card className="bg-gradient-card border-border/60">
            <CardHeader>
              <CardTitle>Residential address</CardTitle>
              <CardDescription>Used for KYC and compliance — please use your real address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Address line 1" className="sm:col-span-2">
                  <Input value={profileForm.address_line1} onChange={(e) => setProfileForm({ ...profileForm, address_line1: e.target.value })} placeholder="Street address" />
                </Field>
                <Field label="Address line 2 (optional)" className="sm:col-span-2">
                  <Input value={profileForm.address_line2} onChange={(e) => setProfileForm({ ...profileForm, address_line2: e.target.value })} placeholder="Apt, suite, unit" />
                </Field>
                <Field label="City">
                  <Input value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} />
                </Field>
                <Field label="State / Province">
                  <Input value={profileForm.state} onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })} />
                </Field>
                <Field label="Postal / ZIP code">
                  <Input value={profileForm.postal_code} onChange={(e) => setProfileForm({ ...profileForm, postal_code: e.target.value })} />
                </Field>
                <Field label="Country">
                  <Input value={profileForm.country} onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })} placeholder="Country of residence" />
                </Field>
              </div>
              <Button onClick={saveProfile} disabled={busy === "profile"} className="bg-gradient-primary">
                {busy === "profile" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save address
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC */}
        <TabsContent value="kyc" className="mt-6">
          <KycForm />
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <Card className="bg-gradient-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Change password</CardTitle>
              <CardDescription>Use at least 8 characters with a mix of letters, numbers and symbols.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <Field label="New password">
                <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
              </Field>
              {pwd.next && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${passwordStrength.color} transition-all`} style={{ width: `${(["Weak","Fair","Good","Strong","Excellent"].indexOf(passwordStrength.label) + 1) * 20}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground">{passwordStrength.label}</div>
                </div>
              )}
              <Field label="Confirm new password">
                <Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
              </Field>
              <Button onClick={changePwd} disabled={busy === "password"} variant="outline">
                {busy === "password" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update password
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Two-factor authentication</CardTitle>
              <CardDescription>Add an extra layer of protection to your account. Coming soon.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                <div>
                  <div className="font-medium text-sm">Authenticator app</div>
                  <div className="text-xs text-muted-foreground">Use Google Authenticator, Authy or 1Password.</div>
                </div>
                <Button variant="outline" size="sm" disabled>Set up</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value="preferences" className="mt-6 space-y-6">
          <Card className="bg-gradient-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle label="In-app alerts" hint="Deposits, withdrawals, signals & status changes."
                checked={prefs.in_app_alerts} onChange={(v) => setPrefs({ ...prefs, in_app_alerts: v })} />
              <Toggle label="Email alerts" hint="Important account & security messages."
                checked={prefs.email_alerts} onChange={(v) => setPrefs({ ...prefs, email_alerts: v })} />
              <Toggle label="SMS alerts" hint="High-priority confirmations (when supported)."
                checked={prefs.sms_alerts} onChange={(v) => setPrefs({ ...prefs, sms_alerts: v })} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/60">
            <CardHeader>
              <CardTitle>Regional preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Language">
                  <Select value={prefs.language} onValueChange={(v) => setPrefs({ ...prefs, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[60]">
                      {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Display currency">
                  <Select value={prefs.display_currency} onValueChange={(v) => setPrefs({ ...prefs, display_currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[60]">
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="JPY">JPY (¥)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Button onClick={savePrefs} disabled={busy === "prefs"} className="bg-gradient-primary">
                {busy === "prefs" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
