// ============================================================
// Server Actions - Charge Entity
// ============================================================
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentEntreprise } from "./auth";
import {
  createChargeSchema,
  updateChargeSchema,
  deleteChargeSchema,
  type CreateChargeInput,
  type UpdateChargeInput,
  type DeleteChargeInput,
} from "@/lib/validations/charge";
import { safeLogError } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function createCharge(data: CreateChargeInput) {
  try {
    const validatedData = createChargeSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("charges.create", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    if (validatedData.categorie === "DOSSIER") {
      const charge = await prisma.$transaction(async (tx) => {
        const dossier = await tx.dossier.findFirst({
          where: { id: validatedData.dossierId, entrepriseId: user.entrepriseId },
          select: { id: true, statut: true },
        });
        if (!dossier) return { error: "Dossier non trouvé" as const };
        if (dossier.statut !== "OUVERT") return { error: "Impossible d'ajouter des charges : le dossier doit être ouvert" as const };

        const created = await tx.charge.create({
          data: {
            categorie: "DOSSIER",
            type: validatedData.type,
            montant: validatedData.montant,
            commentaire: validatedData.commentaire || null,
            submissionKey: validatedData.submissionKey ?? null,
            dossierId: validatedData.dossierId,
          },
        });
        return { data: created };
      });

      if ("error" in charge) return { success: false, error: charge.error };
      await logAudit({
        module: "charges",
        action: "charge.create",
        entrepriseId: user.entrepriseId,
        userId: user.id,
        targetType: "charge",
        targetId: charge.data.id,
        details: {
          categorie: "DOSSIER",
          type: charge.data.type,
          montant: charge.data.montant,
          dossierId: validatedData.dossierId,
        },
      });
      revalidatePath("/dashboard/operations");
      return { success: true, data: charge.data, message: "Charge ajoutée avec succès" };
    }

    const charge = await prisma.charge.create({
      data: {
        categorie: "GENERALE",
        type: validatedData.type,
        montant: validatedData.montant,
        commentaire: validatedData.commentaire || null,
        submissionKey: validatedData.submissionKey ?? null,
        entrepriseId: user.entrepriseId,
      },
    });

    await logAudit({
      module: "charges",
      action: "charge.create",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "charge",
      targetId: charge.id,
      details: { categorie: "GENERALE", type: charge.type, montant: charge.montant },
    });

    revalidatePath("/dashboard/charges");
    return { success: true, data: charge, message: "Charge générale ajoutée avec succès" };
  } catch (error) {
    const msg = safeLogError(error);
    if (msg.includes("submissionKey")) {
      return { success: false, error: "Cette charge a déjà été ajoutée" };
    }
    console.error("Error creating charge:", msg);
    return { success: false, error: "Erreur lors de l'ajout de la charge" };
  }
}

export async function updateCharge(data: UpdateChargeInput) {
  try {
    const validatedData = updateChargeSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("charges.update", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const charge = await prisma.$transaction(async (tx) => {
      const existing = await tx.charge.findFirst({
        where: {
          id: validatedData.id,
          OR: [
            { entrepriseId: user.entrepriseId },
            { dossier: { entrepriseId: user.entrepriseId } },
          ],
        },
        select: { id: true, dossierId: true },
      });
      if (!existing) return { error: "Charge non trouvée" as const };

      if (existing.dossierId) {
        const dossier = await tx.dossier.findFirst({
          where: { id: existing.dossierId, entrepriseId: user.entrepriseId },
          select: { statut: true },
        });
        if (!dossier) return { error: "Dossier non trouvé" as const };
        if (dossier.statut !== "OUVERT") {
          return { error: "Impossible de modifier cette charge car le dossier n'est plus ouvert." as const };
        }
      }

      const updated = await tx.charge.update({
        where: { id: validatedData.id },
        data: {
          type: validatedData.type,
          montant: validatedData.montant,
          commentaire: validatedData.commentaire || null,
        },
      });
      return { data: updated };
    });

    if ("error" in charge) return { success: false, error: charge.error };

    await logAudit({
      module: "charges",
      action: "charge.update",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "charge",
      targetId: charge.data.id,
      details: { type: charge.data.type, montant: charge.data.montant },
    });

    revalidatePath("/dashboard/operations");
    revalidatePath("/dashboard/charges");
    return { success: true, data: charge.data, message: "Charge mise à jour avec succès" };
  } catch (error) {
    console.error("Error updating charge:", safeLogError(error));
    return { success: false, error: "Erreur lors de la mise à jour de la charge" };
  }
}

export async function deleteCharge(data: DeleteChargeInput) {
  try {
    const validatedData = deleteChargeSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("charges.delete", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const existing = await prisma.charge.findFirst({
      where: {
        id: validatedData.id,
        OR: [
          { entrepriseId: user.entrepriseId },
          { dossier: { entrepriseId: user.entrepriseId } },
        ],
      },
      select: { id: true, dossierId: true },
    });
    if (!existing) return { success: false, error: "Charge non trouvée" };

    if (existing.dossierId) {
      const deleteResult = await prisma.$transaction(async (tx) => {
        const dossier = await tx.dossier.findFirst({
          where: { id: existing.dossierId!, entrepriseId: user.entrepriseId },
          select: { statut: true },
        });
        if (!dossier) return { error: "Dossier non trouvé" as const };
        if (dossier.statut !== "OUVERT") {
          return { error: "Impossible de supprimer cette charge car le dossier n'est plus ouvert." as const };
        }
        const result = await tx.charge.deleteMany({
          where: {
            id: validatedData.id,
            OR: [
              { entrepriseId: user.entrepriseId },
              { dossier: { entrepriseId: user.entrepriseId } },
            ],
          },
        });
        return { count: result.count };
      });
      if ("error" in deleteResult) return { success: false, error: deleteResult.error };
      if (deleteResult.count === 0) return { success: false, error: "Charge non trouvée" };
    } else {
      const result = await prisma.charge.deleteMany({
        where: {
          id: validatedData.id,
          OR: [
            { entrepriseId: user.entrepriseId },
            { dossier: { entrepriseId: user.entrepriseId } },
          ],
        },
      });
      if (result.count === 0) return { success: false, error: "Charge non trouvée" };
    }

    await logAudit({
      module: "charges",
      action: "charge.delete",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "charge",
      targetId: validatedData.id,
    });

    revalidatePath("/dashboard/operations");
    revalidatePath("/dashboard/charges");
    return { success: true, message: "Charge supprimée avec succès" };
  } catch (error) {
    console.error("Error deleting charge:", safeLogError(error));
    return { success: false, error: "Erreur lors de la suppression de la charge" };
  }
}

export async function getChargesByDossier(dossierId: string) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("charges.view", user)) {
      return { success: false, data: [] };
    }

    const charges = await prisma.charge.findMany({
      where: { dossierId, dossier: { entrepriseId: user.entrepriseId } },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: charges };
  } catch (error) {
    console.error("Error fetching charges:", safeLogError(error));
    return { success: false, data: [] };
  }
}

export async function getAllCharges() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("charges.view", user)) {
      return { success: false, data: [] };
    }

    const charges = await prisma.charge.findMany({
      where: {
        OR: [
          { dossier: { entrepriseId: user.entrepriseId } },
          { entrepriseId: user.entrepriseId },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { dossier: { select: { reference: true, id: true, statut: true } } },
    });
    return { success: true, data: charges };
  } catch (error) {
    console.error("Error fetching all charges:", safeLogError(error));
    return { success: false, data: [] };
  }
}
