// ============================================================
// Camions Page - TMS Pro
// ============================================================
"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, Truck, FolderOpen, AlertTriangle, ShieldCheck, SearchX, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { PageToolbar } from "@/components/page-toolbar";
import { StatCard } from "@/components/stat-card";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReusableDialogForm } from "@/components/reusable-dialog-form";
import { createCamionSchema, type CreateCamionInput } from "@/lib/validations/camion";
import { createCamion, updateCamion, deleteCamion, getCamions } from "@/lib/actions/camion";
import { usePermissionCheck } from "@/lib/client-permissions";
import { debounce, formatShortDate, documentStatus } from "@/lib/utils";
import { VEHICULE_TYPE, vehiculeTypeLabel } from "@/lib/constants";

interface CamionData {
  id: string;
  matricule: string;
  type: string;
  marque: string | null;
  annee: number | null;
  assuranceCirculation: Date | null;
  dateVisiteTechnique: Date | null;
  dateAssuranceMarchandise: Date | null;
  chauffeur: { id: string; nom: string } | null;
  _count: { dossiers: number };
}

const PAGE_SIZE = 10;
const ALL = "ALL";
const DOC_FILTERS = [
  { value: "ALERTE", label: "En alerte" },
  { value: "EXPIRE", label: "Expiré" },
  { value: "BIENTOT_EXPIRE", label: "Expire bientôt" },
  { value: "ABSENT", label: "Non renseigné" },
];

