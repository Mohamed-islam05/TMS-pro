// ============================================================
// Server Actions - Dashboard Stats + Smart Alerts
// ============================================================
"use server";

import prisma from "@/lib/prisma";
import { getCurrentEntreprise } from "./auth";
import { roundMoney } from "@/lib/calculations";
import { safeLogError } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

export async function getDashboardStats() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("dashboard.overview", user)) {
      return null;
    }

    const where = { entrepriseId: user.entrepriseId };

    const [totalDossiers, dossiers, chargesAgg, camionsStats, chauffeurStats] = await Promise.all([
      prisma.dossier.count({ where }),
      prisma.dossier.findMany({ where, include: { charges: true, chauffeur: true } }),
      prisma.charge.aggregate({ where: { dossier: where }, _sum: { montant: true } }),
      prisma.camion.count({ where }),
      prisma.chauffeur.findMany({
        where,
        select: {
          id: true,
          nom: true,
          dossiers: {
            select: { prixVente: true, prixAchat: true, charges: { select: { montant: true } } },
          },
        },
      }),
    ]);

    const totalCharges = roundMoney(chargesAgg._sum.montant ?? 0);
    const totalVente = roundMoney(dossiers.reduce((s, d) => s + d.prixVente, 0));

    const dossiersConnus = dossiers.filter((d) => d.prixAchat != null);
    const totalVenteConnue = roundMoney(dossiersConnus.reduce((s, d) => s + d.prixVente, 0));
    const totalAchatConnue = roundMoney(dossiersConnus.reduce((s, d) => s + (d.prixAchat as number), 0));
    const totalChargesConnues = roundMoney(
      dossiersConnus.reduce((s, d) => s + d.charges.reduce((cs, ch) => cs + ch.montant, 0), 0)
    );
    const totalBeneficeKnown = roundMoney(totalVenteConnue - totalAchatConnue - totalChargesConnues);
    const unknownBeneficeCount = dossiers.length - dossiersConnus.length;
    const isBeneficeIncomplete = unknownBeneficeCount > 0;
    const margeMoyenne = totalVenteConnue > 0 ? (totalBeneficeKnown / totalVenteConnue) * 100 : 0;

    const totalCamions = camionsStats;

    const dossiersParStatut = {
      OUVERT: dossiers.filter((d) => d.statut === "OUVERT").length,
      EN_ATTENTE_VALIDATION: dossiers.filter((d) => d.statut === "EN_ATTENTE_VALIDATION").length,
      CLOTURE: dossiers.filter((d) => d.statut === "CLOTURE").length,
    };

    const performanceChauffeurs = chauffeurStats.map((c) => {
      const revenu = roundMoney(c.dossiers.reduce((s, d) => s + d.prixVente, 0));
      const charges = roundMoney(c.dossiers.reduce((s, d) => s + d.charges.reduce((cs, ch) => cs + ch.montant, 0), 0));
      const connus = c.dossiers.filter((d) => d.prixAchat != null);
      const beneficeKnown = roundMoney(connus.reduce((s, d) => s + d.prixVente - (d.prixAchat as number) - d.charges.reduce((cs, ch) => cs + ch.montant, 0), 0));
      const unknownBeneficeCount = c.dossiers.length - connus.length;
      return {
        id: c.id,
        nom: c.nom,
        revenu,
        charges,
        beneficeKnown,
        unknownBeneficeCount,
        isBeneficeIncomplete: unknownBeneficeCount > 0,
        nbOperations: c.dossiers.length,
      };
    });

    if (user.role !== "ENTREPRISE_ADMIN" && !hasPermission("dashboard.financials", user)) {
      return {
        totalDossiers,
        totalVente: 0,
        totalCharges: 0,
        totalVenteKnown: 0,
        totalBeneficeKnown: 0,
        unknownBeneficeCount: 0,
        isBeneficeIncomplete: false,
        margeMoyenne: 0,
        totalCamions,
        dossiersParStatut,
        performanceChauffeurs: performanceChauffeurs.map((c) => ({
          ...c,
          revenu: 0,
          charges: 0,
          beneficeKnown: 0,
        })),
      };
    }

    return {
      totalDossiers,
      totalVente,
      totalCharges,
      totalVenteKnown: totalVenteConnue,
      totalBeneficeKnown,
      unknownBeneficeCount,
      isBeneficeIncomplete,
      margeMoyenne,
      totalCamions,
      dossiersParStatut,
      performanceChauffeurs,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", safeLogError(error));
    return null;
  }
}

export async function getDossiersEnAttente() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("dashboard.alerts", user)) {
      return { success: false, error: "Accès non autorisé", data: [] };
    }

    const dossiers = await prisma.dossier.findMany({
      where: { entrepriseId: user.entrepriseId, statut: "EN_ATTENTE_VALIDATION" },
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { nom: true } },
        chauffeur: { select: { nom: true } },
        camion: { select: { matricule: true } },
      },
    });

    return { success: true, data: dossiers };
  } catch (error) {
    console.error("Error fetching pending dossiers:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement des dossiers en attente", data: [] };
  }
}

export async function getSmartAlerts() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("dashboard.alerts", user)) {
      return { success: false, data: [] };
    }

    const in15Days = new Date();
    in15Days.setDate(in15Days.getDate() + 15);

    const camions = await prisma.camion.findMany({
      where: {
        entrepriseId: user.entrepriseId,
        OR: [
          { dateVisiteTechnique: { not: null, lte: in15Days } },
          { dateAssuranceMarchandise: { not: null, lte: in15Days } },
        ],
      },
      select: {
        id: true,
        matricule: true,
        dateVisiteTechnique: true,
        dateAssuranceMarchandise: true,
      },
    });

    const now = new Date();
    const alerts: Array<{
      camionId: string;
      matricule: string;
      type: string;
      dateExpiration: Date;
      joursRestants: number;
    }> = [];

    for (const c of camions) {
      if (c.dateVisiteTechnique && c.dateVisiteTechnique <= in15Days) {
        const diff = Math.ceil((c.dateVisiteTechnique.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0) {
          alerts.push({
            camionId: c.id,
            matricule: c.matricule,
            type: "VISITE_TECHNIQUE",
            dateExpiration: c.dateVisiteTechnique,
            joursRestants: diff,
          });
        }
      }
      if (c.dateAssuranceMarchandise && c.dateAssuranceMarchandise <= in15Days) {
        const diff = Math.ceil((c.dateAssuranceMarchandise.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0) {
          alerts.push({
            camionId: c.id,
            matricule: c.matricule,
            type: "ASSURANCE_MARCHANDISE",
            dateExpiration: c.dateAssuranceMarchandise,
            joursRestants: diff,
          });
        }
      }
    }

    return { success: true, data: alerts };
  } catch (error) {
    console.error("Error fetching alerts:", safeLogError(error));
    return { success: false, data: [] };
  }
}
