// ============================================================
// Operations (Dossiers) Page - TMS Pro
// ============================================================
"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePermissionCheck } from "@/lib/client-permissions";
import {
  Plus,
  FileCheck,
  Send,
  MoreHorizontal,
  Pencil,
  Trash2,
  Printer,
  Loader2,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  SearchX,
  Inbox,
  Activity,
  FolderOpen,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { PageToolbar } from "@/components/page-toolbar";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createDossierSchema, type CreateDossierInput } from "@/lib/validations/operation";
import { createDossier, updateDossier, deleteDossier, cloturerDossier, envoyerValidationDossier, getDossiers } from "@/lib/actions/dossier";
import { getClients } from "@/lib/actions/client";
import { getChauffeurs } from "@/lib/actions/chauffeur";
import { getAvailableCamions } from "@/lib/actions/camion";
import { formatCurrency, formatShortDate, numberFromInput, debounce } from "@/lib/utils";
import { DOSSIER_STATUT_LABELS, VEHICULE_TYPE, vehiculeTypeLabel } from "@/lib/constants";

interface DossierData {
  id: string;
  reference: string;
  statut: string;
  lieuDepart: string;
  lieuArrivee: string;
  prixVente: number;
  prixAchat: number | null;
  tvaRate: number;
  typeVehicule: string | null;
  dateOperation: Date | null;
  camionExterne: string | null;
  client: { id: string; nom: string };
  chauffeur: { id: string; nom: string };
  camion: { id: string; matricule: string } | null;
  charges: { montant: number }[];
  facture: { id: string; reference: string; montantTotal: number } | null;
}

interface SelectOption { value: string; label: string }

interface ChauffeurData {
  id: string;
  nom: string;
  type: string;
  camionId: string | null;
  camion: { matricule: string } | null;
}

type ConfirmKind = "validate" | "delete";

const PAGE_SIZE = 10;
const ALL = "ALL";

