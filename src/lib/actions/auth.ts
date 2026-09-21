// ============================================================
// Server Actions - Auth Helper
// ============================================================
// Provides getCurrentEntreprise() for multi-tenant scoping
// Uses NextAuth session instead of hardcoded user
// ============================================================
"use server";

import { headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { safeLogError } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import {
  DEFAULT_STAFF_PERMISSIONS,
  ALL_PERMISSIONS,
  ADMIN_ONLY_PERMISSIONS,
  isValidPermission,
  getPermissionGroups,
  type Permission,
} from "@/lib/permissions";

export async function getCurrentEntreprise() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Non authentifié. Veuillez vous connecter.");
  }

  const user = await prisma.utilisateur.findUnique({
    where: { id: session.user.id },
    include: {
      entreprise: true,
      permissions: { select: { permission: true } },
    },
  });

  if (!user) {
    throw new Error("Utilisateur non trouvé.");
  }

  const permissions = user.permissions.map((p) => p.permission);

  return { ...user, permissions };
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.utilisateur.findUnique({
    where: { id: session.user.id },
    include: {
      entreprise: true,
      permissions: { select: { permission: true } },
    },
  });

  if (!user) return null;

  const permissions = user.permissions.map((p) => p.permission);

  return { ...user, permissions };
}

