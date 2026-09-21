// ============================================================
// DocumentStatusBadge - Vehicle document validity states
// ============================================================
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/lib/utils";

interface DocumentStatusBadgeProps {
  state: DocumentStatus;
  className?: string;
}

const stateConfig: Record<DocumentStatus, { label: string; className: string }> = {
  VALIDE: { label: "Valide", className: "bg-green-100 text-green-700" },
  BIENTOT_EXPIRE: { label: "Expire bientôt", className: "bg-orange-100 text-orange-700" },
  EXPIRE: { label: "Expiré", className: "bg-red-100 text-red-700" },
  ABSENT: { label: "Non renseigné", className: "bg-muted text-muted-foreground" },
};

export function DocumentStatusBadge({ state, className }: DocumentStatusBadgeProps) {
  const config = stateConfig[state];
  return (
    <Badge className={cn("border-transparent", config.className, className)}>{config.label}</Badge>
  );
}
