// ============================================================
// FacturePrintView - A4 Invoice Print Component - TMS Pro
// Supports per-tenant branding (logo, footer text) and three
// layout templates: classic / modern / compact.
// ============================================================
"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatShortDate, cn } from "@/lib/utils";
import { vehiculeTypeLabel } from "@/lib/constants";

interface EntrepriseConfigData {
  logoUrl?: string | null;
  footerText?: string | null;
  templateId?: string | null;
}

interface EntrepriseData {
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  ice?: string | null;
  config?: EntrepriseConfigData | null;
}

interface ChargeData {
  type: string;
  montant: number;
  commentaire?: string | null;
}

interface FacturePrintData {
  reference: string;
  montantHT: number;
  tva: number;
  montantTotal: number;
  createdAt: Date | string;
  dateFacture?: Date | string | null;
  dossier: {
    reference: string;
    lieuDepart: string;
    lieuArrivee: string;
    prixVente: number;
    typeVehicule?: string | null;
    client: { nom: string; telephone?: string | null; adresse?: string | null; ice?: string | null; clientReference?: string | null };
    chauffeur: { nom: string };
    camion: { matricule: string; type: string } | null;
    camionExterne: string | null;
    tvaRate: number;
    charges: ChargeData[];
  };
  entreprise: EntrepriseData;
}

const TEMPLATES = ["classic", "modern", "compact"] as const;
type InvoiceTemplate = (typeof TEMPLATES)[number];

function resolveTemplate(raw: string | null | undefined): InvoiceTemplate {
  return raw === "modern" || raw === "compact" ? raw : "classic";
}

const typeLabels: Record<string, string> = {
  CARBURANT: "Carburant",
  PEAGE: "Péage",
  DEPLACEMENT_CHAUFFEUR: "Déplacement",
  REPARATION: "Réparation",
  AMENDE: "Amende",
  GARDIENNAGE: "Gardiennage",
  KEROSENE: "Kérosène",
  TELEPHONE: "Téléphone",
  AUTRE: "Autre",
};

const FALLBACK_FOOTER = "Facture générée automatiquement par TMS Pro";

function EntrepriseIdentity({
  entreprise,
  logo,
  titleClass,
  textClass,
  logoClass,
  iceTop = true,
}: {
  entreprise: EntrepriseData;
  logo: string | null;
  titleClass: string;
  textClass: string;
  logoClass?: string;
  iceTop?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      {logo && (
        <img src={logo} alt="" className={cn("h-16 w-auto max-w-40 object-contain", logoClass)} />
      )}
<div>
        <h1 className={titleClass}>{entreprise.nom}</h1>
        {entreprise.adresse && <p className={textClass}>{entreprise.adresse}</p>}
        {entreprise.telephone && <p className={textClass}>Tél: {entreprise.telephone}</p>}
        {entreprise.email && <p className={textClass}>{entreprise.email}</p>}
        {iceTop && entreprise.ice && <p className={cn(textClass, "mt-1")}>ICE: {entreprise.ice}</p>}
      </div>
    </div>
  );
}

