import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [broadcast, setBroadcast] = useState(true);
  const [targetUser, setTargetUser] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["all-users-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,email,full_name").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["notif-history"],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  async function send() {
    if (!title.trim()) return toast.error("Title required");
    setBusy(true);
    if (broadcast) {
      const rows = users.map((u: any) => ({ user_id: u.id, title, body, broadcast: true }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) { setBusy(false); return toast.error(error.message); }
    } else {
      if (!targetUser) { setBusy(false); return toast.error("Select a user"); }
      const { error } = await supabase.from("notifications").insert({ user_id: targetUser, title, body, broadcast: false });
      if (error) { setBusy(false); return toast.error(error.message); }
    }
    setBusy(false);
    toast.success("Notification sent");
    setTitle(""); setBody("");
    qc.invalidateQueries({ queryKey: ["notif-history"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Send Notification</h1>
        <p className="text-muted-foreground">Broadcast to all users or send to a specific user.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle>New notification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Broadcast to all users</Label>
              <Switch checked={broadcast} onCheckedChange={setBroadcast} />
            </div>
            {!broadcast && (
              <div className="space-y-2">
                <Label>Target user</Label>
                <Select value={targetUser} onValueChange={setTargetUser}>
                  <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Body</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} /></div>
            <Button onClick={send} disabled={busy} className="w-full bg-gradient-primary">Send</Button>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/60">
          <CardHeader><CardTitle>Recent notifications</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {history.map((n: any) => (
              <div key={n.id} className="p-3 rounded-lg border border-border/60 bg-background/40">
                <div className="font-medium text-sm">{n.title} {n.broadcast && <span className="text-xs text-primary ml-2">[broadcast]</span>}</div>
                {n.body && <div className="text-xs text-muted-foreground mt-1">{n.body}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, p")}</div>
              </div>
            ))}
            {history.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">None yet.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