export async function getUtilisateurs() {
  try {
    const user = await getCurrentEntreprise();

    if (user.role !== "ENTREPRISE_ADMIN") {
      return { success: false, error: "Accès non autorisé", data: [] };
    }

    const utilisateurs = await prisma.utilisateur.findMany({
      where: { entrepriseId: user.entrepriseId },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        specialite: true,
        createdAt: true,
        permissions: { select: { permission: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = utilisateurs.map((u) => ({
      ...u,
      permissions: u.permissions.map((p) => p.permission),
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching utilisateurs:", safeLogError(error));
    return { success: false, error: "Erreur lors du chargement des utilisateurs", data: [] };
  }
}

const USER_ROLES = ["ENTREPRISE_ADMIN", "STAFF"] as const;

export async function updateUserRole(data: { userId: string; role: string }) {
  try {
    const { updateUserRoleSchema } = await import("@/lib/validations/password");
    const parsed = updateUserRoleSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Données invalides" };
    }

    const currentUser = await getCurrentEntreprise();

    if (currentUser.role !== "ENTREPRISE_ADMIN") {
      return { success: false, error: "Seul un administrateur peut modifier les rôles" };
    }

    if (currentUser.id === parsed.data.userId) {
      return { success: false, error: "Vous ne pouvez pas modifier votre propre rôle" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.utilisateur.findFirst({
        where: { id: parsed.data.userId, entrepriseId: currentUser.entrepriseId },
        select: { id: true },
      });
      if (!target) return { count: 0 };

      if (parsed.data.role === "ENTREPRISE_ADMIN") {
        await tx.userPermission.deleteMany({
          where: { userId: target.id, entrepriseId: currentUser.entrepriseId },
        });
      } else {
        const existing = await tx.userPermission.findMany({
          where: { userId: target.id, entrepriseId: currentUser.entrepriseId },
          select: { permission: true },
        });
        const existingSet = new Set(existing.map((e) => e.permission));
        const toCreate = DEFAULT_STAFF_PERMISSIONS.filter(
          (permission) => !existingSet.has(permission)
        );
        if (toCreate.length > 0) {
          await tx.userPermission.createMany({
            data: toCreate.map((permission) => ({
              userId: target.id,
              permission,
              entrepriseId: currentUser.entrepriseId,
            })),
          });
        }
      }

      return tx.utilisateur.updateMany({
        where: { id: parsed.data.userId, entrepriseId: currentUser.entrepriseId },
        data: { role: parsed.data.role, roleChangedAt: new Date(), permissionsChangedAt: new Date() },
      });
    });

    if (result.count === 0) {
      return { success: false, error: "Utilisateur introuvable" };
    }

    await logAudit({
      module: "users",
      action: "user.role_update",
      entrepriseId: currentUser.entrepriseId,
      userId: currentUser.id,
      targetType: "user",
      targetId: parsed.data.userId,
      details: { role: parsed.data.role },
    });

    revalidatePath("/dashboard/utilisateurs");
    return { success: true, message: "Rôle mis à jour avec succès" };
  } catch (error) {
    console.error("Error updating user role:", safeLogError(error));
    return { success: false, error: "Erreur lors de la mise à jour du rôle" };
  }
}

export async function createUser(data: {
  nom: string;
  email: string;
  password: string;
  role: string;
  specialite?: string;
}) {
  try {
    const { createUserSchema } = await import("@/lib/validations/password");
    const parsed = createUserSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Données invalides" };
    }

    const bcrypt = await import("bcryptjs");
    const currentUser = await getCurrentEntreprise();

    if (currentUser.role !== "ENTREPRISE_ADMIN") {
      return { success: false, error: "Seul un administrateur peut créer des utilisateurs" };
    }

    const existing = await prisma.utilisateur.findFirst({
      where: { email: parsed.data.email, entrepriseId: currentUser.entrepriseId },
    });

    if (existing) {
      return { success: false, error: "Cet email est déjà utilisé" };
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    const newUser = await prisma.utilisateur.create({
      data: {
        nom: parsed.data.nom,
        email: parsed.data.email,
        password: hashedPassword,
        role: parsed.data.role,
        specialite: parsed.data.specialite || null,
        entrepriseId: currentUser.entrepriseId,
        permissions:
          parsed.data.role === "ENTREPRISE_ADMIN"
            ? undefined
            : {
                create: DEFAULT_STAFF_PERMISSIONS.map((permission) => ({
                  permission,
                  entrepriseId: currentUser.entrepriseId,
                })),
              },
      },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    await logAudit({
      module: "users",
      action: "user.create",
      entrepriseId: currentUser.entrepriseId,
      userId: currentUser.id,
      targetType: "user",
      targetId: newUser.id,
      details: { email: newUser.email, role: newUser.role },
    });

    return { success: true, data: newUser, message: "Utilisateur créé avec succès" };
  } catch (error) {
    console.error("Error creating user:", safeLogError(error));
    return { success: false, error: "Erreur lors de la création de l'utilisateur" };
  }
}

export async function deleteUser(userId: string) {
  try {
    const currentUser = await getCurrentEntreprise();

    if (currentUser.role !== "ENTREPRISE_ADMIN") {
      return { success: false, error: "Seul un administrateur peut supprimer des utilisateurs" };
    }

    if (currentUser.id === userId) {
      return { success: false, error: "Vous ne pouvez pas supprimer votre propre compte" };
    }

    await prisma.utilisateur.deleteMany({
      where: { id: userId, entrepriseId: currentUser.entrepriseId },
    });

    await logAudit({
      module: "users",
      action: "user.delete",
      entrepriseId: currentUser.entrepriseId,
      userId: currentUser.id,
      targetType: "user",
      targetId: userId,
    });

    return { success: true, message: "Utilisateur supprimé avec succès" };
  } catch (error) {
    console.error("Error deleting user:", safeLogError(error));
    return { success: false, error: "Erreur lors de la suppression de l'utilisateur" };
  }
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  try {
    const { changePasswordSchema } = await import("@/lib/validations/password");
    const parsed = changePasswordSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Données invalides" };
    }

    const bcrypt = await import("bcryptjs");
    const currentUser = await getCurrentEntreprise();

    const user = await prisma.utilisateur.findUnique({
      where: { id: currentUser.id },
      select: { id: true, password: true },
    });

    if (!user || !user.password) {
      return { success: false, error: "Erreur lors du changement de mot de passe" };
    }

    const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!isValid) {
      return { success: false, error: "Le mot de passe actuel est incorrect" };
    }

    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return { success: false, error: "Le nouveau mot de passe doit être différent de l'actuel" };
    }

    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);

    await prisma.utilisateur.update({
      where: { id: currentUser.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    });

    await logAudit({
      module: "auth",
      action: "user.password_change",
      entrepriseId: currentUser.entrepriseId,
      userId: currentUser.id,
      targetType: "user",
      targetId: currentUser.id,
    });

    return { success: true, message: "Mot de passe modifié avec succès" };
  } catch (error) {
    console.error("Error changing password:", safeLogError(error));
    return { success: false, error: "Erreur lors du changement de mot de passe" };
  }
}

const GENERIC_FORGOT_PASSWORD_RESPONSE =
  "Si cette adresse est associée à un compte, un lien de réinitialisation vous a été envoyé.";

export async function requestPasswordReset(data: { ice: string; email: string }) {
  try {
    const {
      checkForgotPasswordIpRateLimit,
      checkForgotPasswordEmailRateLimit,
      isRateLimitConfigured,
    } = await import("@/lib/rate-limit");

    if (isRateLimitConfigured()) {
      const headerStore = await headers();
      const forwardedFor = headerStore.get("x-forwarded-for");
      const realIp = headerStore.get("x-real-ip");
      const ip = forwardedFor
        ? forwardedFor.split(",")[0].trim()
        : realIp || "127.0.0.1";

      const ipResult = await checkForgotPasswordIpRateLimit(ip);
      if (!ipResult.success) {
        return { success: true as const, message: GENERIC_FORGOT_PASSWORD_RESPONSE };
      }

      const emailResult = await checkForgotPasswordEmailRateLimit(data.email);
      if (!emailResult.success) {
        return { success: true as const, message: GENERIC_FORGOT_PASSWORD_RESPONSE };
      }
    }

    const { forgotPasswordSchema } = await import("@/lib/validations/password");
    const parsed = forgotPasswordSchema.safeParse(data);
    if (!parsed.success) {
      return { success: true as const, message: GENERIC_FORGOT_PASSWORD_RESPONSE };
    }

    // Tenant-scoped lookup: resolve the entreprise by its ICE (same
    // tenant identity used at login), then the user within that tenant.
    // This deterministically targets the exact (email, entreprise) account
    // even when the same email exists in multiple entreprises.
    const entreprise = await prisma.entreprise.findFirst({
      where: { ice: parsed.data.ice },
      select: { id: true },
    });

    if (!entreprise) {
      return { success: true as const, message: GENERIC_FORGOT_PASSWORD_RESPONSE };
    }

    const user = await prisma.utilisateur.findFirst({
      where: { email: parsed.data.email, entrepriseId: entreprise.id },
      select: { id: true },
    });

    if (!user) {
      return { success: true as const, message: GENERIC_FORGOT_PASSWORD_RESPONSE };
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await logAudit({
      module: "auth",
      action: "user.password_reset_request",
      entrepriseId: entreprise.id,
      targetType: "user",
      targetId: user.id,
    });

    const { sendPasswordResetEmail, isEmailConfigured } = await import("@/lib/email");
    if (isEmailConfigured()) {
      await sendPasswordResetEmail(parsed.data.email, rawToken);
    }

    return { success: true as const, message: GENERIC_FORGOT_PASSWORD_RESPONSE };
  } catch (error) {
    console.error("Error in requestPasswordReset:", safeLogError(error));
    return { success: true as const, message: GENERIC_FORGOT_PASSWORD_RESPONSE };
  }
}

const GENERIC_RESET_PASSWORD_RESPONSE =
  "Le lien de réinitialisation est invalide ou expiré.";

export async function resetPassword(data: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) {
  try {
    const { checkResetTokenRateLimit, isRateLimitConfigured } = await import("@/lib/rate-limit");

    const { resetPasswordSchema } = await import("@/lib/validations/password");
    const parsed = resetPasswordSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false as const, error: GENERIC_RESET_PASSWORD_RESPONSE };
    }

    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

    if (isRateLimitConfigured()) {
      const tokenResult = await checkResetTokenRateLimit(tokenHash);
      if (!tokenResult.success) {
        return { success: false as const, error: GENERIC_RESET_PASSWORD_RESPONSE };
      }
    }

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);

    const result = await prisma.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, userId: true },
      });

      if (!resetToken) {
        throw new Error("INVALID_TOKEN");
      }

      await tx.utilisateur.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
      });

      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new Error("TOKEN_ALREADY_CONSUMED");
      }

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      return { userId: resetToken.userId };
    });

    await logAudit({
      module: "auth",
      action: "user.password_reset",
      userId: result.userId,
      targetType: "user",
      targetId: result.userId,
    });

    return { success: true as const, message: "Mot de passe réinitialisé avec succès" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_TOKEN" || message === "TOKEN_ALREADY_CONSUMED") {
      return { success: false as const, error: GENERIC_RESET_PASSWORD_RESPONSE };
    }
    console.error("Error in resetPassword:", safeLogError(error));
    return { success: false as const, error: "Erreur lors de la réinitialisation du mot de passe" };
  }
}

