// ============================================================
// Utilisateurs Page - Admin Studio (roles management)
// ============================================================
"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Plus, Trash2, SearchX, Shield, ShieldCheck, Users, UserCog, ChevronLeft, ChevronRight, RotateCcw, Inbox, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { PageToolbar } from "@/components/page-toolbar";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReusableDialogForm } from "@/components/reusable-dialog-form";
import { usePermissionCheck } from "@/lib/client-permissions";
import { getUtilisateurs, createUser, deleteUser, updateUserRole, updateUserPermissions } from "@/lib/actions/auth";
import {
  PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  ADMIN_ONLY_PERMISSIONS,
  getPermissionGroups,
} from "@/lib/permissions";
import { formatShortDate, debounce } from "@/lib/utils";

const userFormSchema = z.object({
  nom: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne doit pas dépasser 100 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  role: z.enum(["ENTREPRISE_ADMIN", "STAFF"], {
    errorMap: () => ({ message: "Rôle invalide" }),
  }),
  specialite: z.string().max(100).optional().or(z.literal("")),
});

interface UtilisateurData {
  id: string;
  nom: string | null;
  email: string;
  role: string;
  specialite: string | null;
  createdAt: Date | string;
  permissions: string[];
}

const ROLE_LABELS: Record<string, string> = {
  ENTREPRISE_ADMIN: "Administrateur",
  STAFF: "Staff",
};

const PAGE_SIZE = 10;
const ALL = "ALL";

