import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyKyc } from "@/hooks/useKyc";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Upload, ShieldCheck, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const DOC_TYPES = ["passport", "drivers_license", "national_id"] as const;

export function KycForm() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: kyc, refetch } = useMyKyc();
  const { data: profile } = useProfile();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    doc_type: "passport",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    dob: "",
    id_number: "",
  });
  const [files, setFiles] = useState<{ front?: File; back?: File; selfie?: File }>({});

  // hydrate from profile if present
  useState(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        address_line1: profile.address_line1 ?? "",
        address_line2: profile.address_line2 ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        postal_code: profile.postal_code ?? "",
        country: profile.country ?? "",
        dob: profile.dob ?? "",
        id_number: profile.id_number ?? "",
      }));
    }
  });

  async function uploadDoc(file: File, label: string): Promise<string> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${label}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("kyc-docs").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.address_line1 || !form.city || !form.country) return toast.error("Complete address fields");
    if (!form.id_number) return toast.error("Enter ID number");
    if (!files.front && !kyc?.id_front_url) return toast.error("Upload ID front image");

    setBusy(true);
    try {
      const front = files.front ? await uploadDoc(files.front, "id-front") : kyc?.id_front_url;
      const back = files.back ? await uploadDoc(files.back, "id-back") : kyc?.id_back_url;
      const selfie = files.selfie ? await uploadDoc(files.selfie, "selfie") : kyc?.selfie_url;

      const fullAddress = [form.address_line1, form.address_line2, form.city, form.state, form.postal_code, form.country].filter(Boolean).join(", ");

      // Update profile address fields
      await supabase.from("profiles").update({
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        state: form.state,
        postal_code: form.postal_code,
        country: form.country,
        dob: form.dob || null,
        id_number: form.id_number,
      }).eq("id", user.id);

      // Insert a new KYC record (each submission = new record, latest wins)
      const { error } = await supabase.from("kyc_records").insert({
        user_id: user.id,
        doc_type: form.doc_type,
        doc_url: front ?? null,
        id_front_url: front ?? null,
        id_back_url: back ?? null,
        selfie_url: selfie ?? null,
        full_address: fullAddress,
        status: "pending",
      });
      if (error) throw error;
      toast.success("KYC submitted — awaiting admin review");
      setFiles({});
      refetch();
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit KYC");
    } finally {
      setBusy(false);
    }
  }

  const canEdit = !kyc || kyc.status === "rejected";
  const status = kyc?.status ?? profile?.kyc_status ?? "none";

  return (
    <Card className="bg-gradient-card border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Identity verification (KYC)</span>
          <StatusBadge status={status} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === "approved" ? (
          <div className="text-sm text-muted-foreground">
            ✅ Your identity has been verified. Contact support if you need to update your details.
          </div>
        ) : status === "pending" ? (
          <div className="text-sm text-muted-foreground">
            Your KYC submission is pending review. We'll notify you once it's processed.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {kyc?.status === "rejected" && kyc?.admin_note && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 text-sm p-3">
                <strong>Rejected:</strong> {kyc.admin_note}
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-3">Address</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-2">
                  <Label>Address line 1</Label>
                  <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} required />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Address line 2 <span className="text-muted-foreground">(optional)</span></Label>
                  <Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
                </div>
                <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></div>
                <div className="space-y-2"><Label>State / Province</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                <div className="space-y-2"><Label>Postal code</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
                <div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required /></div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Identity document</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Document type</Label>
                  <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>ID number</Label><Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Date of birth</Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                <FilePicker label="ID Front *" file={files.front} onChange={(f) => setFiles((s) => ({ ...s, front: f }))} />
                <FilePicker label="ID Back" file={files.back} onChange={(f) => setFiles((s) => ({ ...s, back: f }))} />
                <FilePicker label="Selfie" file={files.selfie} onChange={(f) => setFiles((s) => ({ ...s, selfie: f }))} />
              </div>
            </div>

            <Button type="submit" disabled={busy || !canEdit} className="bg-gradient-primary">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit for review
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function FilePicker({ label, file, onChange }: { label: string; file?: File; onChange: (f: File) => void }) {
  return (
    <label className="block cursor-pointer">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="border border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition">
        <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        <div className="text-xs">{file ? file.name : "Click to upload"}</div>
      </div>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }}
      />
    </label>
  );
}