export default function OperationsPage() {
  const { can, status } = usePermissionCheck();
  const canView = can("dossiers.view");
  const canCreate = can("dossiers.create");
  const canUpdate = can("dossiers.update");
  const canDelete = can("dossiers.delete");
  const canSend = can("dossiers.send");
  const canClose = can("dossiers.close");
  const canPrint = can("factures.print");
  const [dossiers, setDossiers] = useState<DossierData[]>([]);
  const [clientOptions, setClientOptions] = useState<SelectOption[]>([]);
  const [chauffeurs, setChauffeurs] = useState<ChauffeurData[]>([]);
  const [camionOptions, setCamionOptions] = useState<SelectOption[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [clientFilter, setClientFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDossier, setEditingDossier] = useState<DossierData | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ kind: ConfirmKind; dossier: DossierData } | null>(null);
  const [selectedChauffeurType, setSelectedChauffeurType] = useState<"INTERNE" | "EXTERNE" | null>(null);

  const form = useForm<CreateDossierInput>({
    resolver: zodResolver(createDossierSchema),
    defaultValues: {
      reference: "",
      clientId: "",
      chauffeurId: "",
      camionId: "",
      camionExterne: "",
      lieuDepart: "",
      lieuArrivee: "",
      prixVente: undefined,
      prixAchat: undefined,
      tvaRate: 20,
      typeVehicule: "",
      dateOperation: undefined,
      statut: "OUVERT",
    },
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!canView) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [status, canView]);

  useEffect(() => {
    if (dialogOpen) {
      if (editingDossier) {
        const chType = chauffeurs.find((c) => c.id === editingDossier.chauffeur.id)?.type as "INTERNE" | "EXTERNE" | undefined;
        setSelectedChauffeurType(chType || null);
        form.reset({
          reference: editingDossier.reference,
          clientId: editingDossier.client.id,
          chauffeurId: editingDossier.chauffeur.id,
          camionId: editingDossier.camion?.id || "",
          camionExterne: editingDossier.camionExterne || "",
          lieuDepart: editingDossier.lieuDepart,
          lieuArrivee: editingDossier.lieuArrivee,
          prixVente: editingDossier.prixVente,
          prixAchat: editingDossier.prixAchat ?? undefined,
          tvaRate: editingDossier.tvaRate ?? 20,
          typeVehicule: (editingDossier.typeVehicule || "") as CreateDossierInput["typeVehicule"],
          dateOperation: editingDossier.dateOperation ? new Date(editingDossier.dateOperation) : undefined,
          statut: editingDossier.statut as CreateDossierInput["statut"],
        });
      } else {
        setSelectedChauffeurType(null);
        form.reset({
          reference: "",
          clientId: "",
          chauffeurId: "",
          camionId: "",
          camionExterne: "",
          lieuDepart: "",
          lieuArrivee: "",
          prixVente: undefined,
          prixAchat: undefined,
          tvaRate: 20,
          typeVehicule: "",
          dateOperation: undefined,
          statut: "OUVERT",
        });
      }
    }
  }, [dialogOpen, editingDossier, chauffeurs, form]);

  const debouncedApply = useRef(debounce((value: string) => setAppliedQuery(value), 300)).current;

  useEffect(() => {
    setPage(1);
  }, [appliedQuery, statusFilter, clientFilter, typeFilter]);

  const fetchData = async () => {
    const [dRes, clRes, chRes, cRes] = await Promise.all([getDossiers(), getClients(), getChauffeurs(), getAvailableCamions()]);
    if (dRes.success) setDossiers(dRes.data as DossierData[]);
    if (clRes.success) setClientOptions((clRes.data as any[]).map((c) => ({ value: c.id, label: c.nom })));
    if (chRes.success) setChauffeurs(chRes.data as ChauffeurData[]);
    if (cRes.success) setCamionOptions((cRes.data as any[]).map((c) => ({ value: c.id, label: c.matricule })));
    setLoading(false);
  };

  const chauffeurOptions = chauffeurs.map((c) => ({ value: c.id, label: c.nom }));

  const handleChauffeurChange = async (chauffeurId: string) => {
    if (!chauffeurId) {
      setSelectedChauffeurType(null);
      form.setValue("camionId", "");
      form.setValue("camionExterne", "");
      return;
    }
    const ch = chauffeurs.find((c) => c.id === chauffeurId);
    if (!ch) return;

    setSelectedChauffeurType(ch.type as "INTERNE" | "EXTERNE");

    if (ch.type === "INTERNE") {
      form.setValue("camionExterne", "");
      if (ch.camionId) {
        form.setValue("camionId", ch.camionId);
      } else {
        form.setValue("camionId", "");
      }
    } else {
      form.setValue("camionId", "");
      form.setValue("camionExterne", "");
    }
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    const submitData = {
      ...data,
      camionId: selectedChauffeurType === "INTERNE" ? (data.camionId || "") : "",
      camionExterne: selectedChauffeurType === "EXTERNE" ? (data.camionExterne || "") : "",
    };
    startTransition(async () => {
      let result;
      if (editingDossier) {
        result = await updateDossier({ ...submitData, id: editingDossier.id });
      } else {
        result = await createDossier(submitData);
      }
      if (result.success) {
        toast.success(result.message);
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(result.error);
      }
    });
  });

  const handleCloturer = async (id: string) => {
    setClosingId(id);
    try {
      const result = await cloturerDossier(id);
      if (result.success) {
        toast.success(`Facture ${result.reference} générée`);
        fetchData();
      } else {
        toast.error(result.error);
      }
    } finally { setClosingId(null); }
  };

  const handleEnvoyerValidation = async (id: string) => {
    setClosingId(id);
    try {
      const result = await envoyerValidationDossier(id);
      if (result.success) {
        toast.success(result.message);
        fetchData();
      } else {
        toast.error(result.error);
      }
    } finally { setClosingId(null); }
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      const result = await deleteDossier({ id });
      if (result.success) { toast.success(result.message); fetchData(); } else { toast.error(result.error); }
    });
  };

  const runConfirm = (action: { kind: ConfirmKind; dossier: DossierData }) => {
    setConfirmAction(null);
    if (action.kind === "validate") {
      handleEnvoyerValidation(action.dossier.id);
    } else {
      handleDelete(action.dossier.id);
    }
  };

  const query = appliedQuery.trim().toLowerCase();
  const filtered = dossiers.filter((d) => {
    const matchesSearch =
      !query ||
      d.reference.toLowerCase().includes(query) ||
      d.client.nom.toLowerCase().includes(query) ||
      d.lieuDepart.toLowerCase().includes(query) ||
      d.lieuArrivee.toLowerCase().includes(query);
    const matchesStatus = statusFilter === ALL || d.statut === statusFilter;
    const matchesClient = clientFilter === ALL || d.client.id === clientFilter;
    const matchesType = typeFilter === ALL || d.typeVehicule === typeFilter;
    return matchesSearch && matchesStatus && matchesClient && matchesType;
  });

  const hasFilters = appliedQuery !== "" || statusFilter !== ALL || clientFilter !== ALL || typeFilter !== ALL;
  const resetFilters = () => {
    setSearchQuery("");
    setAppliedQuery("");
    setStatusFilter(ALL);
    setClientFilter(ALL);
    setTypeFilter(ALL);
    setPage(1);
  };

  const counts = {
    total: dossiers.length,
    OUVERT: dossiers.filter((d) => d.statut === "OUVERT").length,
    EN_ATTENTE_VALIDATION: dossiers.filter((d) => d.statut === "EN_ATTENTE_VALIDATION").length,
    CLOTURE: dossiers.filter((d) => d.statut === "CLOTURE").length,
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const confirmTitle = confirmAction?.kind === "delete" ? "Supprimer ce dossier ?" : "Envoyer pour validation";
  const confirmDescription = confirmAction
    ? confirmAction.kind === "delete"
      ? `Le dossier ${confirmAction.dossier.reference} sera supprimé définitivement.`
      : `Confirmer l'envoi du dossier ${confirmAction.dossier.reference} pour validation ?`
    : undefined;
  const confirmLabel = confirmAction?.kind === "delete" ? "Supprimer" : "Envoyer";
  const confirmVariant = confirmAction?.kind === "delete" ? ("destructive" as const) : ("default" as const);

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Opérations" description="Suivez et gérez les opérations de transport." />
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
            <TableSkeleton rows={8} columns={8} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Opérations" description="Suivez et gérez les opérations de transport." />
        <AccessDenied message="Vous n'avez pas la permission d'accéder aux opérations." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Opérations" description="Suivez et gérez les opérations de transport.">
        {canCreate && (
          <Button onClick={() => { setEditingDossier(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle opération
          </Button>
        )}
      </PageHeader>

      <PageToolbar
        searchValue={searchQuery}
        onSearchChange={(value) => { setSearchQuery(value); debouncedApply(value); }}
        searchPlaceholder="Rechercher (référence, client, trajet)..."
        filters={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filtrer par statut">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les statuts</SelectItem>
                {Object.entries(DOSSIER_STATUT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filtrer par client">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les clients</SelectItem>
                {clientOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filtrer par type de véhicule">
                <SelectValue placeholder="Type de véhicule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les types</SelectItem>
                {Object.entries(VEHICULE_TYPE).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total opérations" value={String(counts.total)} icon={Activity} tone="info" />
        <StatCard title="Ouvertes" value={String(counts.OUVERT)} icon={FolderOpen} tone="default" />
        <StatCard title="En attente" value={String(counts.EN_ATTENTE_VALIDATION)} icon={Clock} tone="warning" />
        <StatCard title="Clôturées" value={String(counts.CLOTURE)} icon={ShieldCheck} tone="success" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Liste des opérations</CardTitle>
          <CardDescription>{filtered.length} opération(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="Aucune opération ne correspond à vos critères"
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
                title="Aucune opération"
                description="Créez votre première opération de transport pour démarrer."
              />
            )
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Référence</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Trajet</TableHead>
                      <TableHead>Type de véhicule</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          <Link href={`/dashboard/operations/${d.id}`} className="hover:underline">
                            {d.reference}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge statut={d.statut} />
                        </TableCell>
                        <TableCell>{d.client.nom}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {d.lieuDepart} → {d.lieuArrivee}
                        </TableCell>
                        <TableCell>{vehiculeTypeLabel(d.typeVehicule)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatShortDate(d.dateOperation)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium">
                          {formatCurrency(d.prixVente)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer" aria-label={`Actions pour ${d.reference}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/operations/${d.id}`}>
                                  <Eye className="mr-2 h-4 w-4" /> Voir le dossier
                                </Link>
                              </DropdownMenuItem>
                              {d.statut === "OUVERT" && (
                                <>
                                  {canSend && (
                                    <DropdownMenuItem onClick={() => setConfirmAction({ kind: "validate", dossier: d })} disabled={closingId === d.id}>
                                      <Send className="mr-2 h-4 w-4" /> Envoyer pour validation
                                    </DropdownMenuItem>
                                  )}
                                  {canUpdate && (
                                    <DropdownMenuItem onClick={() => { setEditingDossier(d); setDialogOpen(true); }}>
                                      <Pencil className="mr-2 h-4 w-4" /> Modifier
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <DropdownMenuItem onClick={() => setConfirmAction({ kind: "delete", dossier: d })} className="text-red-600">
                                      <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                              {d.statut === "EN_ATTENTE_VALIDATION" && canClose && (
                                <>
                                  <DropdownMenuItem onClick={() => handleCloturer(d.id)} disabled={closingId === d.id}>
                                    <FileCheck className="mr-2 h-4 w-4" /> {closingId === d.id ? "Clôture..." : "Clôturer"}
                                  </DropdownMenuItem>
                                  {canUpdate && (
                                    <DropdownMenuItem onClick={() => { setEditingDossier(d); setDialogOpen(true); }}>
                                      <Pencil className="mr-2 h-4 w-4" /> Modifier
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                              {d.statut === "EN_ATTENTE_VALIDATION" && !canClose && (
                                <DropdownMenuItem disabled>
                                  <Clock className="mr-2 h-4 w-4" /> En attente de validation
                                </DropdownMenuItem>
                              )}
                              {d.statut === "CLOTURE" && d.facture && canPrint && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/factures/${d.facture.id}/imprimer`} target="_blank" rel="noopener noreferrer">
                                    <Printer className="mr-2 h-4 w-4" /> Imprimer Facture
                                  </Link>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} opération(s) · Page {safePage}/{totalPages}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingDossier ? "Modifier le dossier" : "Nouvelle opération"}</DialogTitle>
            <DialogDescription>
              {editingDossier ? "Modifiez les informations du dossier" : "Créez un nouveau dossier de transport"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client <span className="text-red-500 ml-1">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                        <SelectContent>
                          {clientOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="chauffeurId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chauffeur <span className="text-red-500 ml-1">*</span></FormLabel>
                      <Select
                        onValueChange={(v) => {
                          field.onChange(v);
                          handleChauffeurChange(v);
                        }}
                        value={field.value || ""}
                      >
                        <SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                        <SelectContent>
                          {chauffeurOptions.map((opt) => {
                            const ch = chauffeurs.find((c) => c.id === opt.value);
                            return (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label} {ch && <span className="text-muted-foreground text-xs ml-1">({ch.type === "INTERNE" ? "Interne" : "Externe"})</span>}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedChauffeurType === "INTERNE" && (
                  <FormField
                    control={form.control}
                    name="camionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Camion <span className="text-red-500 ml-1">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger><SelectValue placeholder="Sélectionnez un camion" /></SelectTrigger>
                          <SelectContent>
                            {camionOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {selectedChauffeurType === "EXTERNE" && (
                  <FormField
                    control={form.control}
                    name="camionExterne"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Camion (nom ou matricule) <span className="text-red-500 ml-1">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Volvo FH16 - Mat 22345-B" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="lieuDepart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lieu de départ <span className="text-red-500 ml-1">*</span></FormLabel>
                      <FormControl><Input placeholder="Casablanca" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lieuArrivee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lieu d'arrivée <span className="text-red-500 ml-1">*</span></FormLabel>
                      <FormControl><Input placeholder="Marrakech" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prixVente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix de vente (DH) <span className="text-red-500 ml-1">*</span></FormLabel>
                      <FormControl><Input type="number" placeholder="50000" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(numberFromInput(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prixAchat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix d'achat (DH)</FormLabel>
                      <FormControl><Input type="number" placeholder="30000" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(numberFromInput(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Référence <span className="text-red-500 ml-1">*</span></FormLabel>
                      <FormControl><Input placeholder="OP-2026-0001" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tvaRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TVA (%)</FormLabel>
                      <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value != null ? String(field.value) : ""}>
                        <SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="10">10%</SelectItem>
                          <SelectItem value="20">20%</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="typeVehicule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de véhicule</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(VEHICULE_TYPE).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOperation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date d'opération <span className="text-red-500 ml-1">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    editingDossier ? "Mettre à jour" : "Créer"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        variant={confirmVariant}
        loading={isPending}
        onConfirm={() => { if (confirmAction) runConfirm(confirmAction); }}
      />
    </div>
  );
}
