// ============================================================
// Granular Permissions - Catalog + Engine (pure, no I/O)
// ============================================================
// Single source of truth for the permission allowlist and the
// default STAFF grant set. This module is intentionally free of
// prisma / next imports so it can be consumed by server actions,
// server pages AND one-off scripts (e.g. backfill).

export const PERMISSIONS = {
  "camions.view": "Consulter les camions",
  "camions.create": "Créer un camion",
  "camions.update": "Modifier un camion",
  "camions.delete": "Supprimer un camion",

  "charges.view": "Consulter les charges",
  "charges.create": "Ajouter une charge",
  "charges.update": "Modifier une charge",
  "charges.delete": "Supprimer une charge",

  "chauffeurs.view": "Consulter les chauffeurs",
  "chauffeurs.create": "Créer un chauffeur",
  "chauffeurs.update": "Modifier un chauffeur",
  "chauffeurs.delete": "Supprimer un chauffeur",

  "clients.view": "Consulter les clients",
  "clients.create": "Créer un client",
  "clients.update": "Modifier un client",
  "clients.delete": "Supprimer un client",

  "dashboard.overview": "Vue d'ensemble des opérations",
  "dashboard.financials": "Statistiques financières (CA, bénéfice, marge)",
  "dashboard.alerts": "Dossiers en attente et alertes",

  "dossiers.view": "Consulter les dossiers",
  "dossiers.create": "Créer un dossier",
  "dossiers.update": "Modifier un dossier",
  "dossiers.delete": "Supprimer un dossier",
  "dossiers.send": "Envoyer un dossier pour validation",
  "dossiers.close": "Clôturer un dossier (générer la facture)",

  "factures.view": "Consulter les factures",
  "factures.print": "Imprimer une facture",
  "factures.releve": "Générer le relevé de factures",

  "users.view": "Consulter les utilisateurs",
  "users.create": "Créer un utilisateur",
  "users.update": "Modifier le rôle d'un utilisateur",
  "users.delete": "Supprimer un utilisateur",
  "users.permissions": "Gérer les permissions",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

// Permissions that govern the Admin Studio. Never offered to STAFF
// accounts (only existing ENTREPRISE_ADMIN roles keep them).
export const ADMIN_ONLY_PERMISSIONS: Permission[] = [
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "users.permissions",
];

// Administrative-only operational permissions (kept off the default
// STAFF grant below, matching today's role-gated surface).
export const ADMIN_OPERATIONAL_PERMISSIONS: Permission[] = [
  "dossiers.close",
  "factures.print",
  "factures.releve",
  "dashboard.financials",
  "dashboard.alerts",
];

// Behavior-preserving default for existing / new STAFF accounts:
// everything currently reachable by STAFF, minus the admin-only set.
export const DEFAULT_STAFF_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) =>
    !ADMIN_ONLY_PERMISSIONS.includes(p) &&
    !ADMIN_OPERATIONAL_PERMISSIONS.includes(p)
);

const GROUPS: Array<{ label: string; permissions: Permission[] }> = [
  { label: "Camions", permissions: ["camions.view", "camions.create", "camions.update", "camions.delete"] },
  { label: "Charges", permissions: ["charges.view", "charges.create", "charges.update", "charges.delete"] },
  { label: "Chauffeurs", permissions: ["chauffeurs.view", "chauffeurs.create", "chauffeurs.update", "chauffeurs.delete"] },
  { label: "Clients", permissions: ["clients.view", "clients.create", "clients.update", "clients.delete"] },
  {
    label: "Tableau de bord",
    permissions: ["dashboard.overview", "dashboard.financials", "dashboard.alerts"],
  },
  {
    label: "Dossiers",
    permissions: ["dossiers.view", "dossiers.create", "dossiers.update", "dossiers.delete", "dossiers.send", "dossiers.close"],
  },
  { label: "Factures", permissions: ["factures.view", "factures.print", "factures.releve"] },
  { label: "Utilisateurs", permissions: ["users.view", "users.create", "users.update", "users.delete", "users.permissions"] },
];

export function getPermissionGroups(): typeof GROUPS {
  return GROUPS;
}

export function isValidPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

type PermissionSubject = {
  role: string;
  permissions: readonly string[];
} | null | undefined;

// ENTREPRISE_ADMIN has implicit full access; everyone else is
// strictly limited to their granted permission rows.
export function hasPermission(permission: Permission, user: PermissionSubject): boolean {
  if (!user) return false;
  if (user.role === "ENTREPRISE_ADMIN") return true;
  return user.permissions.includes(permission);
}

export function requirePermission(permission: Permission, user: PermissionSubject): void {
  if (!hasPermission(permission, user)) {
    throw new Error("Accès non autorisé");
  }
}