// ============================================================
// Dossier Detail Page - TMS Pro
// ============================================================
"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePermissionCheck } from "@/lib/client-permissions";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  FileCheck,
  Percent,
  Plus,
  Printer,
  SearchX,
  Send,
  Trash2,
  Truck,
  User,
  Building2,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { StatusBadge } from "@/components/status-badge";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReusableDialogForm } from "@/components/reusable-dialog-form";
import { getDossierById, cloturerDossier, envoyerValidationDossier } from "@/lib/actions/dossier";
import { getDossierFactureId } from "@/lib/actions/factures";
import { createCharge, deleteCharge } from "@/lib/actions/charges";
import { createChargeSchema, type CreateChargeInput } from "@/lib/validations/charge";
import { cn, formatCurrency, formatDate, formatShortDate, documentStatus } from "@/lib/utils";
import { calculerBenefice, calculerMarge, calculerMontantTTC } from "@/lib/calculations";
import { DOSSIER_STATUT_LABELS, DOSSIER_STATUT_COLORS, vehiculeTypeLabel } from "@/lib/constants";

type DossierData = Awaited<ReturnType<typeof getDossierById>>["data"];

const typeLabels: Record<string, string> = {
  CARBURANT: "Carburant", PEAGE: "Péage", DEPLACEMENT_CHAUFFEUR: "Déplacement", REPARATION: "Réparation",
  AMENDE: "Amende", GARDIENNAGE: "Gardiennage", KEROSENE: "Kérosène", TELEPHONE: "Téléphone", AUTRE: "Autre",
};

