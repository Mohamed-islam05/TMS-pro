// ============================================================
// Relevé de Factures Page - TMS Pro
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { Printer, Loader2, FileText, ClipboardList, SearchX, Receipt, Wallet } from "lucide-react";
import { usePermissionCheck } from "@/lib/client-permissions";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { getClients } from "@/lib/actions/client";
import { getClientReleveFactures, type ReleveFacturesResult } from "@/lib/actions/factures";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/utils";
import "./releve-print.css";

interface ClientOption {
  id: string;
  nom: string;
  clientReference: string | null;
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return toInputDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export default function ReleveFacturesPage() {
  const { can, status } = usePermissionCheck();
  const canReleve = can("factures.releve");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(toInputDate(new Date()));
  const [releve, setReleve] = useState<ReleveFacturesResult | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!canReleve) {
      setClientsLoading(false);
      return;
    }
    getClients()
      .then((res) => {
        if (res.success) setClients(res.data as ClientOption[]);
      })
      .catch(() => {
        toast.error("Erreur lors du chargement des clients");
      })
      .finally(() => setClientsLoading(false));
  }, [canReleve, status]);

  async function handleGenerate() {
    if (!selectedClientId) {
      toast.error("Veuillez sélectionner un client");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Veuillez sélectionner une période");
      return;
    }
    setGenerating(true);
    const res = await getClientReleveFactures(selectedClientId, startDate, endDate);
    setGenerating(false);
    if (res.success && res.data) {
      setReleve(res.data);
    } else {
      setReleve(null);
      toast.error(res.error || "Erreur lors de la génération du relevé");
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <PageHeader title="Relevé de Factures" description="Générer un relevé de factures par client et par période." />
        <Card>
          <CardContent className="p-0">
            <TableSkeleton rows={4} columns={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canReleve) {
    return (
      <AccessDenied message="Vous n'avez pas la permission de consulter le relevé de factures." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        className="no-print"
        title="Relevé de Factures"
        description="Générer un relevé de factures par client et par période."
      />

      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={clientsLoading}>
                <SelectTrigger id="client">
                  <SelectValue placeholder={clientsLoading ? "Chargement..." : "Sélectionner un client"} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.clientReference ? `${c.clientReference} - ${c.nom}` : c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Date début</Label>
              <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Date fin</Label>
              <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleGenerate} disabled={generating || clientsLoading} className="flex-1">
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer
              </Button>
              <Button variant="outline" onClick={() => window.print()} disabled={!releve}>
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {releve ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
            <StatCard title="Nombre de factures" value={String(releve.totaux.count)} icon={ClipboardList} tone="success" />
            <StatCard title="Total HT" value={formatCurrency(releve.totaux.totalHT)} icon={FileText} tone="info" />
            <StatCard title="Total TVA" value={formatCurrency(releve.totaux.totalTVA)} icon={Receipt} tone="warning" />
            <StatCard title="Total TTC" value={formatCurrency(releve.totaux.totalTTC)} icon={Wallet} tone="default" />
          </div>

          <Card className="releve-print">
            <CardContent className="pt-6">
              <div className="mb-6 flex items-start justify-between border-b pb-4">
                <div>
                  <h2 className="text-2xl font-bold">Relevé de Factures</h2>
                  <p className="text-muted-foreground">{releve.client.nom}</p>
                  {releve.client.clientReference && (
                    <p className="text-sm text-muted-foreground">Réf. : {releve.client.clientReference}</p>
                  )}
                  {releve.client.ice && <p className="text-sm text-muted-foreground">ICE : {releve.client.ice}</p>}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Période du {formatDate(releve.periode.debut)} au {formatDate(releve.periode.fin)}</p>
                  <p className="mt-1">{releve.totaux.count} facture(s)</p>
                </div>
              </div>

              {releve.factures.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="Aucune facture sur cette période"
                  description="Aucune facture n'a été générée pour ce client entre les dates sélectionnées."
                />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Date</TableHead>
                        <TableHead>N° Facture</TableHead>
                        <TableHead>N° Dossier</TableHead>
                        <TableHead className="text-right">Montant HT</TableHead>
                        <TableHead className="text-right">TVA</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {releve.factures.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="whitespace-nowrap">{formatShortDate(f.date)}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium">{f.reference}</TableCell>
                          <TableCell className="whitespace-nowrap">{f.dossierReference}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">{formatCurrency(f.montantHT)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">{formatCurrency(f.tva)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-bold">{formatCurrency(f.montantTotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 flex justify-end">
                    <Table className="w-full max-w-sm border-t">
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">Total HT</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(releve.totaux.totalHT)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">Total TVA</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(releve.totaux.totalTVA)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Total TTC</TableCell>
                          <TableCell className="text-right text-lg font-bold">{formatCurrency(releve.totaux.totalTTC)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="releve-print">
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardList}
              title="Aucun relevé généré"
              description="Sélectionnez un client et une période puis cliquez sur « Générer » pour afficher le relevé."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
