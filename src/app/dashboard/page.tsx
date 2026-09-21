// ============================================================
// Dashboard Page - TMS Pro (Admin full view / Staff operational)
// ============================================================
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
  Inbox,
  ShieldCheck,
  Wallet,
  Activity,
  FolderOpen,
  TrendingUp,
  Truck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { getDashboardStats, getDossiersEnAttente } from "@/lib/actions/dashboard";
import { getDossiers } from "@/lib/actions/dossier";
import { getCamions } from "@/lib/actions/camion";
import { usePermissionCheck } from "@/lib/client-permissions";
import {
  formatCurrency,
  formatShortDate,
  documentStatus,
  daysUntil,
  type DocumentStatus,
} from "@/lib/utils";
import { vehiculeTypeLabel } from "@/lib/constants";

type Stats = Awaited<ReturnType<typeof getDashboardStats>>;
type PendingDossier = Awaited<ReturnType<typeof getDossiersEnAttente>>["data"][number];
type Dossier = Awaited<ReturnType<typeof getDossiers>>["data"][number];
type Camion = Awaited<ReturnType<typeof getCamions>>["data"][number];

type DocAlert = {
  id: string;
  matricule: string;
  label: string;
  date: Date;
  state: DocumentStatus;
};

const RECENT_LIMIT = 5;
const TO_TREAT_LIMIT = 6;

const DOC_LABELS: Array<{ key: "dateVisiteTechnique" | "dateAssuranceMarchandise"; label: string }> = [
  { key: "dateVisiteTechnique", label: "Visite technique" },
  { key: "dateAssuranceMarchandise", label: "Assurance marchandise" },
];

