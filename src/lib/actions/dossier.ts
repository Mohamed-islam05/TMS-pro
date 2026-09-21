// ============================================================
// Server Actions - Dossier (Operation) Entity
// ============================================================
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentEntreprise } from "./auth";
import {
  createDossierSchema,
  updateDossierSchema,
  deleteDossierSchema,
  type CreateDossierInput,
  type UpdateDossierInput,
  type DeleteDossierInput,
} from "@/lib/validations/operation";
import { calculerTVA, calculerMontantTTC, roundMoney } from "@/lib/calculations";
import { buildFacturePrefix, nextFactureReference } from "@/lib/facture-refs";
import { logAudit, logAuditTx } from "@/lib/audit";
import { safeLogError } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

export async function createDossier(data: CreateDossierInput) {
  try {
    const validatedData = createDossierSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("dossiers.create", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const client = await prisma.client.findFirst({
      where: { id: validatedData.clientId, entrepriseId: user.entrepriseId },
      select: { id: true },
    });
    if (!client) return { success: false, error: "Client non trouvé" };

    const chauffeur = await prisma.chauffeur.findFirst({
      where: { id: validatedData.chauffeurId, entrepriseId: user.entrepriseId },
      select: { id: true },
    });
    if (!chauffeur) return { success: false, error: "Chauffeur non trouvé" };

    if (validatedData.camionId) {
      const camion = await prisma.camion.findFirst({
        where: { id: validatedData.camionId, entrepriseId: user.entrepriseId },
        select: { id: true },
      });
      if (!camion) return { success: false, error: "Camion non trouvé" };
    }

    let dossier;
    try {
      dossier = await prisma.$transaction(async (tx) => {
        return tx.dossier.create({
          data: {
            reference: validatedData.reference,
            lieuDepart: validatedData.lieuDepart,
            lieuArrivee: validatedData.lieuArrivee,
            prixVente: validatedData.prixVente,
            prixAchat: validatedData.prixAchat ?? null,
            tvaRate: validatedData.tvaRate,
            typeVehicule: validatedData.typeVehicule || null,
            dateOperation: validatedData.dateOperation || null,
            statut: "OUVERT",
            clientId: validatedData.clientId,
            camionId: validatedData.camionId || null,
            camionExterne: validatedData.camionExterne || null,
            chauffeurId: validatedData.chauffeurId,
            entrepriseId: user.entrepriseId,
          },
          include: { client: true, chauffeur: true, camion: true },
        });
      });
    } catch (createError) {
      const msg = safeLogError(createError);
      if (msg.includes("Unique constraint")) {
        return { success: false, error: "Cette référence existe déjà pour votre entreprise" };
      }
      throw createError;
    }

    revalidatePath("/dashboard/operations");
    await logAudit({
      module: "dossiers",
      action: "dossier.create",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "dossier",
      targetId: dossier!.id,
      details: { reference: dossier!.reference },
    });
    return { success: true, data: dossier!, message: "Dossier créé avec succès" };
  } catch (error) {
    console.error("Error creating dossier:", safeLogError(error));
    return { success: false, error: "Erreur lors de la création du dossier" };
  }
}

export async function envoyerValidationDossier(dossierId: string) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("dossiers.send", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const dossier = await prisma.dossier.findFirst({
      where: { id: dossierId, entrepriseId: user.entrepriseId },
      select: { id: true, statut: true },
    });

    if (!dossier) return { success: false, error: "Dossier non trouvé" };
    if (dossier.statut !== "OUVERT") {
      return { success: false, error: "Seul un dossier ouvert peut être envoyé pour validation" };
    }

    const result = await prisma.dossier.updateMany({
      where: { id: dossierId, entrepriseId: user.entrepriseId },
      data: { statut: "EN_ATTENTE_VALIDATION" },
    });

    if (result.count === 0) return { success: false, error: "Dossier non trouvé" };

    await logAudit({
      module: "dossiers",
      action: "dossier.send_validation",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "dossier",
      targetId: dossierId,
    });

    revalidatePath("/dashboard/operations");
    return { success: true, message: "Dossier envoyé pour validation" };
  } catch (error) {
    console.error("Error sending dossier for validation:", safeLogError(error));
    return { success: false, error: "Erreur lors de l'envoi pour validation" };
  }
}

