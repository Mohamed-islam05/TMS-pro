// ============================================================
// Server Actions - Facture (Invoice) Entity
// ============================================================
"use server";

import prisma from "@/lib/prisma";
import { getCurrentEntreprise } from "./auth";
import { roundMoney } from "@/lib/calculations";
import { safeLogError } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

export async function getFactures() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("factures.view", user)) {
      return { success: false, data: [] };
    }

    const factures = await prisma.facture.findMany({
      where: { entrepriseId: user.entrepriseId },
      orderBy: { createdAt: "desc" },
      include: {
        dossier: {
          include: { client: true, chauffeur: true, camion: true },
        },
      },
    });
    return { success: true, data: factures };
  } catch (error) {
    console.error("Error fetching factures:", safeLogError(error));
    return { success: false, data: [] };
  }
}

export async function getFactureById(id: string) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("factures.print", user)) {
      return { success: false, error: "Accès non autorisé", data: null };
    }

    const facture = await prisma.facture.findFirst({
      where: { id, entrepriseId: user.entrepriseId },
      include: {
        dossier: {
          include: {
            client: true,
            chauffeur: true,
            camion: true,
            charges: true,
          },
        },
        entreprise: true,
      },
    });
    if (!facture) return { success: false, error: "Facture non trouvée", data: null };
    return { success: true, data: facture };
  } catch (error) {
    console.error("Error fetching facture:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement de la facture", data: null };
  }
}

export async function getDossierFactureId(dossierId: string) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("factures.print", user)) {
      return { success: false, error: "Accès non autorisé", data: null };
    }

    const dossier = await prisma.dossier.findFirst({
      where: { id: dossierId, entrepriseId: user.entrepriseId, statut: "CLOTURE" },
      select: { facture: { select: { id: true } } },
    });
    if (!dossier?.facture) {
      return { success: false, error: "Aucune facture pour ce dossier", data: null };
    }
    return { success: true, data: { id: dossier.facture.id } };
  } catch (error) {
    console.error("Error fetching dossier facture id:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement de la facture", data: null };
  }
}

export async function getEntrepriseInfo() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("factures.print", user)) {
      return { success: false, data: null };
    }

    return { success: true, data: user.entreprise };
  } catch (error) {
    return { success: false, data: null };
  }
}

export type ReleveFacture = {
  id: string;
  date: Date;
  reference: string;
  dossierReference: string;
  montantHT: number;
  tva: number;
  montantTotal: number;
};

export type ReleveFacturesResult = {
  client: {
    nom: string;
    clientReference: string | null;
    ice: string | null;
  };
  periode: { debut: string; fin: string };
  factures: ReleveFacture[];
  totaux: {
    count: number;
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
  };
};

export async function getClientReleveFactures(
  clientId: string,
  startDate: string,
  endDate: string
) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("factures.releve", user)) {
      return { success: false, error: "Accès non autorisé", data: null };
    }

    if (!clientId || !startDate || !endDate) {
      return {
        success: false,
        error: "Veuillez sélectionner un client et une période",
        data: null,
      };
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, entrepriseId: user.entrepriseId },
      select: { id: true, nom: true, clientReference: true, ice: true },
    });
    if (!client) {
      return { success: false, error: "Client non trouvé", data: null };
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { success: false, error: "Dates invalides", data: null };
    }
    if (start > end) {
      return {
        success: false,
        error: "La date de début doit être antérieure à la date de fin",
        data: null,
      };
    }

    const factures = await prisma.facture.findMany({
      where: {
        entrepriseId: user.entrepriseId,
        OR: [
          { dateFacture: { gte: start, lte: end } },
          { dateFacture: null, createdAt: { gte: start, lte: end } },
        ],
        dossier: { is: { clientId: client.id } },
      },
      orderBy: { createdAt: "asc" },
      include: {
        dossier: { select: { reference: true } },
      },
    });

    const rawTotaux = factures.reduce(
      (acc, f) => ({
        totalHT: acc.totalHT + f.montantHT,
        totalTVA: acc.totalTVA + f.tva,
        totalTTC: acc.totalTTC + f.montantTotal,
      }),
      { totalHT: 0, totalTVA: 0, totalTTC: 0 }
    );

    const totaux = {
      totalHT: roundMoney(rawTotaux.totalHT),
      totalTVA: roundMoney(rawTotaux.totalTVA),
      totalTTC: roundMoney(rawTotaux.totalTTC),
    };

    return {
      success: true,
      data: {
        client: {
          nom: client.nom,
          clientReference: client.clientReference,
          ice: client.ice,
        },
        periode: {
          debut: start.toISOString().split("T")[0],
          fin: end.toISOString().split("T")[0],
        },
        factures: factures.map((f) => ({
          id: f.id,
          date: f.dateFacture ?? f.createdAt,
          reference: f.reference,
          dossierReference: f.dossier.reference,
          montantHT: f.montantHT,
          tva: f.tva,
          montantTotal: f.montantTotal,
        })),
        totaux: { count: factures.length, ...totaux },
      } satisfies ReleveFacturesResult,
    };
  } catch (error) {
    console.error("Error fetching client relevé:", safeLogError(error));
    return {
      success: false,
      error: "Erreur lors de la génération du relevé",
      data: null,
    };
  }
}
