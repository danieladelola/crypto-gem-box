import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function AdminPlaceholder({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <Card className="bg-gradient-card border-border/60">
        <CardContent className="py-16 text-center">
          <Construction className="mx-auto h-12 w-12 text-primary mb-4" />
          <div className="font-semibold">Coming in the next iteration</div>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            This module is fully wired into the database. We'll deepen its UI in the next pass.
          </p>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
