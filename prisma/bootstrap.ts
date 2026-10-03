// ============================================================
// TMS Pro - Explicit production/isolated bootstrap
// ============================================================
// Creates the initial Entreprise + ENTREPRISE_ADMIN, idempotently.
//
// Intentionally NOT automatic:
//   - never runs during "next build" or Vercel startup
//   - requires the dedicated command: npm run db:bootstrap
//   - requires explicit confirmation: BOOTSTRAP_CONFIRM=yes
//   - requires BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD (env only)
//   - refuses non-PostgreSQL targets (protects against legacy SQLite URLs)
//   - prints and confirms the target database before any write
//   - never logs the admin password
// ============================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_ROLE = "ENTREPRISE_ADMIN";
const PASSWORD_SALT_ROUNDS = 12;

// Rejects values that are trivially weak, mirroring src/lib/env.ts spirit.
const WEAK_PASSWORD_WORDS = [
  "password",
  "admin",
  "changeme",
  "1234",
  "secret",
  "default",
];

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `${name} is required. Set it in the environment before running db:bootstrap.`
    );
  }
  return value.trim();
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url.replace(/^postgres:\/\//, "postgresql://"));
    return `postgresql://<creds>@${u.host}${u.pathname}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

function assertPostgresTarget(url: string): void {
  if (!/^(postgres|postgresql):\/\//.test(url)) {
    throw new Error(
      "Refusing to run bootstrap: DATABASE_URL must be a PostgreSQL URL " +
        `(got ${maskUrl(url)}). This command is only safe against a ` +
        `PostgreSQL database.`
    );
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  assertPostgresTarget(dbUrl);

  if (process.env.BOOTSTRAP_CONFIRM !== "yes") {
    throw new Error(
      "Refusing to run: set BOOTSTRAP_CONFIRM=yes to explicitly confirm the " +
        `target database.\nTarget: ${maskUrl(dbUrl)}`
    );
  }

  const email = required("BOOTSTRAP_ADMIN_EMAIL");
  if (!EMAIL_RE.test(email)) {
    throw new Error(`Invalid BOOTSTRAP_ADMIN_EMAIL: ${email}`);
  }

  const password = required("BOOTSTRAP_ADMIN_PASSWORD");
  if (password.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
  }
  if (
    WEAK_PASSWORD_WORDS.some(
      (w) => password.toLowerCase().includes(w) || w === password.toLowerCase()
    )
  ) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD is obviously weak.");
  }

  const entrepriseNom =
    (process.env.BOOTSTRAP_ENTREPRISE_NAME ?? "Transport Pro").trim() ||
    "Transport Pro";
  const adminNom =
    (process.env.BOOTSTRAP_ADMIN_NAME ?? "Administrateur").trim() ||
    "Administrateur";

  console.log("===== TMS Pro bootstrap =====");
  console.log(`Target database: ${maskUrl(dbUrl)}`);
  console.log(`Entreprise:      ${entrepriseNom}`);
  console.log(`Admin email:     ${email}`);
  console.log(`Admin role:      ${ADMIN_ROLE}`);
  console.log("");

  // Entreprise — created only if absent (by name).
  let entreprise = await prisma.entreprise.findFirst({
    where: { nom: entrepriseNom },
  });
  if (!entreprise) {
    entreprise = await prisma.entreprise.create({
      data: { nom: entrepriseNom },
    });
    console.log(`Created Entreprise "${entrepriseNom}" (${entreprise.id}).`);
  } else {
    console.log(`Entreprise "${entrepriseNom}" already exists (${entreprise.id}).`);
  }

  // ENTREPRISE_ADMIN — created only if absent on this entreprise.
  const existing = await prisma.utilisateur.findUnique({
    where: {
      email_entrepriseId: { email, entrepriseId: entreprise.id },
    },
  });

  if (existing) {
    console.log(
      `User ${email} already exists on this entreprise (role "${existing.role}"). No changes made.`
    );
    if (existing.role !== ADMIN_ROLE) {
      console.warn(
        "WARNING: the existing user is not an ENTREPRISE_ADMIN. Skipping to " +
          "avoid altering an existing account. Configure it manually if needed."
      );
    }
  } else {
    const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    await prisma.utilisateur.create({
      data: {
        email,
        password: hashedPassword,
        role: ADMIN_ROLE,
        nom: adminNom,
        entrepriseId: entreprise.id,
      },
    });
    console.log(`Created ENTREPRISE_ADMIN user ${email}.`);
  }

  console.log("Bootstrap complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });