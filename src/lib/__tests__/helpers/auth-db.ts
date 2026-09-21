import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function clearAllData(): Promise<void> {
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany(),
    prisma.userPermission.deleteMany(),
    prisma.account.deleteMany(),
    prisma.session.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.charge.deleteMany(),
    prisma.facture.deleteMany(),
    prisma.dossier.deleteMany(),
    prisma.camion.deleteMany(),
    prisma.chauffeur.deleteMany(),
    prisma.client.deleteMany(),
    prisma.utilisateur.deleteMany(),
    prisma.entreprise.deleteMany(),
  ]);
}

export interface SeedUserInput {
  email: string;
  password: string;
  role?: string;
  nom?: string;
}

export interface SeedEntrepriseResult {
  entreprise: { id: string; ice: string | null; nom: string };
  users: Array<{ id: string; email: string; role: string }>;
}

export async function seedEntreprise(opts: {
  ice: string;
  nom?: string;
  users?: SeedUserInput[];
}): Promise<SeedEntrepriseResult> {
  const entreprise = await prisma.entreprise.create({
    data: { ice: opts.ice, nom: opts.nom ?? `Entreprise ${opts.ice}` },
  });
  const users: SeedEntrepriseResult["users"] = [];
  for (const u of opts.users ?? []) {
    const created = await prisma.utilisateur.create({
      data: {
        email: u.email,
        password: await hashPassword(u.password),
        role: u.role ?? "STAFF",
        nom: u.nom ?? u.email,
        entrepriseId: entreprise.id,
      },
    });
    users.push({ id: created.id, email: created.email, role: created.role });
  }
  return {
    entreprise: { id: entreprise.id, ice: entreprise.ice, nom: entreprise.nom },
    users,
  };
}

export function sha256(raw: string): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(raw).digest("hex");
}

export function randomRawToken(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return randomBytes(32).toString("hex");
}