export async function updateDossier(data: UpdateDossierInput) {
  try {
    const validatedData = updateDossierSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("dossiers.update", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const existing = await prisma.dossier.findFirst({
      where: { id: validatedData.id, entrepriseId: user.entrepriseId },
      select: { statut: true },
    });

    if (!existing) return { success: false, error: "Dossier non trouvé" };
    if (existing.statut === "CLOTURE") return { success: false, error: "Un dossier clôturé ne peut pas être modifié" };

    const client = await prisma.client.findFirst({
      where: { id: validatedData.clientId, entrepriseId: user.entrepriseId },
      select: { id: true },
    });
    if (!client) return { success: false, error: "Client non trouvé" };

    const chauffeur = await prisma.chauffeur.findFirst({
      where: { id: validatedData.chauffeurId, entrepriseId: user.entrepriseId },
      select: { id: true },
    });
    if (!chauffeur) return { success: false, error: "Chauffeur non trouvé" };

    if (validatedData.camionId) {
      const camion = await prisma.camion.findFirst({
        where: { id: validatedData.camionId, entrepriseId: user.entrepriseId },
        select: { id: true },
      });
      if (!camion) return { success: false, error: "Camion non trouvé" };
    }

    const duplicateRef = await prisma.dossier.findFirst({
      where: {
        reference: validatedData.reference,
        entrepriseId: user.entrepriseId,
        NOT: { id: validatedData.id },
      },
      select: { id: true },
    });
    if (duplicateRef) {
      return { success: false, error: "Cette référence existe déjà pour un autre dossier" };
    }

    const dossier = await prisma.$transaction(async (tx) => {
      const ownership = await tx.dossier.findFirst({
        where: { id: validatedData.id, entrepriseId: user.entrepriseId },
        select: { id: true },
      });
      if (!ownership) return null;

      return tx.dossier.update({
        where: { id: validatedData.id, entrepriseId: user.entrepriseId },
        data: {
          reference: validatedData.reference,
          lieuDepart: validatedData.lieuDepart,
          lieuArrivee: validatedData.lieuArrivee,
          prixVente: validatedData.prixVente,
          prixAchat: validatedData.prixAchat ?? null,
          tvaRate: validatedData.tvaRate,
          typeVehicule: validatedData.typeVehicule || null,
          dateOperation: validatedData.dateOperation || null,
          clientId: validatedData.clientId,
          camionId: validatedData.camionId || null,
          camionExterne: validatedData.camionExterne || null,
          chauffeurId: validatedData.chauffeurId,
        },
        include: { client: true, chauffeur: true, camion: true },
      });
    });

    if (!dossier) return { success: false, error: "Dossier non trouvé" };

    await logAudit({
      module: "dossiers",
      action: "dossier.update",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "dossier",
      targetId: validatedData.id,
      details: { reference: dossier.reference },
    });

    revalidatePath("/dashboard/operations");
    return { success: true, data: dossier, message: "Dossier mis à jour avec succès" };
  } catch (error) {
    const msg = safeLogError(error);
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "Cette référence existe déjà pour un autre dossier" };
    }
    console.error("Error updating dossier:", safeLogError(error));
    return { success: false, error: "Erreur lors de la mise à jour du dossier" };
  }
}

