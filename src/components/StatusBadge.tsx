import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning border-warning/30",
    approved: "bg-success/15 text-success border-success/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
    completed: "bg-success/15 text-success border-success/30",
    cancelled: "bg-muted text-muted-foreground border-border",
    active: "bg-primary/15 text-primary border-primary/30",
    open: "bg-primary/15 text-primary border-primary/30",
    closed: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("capitalize border", map[status] ?? "bg-muted")}>
      {status}
    </Badge>
  );
}
