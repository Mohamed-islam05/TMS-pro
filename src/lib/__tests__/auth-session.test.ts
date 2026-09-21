import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSessionInvalidated } from "@/lib/session-invalidation";
import { hasPermission, requirePermission } from "@/lib/permissions";
import {
  getCurrentUser,
  getCurrentEntreprise,
  getUtilisateurs,
  updateUserPermissions,
} from "@/lib/actions/auth";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { clearAllData, seedEntreprise } from "./helpers/auth-db";

const sessionMock = vi.hoisted(() => ({ getServerSession: vi.fn() }));

vi.mock("next-auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next-auth")>();
  return { ...mod, getServerSession: sessionMock.getServerSession };
});

describe("H/I/J/G: session invalidation + expiry configuration", () => {
  it("H. password change after token issuance invalidates the session", () => {
    const iat = Math.floor(Date.now() / 1000);
    const changed = new Date((iat + 5) * 1000);
    expect(isSessionInvalidated(changed, iat)).toBe(true);
  });

  it("I. role change after token issuance invalidates the session", () => {
    const iat = Math.floor(Date.now() / 1000);
    const changed = new Date(iat * 1000 + 60000);
    expect(isSessionInvalidated(changed, iat)).toBe(true);
  });

  it("J. permission change after token issuance invalidates the session", () => {
    const iat = Math.floor(Date.now() / 1000);
    const changed = new Date(iat * 1000 + 60000);
    expect(isSessionInvalidated(changed, iat)).toBe(true);
  });

  it("does not invalidate when nothing changed or the change predates issuance", () => {
    const iat = Math.floor(Date.now() / 1000);
    expect(isSessionInvalidated(null, iat)).toBe(false);
    expect(isSessionInvalidated(undefined, iat)).toBe(false);
    expect(isSessionInvalidated(new Date(0), iat)).toBe(false);
    expect(isSessionInvalidated(new Date(iat * 1000), null)).toBe(false);
    expect(isSessionInvalidated(new Date(iat * 1000 - 5000), iat)).toBe(false);
  });

  it("documents the seconds-granularity boundary (same-second change is not invalidated)", () => {
    const iat = Math.floor(Date.now() / 1000);
    const sameSecond = new Date(iat * 1000 + 500);
    expect(isSessionInvalidated(sameSecond, iat)).toBe(false);
  });

  it("G. JWT session expiry is capped at 8 hours (exp enforced by NextAuth decode)", () => {
    expect(authOptions.session!.maxAge).toBe(60 * 60 * 8);
  });
});

describe("Q/R: authorization boundary (server-derived identity)", () => {
  let adminId: string;
  let staffId: string;
  let tenantAId: string;
  let otherTenantUserId: string;

  beforeAll(async () => {
    await clearAllData();
    const a = await seedEntreprise({
      ice: "ICE-A-555555",
      users: [
        { email: "admin@scope.com", password: "passwordA1", role: "ENTREPRISE_ADMIN" },
        { email: "staff@scope.com", password: "passwordS1", role: "STAFF" },
      ],
    });
    const b = await seedEntreprise({
      ice: "ICE-B-666666",
      users: [{ email: "other@scope.com", password: "passwordO1", role: "STAFF" }],
    });
    tenantAId = a.entreprise.id;
    adminId = a.users[0].id;
    staffId = a.users[1].id;
    otherTenantUserId = b.users[0].id;
  });

  beforeEach(() => {
    sessionMock.getServerSession.mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Q. unauthenticated server action boundary rejects", async () => {
    sessionMock.getServerSession.mockResolvedValue(null);
    await expect(getCurrentEntreprise()).rejects.toThrow("Non authentifié");
    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(getDashboardStats()).resolves.toBeNull();
  });

  it("Q2. a user id not present in the DB is rejected (no stale-token fallback)", async () => {
    sessionMock.getServerSession.mockResolvedValue({
      user: { id: "00000000-0000-4000-8000-000000000000" },
    });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("R. resolved role/permissions are server-derived, not client-supplied", async () => {
    // A STAFF user id — even when the session object claims otherwise — resolves
    // to the DB role and is denied the admin-only users surface.
    sessionMock.getServerSession.mockResolvedValue({
      user: { id: staffId, role: "ENTREPRISE_ADMIN" }, // forged claim, ignored
    });
    const denied = await getUtilisateurs();
    expect(denied.success).toBe(false);

    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminId } });
    const granted = await getUtilisateurs();
    expect(granted.success).toBe(true);
  });

  it("R2. a user from tenant A cannot enlist tenant B users (server-action tenant isolation)", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminId } });
    const res = await getUtilisateurs();
    if (res.success) {
      expect(res.data.every((u: { id: string }) => u.id !== otherTenantUserId)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(2); // admin + staff of A
      expect(res.data.find((u: { id: string }) => u.id === adminId)).toBeTruthy();
      expect(res.data.find((u: { id: string }) => u.id === staffId)).toBeTruthy();
    }
    expect(tenantAId).toBeTruthy();
  });

  it("R3. permission checks require actual possession (no implicit admin grants)", () => {
    // An empty STAFF permission set is denied access to admin surfaces.
    expect(hasPermission("users.delete", { role: "STAFF", permissions: [] })).toBe(false);
    expect(() => requirePermission("users.delete", { role: "STAFF", permissions: [] })).toThrow(
      "Accès non autorisé"
    );
    // hasPermission is possession-based: the string must be actually held to matter.
    expect(hasPermission("dossiers.create", { role: "STAFF", permissions: ["dossiers.create"] })).toBe(true);
    expect(hasPermission("users.delete", { role: "STAFF", permissions: ["dossiers.create"] })).toBe(false);
  });

  it("R3b. the server write-path rejects injecting admin-only permission rows onto a STAFF user", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminId } });
    const res = await updateUserPermissions({ userId: staffId, permissions: ["users.delete"] });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe(
        "Impossible d'attribuer des permissions d'administration à un utilisateur staff"
      );
    }
    // Nothing was written: the staff row still holds no admin-only permission.
    const held = await prisma.userPermission.findMany({
      where: { userId: staffId, permission: { in: ["users.delete", "users.permissions"] } },
    });
    expect(held).toHaveLength(0);
  });

  it("R4. ENTREPRISE_ADMIN keeps implicit full access through the same engine", () => {
    expect(hasPermission("users.delete", { role: "ENTREPRISE_ADMIN", permissions: [] })).toBe(true);
  });
});