export async function cloturerDossier(dossierId: string, tvaRate?: number) {
  try {
    const { z } = await import("zod");
    const cloturerSchema = z.object({
      dossierId: z.string().uuid("ID invalide"),
      tvaRate: z
        .number()
        .refine((v) => [0, 10, 20].includes(v), "La TVA doit être 0%, 10% ou 20%")
        .optional(),
    });
    const parsed = cloturerSchema.safeParse({ dossierId, tvaRate });
    if (!parsed.success) {
      return { success: false, error: "Données invalides" };
    }

    const user = await getCurrentEntreprise();

    if (!hasPermission("dossiers.close", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const dossier = await prisma.dossier.findFirst({
      where: { id: parsed.data.dossierId, entrepriseId: user.entrepriseId },
      include: { charges: true, camion: true },
    });

    if (!dossier) return { success: false, error: "Dossier non trouvé" };
    if (dossier.statut !== "EN_ATTENTE_VALIDATION") {
      return { success: false, error: "Seul un dossier en attente de validation peut être clôturé" };
    }
    if (!dossier.dateOperation) {
      return {
        success: false,
        error: "Date d'opération manquante — renseignez-la avant de clôturer",
      };
    }

    const montantHT = roundMoney(dossier.prixVente);
    const taux = parsed.data.tvaRate ?? dossier.tvaRate ?? 20;
    const tva = calculerTVA(montantHT, taux);
    const montantTTC = calculerMontantTTC(montantHT, taux);

    const now = new Date();
    const prefix = buildFacturePrefix(now);

    let ref = "";
    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await prisma.$transaction(async (tx) => {
          const lastFacture = await tx.facture.findFirst({
            where: {
              entrepriseId: dossier.entrepriseId,
              reference: { startsWith: prefix },
            },
            orderBy: [{ createdAt: "desc" }, { reference: "desc" }],
            select: { reference: true },
          });

          ref = nextFactureReference(prefix, lastFacture?.reference);

          await tx.facture.create({
            data: {
              reference: ref,
              montantTotal: montantTTC,
              tva,
              montantHT,
              dossierId: parsed.data.dossierId,
              entrepriseId: dossier.entrepriseId,
              dateFacture: dossier.dateOperation,
            },
          });

          await tx.dossier.update({
            where: { id: parsed.data.dossierId, entrepriseId: dossier.entrepriseId },
            data: { statut: "CLOTURE" },
          });

          await logAuditTx(tx, {
            module: "dossiers",
            action: "dossier.close",
            entrepriseId: dossier.entrepriseId,
            userId: user.id,
            targetType: "dossier",
            targetId: dossier.id,
            details: { factureReference: ref, montantHT, tva, montantTTC },
          });
        });
        break;
      } catch (txError) {
        const msg = safeLogError(txError);
        if (msg.includes("Unique constraint") && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw txError;
      }
    }

    revalidatePath("/dashboard/operations");
    revalidatePath("/dashboard/factures");
    return { success: true, reference: ref, montantTotal: montantTTC };
  } catch (error) {
    console.error("Error closing dossier:", safeLogError(error));
    return { success: false, error: "Erreur lors de la clôture du dossier" };
  }
}

export async function deleteDossier(data: DeleteDossierInput) {
  try {
    const validatedData = deleteDossierSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("dossiers.delete", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const dossier = await prisma.dossier.findFirst({
      where: { id: validatedData.id, entrepriseId: user.entrepriseId },
      select: { statut: true },
    });

    if (!dossier) return { success: false, error: "Dossier non trouvé" };
    if (dossier.statut === "CLOTURE") return { success: false, error: "Un dossier clôturé ne peut pas être supprimé" };

    const result = await prisma.dossier.deleteMany({
      where: { id: validatedData.id, entrepriseId: user.entrepriseId },
    });

    if (result.count === 0) return { success: false, error: "Dossier non trouvé" };

    await logAudit({
      module: "dossiers",
      action: "dossier.delete",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "dossier",
      targetId: validatedData.id,
    });

    revalidatePath("/dashboard/operations");
    return { success: true, message: "Dossier supprimé avec succès" };
  } catch (error) {
    console.error("Error deleting dossier:", safeLogError(error));
    return { success: false, error: "Erreur lors de la suppression du dossier" };
  }
}

export async function getDossiers() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("dossiers.view", user)) {
      return { success: false, error: "Accès non autorisé", data: [] };
    }

    const canViewCharges = hasPermission("charges.view", user);
    const canViewFactures = hasPermission("factures.view", user);

    const dossiers = await prisma.dossier.findMany({
      where: { entrepriseId: user.entrepriseId },
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        chauffeur: true,
        camion: true,
        charges: canViewCharges,
        facture: canViewFactures,
      },
    });

    const data = dossiers.map((d) => ({
      ...d,
      charges: canViewCharges ? d.charges : [],
      facture: canViewFactures ? d.facture : null,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching dossiers:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement des dossiers", data: [] };
  }
}

export async function getDossierById(id: string) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("dossiers.view", user)) {
      return { success: false, error: "Accès non autorisé", data: null };
    }

    const canViewCharges = hasPermission("charges.view", user);
    const canViewFactures = hasPermission("factures.view", user);

    const dossier = await prisma.dossier.findFirst({
      where: { id, entrepriseId: user.entrepriseId },
      include: {
        client: true,
        chauffeur: true,
        camion: true,
        charges: canViewCharges,
        facture: canViewFactures,
      },
    });
    if (!dossier) return { success: false, error: "Dossier non trouvé", data: null };
    return {
      success: true,
      data: {
        ...dossier,
        charges: canViewCharges ? dossier.charges : [],
        facture: canViewFactures ? dossier.facture : null,
      },
    };
  } catch (error) {
    console.error("Error fetching dossier:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement du dossier", data: null };
  }
}
