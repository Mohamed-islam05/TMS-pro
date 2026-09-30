// ============================================================
// Server Actions - Entreprise Settings (tenant-scoped)
// ============================================================
"use server";

import prisma from "@/lib/prisma";
import { getCurrentEntreprise } from "@/lib/actions/auth";
import { safeLogError } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import {
  updateEntrepriseSettingsSchema,
  type UpdateEntrepriseSettingsInput,
} from "@/lib/validations/entreprise-settings";

export async function getEntrepriseSettings() {
  try {
    const user = await getCurrentEntreprise();

    if (user.role !== "ENTREPRISE_ADMIN") {
      return { success: false as const, error: "Accès réservé à l'administrateur", data: null };
    }

    const entreprise = await prisma.entreprise.findFirst({
      where: { id: user.entrepriseId },
      select: {
        id: true,
        nom: true,
        adresse: true,
        telephone: true,
        email: true,
        ice: true,
        config: {
          select: {
            id: true,
            logoUrl: true,
            footerText: true,
            templateId: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!entreprise) {
      return { success: false as const, error: "Entreprise introuvable", data: null };
    }

    return { success: true as const, data: entreprise };
  } catch (error) {
    console.error("Error fetching entreprise settings:", safeLogError(error));
    return {
      success: false as const,
      error: "Erreur lors du chargement des paramètres",
      data: null,
    };
  }
}

export async function updateEntrepriseSettings(input: UpdateEntrepriseSettingsInput) {
  try {
    const user = await getCurrentEntreprise();

    if (user.role !== "ENTREPRISE_ADMIN") {
      return { success: false, error: "Accès réservé à l'administrateur" };
    }

    const parsed = updateEntrepriseSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }

    const { nom, adresse, telephone, email, ice, logoUrl, footerText, templateId } = parsed.data;

    const [, config] = await prisma.$transaction([
      prisma.entreprise.update({
        where: { id: user.entrepriseId },
        data: {
          nom,
          adresse: adresse || null,
          telephone: telephone || null,
          email: email || null,
          ice: ice || null,
        },
      }),
      prisma.entrepriseConfig.upsert({
        where: { entrepriseId: user.entrepriseId },
        create: {
          entrepriseId: user.entrepriseId,
          logoUrl: logoUrl || null,
          footerText: footerText || null,
          templateId,
        },
        update: {
          logoUrl: logoUrl || null,
          footerText: footerText || null,
          templateId,
        },
      }),
    ]);

    await logAudit({
      action: "update",
      module: "settings",
      entrepriseId: user.entrepriseId,
      userId: user.id,
      targetType: "EntrepriseConfig",
      targetId: config?.id ?? null,
      details: {
        templateId,
        hasLogo: Boolean(logoUrl),
        fields: ["nom", "adresse", "telephone", "email", "ice", "logoUrl", "footerText", "templateId"],
      },
    });

    return { success: true, message: "Paramètres de l'entreprise mis à jour" };
  } catch (error) {
    console.error("Error updating entreprise settings:", safeLogError(error));
    return { success: false, error: "Erreur lors de l'enregistrement des paramètres" };
  }
}