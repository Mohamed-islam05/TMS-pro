// ============================================================
// Factures Page - TMS Pro
// ============================================================
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { SearchX, FileText, Wallet, Receipt, ClipboardList, Printer, Inbox, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePermissionCheck } from "@/lib/client-permissions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { PageToolbar } from "@/components/page-toolbar";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { getFactures } from "@/lib/actions/factures";
import { formatCurrency, formatShortDate, debounce } from "@/lib/utils";
import { roundMoney } from "@/lib/calculations";
import { VEHICULE_TYPE, DOSSIER_STATUT_LABELS, vehiculeTypeLabel } from "@/lib/constants";

interface FactureData {
  id: string;
  reference: string;
  montantTotal: number;
  tva: number;
  montantHT: number;
  createdAt: Date;
  dateFacture: Date | null;
  dossier: {
    reference: string;
    statut: string;
    typeVehicule: string | null;
    tvaRate: number;
    lieuDepart: string;
    lieuArrivee: string;
    client: { id: string; nom: string };
    chauffeur: { nom: string };
    camion: { matricule: string } | null;
    camionExterne: string | null;
  };
}

interface SelectOption { value: string; label: string }

const PAGE_SIZE = 10;
const ALL = "ALL";

export default function FacturesPage() {
  const { can, status } = usePermissionCheck();
  const canView = can("factures.view");
  const canPrint = can("factures.print");
  const [factures, setFactures] = useState<FactureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [statutFilter, setStatutFilter] = useState(ALL);
  const [clientFilter, setClientFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [page, setPage] = useState(1);

  const debouncedApply = useRef(debounce((value: string) => setAppliedQuery(value), 300)).current;

  useEffect(() => {
    if (status === "loading") return;
    if (!canView) {
      setLoading(false);
      return;
    }
    getFactures()
      .then((res) => { if (res.success) setFactures(res.data as FactureData[]); })
      .finally(() => setLoading(false));
  }, [canView, status]);

  useEffect(() => {
    setPage(1);
  }, [appliedQuery, statutFilter, clientFilter, typeFilter]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of factures) {
      if (!map.has(f.dossier.client.id)) map.set(f.dossier.client.id, f.dossier.client.nom);
    }
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [factures]);

  const query = appliedQuery.trim().toLowerCase();
  const filtered = factures.filter((f) => {
    const matchesSearch =
      !query ||
      f.reference.toLowerCase().includes(query) ||
      f.dossier.reference.toLowerCase().includes(query) ||
      f.dossier.client.nom.toLowerCase().includes(query) ||
      f.dossier.lieuDepart.toLowerCase().includes(query) ||
      f.dossier.lieuArrivee.toLowerCase().includes(query);
    const matchesStatut = statutFilter === ALL || f.dossier.statut === statutFilter;
    const matchesClient = clientFilter === ALL || f.dossier.client.id === clientFilter;
    const matchesType = typeFilter === ALL || f.dossier.typeVehicule === typeFilter;
    return matchesSearch && matchesStatut && matchesClient && matchesType;
  });

  const totals = {
    count: filtered.length,
    totalHT: roundMoney(filtered.reduce((s, f) => s + f.montantHT, 0)),
    totalTVA: roundMoney(filtered.reduce((s, f) => s + f.tva, 0)),
    totalTTC: roundMoney(filtered.reduce((s, f) => s + f.montantTotal, 0)),
  };

  const hasFilters = appliedQuery !== "" || statutFilter !== ALL || clientFilter !== ALL || typeFilter !== ALL;
  const resetFilters = () => {
    setSearchQuery("");
    setAppliedQuery("");
    setStatutFilter(ALL);
    setClientFilter(ALL);
    setTypeFilter(ALL);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Factures" description="Factures générées automatiquement lors de la clôture des dossiers." />
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
        <PageHeader title="Factures" description="Factures générées automatiquement lors de la clôture des dossiers." />
        <AccessDenied message="Vous n'avez pas la permission d'accéder aux factures." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Factures" description="Factures générées automatiquement lors de la clôture des dossiers." />

      <PageToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Rechercher (référence, dossier, client, trajet)..."
        filters={
          <>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filtrer par statut du dossier">
                <SelectValue placeholder="Statut du dossier" />
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
        <StatCard title="Total TTC" value={formatCurrency(totals.totalTTC)} icon={Wallet} tone="default" hint={`${totals.count} facture(s)`} />
        <StatCard title="Total HT" value={formatCurrency(totals.totalHT)} icon={FileText} tone="info" />
        <StatCard title="Total TVA" value={formatCurrency(totals.totalTVA)} icon={Receipt} tone="warning" />
        <StatCard title="Nombre de factures" value={String(totals.count)} icon={ClipboardList} tone="success" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Liste des factures</CardTitle>
          <CardDescription>{filtered.length} facture(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="Aucune facture ne correspond à vos critères"
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
                title="Aucune facture"
                description="Les factures sont générées automatiquement à la clôture d'un dossier."
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
                      <TableHead>Route</TableHead>
                      <TableHead>Type de véhicule</TableHead>
                      <TableHead>Chauffeur</TableHead>
                      <TableHead>Camion</TableHead>
                      <TableHead className="text-right">Montant HT</TableHead>
                      <TableHead className="text-right">TVA</TableHead>
                      <TableHead className="text-right">Total TTC</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="whitespace-nowrap font-medium">{f.reference}</TableCell>
                        <TableCell>
                          <StatusBadge statut={f.dossier.statut} />
                        </TableCell>
                        <TableCell>{f.dossier.client.nom}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {f.dossier.lieuDepart} → {f.dossier.lieuArrivee}
                        </TableCell>
                        <TableCell>{vehiculeTypeLabel(f.dossier.typeVehicule)}</TableCell>
                        <TableCell>{f.dossier.chauffeur.nom}</TableCell>
                        <TableCell className="whitespace-nowrap">{f.dossier.camion?.matricule || f.dossier.camionExterne || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatCurrency(f.montantHT)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatCurrency(f.tva)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-bold">{formatCurrency(f.montantTotal)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatShortDate(f.dateFacture ?? f.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          {canPrint ? (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/factures/${f.id}/imprimer`} target="_blank" rel="noopener noreferrer">
                                <Printer className="h-4 w-4" />
                              </Link>
                            </Button>
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
                    {filtered.length} facture(s) · Page {safePage}/{totalPages}
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
    </div>
  );
}