export default function FacturePrintView({ facture }: { facture: FacturePrintData }) {
  const { dossier, entreprise } = facture;
  const montantHT = facture.montantHT;
  const montantTVA = facture.tva;
  const montantTTC = facture.montantTotal;

  const template = resolveTemplate(entreprise.config?.templateId);
  const logo = entreprise.config?.logoUrl || null;
  const footerText = (entreprise.config?.footerText || "").trim() || FALLBACK_FOOTER;
  const dateLabel = formatShortDate(facture.dateFacture ?? facture.createdAt);

  return (
    <>
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Imprimer
        </Button>
      </div>

      <div className={cn("invoice-print bg-white text-black", template === "compact" && "text-[13px]")}>
        <div className={cn(template === "compact" ? "p-6" : "p-8")}>
          {/* ===== Header ===== */}
          {template === "classic" && (
            <div className="mb-8 flex items-start justify-between border-b-2 border-gray-900 pb-6">
              <EntrepriseIdentity
                entreprise={entreprise}
                logo={logo}
                titleClass="text-2xl font-bold text-gray-900"
                textClass="mt-1 text-sm text-gray-600"
              />
              <div className="text-right">
                <h2 className="text-3xl font-bold text-gray-900">FACTURE</h2>
                <p className="mt-2 text-sm text-gray-600">N° {facture.reference}</p>
                <p className="text-sm text-gray-600">Date: {dateLabel}</p>
              </div>
            </div>
          )}

          {template === "modern" && (
            <div className="mb-8 flex items-center justify-between rounded-xl bg-blue-600 p-6 text-white">
              <EntrepriseIdentity
                entreprise={entreprise}
                logo={logo}
                titleClass="text-2xl font-bold"
                textClass="mt-1 text-sm text-blue-100"
                logoClass="rounded-md bg-white p-1"
              />
              <div className="text-right">
                <h2 className="text-3xl font-bold">FACTURE</h2>
                <p className="mt-2 text-sm text-blue-100">N° {facture.reference}</p>
                <p className="text-sm text-blue-100">Date: {dateLabel}</p>
              </div>
            </div>
          )}

          {template === "compact" && (
            <div className="mb-6 flex items-end justify-between border-b-2 border-gray-300 pb-3">
              <div className="flex items-center gap-3">
{logo && <img src={logo} alt="" className="h-12 w-auto max-w-28 object-contain" />}
                <div>
                  <h1 className="text-sm font-bold uppercase tracking-wide">{entreprise.nom}</h1>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {[entreprise.adresse, entreprise.telephone ? `Tél: ${entreprise.telephone}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {entreprise.ice && <p className="text-xs text-gray-600">ICE: {entreprise.ice}</p>}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold">FACTURE</h2>
                <p className="mt-1 text-xs text-gray-600">
                  N° {facture.reference} — {dateLabel}
                </p>
              </div>
            </div>
          )}

          {/* ===== Client + Operation ===== */}
          <div
            className={cn(
              "mb-8 grid grid-cols-2 gap-8",
              template === "modern" && "gap-4",
              template === "compact" && "mb-6 gap-4"
            )}
          >
            <div
              className={cn(
                "bg-gray-50 p-4 rounded-lg",
                template === "modern" && "rounded-lg border border-blue-100 bg-white p-4",
                template === "compact" && "rounded border border-gray-200 bg-white p-3"
              )}
            >
              <h3 className="mb-2 text-sm font-bold uppercase text-gray-500">Client</h3>
              <p className="text-lg font-semibold">{dossier.client.nom}</p>
              {dossier.client.adresse && <p className="text-sm text-gray-600">{dossier.client.adresse}</p>}
              {dossier.client.telephone && <p className="text-sm text-gray-600">Tél: {dossier.client.telephone}</p>}
              {dossier.client.ice && <p className="text-sm text-gray-600">ICE: {dossier.client.ice}</p>}
            </div>
            <div
              className={cn(
                "bg-gray-50 p-4 rounded-lg",
                template === "modern" && "rounded-lg border border-blue-100 bg-white p-4",
                template === "compact" && "rounded border border-gray-200 bg-white p-3"
              )}
            >
              <h3 className="mb-2 text-sm font-bold uppercase text-gray-500">Détails Opération</h3>
              <p className="text-sm"><span className="font-medium">Route:</span> {dossier.lieuDepart} → {dossier.lieuArrivee}</p>
              <p className="text-sm"><span className="font-medium">Type de véhicule:</span> {vehiculeTypeLabel(dossier.typeVehicule)}</p>
              <p className="text-sm"><span className="font-medium">Camion:</span> {dossier.camion?.matricule || dossier.camionExterne || "—"}</p>
              <p className="text-sm"><span className="font-medium">Chauffeur:</span> {dossier.chauffeur?.nom || "—"}</p>
              <p className="text-sm"><span className="font-medium">Réf. Client:</span> {dossier.client.clientReference || "—"}</p>
            </div>
          </div>

          {/* ===== Lines table ===== */}
          <table className="w-full border-collapse mb-8">
            <thead>
              <tr
                className={cn(
                  "bg-gray-900 text-white",
                  template === "modern" && "bg-blue-600",
                  template === "compact" && "bg-gray-100 text-gray-900"
                )}
              >
                <th className={cn("border border-gray-700 px-4 py-3 text-left text-sm font-semibold", template === "compact" && "border-gray-200 px-3 py-2 text-xs")}>Désignation</th>
                <th className={cn("border border-gray-700 px-4 py-3 text-left text-sm font-semibold", template === "compact" && "border-gray-200 px-3 py-2 text-xs")}>Détail</th>
                <th className={cn("border border-gray-700 px-4 py-3 text-right text-sm font-semibold", template === "compact" && "border-gray-200 px-3 py-2 text-xs")}>MT TTC</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className={cn("border border-gray-300 px-4 py-3 text-sm font-medium", template === "compact" && "border-gray-200 px-3 py-2")}>
                  Transport {dossier.lieuDepart} → {dossier.lieuArrivee}
                </td>
                <td className={cn("border border-gray-300 px-4 py-3 text-sm text-gray-600", template === "compact" && "border-gray-200 px-3 py-2")}>
                  <span className="font-medium">Route:</span> {dossier.lieuDepart} → {dossier.lieuArrivee}<br />
                  <span className="font-medium">Type de véhicule:</span> {vehiculeTypeLabel(dossier.typeVehicule)}<br />
                  <span className="font-medium">Réf. Client:</span> {dossier.client.clientReference || "—"}
                </td>
                <td className={cn("border border-gray-300 px-4 py-3 text-sm text-right", template === "compact" && "border-gray-200 px-3 py-2")}>{formatCurrency(montantTTC)}</td>
              </tr>
              {dossier.charges.map((charge, idx) => (
                <tr key={idx} className="border-b">
                  <td className={cn("border border-gray-300 px-4 py-3 text-sm font-medium", template === "compact" && "border-gray-200 px-3 py-2")}>
                    {typeLabels[charge.type] || charge.type}
                  </td>
                  <td className={cn("border border-gray-300 px-4 py-3 text-sm text-gray-600", template === "compact" && "border-gray-200 px-3 py-2")}>
                    {charge.commentaire || "—"}
                  </td>
                  <td className={cn("border border-gray-300 px-4 py-3 text-sm text-right", template === "compact" && "border-gray-200 px-3 py-2")}>—</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ===== Totals ===== */}
          <div className={cn("mb-8 flex justify-end", template === "compact" && "mb-6")}>
            <div className={cn("w-72", template === "compact" && "w-64")}>
              <div className="flex justify-between border-b border-gray-200 py-2">
                <span className="text-sm text-gray-600">MT HT</span>
                <span className="text-sm font-medium">{formatCurrency(montantHT)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 py-2">
                <span className="text-sm text-gray-600">MT TVA ({dossier.tvaRate}%)</span>
                <span className="text-sm font-medium">{formatCurrency(montantTVA)}</span>
              </div>
              <div className={cn("flex justify-between py-3 mt-1", template === "modern" ? "border-t-2 border-blue-600" : "border-t-2 border-gray-900")}>
                <span className="text-base font-bold">MT TTC</span>
                <span className={cn("text-base font-bold", template === "modern" && "text-blue-700")}>{formatCurrency(montantTTC)}</span>
              </div>
            </div>
          </div>

          {/* ===== Footer ===== */}
          <div
            className={cn(
              "mt-8 text-center text-xs text-gray-400",
              template === "modern" && "border-t-2 border-blue-200 pt-3",
              template === "compact" && "mt-6 border-t border-gray-200 pt-2 text-[10px]"
            )}
          >
            <p>{[entreprise.nom, entreprise.adresse, entreprise.telephone ? `Tél: ${entreprise.telephone}` : null, entreprise.ice ? `ICE: ${entreprise.ice}` : null].filter(Boolean).join(" — ")}</p>
            <p className="mt-1">{footerText}</p>
          </div>
        </div>
      </div>
    </>
  );
}