import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye } from "lucide-react";

export default function AdminKyc() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [note, setNote] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: async () => {
      const { data: kyc } = await supabase
        .from("kyc_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (!kyc?.length) return [];
      const ids = [...new Set(kyc.map((k) => k.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id,email,full_name").in("id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return kyc.map((k) => ({ ...k, profile: map.get(k.user_id) }));
    },
  });

  async function openDetail(row: any) {
    setSelected(row);
    setNote(row.admin_note ?? "");
    // Sign the doc URLs (kyc-docs is private)
    const paths = [row.id_front_url, row.id_back_url, row.selfie_url].filter(Boolean) as string[];
    const signed: Record<string, string> = {};
    await Promise.all(paths.map(async (p) => {
      const { data } = await supabase.storage.from("kyc-docs").createSignedUrl(p, 600);
      if (data?.signedUrl) signed[p] = data.signedUrl;
    }));
    setSignedUrls(signed);
  }

  async function decide(status: "approved" | "rejected") {
    if (!selected) return;
    const { error } = await supabase
      .from("kyc_records")
      .update({ status, admin_note: note || null })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success(`KYC ${status}`);
    setSelected(null);
    qc.invalidateQueries({ queryKey: ["admin-kyc"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">KYC Submissions</h1>
        <p className="text-muted-foreground">Review identity verification submissions.</p>
      </div>
      <Card className="bg-gradient-card border-border/60 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Doc type</th>
                <th className="text-left p-3">Address</th>
                <th className="text-right p-3">Status</th>
                <th className="text-right p-3">Submitted</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((k: any) => (
                <tr key={k.id} className="border-b border-border/40 last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{k.profile?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{k.profile?.email}</div>
                  </td>
                  <td className="p-3 capitalize">{k.doc_type?.replace("_", " ")}</td>
                  <td className="p-3 text-xs text-muted-foreground truncate max-w-[240px]">{k.full_address || "—"}</td>
                  <td className="p-3 text-right"><StatusBadge status={k.status} /></td>
                  <td className="p-3 text-right text-muted-foreground">{format(new Date(k.created_at), "MMM d")}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openDetail(k)}>
                      <Eye className="h-4 w-4 mr-1" />Review
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No submissions.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>KYC review — {selected?.profile?.email}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Document type</div><div>{selected.doc_type}</div></div>
                <div><div className="text-xs text-muted-foreground">Status</div><StatusBadge status={selected.status} /></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Address</div><div>{selected.full_address}</div></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "ID Front", path: selected.id_front_url },
                  { label: "ID Back", path: selected.id_back_url },
                  { label: "Selfie", path: selected.selfie_url },
                ].map(({ label, path }) => (
                  <div key={label} className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="text-xs text-muted-foreground p-2 bg-background/40">{label}</div>
                    {path && signedUrls[path] ? (
                      <a href={signedUrls[path]} target="_blank" rel="noreferrer">
                        <img src={signedUrls[path]} alt={label} className="w-full h-40 object-cover" />
                      </a>
                    ) : <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">Not provided</div>}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin note (shown to user on rejection)</label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" rows={3} />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="destructive" onClick={() => decide("rejected")}>Reject</Button>
                <Button onClick={() => decide("approved")} className="bg-success text-success-foreground hover:bg-success/90">Approve</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
