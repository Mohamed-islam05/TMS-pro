// ============================================================
// StatusBadge - Dossier workflow status (reuses constants)
// ============================================================
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DOSSIER_STATUT_COLORS, DOSSIER_STATUT_LABELS } from "@/lib/constants";

interface StatusBadgeProps {
  statut: string;
  className?: string;
}

export function StatusBadge({ statut, className }: StatusBadgeProps) {
  return (
    <Badge className={cn("border-transparent", DOSSIER_STATUT_COLORS[statut], className)}>
      {DOSSIER_STATUT_LABELS[statut] ?? statut}
    </Badge>
  );
}
