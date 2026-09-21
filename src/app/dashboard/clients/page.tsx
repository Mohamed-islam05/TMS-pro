// ============================================================
// Clients Page - TMS Pro
// ============================================================
"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, Users, FolderOpen, UserCheck, UserPlus, SearchX, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { PageToolbar } from "@/components/page-toolbar";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReusableDialogForm } from "@/components/reusable-dialog-form";
import { createClientSchema, type CreateClientInput } from "@/lib/validations/client";
import { createClient, updateClient, deleteClient, getClients } from "@/lib/actions/client";
import { usePermissionCheck } from "@/lib/client-permissions";
import { debounce, formatPhone, formatShortDate, truncate } from "@/lib/utils";

interface ClientData {
  id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  ice: string | null;
  clientReference: string | null;
  createdAt: Date;
  _count: { dossiers: number };
}

const PAGE_SIZE = 10;

export default function ClientsPage() {
  const { can, status } = usePermissionCheck();
  const canView = can("clients.view");
  const canCreate = can("clients.create");
  const canUpdate = can("clients.update");
  const canDelete = can("clients.delete");
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientData | null>(null);

  const debouncedApply = useRef(debounce((value: string) => setAppliedQuery(value), 300)).current;

  useEffect(() => {
    if (status === "loading") return;
    if (!canView) {
      setLoading(false);
      return;
    }
    fetchClients();
  }, [status, canView]);

  useEffect(() => { setPage(1); }, [appliedQuery]);

  const fetchClients = async () => {
    const result = await getClients();
    if (result.success) setClients(result.data as ClientData[]);
    setLoading(false);
  };

  const clientFormFields = [
    { name: "nom", label: "Nom", type: "text" as const, placeholder: "Nom du client", required: true },
    { name: "telephone", label: "Téléphone", type: "text" as const, placeholder: "+212 6 12 34 56 78" },
    { name: "adresse", label: "Adresse", type: "text" as const, placeholder: "Adresse complète" },
    { name: "ice", label: "ICE", type: "text" as const, placeholder: "Identifiant Commun de l'Entreprise" },
    { name: "clientReference", label: "Référence Client", type: "text" as const, placeholder: "Réf. interne du client" },
  ];

  const handleSubmit = async (data: CreateClientInput) => {
    if (editingClient) return await updateClient({ ...data, id: editingClient.id });
    return await createClient(data);
  };

  const requestDelete = (client: ClientData) => {
    if (client._count.dossiers > 0) {
      toast.error(
        `Ce client possède ${client._count.dossiers} dossier${client._count.dossiers > 1 ? "s" : ""}. Il ne peut pas être supprimé afin de préserver l'historique des opérations.`
      );
      return;
    }
    setClientToDelete(client);
  };

  const handleDelete = () => {
    if (!clientToDelete) return;
    startTransition(async () => {
      const result = await deleteClient({ id: clientToDelete.id });
      if (result.success) { toast.success(result.message); setClientToDelete(null); fetchClients(); }
      else { toast.error(result.error); setClientToDelete(null); }
    });
  };

  const resetSearch = () => {
    setSearchQuery("");
    setAppliedQuery("");
  };

  const totalDossiers = clients.reduce((sum, c) => sum + c._count.dossiers, 0);
  const clientsActifs = clients.filter((c) => c._count.dossiers > 0).length;
  const now = new Date();
  const nouveauxCeMois = clients.filter((c) => {
    const d = new Date(c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const moisCourant = now.toLocaleDateString("fr-FR", { month: "long" });

  const q = appliedQuery.trim().toLowerCase();
  const filtered = q === ""
    ? clients
    : clients.filter((c) =>
        [c.nom, c.telephone, c.adresse, c.ice, c.clientReference]
          .some((v) => !!v && v.toLowerCase().includes(q))
      );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Clients" description="Gérez vos clients." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={6} columns={7} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Clients" description="Gérez vos clients." />
        <AccessDenied message="Vous n'avez pas la permission d'accéder aux clients." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Gérez vos clients.">
        {canCreate && (
          <Button onClick={() => { setEditingClient(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau client
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total clients" value={clients.length} icon={Users} hint="Références actives" />
        <StatCard title="Dossiers liés" value={totalDossiers} icon={FolderOpen} hint="Opérations rattachées" />
        <StatCard title="Clients actifs" value={clientsActifs} icon={UserCheck} hint="Clients avec au moins un dossier" />
        <StatCard title="Nouveaux ce mois" value={nouveauxCeMois} icon={UserPlus} hint={`Créés en ${moisCourant}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des clients</CardTitle>
          <CardDescription>{clients.length} client(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <PageToolbar
              searchValue={searchQuery}
              onSearchChange={(value) => { setSearchQuery(value); debouncedApply(value); }}
              searchPlaceholder="Rechercher par nom, téléphone, adresse, ICE ou référence..."
            />
          </div>

          {clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun client"
              description="Ajoutez votre premier client pour commencer à enregistrer des opérations."
              action={
                canCreate ? (
                  <Button onClick={() => { setEditingClient(null); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Nouveau client
                  </Button>
                ) : undefined
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Aucun résultat"
              description="Aucun client ne correspond à votre recherche."
              action={
                <Button variant="outline" onClick={resetSearch}>
                  Réinitialiser la recherche
                </Button>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Adresse</TableHead>
                      <TableHead>ICE</TableHead>
                      <TableHead>Réf. Client</TableHead>
                      <TableHead>Dossiers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.nom}</div>
                          <div className="text-xs text-muted-foreground">Client depuis {formatShortDate(c.createdAt)}</div>
                        </TableCell>
                        <TableCell>{c.telephone ? formatPhone(c.telephone) : "—"}</TableCell>
                        <TableCell>{c.adresse ? truncate(c.adresse, 30) : "—"}</TableCell>
                        <TableCell>{c.ice || "—"}</TableCell>
                        <TableCell>{c.clientReference || "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{c._count.dossiers}</Badge></TableCell>
                        <TableCell className="text-right">
                          {canUpdate || canDelete ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer" aria-label={`Actions pour ${c.nom}`}><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canUpdate && (
                                  <DropdownMenuItem onClick={() => { setEditingClient(c); setDialogOpen(true); }}>
                                    <Pencil className="mr-2 h-4 w-4" /> Modifier
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <DropdownMenuItem onClick={() => requestDelete(c)} className="text-red-600">
                                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} client(s) · Page {safePage}/{totalPages}
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
        title={editingClient ? "Modifier le client" : "Nouveau client"}
        description={editingClient ? "Modifiez les informations du client" : "Ajoutez un nouveau client"}
        schema={createClientSchema as any}
        fields={clientFormFields}
        onSubmit={handleSubmit}
        initialData={editingClient ? { nom: editingClient.nom, telephone: editingClient.telephone || "", adresse: editingClient.adresse || "", ice: editingClient.ice || "", clientReference: editingClient.clientReference || "" } : undefined}
        submitLabel={editingClient ? "Mettre à jour" : "Créer"}
      />

      <ConfirmDialog
        open={!!clientToDelete}
        onOpenChange={(open) => { if (!open) setClientToDelete(null); }}
        title="Supprimer ce client ?"
        description={clientToDelete ? `Le client « ${clientToDelete.nom} » sera supprimé définitivement.` : undefined}
        confirmLabel="Supprimer"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
