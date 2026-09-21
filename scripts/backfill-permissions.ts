// One-off backfill: grant DEFAULT_STAFF_PERMISSIONS to existing STAFF
// accounts and stamp permissionsChangedAt (forces re-authentication).
// Admins keep implicit full access (no rows). Idempotent.
import { PrismaClient } from "@prisma/client";
import { DEFAULT_STAFF_PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient();

async function main() {
  const staffUsers = await prisma.utilisateur.findMany({
    where: { role: "STAFF" },
    select: { id: true, email: true, entrepriseId: true },
  });

  console.log(`Found ${staffUsers.length} STAFF user(s).`);

  for (const user of staffUsers) {
    const existing = await prisma.userPermission.findMany({
      where: { userId: user.id },
      select: { permission: true },
    });
    const existingSet = new Set(existing.map((e) => e.permission));
    const toCreate = DEFAULT_STAFF_PERMISSIONS.filter((p) => !existingSet.has(p));

    if (toCreate.length > 0) {
      await prisma.userPermission.createMany({
        data: toCreate.map((permission) => ({
          userId: user.id,
          permission,
          entrepriseId: user.entrepriseId,
        })),
      });
      console.log(`  ${user.email}: +${toCreate.length} permissions granted`);
    } else {
      console.log(`  ${user.email}: all defaults already present`);
    }

    await prisma.utilisateur.update({
      where: { id: user.id },
      data: { permissionsChangedAt: new Date() },
    });
  }

  const counts = await prisma.userPermission.groupBy({
    by: ["userId"],
    _count: { userId: true },
  });
  console.log("Grant summary per user:", JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());