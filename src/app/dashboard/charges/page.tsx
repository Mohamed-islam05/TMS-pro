// ============================================================
// Charges Page - TMS Pro
// ============================================================
"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { Plus, Pencil, Trash2, MoreHorizontal, SearchX, Receipt, FileText, Globe, Wallet, ChevronLeft, ChevronRight } from "lucide-react";
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
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReusableDialogForm } from "@/components/reusable-dialog-form";
import { createChargeSchema, type CreateChargeInput } from "@/lib/validations/charge";
import { createCharge, updateCharge, deleteCharge, getAllCharges } from "@/lib/actions/charges";
import { getDossiers } from "@/lib/actions/dossier";
import { usePermissionCheck } from "@/lib/client-permissions";
import { debounce, formatCurrency, formatShortDate, truncate } from "@/lib/utils";
import { DOSSIER_STATUT_LABELS } from "@/lib/constants";

interface ChargeData {
  id: string;
  type: string;
  montant: number;
  commentaire: string | null;
  categorie: string;
  dossierId: string | null;
  createdAt: Date;
  dossier: { reference: string; id: string; statut: string } | null;
}

interface SelectOption { value: string; label: string }

const typeLabels: Record<string, string> = {
  CARBURANT: "Carburant",
  PEAGE: "Péage",
  DEPLACEMENT_CHAUFFEUR: "Déplacement chauffeur",
  REPARATION: "Réparation",
  AMENDE: "Amende",
  GARDIENNAGE: "Gardiennage",
  KEROSENE: "Kérosène",
  TELEPHONE: "Téléphone",
  AUTRE: "Autre",
};

const typeColors: Record<string, string> = {
  CARBURANT: "bg-orange-100 text-orange-800",
  PEAGE: "bg-blue-100 text-blue-800",
  REPARATION: "bg-red-100 text-red-800",
  DEPLACEMENT_CHAUFFEUR: "bg-green-100 text-green-800",
  AUTRE: "bg-gray-100 text-gray-800",
};

const PAGE_SIZE = 10;
const ALL = "ALL";

