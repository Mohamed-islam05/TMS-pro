// ============================================================
// FacturePrintView - A4 Invoice Print Component - TMS Pro
// ============================================================
"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { vehiculeTypeLabel } from "@/lib/constants";

interface EntrepriseData {
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  ice?: string | null;
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

export default function FacturePrintView({ facture }: { facture: FacturePrintData }) {
  const { dossier, entreprise } = facture;
  const montantHT = facture.montantHT;
  const montantTVA = facture.tva;
  const montantTTC = facture.montantTotal;

  return (
    <>
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Imprimer
        </Button>
      </div>

      <div className="invoice-print bg-white text-black">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8 border-b-2 border-gray-900 pb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{entreprise.nom}</h1>
              {entreprise.adresse && <p className="text-sm text-gray-600 mt-1">{entreprise.adresse}</p>}
              {entreprise.telephone && <p className="text-sm text-gray-600">Tél: {entreprise.telephone}</p>}
              {entreprise.email && <p className="text-sm text-gray-600">{entreprise.email}</p>}
              {entreprise.ice && <p className="text-sm text-gray-600 mt-1">ICE: {entreprise.ice}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-gray-900">FACTURE</h2>
              <p className="text-sm text-gray-600 mt-2">N° {facture.reference}</p>
              <p className="text-sm text-gray-600">Date: {formatShortDate(facture.dateFacture ?? facture.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-bold text-sm text-gray-500 uppercase mb-2">Client</h3>
              <p className="font-semibold text-lg">{dossier.client.nom}</p>
              {dossier.client.adresse && <p className="text-sm text-gray-600">{dossier.client.adresse}</p>}
              {dossier.client.telephone && <p className="text-sm text-gray-600">Tél: {dossier.client.telephone}</p>}
              {dossier.client.ice && <p className="text-sm text-gray-600">ICE: {dossier.client.ice}</p>}
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-bold text-sm text-gray-500 uppercase mb-2">Détails Opération</h3>
              <p className="text-sm"><span className="font-medium">Route:</span> {dossier.lieuDepart} → {dossier.lieuArrivee}</p>
              <p className="text-sm"><span className="font-medium">Type de véhicule:</span> {vehiculeTypeLabel(dossier.typeVehicule)}</p>
              <p className="text-sm"><span className="font-medium">Camion:</span> {dossier.camion?.matricule || dossier.camionExterne || "—"}</p>
              <p className="text-sm"><span className="font-medium">Chauffeur:</span> {dossier.chauffeur?.nom || "—"}</p>
              <p className="text-sm"><span className="font-medium">Réf. Client:</span> {dossier.client.clientReference || "—"}</p>
            </div>
          </div>

          <table className="w-full border-collapse mb-8">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="border border-gray-700 px-4 py-3 text-left text-sm font-semibold">Désignation</th>
                <th className="border border-gray-700 px-4 py-3 text-left text-sm font-semibold">Détail</th>
                <th className="border border-gray-700 px-4 py-3 text-right text-sm font-semibold">MT TTC</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="border border-gray-300 px-4 py-3 text-sm font-medium">
                  Transport {dossier.lieuDepart} → {dossier.lieuArrivee}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">
                  <span className="font-medium">Route:</span> {dossier.lieuDepart} → {dossier.lieuArrivee}<br />
                  <span className="font-medium">Type de véhicule:</span> {vehiculeTypeLabel(dossier.typeVehicule)}<br />
                  <span className="font-medium">Réf. Client:</span> {dossier.client.clientReference || "—"}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-sm text-right">{formatCurrency(montantTTC)}</td>
              </tr>
              {dossier.charges.map((charge, idx) => (
                <tr key={idx} className="border-b">
                  <td className="border border-gray-300 px-4 py-3 text-sm font-medium">
                    {typeLabels[charge.type] || charge.type}
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">
                    {charge.commentaire || "—"}
                  </td>
                  <td className="border border-gray-300 px-4 py-3 text-sm text-right">—</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-8">
            <div className="w-72">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">MT HT</span>
                <span className="text-sm font-medium">{formatCurrency(montantHT)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">MT TVA ({dossier.tvaRate}%)</span>
                <span className="text-sm font-medium">{formatCurrency(montantTVA)}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-gray-900 mt-1">
                <span className="text-base font-bold">MT TTC</span>
                <span className="text-base font-bold">{formatCurrency(montantTTC)}</span>
              </div>
            </div>
          </div>


          <div className="text-center mt-8 text-xs text-gray-400">
            <p>{entreprise.nom} — {entreprise.adresse || ""} — Tél: {entreprise.telephone || ""} — ICE: {entreprise.ice || ""}</p>
            <p className="mt-1">Facture générée automatiquement par TMS Pro</p>
          </div>
        </div>
      </div>
    </>
  );
}