const WORKFLOW_STEPS = [
  { key: "OUVERT", label: DOSSIER_STATUT_LABELS.OUVERT },
  { key: "EN_ATTENTE_VALIDATION", label: DOSSIER_STATUT_LABELS.EN_ATTENTE_VALIDATION },
  { key: "CLOTURE", label: DOSSIER_STATUT_LABELS.CLOTURE },
] as const;

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function DossierDetailPage() {
  const { dossierId } = useParams<{ dossierId: string }>();
  const { can, status } = usePermissionCheck();
  const canView = can("dossiers.view");
  const canViewCharges = can("charges.view");
  const canCreateCharge = can("charges.create");
  const canDeleteCharge = can("charges.delete");
  const canSend = can("dossiers.send");
  const canClose = can("dossiers.close");
  const canPrint = can("factures.print");
  const canViewFactures = can("factures.view");
  const [dossier, setDossier] = useState<DossierData>(null);
  const [printFactureId, setPrintFactureId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeSubmissionKey, setChargeSubmissionKey] = useState<string | null>(null);
  const [chargeToDelete, setChargeToDelete] = useState<string | null>(null);
  const [tvaRate, setTvaRate] = useState(20);

  useEffect(() => {
    if (status === "loading") return;
    if (!canView) {
      setLoading(false);
      return;
    }
    setPrintFactureId(null);
    getDossierById(dossierId)
      .then((res) => {
        if (res.success) {
          setDossier(res.data);
          if (canPrint) {
            return getDossierFactureId(dossierId).then((fr) => {
              if (fr.success && fr.data) setPrintFactureId(fr.data.id);
            });
          }
        }
      })
      .finally(() => setLoading(false));
  }, [dossierId, canView, canPrint, status]);

  async function handleEnvoyerValidation() {
    if (!dossier) return;
    setClosing(true);
    try {
      const result = await envoyerValidationDossier(dossier.id);
      if (result.success) {
        toast.success(result.message);
        const updated = await getDossierById(dossierId);
        if (updated.success) setDossier(updated.data);
      } else {
        toast.error(result.error);
      }
    } finally { setClosing(false); }
  }

  async function handleCloturer() {
    if (!dossier) return;
    setClosing(true);
    try {
      const result = await cloturerDossier(dossier.id, tvaRate);
      if (result.success) {
        toast.success(`Facture ${result.reference} générée (TVA ${tvaRate}%)`);
        const updated = await getDossierById(dossierId);
        if (updated.success) setDossier(updated.data);
      } else {
        toast.error(result.error);
      }
    } finally { setClosing(false); }
  }

  async function handleAddCharge(data: CreateChargeInput) {
    const result = await createCharge(data);
    if (result.success) {
      const updated = await getDossierById(dossierId);
      if (updated.success) setDossier(updated.data);
    }
    return result;
  }

  async function handleDeleteCharge(chargeId: string) {
    const result = await deleteCharge({ id: chargeId });
    if (result.success) {
      toast.success(result.message);
      const updated = await getDossierById(dossierId);
      if (updated.success) setDossier(updated.data);
    } else {
      toast.error(result.error);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={4} columns={4} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/operations">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux opérations
          </Link>
        </Button>
        <AccessDenied message="Vous n'avez pas la permission d'accéder à ce dossier." />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/operations">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux opérations
          </Link>
        </Button>
        <Card>
          <CardContent>
            <EmptyState
              icon={SearchX}
              title="Dossier introuvable"
              description="Ce dossier n'existe pas ou n'est pas accessible."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/operations">Voir les opérations</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalCharges = dossier.charges.reduce((sum, c) => sum + c.montant, 0);
  const benefice = calculerBenefice(dossier.prixVente, dossier.prixAchat, totalCharges);
  const marge = calculerMarge(benefice, dossier.prixVente);
  const montantTTC = dossier.facture
    ? dossier.facture.montantTotal
    : calculerMontantTTC(dossier.prixVente, dossier.tvaRate ?? 20);
  const displayMarge = marge == null ? null : Math.abs(marge) < 0.05 ? 0 : marge;
  const isOuvert = dossier.statut === "OUVERT";
  const currentStep = WORKFLOW_STEPS.findIndex((s) => s.key === dossier.statut);

  const chargeFormFields = [
    { name: "categorie", label: "Catégorie", type: "text" as const, disabled: true },
    { name: "dossierId", label: "Dossier", type: "text" as const, disabled: true },
    { name: "type", label: "Type", type: "select" as const, placeholder: "Sélectionnez", options: Object.entries(typeLabels).map(([v, l]) => ({ value: v, label: l })), required: true },
    { name: "montant", label: "Montant (DH)", type: "number" as const, placeholder: "1500", required: true },
    { name: "commentaire", label: "Commentaire", type: "text" as const, placeholder: "Détails" },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge statut={dossier.statut} />
      {dossier.statut === "OUVERT" && (
        <>
          {canCreateCharge && (
            <Button variant="outline" onClick={() => {
              setChargeSubmissionKey(crypto.randomUUID());
              setChargeDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter charge
            </Button>
          )}
          {canSend && (
            <Button disabled={closing} onClick={handleEnvoyerValidation}>
              <Send className="mr-2 h-4 w-4" />
              {closing ? "Envoi..." : "Envoyer pour validation"}
            </Button>
          )}
        </>
      )}
      {dossier.statut === "EN_ATTENTE_VALIDATION" && canClose && (
        <>
          <Select value={String(tvaRate)} onValueChange={(v) => setTvaRate(Number(v))}>
            <SelectTrigger className="w-[120px]" aria-label="Taux de TVA">
              <Percent className="mr-1 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0%</SelectItem>
              <SelectItem value="10">10%</SelectItem>
              <SelectItem value="20">20%</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={closing} onClick={handleCloturer}>
            <FileCheck className="mr-2 h-4 w-4" />
            {closing ? "Clôture..." : "Clôturer et Facturer"}
          </Button>
        </>
      )}
      {dossier.statut === "EN_ATTENTE_VALIDATION" && !canClose && (
        <span className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <Clock className="h-4 w-4" />
          En attente de validation par l'administrateur
        </span>
      )}
      {dossier.statut === "CLOTURE" && canPrint && (printFactureId || dossier.facture) && (
        <Button variant="outline" asChild>
          <Link href={`/dashboard/factures/${printFactureId ?? dossier.facture?.id}/imprimer`} target="_blank" rel="noopener noreferrer">
            <Printer className="mr-2 h-4 w-4" /> Imprimer la facture
          </Link>
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="w-fit -mb-2">
        <Link href="/dashboard/operations">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux opérations
        </Link>
      </Button>

      <PageHeader
        title={dossier.reference}
        description={`${dossier.client.nom} · ${dossier.lieuDepart} → ${dossier.lieuArrivee}`}
      >
        {headerActions}
      </PageHeader>

      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            {WORKFLOW_STEPS.map((step, i) => {
              const done = i < currentStep;
              const current = i === currentStep;
              const colorClass = DOSSIER_STATUT_COLORS[step.key];
              return (
                <Fragment key={step.key}>
                  {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
                      current || done ? colorClass : "bg-muted text-muted-foreground",
                      done && "opacity-60"
                    )}
                  >
                    {done && <Check className="h-3.5 w-3.5" />}
                    {step.label}
                  </span>
                </Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations opérationnelles</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
            <InfoItem label="Référence">{dossier.reference}</InfoItem>
            <InfoItem label="Date d'opération">{formatDate(dossier.dateOperation)}</InfoItem>
            <InfoItem label="Statut"><StatusBadge statut={dossier.statut} /></InfoItem>
            <InfoItem label="Lieu de départ">{dossier.lieuDepart}</InfoItem>
            <InfoItem label="Lieu d'arrivée">{dossier.lieuArrivee}</InfoItem>
            <InfoItem label="Type de véhicule">{vehiculeTypeLabel(dossier.typeVehicule)}</InfoItem>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Client
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tracking-tight">{dossier.client.nom}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Téléphone">{dossier.client.telephone || "—"}</InfoItem>
            <InfoItem label="Adresse">{dossier.client.adresse || "—"}</InfoItem>
            <InfoItem label="ICE">{dossier.client.ice || "—"}</InfoItem>
            <InfoItem label="Référence client">{dossier.client.clientReference || "—"}</InfoItem>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Truck className="h-4 w-4 text-muted-foreground" />
            Transport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Véhicule</p>
              {dossier.camion ? (
                <div className="space-y-1">
                  <p className="text-lg font-bold tracking-tight">{dossier.camion.matricule}</p>
                  <p className="text-sm">
                    {vehiculeTypeLabel(dossier.camion.type)}
                    {dossier.camion.marque ? ` · ${dossier.camion.marque}` : ""}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Visite technique</span>
                      <DocumentStatusBadge state={documentStatus(dossier.camion.dateVisiteTechnique)} />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Assurance marchandise</span>
                      <DocumentStatusBadge state={documentStatus(dossier.camion.dateAssuranceMarchandise)} />
                    </div>
                  </div>
                </div>
              ) : dossier.camionExterne ? (
                <div className="space-y-1">
                  <Badge className="border-transparent bg-orange-100 text-orange-800">Camion externe</Badge>
                  <p className="text-sm">{dossier.camionExterne}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun véhicule renseigné</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Chauffeur</p>
              <div className="space-y-1">
                <p className="text-lg font-bold tracking-tight">{dossier.chauffeur.nom}</p>
                <p className="text-sm text-muted-foreground">
                  {dossier.chauffeur.type === "INTERNE" ? "Chauffeur interne" : "Chauffeur externe"}
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <InfoItem label="Téléphone">{dossier.chauffeur.telephone || "—"}</InfoItem>
                  <InfoItem label="CIN">{dossier.chauffeur.cin || "—"}</InfoItem>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Tarification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Prix de vente</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(dossier.prixVente)}</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Prix d'achat</p>
              <p className="mt-1 text-xl font-bold">{dossier.prixAchat != null ? formatCurrency(dossier.prixAchat) : "—"}</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">TVA</p>
              <p className="mt-1 text-xl font-bold">{dossier.tvaRate ?? 20}%</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Montant HT</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(dossier.prixVente)}</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Montant TTC</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(montantTTC)}</p>
            </div>
            {canViewCharges && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Total charges</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(totalCharges)}</p>
            </div>
            )}
            {canViewCharges && (
            <div className={cn("rounded-lg p-4", benefice == null ? "bg-muted" : benefice >= 0 ? "bg-green-50" : "bg-red-50")}>
              <p className="text-sm text-muted-foreground">Bénéfice</p>
              <p className={cn("mt-1 text-xl font-bold", benefice == null ? "text-muted-foreground" : benefice >= 0 ? "text-green-700" : "text-red-700")}>
                {benefice == null ? "—" : formatCurrency(benefice)}
              </p>
            </div>
            )}
            {canViewCharges && (
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-muted-foreground">Marge</p>
              <p className="mt-1 text-xl font-bold text-blue-700">{displayMarge == null ? "—" : `${displayMarge.toFixed(1)}%`}</p>
            </div>
            )}
          </div>
        </CardContent>
      </Card>

      {canViewCharges && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Charges</CardTitle>
          <CardDescription>{dossier.charges.length} charge(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {dossier.charges.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Aucune charge"
              description={isOuvert ? "Ajoutez une charge à ce dossier." : "Aucune charge enregistrée pour ce dossier."}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Type</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Commentaire</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    {isOuvert && canDeleteCharge && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dossier.charges.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{typeLabels[c.type] || c.type}</TableCell>
                      <TableCell>
                        <Badge className="border-transparent bg-blue-100 text-blue-800">Dossier</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.commentaire || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatShortDate(c.createdAt)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(c.montant)}</TableCell>
                      {isOuvert && canDeleteCharge && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 cursor-pointer"
                            onClick={() => setChargeToDelete(c.id)}
                            aria-label={`Supprimer la charge ${typeLabels[c.type] || c.type}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {canViewFactures && dossier.facture && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              Facture
            </CardTitle>
            {canPrint && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/factures/${dossier.facture.id}/imprimer`} target="_blank" rel="noopener noreferrer">
                  <Printer className="mr-2 h-4 w-4" /> Imprimer
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Référence</p>
                <p className="mt-1 text-sm font-medium">{dossier.facture.reference}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Date</p>
                <p className="mt-1 text-sm font-medium">{formatShortDate(dossier.facture.dateFacture ?? dossier.facture.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Montant HT</p>
                <p className="mt-1 text-sm font-medium">{formatCurrency(dossier.facture.montantHT)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">TVA</p>
                <p className="mt-1 text-sm font-medium">{formatCurrency(dossier.facture.tva)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Montant TTC</p>
                <p className="mt-1 text-sm font-bold">{formatCurrency(dossier.facture.montantTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ReusableDialogForm
        open={chargeDialogOpen}
        onOpenChange={setChargeDialogOpen}
        title="Nouvelle charge"
        description="Ajoutez une charge à ce dossier"
        schema={createChargeSchema as any}
        fields={chargeFormFields}
        onSubmit={handleAddCharge}
        initialData={{ categorie: "DOSSIER", dossierId: dossier.id }}
        submissionKey={chargeSubmissionKey ?? undefined}
        submitLabel="Ajouter"
      />

      <ConfirmDialog
        open={chargeToDelete !== null}
        onOpenChange={(open) => { if (!open) setChargeToDelete(null); }}
        title="Supprimer cette charge ?"
        description="La charge sera supprimée définitivement de ce dossier."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (!chargeToDelete) return;
          const id = chargeToDelete;
          setChargeToDelete(null);
          handleDeleteCharge(id);
        }}
      />
    </div>
  );
}
