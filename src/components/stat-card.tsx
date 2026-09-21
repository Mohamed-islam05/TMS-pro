// ============================================================
// StatCard - Compact KPI card for dashboards
// ============================================================
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type StatTone = "default" | "success" | "warning" | "danger" | "info";

interface StatCardProps {
  title: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  tone?: StatTone;
  className?: string;
}

const toneClasses: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-green-100 text-green-700",
  warning: "bg-orange-100 text-orange-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

export function StatCard({ title, value, icon: Icon, hint, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</p>
            {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
          </div>
          {Icon && (
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                toneClasses[tone]
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
