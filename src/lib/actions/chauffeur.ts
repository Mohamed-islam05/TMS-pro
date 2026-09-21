// ============================================================
// Server Actions - Chauffeur Entity
// ============================================================
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentEntreprise } from "./auth";
import {
  createChauffeurSchema,
  updateChauffeurSchema,
  deleteChauffeurSchema,
  type CreateChauffeurInput,
  type UpdateChauffeurInput,
  type DeleteChauffeurInput,
} from "@/lib/validations/chauffeur";
import { safeLogError } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function createChauffeur(data: CreateChauffeurInput) {
  try {
    const validatedData = createChauffeurSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("chauffeurs.create", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    if (validatedData.type === "INTERNE" && validatedData.camionId) {
      const camion = await prisma.camion.findFirst({
        where: { id: validatedData.camionId, entrepriseId: user.entrepriseId },
        select: { id: true },
      });
      if (!camion) return { success: false, error: "Camion non trouvé" };
    }

    const chauffeur = await prisma.chauffeur.create({
      data: {
        nom: validatedData.nom,
        telephone: validatedData.telephone,
        cin: validatedData.cin,
        type: validatedData.type,
        camionExterne: validatedData.type === "EXTERNE" ? (validatedData.camionExterne || null) : null,
        actif: validatedData.actif,
        camionId: validatedData.type === "INTERNE" ? (validatedData.camionId || null) : null,
        entrepriseId: user.entrepriseId,
      },
    });

    await logAudit({
      module: "chauffeurs",
      action: "chauffeur.create",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "chauffeur",
      targetId: chauffeur.id,
      details: { nom: chauffeur.nom },
    });

    revalidatePath("/dashboard/chauffeurs");
    return { success: true, data: chauffeur, message: "Chauffeur créé avec succès" };
  } catch (error) {
    console.error("Error creating chauffeur:", safeLogError(error));
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { success: false, error: "Ce CIN ou numéro de permis existe déjà" };
    }
    return { success: false, error: "Erreur lors de la création du chauffeur" };
  }
}

export async function updateChauffeur(data: UpdateChauffeurInput) {
  try {
    const validatedData = updateChauffeurSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("chauffeurs.update", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    let camionOk = true;
    if (validatedData.type === "INTERNE" && validatedData.camionId) {
      const camion = await prisma.camion.findFirst({
        where: { id: validatedData.camionId, entrepriseId: user.entrepriseId },
        select: { id: true },
      });
      if (!camion) camionOk = false;
    }

    if (!camionOk) return { success: false, error: "Camion non trouvé" };

    const result = await prisma.chauffeur.updateMany({
      where: { id: validatedData.id, entrepriseId: user.entrepriseId },
      data: {
        nom: validatedData.nom,
        telephone: validatedData.telephone,
        cin: validatedData.cin,
        type: validatedData.type,
        camionExterne: validatedData.type === "EXTERNE" ? (validatedData.camionExterne || null) : null,
        actif: validatedData.actif,
        camionId: validatedData.type === "INTERNE" ? (validatedData.camionId || null) : null,
      },
    });

    const chauffeur = result.count > 0
      ? await prisma.chauffeur.findFirst({ where: { id: validatedData.id, entrepriseId: user.entrepriseId } })
      : null;

    if (!chauffeur) return { success: false, error: "Chauffeur non trouvé" };

    await logAudit({
      module: "chauffeurs",
      action: "chauffeur.update",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "chauffeur",
      targetId: chauffeur.id,
      details: { nom: chauffeur.nom },
    });

    revalidatePath("/dashboard/chauffeurs");
    return { success: true, data: chauffeur, message: "Chauffeur mis à jour avec succès" };
  } catch (error) {
    console.error("Error updating chauffeur:", safeLogError(error));
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { success: false, error: "Ce CIN existe déjà" };
    }
    return { success: false, error: "Erreur lors de la mise à jour du chauffeur" };
  }
}

export async function deleteChauffeur(data: DeleteChauffeurInput) {
  try {
    const validatedData = deleteChauffeurSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("chauffeurs.delete", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const result = await prisma.chauffeur.deleteMany({
      where: { id: validatedData.id, entrepriseId: user.entrepriseId },
    });

    if (result.count === 0) return { success: false, error: "Chauffeur non trouvé" };

    await logAudit({
      module: "chauffeurs",
      action: "chauffeur.delete",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "chauffeur",
      targetId: validatedData.id,
    });

    revalidatePath("/dashboard/chauffeurs");
    return { success: true, message: "Chauffeur supprimé avec succès" };
  } catch (error) {
    console.error("Error deleting chauffeur:", safeLogError(error));
    return { success: false, error: "Erreur lors de la suppression du chauffeur" };
  }
}

export async function getChauffeurs() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("chauffeurs.view", user)) {
      return { success: false, error: "Accès non autorisé", data: [] };
    }

    const chauffeurs = await prisma.chauffeur.findMany({
      where: { entrepriseId: user.entrepriseId },
      orderBy: { createdAt: "desc" },
      include: {
        camion: true,
        _count: { select: { dossiers: true } },
      },
    });
    return { success: true, data: chauffeurs };
  } catch (error) {
    console.error("Error fetching chauffeurs:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement des chauffeurs", data: [] };
  }
}

export async function getChauffeurById(id: string) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("chauffeurs.view", user)) {
      return { success: false, error: "Accès non autorisé", data: null };
    }

    const chauffeur = await prisma.chauffeur.findFirst({
      where: { id, entrepriseId: user.entrepriseId },
      include: {
        camion: true,
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
    if (!chauffeur) return { success: false, error: "Chauffeur non trouvé", data: null };
    return { success: true, data: chauffeur };
  } catch (error) {
    console.error("Error fetching chauffeur:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement du chauffeur", data: null };
  }
}

export async function getChauffeurCamion(chauffeurId: string) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("chauffeurs.view", user)) {
      return { success: false, data: null };
    }

    const chauffeur = await prisma.chauffeur.findFirst({
      where: { id: chauffeurId, entrepriseId: user.entrepriseId },
      select: { camionId: true, camion: { select: { matricule: true } } },
    });
    return {
      success: true,
      data: chauffeur?.camion ? { camionId: chauffeur.camionId, matricule: chauffeur.camion.matricule } : null,
    };
  } catch (error) {
    return { success: false, data: null };
  }
}