function buildDocumentAlerts(camions: Camion[]): DocAlert[] {
  return camions
    .flatMap((c) => {
      const items: DocAlert[] = [];
      for (const doc of DOC_LABELS) {
        const date = c[doc.key];
        const state = documentStatus(date);
        if (state === "EXPIRE" || state === "BIENTOT_EXPIRE") {
          items.push({ id: c.id, matricule: c.matricule, label: doc.label, date: date as Date, state });
        }
      }
      return items;
    })
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { can, status } = usePermissionCheck();
  const canOverview = can("dashboard.overview");
  const canFinancials = can("dashboard.financials");
  const canAlerts = can("dashboard.alerts");
  const userName = session?.user?.nom || session?.user?.email || "Utilisateur";

  const [stats, setStats] = useState<Stats>(null);
  const [pending, setPending] = useState<PendingDossier[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [camions, setCamions] = useState<Camion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!canOverview) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const s = await getDashboardStats();
      if (!active) return;
      setStats(s);

      const [d, c] = await Promise.all([getDossiers(), getCamions()]);
      if (!active) return;
      if (d.success) setDossiers(d.data);
      if (c.success) setCamions(c.data);

      if (canAlerts) {
        const p = await getDossiersEnAttente();
        if (active && p.success) setPending(p.data);
      }

      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [canAlerts, canOverview, status]);

  const recentDossiers = dossiers.slice(0, RECENT_LIMIT);
  const staffToTreat = dossiers
    .filter((d) => d.statut === "OUVERT" || d.statut === "EN_ATTENTE_VALIDATION")
    .slice(0, TO_TREAT_LIMIT);
  const documentAlerts = buildDocumentAlerts(camions);

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={4} columns={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canOverview) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tableau de bord" description="Vue d'ensemble de votre activité." />
        <AccessDenied message="Vous n'avez pas la permission d'accéder au tableau de bord." />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tableau de bord" description="Vue d'ensemble de votre activité." />
        <Card>
          <CardContent>
            <EmptyState
              icon={AlertTriangle}
              title="Impossible de charger les données"
              description="Veuillez réessayer dans quelques instants."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour, ${userName}`}
        description={
          canFinancials
            ? "Vue d'ensemble de votre activité : traitez les dossiers en attente et surveillez vos documents véhicules."
            : "Vos opérations en cours : ouvrez vos dossiers et suivez leur statut de validation."
        }
      />

      {canFinancials ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              title="Chiffre d'affaires"
              value={formatCurrency(stats.totalVente)}
              icon={Wallet}
              tone="success"
            />
            <StatCard
              title="Dossiers"
              value={String(stats.totalDossiers)}
              icon={Activity}
              tone="info"
            />
            <StatCard
              title="Dossiers ouverts"
              value={String(stats.dossiersParStatut.OUVERT)}
              icon={FolderOpen}
              tone="default"
            />
            <StatCard
              title="En attente de validation"
              value={String(stats.dossiersParStatut.EN_ATTENTE_VALIDATION)}
              icon={Clock}
              tone="warning"
            />
            <StatCard
              title="Bénéfice net"
              value={
                stats.totalDossiers - stats.unknownBeneficeCount > 0
                  ? formatCurrency(stats.totalBeneficeKnown)
                  : "—"
              }
              icon={TrendingUp}
              tone={
                stats.totalDossiers - stats.unknownBeneficeCount === 0
                  ? "default"
                  : stats.isBeneficeIncomplete
                  ? "warning"
                  : stats.totalBeneficeKnown >= 0
                  ? "success"
                  : "danger"
              }
              hint={
                stats.isBeneficeIncomplete
                  ? `Bénéfice incomplet — ${stats.unknownBeneficeCount} opération(s) sans prix d'achat`
                  : undefined
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {canAlerts && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Dossiers en attente de validation
                  {pending.length > 0 && (
                    <Badge className="bg-amber-100 text-amber-800">{pending.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pending.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="Aucun dossier en attente"
                    description="Tous les dossiers envoyés pour validation ont été traités."
                  />
                ) : (
                  <ul className="divide-y">
                    {pending.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge statut={d.statut} />
                            <Link
                              href={`/dashboard/operations/${d.id}`}
                              className="truncate font-medium hover:underline"
                            >
                              {d.reference}
                            </Link>
                          </div>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {d.client.nom} · {d.lieuDepart} → {d.lieuArrivee}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-medium">{formatCurrency(d.prixVente)}</span>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/operations/${d.id}`}>Vérifier</Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            )}

            {canAlerts && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Alertes documents véhicules
                  {documentAlerts.length > 0 && (
                    <Badge className="bg-red-100 text-red-700">{documentAlerts.length}</Badge>
                  )}
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/camions">Voir camions</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {documentAlerts.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="Aucune alerte documentaire"
                    description="Les documents de vos véhicules sont valides ou non renseignés."
                  />
                ) : (
                  <ul className="divide-y">
                    {documentAlerts.slice(0, TO_TREAT_LIMIT).map((a, i) => (
                      <li key={`${a.id}-${a.label}`} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {a.matricule} · {a.label}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {a.state === "EXPIRE"
                              ? `Expiré depuis ${Math.abs(daysUntil(a.date))} j`
                              : `Expire dans ${daysUntil(a.date)} j`}
                          </p>
                        </div>
                        <DocumentStatusBadge state={a.state} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            )}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activité récente</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/operations">
                  Toutes les opérations
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentDossiers.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Aucune opération"
                  description="Créez votre première opération pour voir son activité ici."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Véhicule</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentDossiers.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/operations/${d.id}`}
                              className="font-medium hover:underline"
                            >
                              {d.reference}
                            </Link>
                          </TableCell>
                          <TableCell>{d.client.nom}</TableCell>
                          <TableCell>
                            {d.lieuDepart} → {d.lieuArrivee}
                          </TableCell>
                          <TableCell>{vehiculeTypeLabel(d.typeVehicule)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(d.prixVente)}</TableCell>
                          <TableCell>
                            <StatusBadge statut={d.statut} />
                          </TableCell>
                          <TableCell>{formatShortDate(d.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4 text-blue-600" />
                Flotte ({camions.length})
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/camions">Voir camions</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {camions.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title="Aucun véhicule"
                  description="Ajoutez un camion pour suivre ses documents ici."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {camions.map((c) => (
                    <div key={c.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{c.matricule}</p>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {vehiculeTypeLabel(c.type)}
                        </p>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">Visite technique</span>
                          <DocumentStatusBadge state={documentStatus(c.dateVisiteTechnique)} />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">Assurance marchandise</span>
                          <DocumentStatusBadge state={documentStatus(c.dateAssuranceMarchandise)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-amber-600" />
                À traiter
              </CardTitle>
            </CardHeader>
            <CardContent>
              {staffToTreat.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="Rien à traiter"
                  description="Aucun dossier ouvert ou en attente de validation."
                />
              ) : (
                <ul className="divide-y">
                  {staffToTreat.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge statut={d.statut} />
                          <Link
                            href={`/dashboard/operations/${d.id}`}
                            className="truncate font-medium hover:underline"
                          >
                            {d.reference}
                          </Link>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {d.client.nom} · {d.lieuDepart} → {d.lieuArrivee}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/operations/${d.id}`}>Ouvrir</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total opérations"
              value={String(stats.totalDossiers)}
              icon={Activity}
              tone="info"
            />
            <StatCard
              title="Ouvertes"
              value={String(stats.dossiersParStatut.OUVERT)}
              icon={FolderOpen}
              tone="default"
            />
            <StatCard
              title="En attente"
              value={String(stats.dossiersParStatut.EN_ATTENTE_VALIDATION)}
              icon={Clock}
              tone="warning"
            />
            <StatCard
              title="Clôturées"
              value={String(stats.dossiersParStatut.CLOTURE)}
              icon={ShieldCheck}
              tone="success"
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Opérations récentes</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/operations">
                  Toutes les opérations
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentDossiers.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Aucune opération"
                  description="Créez votre première opération pour la voir apparaître ici."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Véhicule</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentDossiers.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/operations/${d.id}`}
                              className="font-medium hover:underline"
                            >
                              {d.reference}
                            </Link>
                          </TableCell>
                          <TableCell>{d.client.nom}</TableCell>
                          <TableCell>
                            {d.lieuDepart} → {d.lieuArrivee}
                          </TableCell>
                          <TableCell>{vehiculeTypeLabel(d.typeVehicule)}</TableCell>
                          <TableCell>
                            <StatusBadge statut={d.statut} />
                          </TableCell>
                          <TableCell>{formatShortDate(d.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