export default function ChargesPage() {
  const { can, status } = usePermissionCheck();
  const canView = can("charges.view");
  const canCreate = can("charges.create");
  const canUpdate = can("charges.update");
  const canDelete = can("charges.delete");
  const [charges, setCharges] = useState<ChargeData[]>([]);
  const [dossierOptions, setDossierOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [categorieFilter, setCategorieFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statutFilter, setStatutFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [editingCharge, setEditingCharge] = useState<ChargeData | null>(null);
  const [chargeToDelete, setChargeToDelete] = useState<ChargeData | null>(null);
  const [chargeCategorie, setChargeCategorie] = useState<string>("DOSSIER");

  const debouncedApply = useRef(debounce((value: string) => setAppliedQuery(value), 300)).current;

  useEffect(() => {
    if (status === "loading") return;
    if (!canView) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [status, canView]);

  useEffect(() => { setPage(1); }, [appliedQuery, categorieFilter, typeFilter, statutFilter]);

  const fetchData = async () => {
    const [chRes, dRes] = await Promise.all([getAllCharges(), getDossiers()]);
    if (chRes.success) setCharges(chRes.data as ChargeData[]);
    if (dRes.success) {
      setDossierOptions(
        (dRes.data as any[])
          .filter((d) => d.statut === "OUVERT")
          .map((d) => ({ value: d.id, label: d.reference }))
      );
    }
    setLoading(false);
  };

  const chargeFormFields = useMemo(() => {
    const base: any[] = [
      {
        name: "categorie",
        label: "Catégorie",
        type: "select" as const,
        placeholder: "Sélectionnez",
        options: [
          { value: "DOSSIER", label: "Charge liée à un dossier" },
          { value: "GENERALE", label: "Charge générale" },
        ],
        required: true,
      },
      ...(chargeCategorie === "DOSSIER"
        ? [
            {
              name: "dossierId",
              label: "Dossier",
              type: "select" as const,
              placeholder: "Sélectionnez un dossier ouvert",
              options: dossierOptions,
              required: true,
            },
          ]
        : []),
      {
        name: "type",
        label: "Type de charge",
        type: chargeCategorie === "GENERALE" ? ("text" as const) : ("select" as const),
        placeholder: chargeCategorie === "GENERALE" ? "Ex: Loyer, Électricité, Assurance..." : "Sélectionnez",
        options: chargeCategorie === "GENERALE" ? undefined : Object.entries(typeLabels).map(([v, l]) => ({ value: v, label: l })),
        required: true,
      },
      {
        name: "montant",
        label: "Montant (DH)",
        type: "number" as const,
        placeholder: "1500",
        required: true,
      },
      {
        name: "commentaire",
        label: "Commentaire",
        type: "text" as const,
        placeholder: "Détails optionnels",
      },
    ];
    return base;
  }, [dossierOptions, chargeCategorie]);

  const handleSubmit = async (data: CreateChargeInput) => {
    if (editingCharge) return await updateCharge({ ...data, id: editingCharge.id });
    return await createCharge(data);
  };

  const handleCategorieChange = (value: string) => {
    setChargeCategorie(value);
  };

  const openNew = () => {
    setEditingCharge(null);
    setChargeCategorie("DOSSIER");
    setSubmissionKey(crypto.randomUUID());
    setDialogOpen(true);
  };

  const openEdit = (c: ChargeData) => {
    setEditingCharge(c);
    setChargeCategorie(c.categorie);
    setSubmissionKey(null);
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (!chargeToDelete) return;
    startTransition(async () => {
      const result = await deleteCharge({ id: chargeToDelete.id });
      if (result.success) { toast.success(result.message); setChargeToDelete(null); fetchData(); }
      else { toast.error(result.error); setChargeToDelete(null); }
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setAppliedQuery("");
    setCategorieFilter(ALL);
    setTypeFilter(ALL);
    setStatutFilter(ALL);
  };

  const canMutate = (c: ChargeData) => !c.dossier || c.dossier.statut === "OUVERT";

  const totalMontant = charges.reduce((s, c) => s + c.montant, 0);
  const dossierCharges = charges.filter((c) => c.categorie === "DOSSIER");
  const generales = charges.filter((c) => c.categorie === "GENERALE");
  const montantDossiers = dossierCharges.reduce((s, c) => s + c.montant, 0);
  const montantGenerales = generales.reduce((s, c) => s + c.montant, 0);

  const q = appliedQuery.trim().toLowerCase();
  const filtered = charges.filter((c) => {
    const matchesSearch = q === "" ||
      [typeLabels[c.type] || c.type, c.commentaire, c.dossier?.reference || "Générale"]
        .some((v) => !!v && v.toLowerCase().includes(q));
    const matchesCategorie = categorieFilter === ALL || c.categorie === categorieFilter;
    const matchesType = typeFilter === ALL || c.type === typeFilter;
    const matchesStatut = statutFilter === ALL || (c.dossier?.statut || null) === statutFilter;
    return matchesSearch && matchesCategorie && matchesType && matchesStatut;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Charges" description="Suivez vos charges et dépenses." />
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
            <TableSkeleton rows={8} columns={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Charges" description="Suivez vos charges et dépenses." />
        <AccessDenied message="Vous n'avez pas la permission d'accéder aux charges." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Charges" description="Suivez vos charges et dépenses.">
        {canCreate && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle charge
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total charges" value={charges.length} icon={Receipt} hint="Charges enregistrées" />
        <StatCard title="Montant total" value={formatCurrency(totalMontant)} icon={Wallet} hint="Toutes catégories" />
        <StatCard title="Liées aux dossiers" value={dossierCharges.length} icon={FileText} hint={formatCurrency(montantDossiers)} />
        <StatCard title="Générales" value={generales.length} icon={Globe} hint={formatCurrency(montantGenerales)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des charges</CardTitle>
          <CardDescription>{charges.length} charge(s) enregistrée(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <PageToolbar
              searchValue={searchQuery}
              onSearchChange={(value) => { setSearchQuery(value); debouncedApply(value); }}
              searchPlaceholder="Rechercher par type, commentaire ou dossier..."
              filters={
                <>
                  <Select value={categorieFilter} onValueChange={setCategorieFilter}>
                    <SelectTrigger className="w-[190px]">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Toutes les catégories</SelectItem>
                      <SelectItem value="DOSSIER">Liée à un dossier</SelectItem>
                      <SelectItem value="GENERALE">Générale</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[190px]">
                      <SelectValue placeholder="Type de charge" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous les types</SelectItem>
                      {Object.entries(typeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statutFilter} onValueChange={setStatutFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Statut du dossier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous les statuts</SelectItem>
                      {Object.entries(DOSSIER_STATUT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
            />
          </div>

          {charges.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Aucune charge"
              description="Ajoutez votre première charge pour suivre vos dépenses."
              action={
                canCreate ? (
                  <Button onClick={openNew}>
                    <Plus className="mr-2 h-4 w-4" /> Nouvelle charge
                  </Button>
                ) : undefined
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Aucun résultat"
              description="Aucune charge ne correspond à votre recherche ou à vos filtres."
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
                      <TableHead>Dossier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Commentaire</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.dossier ? c.dossier.reference : <span className="text-muted-foreground italic">Générale</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={typeColors[c.type] || "bg-gray-100 text-gray-800"}>
                            {typeLabels[c.type] || c.type}
                          </Badge>
                          {c.categorie === "GENERALE" && (
                            <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
                              <Globe className="mr-0.5 h-3 w-3" /> Générale
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.commentaire ? truncate(c.commentaire, 40) : "—"}</TableCell>
                        <TableCell>{formatShortDate(c.createdAt)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(c.montant)}</TableCell>
                        <TableCell className="text-right">
                          {canMutate(c) && (canUpdate || canDelete) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer" aria-label={`Actions pour ${typeLabels[c.type] || c.type}`}><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canUpdate && (
                                  <DropdownMenuItem onClick={() => openEdit(c)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Modifier
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <DropdownMenuItem onClick={() => setChargeToDelete(c)} className="text-red-600">
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
                    {filtered.length} charge(s) · Page {safePage}/{totalPages}
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
        title={editingCharge ? "Modifier la charge" : "Nouvelle charge"}
        description={editingCharge ? "Modifiez les informations de la charge" : "Ajoutez une nouvelle charge"}
        schema={createChargeSchema as any}
        fields={chargeFormFields}
        onSubmit={handleSubmit}
        initialData={editingCharge ? {
          categorie: editingCharge.categorie,
          ...(editingCharge.categorie === "DOSSIER" && editingCharge.dossierId ? { dossierId: editingCharge.dossierId } : {}),
          type: editingCharge.type,
          montant: editingCharge.montant,
          commentaire: editingCharge.commentaire || "",
        } : { categorie: chargeCategorie }}
        submissionKey={editingCharge ? undefined : submissionKey ?? undefined}
        submitLabel={editingCharge ? "Mettre à jour" : "Ajouter"}
        onFieldChange={(name, value) => {
          if (name === "categorie") handleCategorieChange(value);
        }}
      />

      <ConfirmDialog
        open={!!chargeToDelete}
        onOpenChange={(open) => { if (!open) setChargeToDelete(null); }}
        title="Supprimer cette charge ?"
        description={chargeToDelete ? `La charge « ${typeLabels[chargeToDelete.type] || chargeToDelete.type} » (${formatCurrency(chargeToDelete.montant)}) sera supprimée définitivement.` : undefined}
        confirmLabel="Supprimer"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
