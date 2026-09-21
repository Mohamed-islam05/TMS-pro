// ============================================================
// Shared Constants - Dossier workflow statuses
// ============================================================

export const DOSSIER_STATUT_LABELS: Record<string, string> = {
  OUVERT: "Ouvert",
  EN_ATTENTE_VALIDATION: "En attente de validation",
  CLOTURE: "Clôturé",
};

export const DOSSIER_STATUT_COLORS: Record<string, string> = {
  OUVERT: "bg-blue-100 text-blue-800",
  EN_ATTENTE_VALIDATION: "bg-amber-100 text-amber-800",
  CLOTURE: "bg-green-100 text-green-800",
};

export const VEHICULE_TYPE: Record<string, string> = {
  "1": "1 — Voiture",
  "2": "2 — Fourgon",
  "3": "3 — Camion 3T",
  "4": "4 — Camion 7T",
  "5": "5 — Camion 14T",
  "6": "6 — Camion 19T",
  "7": "7 — Remorque",
};

export function vehiculeTypeLabel(code?: string | null): string {
  if (!code) return "—";
  return VEHICULE_TYPE[code] ?? code;
}