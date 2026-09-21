// ============================================================
// Chauffeurs Page - TMS Pro
// ============================================================
"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, MoreHorizontal, Truck, Users, UserCheck, AlertTriangle, FolderOpen, SearchX, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { PageToolbar } from "@/components/page-toolbar";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createChauffeurSchema, type CreateChauffeurInput } from "@/lib/validations/chauffeur";
import { createChauffeur, updateChauffeur, deleteChauffeur, getChauffeurs } from "@/lib/actions/chauffeur";
import { getCamions } from "@/lib/actions/camion";
import { usePermissionCheck } from "@/lib/client-permissions";
import { debounce, formatPhone } from "@/lib/utils";
import { vehiculeTypeLabel } from "@/lib/constants";

interface ChauffeurData {
  id: string;
  nom: string;
  telephone: string;
  cin: string;
  type: string;
  camionExterne: string | null;
  actif: boolean;
  camionId: string | null;
  camion: { matricule: string; type: string } | null;
  _count: { dossiers: number };
}

interface SelectOption {
  value: string;
  label: string;
}

const PAGE_SIZE = 10;
const ALL = "ALL";

export default function ChauffeursPage() {
  const { can, status } = usePermissionCheck();
  const canView = can("chauffeurs.view");
  const canCreate = can("chauffeurs.create");
  const canUpdate = can("chauffeurs.update");
  const canDelete = can("chauffeurs.delete");
  const [chauffeurs, setChauffeurs] = useState<ChauffeurData[]>([]);
  const [camionOptions, setCamionOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statutFilter, setStatutFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChauffeur, setEditingChauffeur] = useState<ChauffeurData | null>(null);
  const [chauffeurToDelete, setChauffeurToDelete] = useState<ChauffeurData | null>(null);
  const [selectedType, setSelectedType] = useState<"INTERNE" | "EXTERNE">("INTERNE");

  const debouncedApply = useRef(debounce((value: string) => setAppliedQuery(value), 300)).current;

  const form = useForm<CreateChauffeurInput>({
    resolver: zodResolver(createChauffeurSchema),
    defaultValues: {
      nom: "",
      telephone: "",
      cin: "",
      type: "INTERNE",
      camionId: "",
      camionExterne: "",
      actif: true,
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
      if (editingChauffeur) {
        const t = editingChauffeur.type as "INTERNE" | "EXTERNE";
        setSelectedType(t);
        form.reset({
          nom: editingChauffeur.nom,
          telephone: editingChauffeur.telephone,
          cin: editingChauffeur.cin,
          type: t,
          camionId: editingChauffeur.camionId || "",
          camionExterne: editingChauffeur.camionExterne || "",
          actif: editingChauffeur.actif,
        });
      } else {
        setSelectedType("INTERNE");
        form.reset({
          nom: "",
          telephone: "",
          cin: "",
          type: "INTERNE",
          camionId: "",
          camionExterne: "",
          actif: true,
        });
      }
    }
  }, [dialogOpen, editingChauffeur, form]);

  useEffect(() => { setPage(1); }, [appliedQuery, typeFilter, statutFilter]);

  const fetchData = async () => {
    const [chResult, cResult] = await Promise.all([getChauffeurs(), getCamions()]);
    if (chResult.success) setChauffeurs(chResult.data as ChauffeurData[]);
    if (cResult.success) {
      setCamionOptions(
        (cResult.data as any[]).map((c) => ({ value: c.id, label: `${c.matricule} (${vehiculeTypeLabel(c.type)})` }))
      );
    }
    setLoading(false);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    const submitData = {
      ...data,
      type: selectedType,
      camionId: selectedType === "INTERNE" ? (data.camionId || "") : "",
      camionExterne: selectedType === "EXTERNE" ? (data.camionExterne || "") : "",
    };
    startTransition(async () => {
      let result;
      if (editingChauffeur) {
        result = await updateChauffeur({ ...submitData, id: editingChauffeur.id });
      } else {
        result = await createChauffeur(submitData);
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

  const handleDelete = () => {
    if (!chauffeurToDelete) return;
    startTransition(async () => {
      const result = await deleteChauffeur({ id: chauffeurToDelete.id });
      if (result.success) { toast.success(result.message); setChauffeurToDelete(null); fetchData(); }
      else { toast.error(result.error); setChauffeurToDelete(null); }
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setAppliedQuery("");
    setTypeFilter(ALL);
    setStatutFilter(ALL);
  };

  const totalDossiers = chauffeurs.reduce((sum, ch) => sum + ch._count.dossiers, 0);
  const chauffeursActifs = chauffeurs.filter((ch) => ch.actif).length;
  const sansCamion = chauffeurs.filter((ch) => ch.type === "INTERNE" && !ch.camionId).length;

  const q = appliedQuery.trim().toLowerCase();
  const filtered = chauffeurs.filter((ch) => {
    const matchesSearch = q === "" ||
      [ch.nom, ch.telephone, ch.cin, ch.camionExterne, ch.camion?.matricule]
        .some((v) => !!v && v.toLowerCase().includes(q));
    const matchesType = typeFilter === ALL || ch.type === typeFilter;
    const matchesStatut = statutFilter === ALL ||
      (statutFilter === "ACTIF" ? ch.actif : !ch.actif);
    return matchesSearch && matchesType && matchesStatut;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Chauffeurs" description="Gérez vos équipes et sous-traitants." />
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
        <PageHeader title="Chauffeurs" description="Gérez vos équipes et sous-traitants." />
        <AccessDenied message="Vous n'avez pas la permission d'accéder aux chauffeurs." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Chauffeurs" description="Gérez vos équipes et sous-traitants.">
        {canCreate && (
          <Button onClick={() => { setEditingChauffeur(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau chauffeur
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total chauffeurs" value={chauffeurs.length} icon={Users} hint="Équipe et sous-traitants" />
        <StatCard title="Actifs" value={chauffeursActifs} icon={UserCheck} tone="success" hint="Sur le terrain" />
        <StatCard title="Sans camion" value={sansCamion} icon={AlertTriangle} tone="warning" hint="Camion non assigné" />
        <StatCard title="Dossiers liés" value={totalDossiers} icon={FolderOpen} hint="Opérations rattachées" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des chauffeurs</CardTitle>
          <CardDescription>{chauffeurs.length} chauffeur(s) enregistré(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <PageToolbar
              searchValue={searchQuery}
              onSearchChange={(value) => { setSearchQuery(value); debouncedApply(value); }}
              searchPlaceholder="Rechercher par nom, téléphone, CIN ou camion..."
              filters={
                <>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous les types</SelectItem>
                      <SelectItem value="INTERNE">Interne</SelectItem>
                      <SelectItem value="EXTERNE">Externe</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statutFilter} onValueChange={setStatutFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous les statuts</SelectItem>
                      <SelectItem value="ACTIF">Actif</SelectItem>
                      <SelectItem value="INACTIF">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              }
            />
          </div>

          {chauffeurs.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun chauffeur"
              description="Ajoutez votre premier chauffeur pour l'affecter à des opérations."
              action={
                canCreate ? (
                  <Button onClick={() => { setEditingChauffeur(null); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Nouveau chauffeur
                  </Button>
                ) : undefined
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Aucun résultat"
              description="Aucun chauffeur ne correspond à votre recherche ou à vos filtres."
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
                      <TableHead>Nom</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>CIN</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Camion</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Dossiers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((ch) => (
                      <TableRow key={ch.id}>
                        <TableCell className="font-medium">{ch.nom}</TableCell>
                        <TableCell>{formatPhone(ch.telephone)}</TableCell>
                        <TableCell>{ch.cin}</TableCell>
                        <TableCell>
                          <Badge variant={ch.type === "INTERNE" ? "default" : "outline"}>
                            {ch.type === "INTERNE" ? "Interne" : "Externe"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ch.type === "INTERNE" && ch.camion ? (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Truck className="h-3 w-3" /> {ch.camion.matricule}
                            </Badge>
                          ) : ch.type === "EXTERNE" && ch.camionExterne ? (
                            <span className="text-sm text-muted-foreground">{ch.camionExterne}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ch.actif ? "default" : "secondary"}>{ch.actif ? "Actif" : "Inactif"}</Badge>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{ch._count.dossiers}</Badge></TableCell>
                        <TableCell className="text-right">
                          {canUpdate || canDelete ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer" aria-label={`Actions pour ${ch.nom}`}><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canUpdate && (
                                <DropdownMenuItem onClick={() => { setEditingChauffeur(ch); setDialogOpen(true); }}>
                                  <Pencil className="mr-2 h-4 w-4" /> Modifier
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem onClick={() => setChauffeurToDelete(ch)} className="text-red-600">
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
                    {filtered.length} chauffeur(s) · Page {safePage}/{totalPages}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingChauffeur ? "Modifier le chauffeur" : "Nouveau chauffeur"}</DialogTitle>
            <DialogDescription>
              {editingChauffeur ? "Modifiez les informations du chauffeur" : "Ajoutez un nouveau chauffeur"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom complet <span className="text-red-500 ml-1">*</span></FormLabel>
                      <FormControl><Input placeholder="Mohammed Ali" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telephone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone <span className="text-red-500 ml-1">*</span></FormLabel>
                      <FormControl><Input placeholder="+212 6 12 34 56 78" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CIN <span className="text-red-500 ml-1">*</span></FormLabel>
                      <FormControl><Input placeholder="BK 123456" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>Type de chauffeur <span className="text-red-500 ml-1">*</span></FormLabel>
                  <Select
                    value={selectedType}
                    onValueChange={(v) => {
                      setSelectedType(v as "INTERNE" | "EXTERNE");
                      form.setValue("type", v as "INTERNE" | "EXTERNE");
                      if (v === "INTERNE") {
                        form.setValue("camionExterne", "");
                      } else {
                        form.setValue("camionId", "");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERNE">Interne</SelectItem>
                      <SelectItem value="EXTERNE">Externe</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>

                {selectedType === "INTERNE" ? (
                  <FormField
                    control={form.control}
                    name="camionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Camion</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value as string}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un camion" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Aucun</SelectItem>
                            {camionOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="camionExterne"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Camion (nom ou matricule)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Volvo FH16 - Mat 22345-B" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
                    editingChauffeur ? "Mettre à jour" : "Créer"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!chauffeurToDelete}
        onOpenChange={(open) => { if (!open) setChauffeurToDelete(null); }}
        title="Supprimer ce chauffeur ?"
        description={chauffeurToDelete ? `Le chauffeur « ${chauffeurToDelete.nom} » sera supprimé définitivement.` : undefined}
        confirmLabel="Supprimer"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
