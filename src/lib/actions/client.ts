// ============================================================
// Server Actions - Client Entity
// ============================================================
"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentEntreprise } from "./auth";
import {
  createClientSchema,
  updateClientSchema,
  deleteClientSchema,
  type CreateClientInput,
  type UpdateClientInput,
  type DeleteClientInput,
} from "@/lib/validations/client";
import { safeLogError } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function createClient(data: CreateClientInput) {
  try {
    const validatedData = createClientSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("clients.create", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const client = await prisma.client.create({
      data: {
        nom: validatedData.nom,
        telephone: validatedData.telephone || null,
        adresse: validatedData.adresse || null,
        ice: validatedData.ice || null,
        clientReference: validatedData.clientReference || null,
        entrepriseId: user.entrepriseId,
      },
    });

    await logAudit({
      module: "clients",
      action: "client.create",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "client",
      targetId: client.id,
      details: { nom: client.nom },
    });

    revalidatePath("/dashboard/clients");
    return { success: true, data: client, message: "Client créé avec succès" };
  } catch (error) {
    console.error("Error creating client:", safeLogError(error));
    return { success: false, error: "Erreur lors de la création du client" };
  }
}

export async function updateClient(data: UpdateClientInput) {
  try {
    const validatedData = updateClientSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("clients.update", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const client = await prisma.$transaction(async (tx) => {
      const existing = await tx.client.findFirst({
        where: { id: validatedData.id, entrepriseId: user.entrepriseId },
        select: { id: true },
      });
      if (!existing) return null;

      return tx.client.update({
        where: {
          id: validatedData.id,
          entrepriseId: user.entrepriseId,
        },
        data: {
          nom: validatedData.nom,
          telephone: validatedData.telephone || null,
          adresse: validatedData.adresse || null,
          ice: validatedData.ice || null,
          clientReference: validatedData.clientReference || null,
        },
      });
    });

    if (!client) return { success: false, error: "Client non trouvé" };

    await logAudit({
      module: "clients",
      action: "client.update",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "client",
      targetId: client.id,
      details: { nom: client.nom },
    });

    revalidatePath("/dashboard/clients");
    return { success: true, data: client, message: "Client mis à jour avec succès" };
  } catch (error) {
    console.error("Error updating client:", safeLogError(error));
    return { success: false, error: "Erreur lors de la mise à jour du client" };
  }
}

export async function deleteClient(data: DeleteClientInput) {
  try {
    const validatedData = deleteClientSchema.parse(data);
    const user = await getCurrentEntreprise();

    if (!hasPermission("clients.delete", user)) {
      return { success: false, error: "Accès non autorisé" };
    }

    const existing = await prisma.client.findFirst({
      where: { id: validatedData.id, entrepriseId: user.entrepriseId },
      include: { _count: { select: { dossiers: true } } },
    });
    if (!existing) return { success: false, error: "Client non trouvé" };

    if (existing._count.dossiers > 0) {
      return {
        success: false,
        error:
          "Impossible de supprimer ce client car il possède des dossiers associés. Supprimez ou archivez d'abord les dossiers concernés.",
      };
    }

    const result = await prisma.client.deleteMany({
      where: { id: validatedData.id, entrepriseId: user.entrepriseId },
    });

    if (result.count === 0) return { success: false, error: "Client non trouvé" };

    await logAudit({
      module: "clients",
      action: "client.delete",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "client",
      targetId: validatedData.id,
    });

    revalidatePath("/dashboard/clients");
    return { success: true, message: "Client supprimé avec succès" };
  } catch (error) {
    console.error("Error deleting client:", safeLogError(error));
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        success: false,
        error:
          "Impossible de supprimer ce client car il est encore référencé par des données métier (dossiers, utilisateurs...).",
      };
    }
    return { success: false, error: "Erreur lors de la suppression du client" };
  }
}

export async function getClients() {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("clients.view", user)) {
      return { success: false, error: "Accès non autorisé", data: [] };
    }

    const clients = await prisma.client.findMany({
      where: { entrepriseId: user.entrepriseId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { dossiers: true } } },
    });
    return { success: true, data: clients };
  } catch (error) {
    console.error("Error fetching clients:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement des clients", data: [] };
  }
}

export async function getClientById(id: string) {
  try {
    const user = await getCurrentEntreprise();

    if (!hasPermission("clients.view", user)) {
      return { success: false, error: "Accès non autorisé", data: null };
    }

    const client = await prisma.client.findFirst({
      where: { id, entrepriseId: user.entrepriseId },
      include: {
        _count: { select: { dossiers: true } },
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
            typeVehicule: true,
          },
        },
      },
    });
    if (!client) return { success: false, error: "Client non trouvé", data: null };
    return { success: true, data: client };
  } catch (error) {
    console.error("Error fetching client:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement du client", data: null };
  }
}