export default function UtilisateursPage() {
  const { can, id: currentUserId, status } = usePermissionCheck();
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UtilisateurData | null>(null);
  const [permUser, setPermUser] = useState<UtilisateurData | null>(null);
  const [permDraft, setPermDraft] = useState<Set<string>>(new Set());
  const [permSaving, setPermSaving] = useState(false);

  const debouncedApply = useRef(debounce((value: string) => setAppliedQuery(value), 300)).current;

  const canViewUsers = can("users.view");
  const canManagePermissions = can("users.permissions");

  const fetchUtilisateurs = async () => {
    const result = await getUtilisateurs();
    if (result.success) {
      setUtilisateurs(result.data as UtilisateurData[]);
    } else {
      toast.error(result.error || "Erreur lors du chargement des utilisateurs");
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!canViewUsers) {
      setLoading(false);
      return;
    }
    fetchUtilisateurs().finally(() => setLoading(false));
  }, [status, canViewUsers]);

  useEffect(() => {
    setPage(1);
  }, [appliedQuery, roleFilter]);

  const userFormFields = [
    { name: "nom", label: "Nom", type: "text" as const, placeholder: "Nom complet", required: true },
    { name: "email", label: "Email", type: "email" as const, placeholder: "utilisateur@entreprise.com", required: true },
    { name: "password", label: "Mot de passe", type: "password" as const, placeholder: "••••••••", required: true },
    {
      name: "role",
      label: "Rôle",
      type: "select" as const,
      placeholder: "Sélectionnez",
      options: [
        { value: "STAFF", label: "Staff" },
        { value: "ENTREPRISE_ADMIN", label: "Administrateur" },
      ],
      required: true,
    },
    { name: "specialite", label: "Spécialité (optionnel)", type: "text" as const, placeholder: "Comptabilité, Logistique..." },
  ];

  const handleCreate = async (data: z.infer<typeof userFormSchema>) => {
    const result = await createUser({
      nom: data.nom,
      email: data.email,
      password: data.password,
      role: data.role,
      specialite: data.specialite || undefined,
    });
    if (result.success) fetchUtilisateurs();
    return result;
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      const result = await deleteUser(id);
      if (result.success) { toast.success(result.message); fetchUtilisateurs(); } else { toast.error(result.error); }
    });
  };

  const handleRoleChange = async (userId: string, role: string) => {
    startTransition(async () => {
      const result = await updateUserRole({ userId, role });
      if (result.success) {
        toast.success(result.message);
        fetchUtilisateurs();
      } else {
        toast.error(result.error);
        fetchUtilisateurs();
      }
    });
  };

  const openPermissions = (user: UtilisateurData) => {
    setPermUser(user);
    setPermDraft(new Set(user.permissions));
  };

  const togglePermission = (permission: string) => {
    setPermDraft((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const resetDefaultPermissions = () => {
    setPermDraft(new Set(DEFAULT_STAFF_PERMISSIONS));
  };

  const savePermissions = async () => {
    if (!permUser) return;
    setPermSaving(true);
    try {
      const result = await updateUserPermissions({
        userId: permUser.id,
        permissions: Array.from(permDraft),
      });
      if (result.success) {
        toast.success(result.message);
        fetchUtilisateurs();
        setPermUser(null);
      } else {
        toast.error(result.error);
      }
    } finally {
      setPermSaving(false);
    }
  };

  const permGroups = getPermissionGroups()
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter((p) => !ADMIN_ONLY_PERMISSIONS.includes(p)),
    }))
    .filter((group) => group.permissions.length > 0);

  const query = appliedQuery.trim().toLowerCase();
  const filtered = utilisateurs.filter((u) => {
    const matchesSearch =
      !query ||
      (u.nom !== null && u.nom.toLowerCase().includes(query)) ||
      u.email.toLowerCase().includes(query);
    const matchesRole = roleFilter === ALL || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const counts = {
    total: filtered.length,
    admins: filtered.filter((u) => u.role === "ENTREPRISE_ADMIN").length,
    staff: filtered.filter((u) => u.role === "STAFF").length,
  };

  const hasFilters = appliedQuery !== "" || roleFilter !== ALL;
  const resetFilters = () => {
    setSearchQuery("");
    setAppliedQuery("");
    setRoleFilter(ALL);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <PageHeader title="Utilisateurs" description="Administration des utilisateurs et des rôles" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canViewUsers) {
    return (
      <div className="space-y-6">
        <PageHeader title="Utilisateurs" description="Administration des utilisateurs et des rôles" />
        <AccessDenied message="Vous n'avez pas la permission de gérer les utilisateurs." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Utilisateurs" description="Administration des utilisateurs et des rôles" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" description="Administration des utilisateurs et des rôles">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nouvel utilisateur
        </Button>
      </PageHeader>

      <PageToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Rechercher (nom, email)..."
        filters={
          <>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filtrer par rôle">
                <SelectValue placeholder="Rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les rôles</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
                <SelectItem value="ENTREPRISE_ADMIN">Administrateur</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Réinitialiser
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total utilisateurs" value={String(counts.total)} icon={Users} tone="info" />
        <StatCard title="Administrateurs" value={String(counts.admins)} icon={ShieldCheck} tone="success" />
        <StatCard title="Staff" value={String(counts.staff)} icon={UserCog} tone="default" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Studio
          </CardTitle>
          <CardDescription>{filtered.length} utilisateur(s) dans votre entreprise</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="Aucun utilisateur ne correspond à vos critères"
                description="Modifiez vos critères de recherche ou réinitialisez les filtres."
                action={
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser les filtres
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="Aucun utilisateur"
                description="Ajoutez un utilisateur à votre entreprise pour commencer."
              />
            )
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Spécialité</TableHead>
                      <TableHead>Créé le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((u) => {
                      const isSelf = u.id === currentUserId;
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {u.nom || "—"}
                              {isSelf && <Badge variant="secondary">Vous</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{u.email}</TableCell>
                          <TableCell>
                            <Select
                              value={u.role}
                              disabled={isSelf || isPending}
                              onValueChange={(v) => handleRoleChange(u.id, v)}
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="STAFF">Staff</SelectItem>
                                <SelectItem value="ENTREPRISE_ADMIN">Administrateur</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{u.specialite || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatShortDate(u.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {u.role === "STAFF" && !isSelf && canManagePermissions && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 cursor-pointer"
                                  disabled={isPending}
                                  onClick={() => openPermissions(u)}
                                  title="Gérer les permissions"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50 cursor-pointer"
                                disabled={isSelf || isPending}
                                onClick={() => setUserToDelete(u)}
                                title={isSelf ? "Impossible de supprimer votre propre compte" : "Supprimer"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} utilisateur(s) · Page {safePage}/{totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                      <ChevronLeft className="h-4 w-4" /> Précédent
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                      Suivant <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ReusableDialogForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Nouvel utilisateur"
        description="Ajoutez un utilisateur à votre entreprise"
        schema={userFormSchema}
        fields={userFormFields}
        onSubmit={handleCreate}
        submitLabel="Créer"
        maxWidth="sm:max-w-[500px]"
      />

      <Dialog open={permUser !== null} onOpenChange={(open) => { if (!open) setPermUser(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Permissions de {permUser?.nom || permUser?.email}</DialogTitle>
            <DialogDescription>
              {permUser?.role === "ENTREPRISE_ADMIN"
                ? "Un administrateur a automatiquement accès à toutes les permissions."
                : "Personnalisez les accès de cet utilisateur."}
            </DialogDescription>
          </DialogHeader>

          {permUser?.role === "ENTREPRISE_ADMIN" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Rôle administrateur : accès complet à l'application.
            </p>
          ) : (
            <div className="space-y-4">
              {permGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-1 rounded-lg border p-3">
                    {group.permissions.map((permission) => (
                      <label key={permission} className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-1 hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={permDraft.has(permission)}
                          onChange={() => togglePermission(permission)}
                          className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                        />
                        <span className="text-sm">{PERMISSIONS[permission]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={resetDefaultPermissions} disabled={permSaving}>
                Rétablir les permissions par défaut
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermUser(null)} disabled={permSaving}>
              Annuler
            </Button>
            <Button onClick={savePermissions} disabled={permSaving || permUser?.role === "ENTREPRISE_ADMIN"}>
              {permSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={userToDelete !== null}
        onOpenChange={(open) => { if (!open) setUserToDelete(null); }}
        title="Supprimer cet utilisateur ?"
        description={userToDelete ? `L'utilisateur ${userToDelete.nom || userToDelete.email} sera supprimé définitivement.` : undefined}
        confirmLabel="Supprimer"
        variant="destructive"
        loading={isPending}
        onConfirm={() => {
          if (userToDelete) {
            const id = userToDelete.id;
            setUserToDelete(null);
            handleDelete(id);
          }
        }}
      />
    </div>
  );
}