export async function getMyPermissions() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, permissions: [], isAdmin: false };
    }
    return {
      success: true,
      permissions: session.user.permissions ?? [],
      isAdmin: session.user.role === "ENTREPRISE_ADMIN",
    };
  } catch (error) {
    console.error("Error fetching my permissions:", safeLogError(error));
    return { success: false, permissions: [], isAdmin: false };
  }
}

export async function getPermissionCatalog() {
  return { success: true, groups: getPermissionGroups() };
}

export async function updateUserPermissions(data: { userId: string; permissions: string[] }) {
  try {
    const currentUser = await getCurrentEntreprise();

    if (currentUser.role !== "ENTREPRISE_ADMIN") {
      return { success: false, error: "Seul un administrateur peut gérer les permissions" };
    }

    if (currentUser.id === data.userId) {
      return { success: false, error: "Vous ne pouvez pas modifier vos propres permissions" };
    }

    const permissions = Array.isArray(data.permissions) ? data.permissions : [];
    if (permissions.length > ALL_PERMISSIONS.length) {
      return { success: false, error: "Données invalides" };
    }
    if (!permissions.every(isValidPermission)) {
      return { success: false, error: "Permission inconnue" };
    }
    if (new Set(permissions).size !== permissions.length) {
      return { success: false, error: "Permissions en double" };
    }
    if (permissions.some((p) => ADMIN_ONLY_PERMISSIONS.includes(p))) {
      return {
        success: false,
        error: "Impossible d'attribuer des permissions d'administration à un utilisateur staff",
      };
    }

    const target = await prisma.utilisateur.findFirst({
      where: { id: data.userId, entrepriseId: currentUser.entrepriseId },
      select: { id: true, role: true },
    });
    if (!target) return { success: false, error: "Utilisateur introuvable" };
    if (target.role === "ENTREPRISE_ADMIN") {
      return { success: false, error: "Un administrateur a déjà accès à toutes les permissions" };
    }

    const finalPermissions = permissions as Permission[];

    await prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({
        where: { userId: target.id, entrepriseId: currentUser.entrepriseId },
      });
      if (finalPermissions.length > 0) {
        await tx.userPermission.createMany({
          data: finalPermissions.map((permission) => ({
            userId: target.id,
            permission,
            entrepriseId: currentUser.entrepriseId,
          })),
        });
      }
      await tx.utilisateur.updateMany({
        where: { id: target.id, entrepriseId: currentUser.entrepriseId },
data: { permissionsChangedAt: new Date() },
    });
    });

    await logAudit({
      module: "users",
      action: "user.permissions_update",
      entrepriseId: currentUser.entrepriseId,
      userId: currentUser.id,
      targetType: "user",
      targetId: target.id,
      details: { permissions: finalPermissions },
    });

    revalidatePath("/dashboard/utilisateurs");
    return { success: true, message: "Permissions mises à jour avec succès" };
  } catch (error) {
    console.error("Error updating permissions:", safeLogError(error));
    return { success: false, error: "Erreur lors de la mise à jour des permissions" };
  }
}
