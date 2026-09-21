import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { clearAllData, seedEntreprise } from "./helpers/auth-db";

const GENERIC = "Email ou mot de passe incorrect";

type Creds = { ice: string; email: string; password: string };

// NextAuth v4's CredentialsProvider factory puts the real authorize inside
// `options.authorize`; the top-level `authorize` is a no-op `() => null`.
const authorize = ((authOptions.providers[0] as any).options?.authorize ??
  (authOptions.providers[0] as any).authorize) as (c: Creds, req?: unknown) => Promise<unknown>;

async function attempt(creds: Creds) {
  try {
    const value = await authorize(creds, {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    return { ok: true as const, value };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// A. Valid login
describe("A/B/C/D/E: login tenant resolution + anti-enumeration", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };

  beforeAll(async () => {
    await clearAllData();
    const a = await seedEntreprise({
      ice: "ICE-A-111111",
      users: [
        { email: "admin@alpha.com", password: "passwordA1", role: "ENTREPRISE_ADMIN" },
        { email: "shared@alpha.com", password: "sharedPassA", role: "STAFF" },
      ],
    });
    const b = await seedEntreprise({
      ice: "ICE-B-222222",
      users: [
        { email: "shared@alpha.com", password: "sharedPassB", role: "STAFF" },
      ],
    });
    tenantA = { id: a.entreprise.id };
    tenantB = { id: b.entreprise.id };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("A. authenticates a valid (ICE, email, password) into the resolved entreprise", async () => {
    const res = await attempt({ ice: "ICE-A-111111", email: "admin@alpha.com", password: "passwordA1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toMatchObject({ email: "admin@alpha.com", entrepriseId: tenantA.id, role: "ENTREPRISE_ADMIN" });
      expect((res.value as { password?: unknown }).password).toBeUndefined();
    }
  });

  it("B. rejects a wrong password with the generic error", async () => {
    const res = await attempt({ ice: "ICE-A-111111", email: "admin@alpha.com", password: "wrong-password" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(GENERIC);
  });

  it("C. rejects an unknown email with the generic error", async () => {
    const res = await attempt({ ice: "ICE-A-111111", email: "nobody@alpha.com", password: "passwordA1" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(GENERIC);
  });

  it("D. rejects a wrong/unknown ICE even with a valid email+password", async () => {
    const res = await attempt({ ice: "ICE-DOES-NOT-EXIST", email: "admin@alpha.com", password: "passwordA1" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(GENERIC);
  });

  it("E. rejects an email that belongs to another entreprise (tenant isolation)", async () => {
    // admin@alpha.com belongs to tenant A; authenticating against tenant B must fail.
    const res = await attempt({ ice: "ICE-B-222222", email: "admin@alpha.com", password: "passwordA1" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(GENERIC);
  });

  it("E2. a tenant A user cannot authenticate into tenant B with tenant B's credentials shape", async () => {
    const res = await attempt({ ice: "ICE-A-111111", email: "shared@alpha.com", password: "sharedPassB" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(GENERIC);
  });

  it("all failure branches return exactly the same generic message (no oracle)", async () => {
    const failures = await Promise.all([
      attempt({ ice: "ICE-A-111111", email: "admin@alpha.com", password: "wrong-password" }),
      attempt({ ice: "ICE-A-111111", email: "nobody@alpha.com", password: "passwordA1" }),
      attempt({ ice: "ICE-DOES-NOT-EXIST", email: "admin@alpha.com", password: "passwordA1" }),
      attempt({ ice: "ICE-B-222222", email: "admin@alpha.com", password: "passwordA1" }),
      attempt({ ice: "", email: "admin@alpha.com", password: "" }),
    ]);
    for (const f of failures) {
      expect(f.ok).toBe(false);
      if (!f.ok) expect(f.error).toBe(GENERIC);
    }
  });

  // F. Duplicate email across two entreprises (supported, tenant-scoped)
  it("F. duplicate emails across entreprises are allowed and resolve to the right tenant", async () => {
    expect(await prisma.utilisateur.count({ where: { email: "shared@alpha.com" } })).toBe(2);

    const viaA = await attempt({ ice: "ICE-A-111111", email: "shared@alpha.com", password: "sharedPassA" });
    expect(viaA.ok).toBe(true);
    if (viaA.ok) expect(viaA.value).toMatchObject({ entrepriseId: tenantA.id });

    const viaB = await attempt({ ice: "ICE-B-222222", email: "shared@alpha.com", password: "sharedPassB" });
    expect(viaB.ok).toBe(true);
    if (viaB.ok) expect(viaB.value).toMatchObject({ entrepriseId: tenantB.id });
  });
});