export default function CamionsPage() {
  const { can, status } = usePermissionCheck();
  const canView = can("camions.view");
  const canCreate = can("camions.create");
  const canUpdate = can("camions.update");
  const canDelete = can("camions.delete");
  const [camions, setCamions] = useState<CamionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [docFilter, setDocFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCamion, setEditingCamion] = useState<CamionData | null>(null);
  const [camionToDelete, setCamionToDelete] = useState<CamionData | null>(null);

  const debouncedApply = useRef(debounce((value: string) => setAppliedQuery(value), 300)).current;

  useEffect(() => {
    if (status === "loading") return;
    if (!canView) {
      setLoading(false);
      return;
    }
    fetchCamions();
  }, [status, canView]);

  useEffect(() => { setPage(1); }, [appliedQuery, typeFilter, docFilter]);

  const fetchCamions = async () => {
    const result = await getCamions();
    if (result.success) setCamions(result.data as CamionData[]);
    setLoading(false);
  };

  const camionFormFields = [
    { name: "matricule", label: "Matricule", type: "text" as const, placeholder: "A-1234-BB", required: true },
    { name: "type", label: "Type", type: "select" as const, placeholder: "Sélectionnez", options: Object.entries(VEHICULE_TYPE).map(([value, label]) => ({ value, label })), required: true },
    { name: "marque", label: "Marque", type: "text" as const, placeholder: "Mercedes, Volvo..." },
    { name: "annee", label: "Année", type: "number" as const, placeholder: "2022" },
    { name: "assuranceCirculation", label: "Assurance Circulation", type: "date" as const, description: "Date d'expiration de l'assurance circulation" },
    { name: "dateVisiteTechnique", label: "Visite Technique", type: "date" as const, description: "Date d'expiration de la visite technique" },
    { name: "dateAssuranceMarchandise", label: "Assurance Marchandise", type: "date" as const, description: "Date d'expiration de l'assurance" },
  ];

  const handleSubmit = async (data: CreateCamionInput) => {
    if (editingCamion) {
      return await updateCamion({ ...data, id: editingCamion.id });
    }
    return await createCamion(data);
  };

  const handleDelete = () => {
    if (!camionToDelete) return;
    startTransition(async () => {
      const result = await deleteCamion({ id: camionToDelete.id });
      if (result.success) { toast.success(result.message); setCamionToDelete(null); fetchCamions(); }
      else { toast.error(result.error); setCamionToDelete(null); }
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setAppliedQuery("");
    setTypeFilter(ALL);
    setDocFilter(ALL);
  };

  const docStates = (c: CamionData): ReturnType<typeof documentStatus>[] => [
    documentStatus(c.assuranceCirculation),
    documentStatus(c.dateVisiteTechnique),
    documentStatus(c.dateAssuranceMarchandise),
  ];

  const inAlerte = (c: CamionData) => {
    const states = docStates(c);
    return states.some((s) => s === "EXPIRE" || s === "BIENTOT_EXPIRE");
  };

  const matchesDocFilter = (c: CamionData) => {
    const states = docStates(c);
    switch (docFilter) {
      case "ALERTE": return inAlerte(c);
      case "EXPIRE": return states.some((s) => s === "EXPIRE");
      case "BIENTOT_EXPIRE": return !states.some((s) => s === "EXPIRE") && states.some((s) => s === "BIENTOT_EXPIRE");
      case "ABSENT": return states.some((s) => s === "ABSENT");
      default: return true;
    }
  };

  const totalDossiers = camions.reduce((sum, c) => sum + c._count.dossiers, 0);
  const enAlerte = camions.filter(inAlerte).length;
  const aJour = camions.length - enAlerte;

  const q = appliedQuery.trim().toLowerCase();
  const filtered = camions.filter((c) => {
    const matchesSearch = q === "" ||
      [c.matricule, c.marque, vehiculeTypeLabel(c.type), c.chauffeur?.nom]
        .some((v) => !!v && v.toLowerCase().includes(q));
    const matchesType = typeFilter === ALL || c.type === typeFilter;
    return matchesSearch && matchesType && matchesDocFilter(c);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Camions" description="Suivez vos véhicules et l'état de leurs documents." />
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
            <TableSkeleton rows={8} columns={7} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Camions" description="Suivez vos véhicules et l'état de leurs documents." />
        <AccessDenied message="Vous n'avez pas la permission d'accéder aux camions." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Camions" description="Suivez vos véhicules et l'état de leurs documents.">
        {canCreate && (
          <Button onClick={() => { setEditingCamion(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau camion
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total camions" value={camions.length} icon={Truck} hint="Flotte enregistrée" />
        <StatCard title="Dossiers liés" value={totalDossiers} icon={FolderOpen} hint="Opérations rattachées" />
        <StatCard title="En alerte" value={enAlerte} icon={AlertTriangle} tone="warning" hint="Visite, assurance ou marchandise" />
        <StatCard title="À jour" value={aJour} icon={ShieldCheck} tone="success" hint="Tous documents valides ou non renseignés" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des camions</CardTitle>
          <CardDescription>{camions.length} camion(s) enregistré(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <PageToolbar
              searchValue={searchQuery}
              onSearchChange={(value) => { setSearchQuery(value); debouncedApply(value); }}
              searchPlaceholder="Rechercher par matricule, marque, type ou chauffeur..."
              filters={
                <>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous les types</SelectItem>
                      {Object.entries(VEHICULE_TYPE).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={docFilter} onValueChange={setDocFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="État des documents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous les documents</SelectItem>
                      {DOC_FILTERS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
            />
          </div>

          {camions.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Aucun camion"
              description="Ajoutez votre premier camion pour suivre ses documents et opérations."
              action={
                canCreate ? (
                  <Button onClick={() => { setEditingCamion(null); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Nouveau camion
                  </Button>
                ) : undefined
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Aucun résultat"
              description="Aucun camion ne correspond à votre recherche ou à vos filtres."
              action={
                <Button variant="outline" onClick={resetFilters}>
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
                      <TableHead>Matricule</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Marque</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Chauffeur</TableHead>
                      <TableHead>Dossiers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.matricule}</TableCell>
                        <TableCell><Badge variant="outline">{vehiculeTypeLabel(c.type)}</Badge></TableCell>
                        <TableCell>
                          {c.marque || "—"}
                          {c.annee && <div className="text-xs text-muted-foreground">Année {c.annee}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-muted-foreground">Visite tech.</span>
                              <div className="flex items-center gap-1.5">
                                {c.dateVisiteTechnique && <span className="text-muted-foreground/70">{formatShortDate(c.dateVisiteTechnique)}</span>}
                                <DocumentStatusBadge state={documentStatus(c.dateVisiteTechnique)} />
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-muted-foreground">Ass. circulation</span>
                              <div className="flex items-center gap-1.5">
                                {c.assuranceCirculation && <span className="text-muted-foreground/70">{formatShortDate(c.assuranceCirculation)}</span>}
                                <DocumentStatusBadge state={documentStatus(c.assuranceCirculation)} />
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-muted-foreground">Ass. marchandise</span>
                              <div className="flex items-center gap-1.5">
                                {c.dateAssuranceMarchandise && <span className="text-muted-foreground/70">{formatShortDate(c.dateAssuranceMarchandise)}</span>}
                                <DocumentStatusBadge state={documentStatus(c.dateAssuranceMarchandise)} />
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{c.chauffeur?.nom || "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{c._count.dossiers}</Badge></TableCell>
                        <TableCell className="text-right">
                          {canUpdate || canDelete ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer" aria-label={`Actions pour ${c.matricule}`}><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canUpdate && (
                                <DropdownMenuItem onClick={() => { setEditingCamion(c); setDialogOpen(true); }}>
                                  <Pencil className="mr-2 h-4 w-4" /> Modifier
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem onClick={() => setCamionToDelete(c)} className="text-red-600">
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
                    {filtered.length} camion(s) · Page {safePage}/{totalPages}
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
        title={editingCamion ? "Modifier le camion" : "Nouveau camion"}
        description={editingCamion ? "Modifiez les informations du camion" : "Ajoutez un nouveau camion"}
        schema={createCamionSchema as any}
        fields={camionFormFields}
        onSubmit={handleSubmit}
        initialData={editingCamion ? {
          matricule: editingCamion.matricule,
          type: editingCamion.type as CreateCamionInput["type"],
          marque: editingCamion.marque || "",
          annee: editingCamion.annee || undefined,
          assuranceCirculation: editingCamion.assuranceCirculation ? new Date(editingCamion.assuranceCirculation) : undefined,
          dateVisiteTechnique: editingCamion.dateVisiteTechnique ? new Date(editingCamion.dateVisiteTechnique) : undefined,
          dateAssuranceMarchandise: editingCamion.dateAssuranceMarchandise ? new Date(editingCamion.dateAssuranceMarchandise) : undefined,
        } : undefined}
        submitLabel={editingCamion ? "Mettre à jour" : "Créer"}
        maxWidth="sm:max-w-[550px]"
      />

      <ConfirmDialog
        open={!!camionToDelete}
        onOpenChange={(open) => { if (!open) setCamionToDelete(null); }}
        title="Supprimer ce camion ?"
        description={camionToDelete ? `Le camion ${camionToDelete.matricule} sera supprimé définitivement.` : undefined}
        confirmLabel="Supprimer"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
