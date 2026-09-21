// ============================================================
// Server Actions - Camion (Vehicle) Entity
// ============================================================
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentEntreprise } from "./auth";
import {
  createCamionSchema,
  updateCamionSchema,
  deleteCamionSchema,
  type CreateCamionInput,
  type UpdateCamionInput,
  type DeleteCamionInput,
} from "@/lib/validations/camion";
import { safeLogError } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function createCamion(data: CreateCamionInput) {
  try {
    const validatedData = createCamionSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("camions.create", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const camion = await prisma.camion.create({
      data: {
        matricule: validatedData.matricule,
        type: validatedData.type,
        marque: validatedData.marque || null,
        annee: validatedData.annee || null,
        assuranceCirculation: validatedData.assuranceCirculation || null,
        dateVisiteTechnique: validatedData.dateVisiteTechnique || null,
        dateAssuranceMarchandise: validatedData.dateAssuranceMarchandise || null,
        entrepriseId: user.entrepriseId,
      },
    });

    await logAudit({
      module: "camions",
      action: "camion.create",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "camion",
      targetId: camion.id,
      details: { matricule: camion.matricule },
    });

    revalidatePath("/dashboard/camions");
    return { success: true, data: camion, message: "Camion créé avec succès" };
  } catch (error) {
    console.error("Error creating camion:", safeLogError(error));
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { success: false, error: "Ce matricule existe déjà pour cette entreprise" };
    }
    return { success: false, error: "Erreur lors de la création du camion" };
  }
}

export async function updateCamion(data: UpdateCamionInput) {
  try {
    const validatedData = updateCamionSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("camions.update", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const camion = await prisma.$transaction(async (tx) => {
      const existing = await tx.camion.findFirst({
        where: { id: validatedData.id, entrepriseId: user.entrepriseId },
        select: { id: true },
      });
      if (!existing) return null;

      return tx.camion.update({
        where: {
          id: validatedData.id,
          entrepriseId: user.entrepriseId,
        },
        data: {
          matricule: validatedData.matricule,
          type: validatedData.type,
          marque: validatedData.marque || null,
          annee: validatedData.annee || null,
          assuranceCirculation: validatedData.assuranceCirculation || null,
          dateVisiteTechnique: validatedData.dateVisiteTechnique || null,
          dateAssuranceMarchandise: validatedData.dateAssuranceMarchandise || null,
        },
      });
    });

    if (!camion) return { success: false, error: "Camion non trouvé" };

    await logAudit({
      module: "camions",
      action: "camion.update",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "camion",
      targetId: camion.id,
      details: { matricule: camion.matricule },
    });

    revalidatePath("/dashboard/camions");
    return { success: true, data: camion, message: "Camion mis à jour avec succès" };
  } catch (error) {
    console.error("Error updating camion:", safeLogError(error));
    return { success: false, error: "Erreur lors de la mise à jour du camion" };
  }
}

export async function deleteCamion(data: DeleteCamionInput) {
  try {
    const validatedData = deleteCamionSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("camions.delete", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const result = await prisma.camion.deleteMany({
      where: { id: validatedData.id, entrepriseId: user.entrepriseId },
    });

    if (result.count === 0) return { success: false, error: "Camion non trouvé" };

    await logAudit({
      module: "camions",
      action: "camion.delete",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "camion",
      targetId: validatedData.id,
    });

    revalidatePath("/dashboard/camions");
    return { success: true, message: "Camion supprimé avec succès" };
  } catch (error) {
    console.error("Error deleting camion:", safeLogError(error));
    return { success: false, error: "Erreur lors de la suppression du camion" };
  }
}

export async function getCamions() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("camions.view", user)) {
      return { success: false, error: "Accès non autorisé", data: [] };
    }

    const camions = await prisma.camion.findMany({
      where: { entrepriseId: user.entrepriseId },
      orderBy: { createdAt: "desc" },
      include: {
        chauffeur: { select: { id: true, nom: true } },
        _count: { select: { dossiers: true } },
      },
    });
    return { success: true, data: camions };
  } catch (error) {
    console.error("Error fetching camions:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement des camions", data: [] };
  }
}

export async function getAvailableCamions() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("camions.view", user)) {
      return { success: false, data: [] };
    }

    const camions = await prisma.camion.findMany({
      where: { entrepriseId: user.entrepriseId },
      orderBy: { matricule: "asc" },
    });
    return { success: true, data: camions };
  } catch (error) {
    return { success: false, data: [] };
  }
}

export async function getCamionById(id: string) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("camions.view", user)) {
      return { success: false, error: "Accès non autorisé", data: null };
    }

    const camion = await prisma.camion.findFirst({
      where: { id, entrepriseId: user.entrepriseId },
      include: {
        chauffeur: true,
        dossiers: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            reference: true,
            statut: true,
            dateOperation: true,
            lieuDepart: true,
            lieuArrivee: true,
            client: { select: { nom: true } },
          },
        },
      },
    });
    if (!camion) return { success: false, error: "Camion non trouvé", data: null };
    return { success: true, data: camion };
  } catch (error) {
    console.error("Error fetching camion:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement du camion", data: null };
  }
}
