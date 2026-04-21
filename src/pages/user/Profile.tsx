import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ full_name: string; phone: string }>({ full_name: "", phone: "" });

  // initialize form when profile loads
  if (profile && form.full_name === "" && form.phone === "" && (profile.full_name || profile.phone)) {
    setForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }

  const initials = (profile?.full_name || user?.email || "U").split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  async function uploadAvatar(file: File) {
    if (!user) return;
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
    refetch();
  }

  async function saveProfile() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: form.full_name, phone: form.phone }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account identity and verification status.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar card */}
        <Card className="bg-gradient-card border-border/60 lg:col-span-1">
          <CardHeader><CardTitle>Profile photo</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-6">
            <div className="relative">
              <Avatar className="h-32 w-32 border-2 border-primary/20">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-3xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow hover:scale-105 transition"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            <div className="text-center">
              <div className="font-semibold">{profile?.full_name || "Unnamed"}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
            {profile?.avatar_url && (
              <Button variant="ghost" size="sm" onClick={removeAvatar} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />Remove photo
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Profile details */}
        <Card className="bg-gradient-card border-border/60 lg:col-span-2">
          <CardHeader><CardTitle>Account details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>KYC status</Label>
                <div className="pt-2"><StatusBadge status={profile?.kyc_status ?? "none"} /></div>
              </div>
              <div className="space-y-2">
                <Label>Email verified</Label>
                <div className="pt-2"><StatusBadge status={profile?.email_verified ? "approved" : "pending"} /></div>
              </div>
              <div className="space-y-2">
                <Label>Account status</Label>
                <div className="pt-2"><StatusBadge status={profile?.banned ? "rejected" : "approved"} /></div>
              </div>
            </div>
            <Button onClick={saveProfile} disabled={busy} className="bg-gradient-primary">Save changes</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
