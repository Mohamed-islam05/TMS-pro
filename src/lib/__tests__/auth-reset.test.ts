import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { clearAllData, seedEntreprise, sha256, randomRawToken } from "./helpers/auth-db";
import { requestPasswordReset, resetPassword } from "@/lib/actions/auth";

const GENERIC_FORGOT =
  "Si cette adresse est associée à un compte, un lien de réinitialisation vous a été envoyé.";
const GENERIC_RESET = "Le lien de réinitialisation est invalide ou expiré.";

const emailMock = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(),
  isEmailConfigured: vi.fn(),
}));

vi.mock("@/lib/email", () => emailMock);

let capturedToken: string | null = null;

describe("K/P: forgot-password + reset-token lifecycle (tenant-scoped)", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  let resUser: { id: string };
  let resUser2: { id: string };

  beforeAll(async () => {
    await clearAllData();
    emailMock.isEmailConfigured.mockReturnValue(true);
    emailMock.sendPasswordResetEmail.mockImplementation(
      async (_to: string, token: string, ..._rest: unknown[]) => {
        capturedToken = token;
      }
    );

    const a = await seedEntreprise({
      ice: "ICE-A-333333",
      users: [
        { email: "reset@alpha.com", password: "oldpass1", role: "STAFF" },
        { email: "reset2@alpha.com", password: "oldpass2", role: "STAFF" },
      ],
    });
    const b = await seedEntreprise({ ice: "ICE-B-444444" });
    tenantA = { id: a.entreprise.id };
    tenantB = { id: b.entreprise.id };
    resUser = { id: a.users[0].id };
    resUser2 = { id: a.users[1].id };
  });

  beforeEach(() => {
    capturedToken = null;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("K. requests a reset for correct ICE + email, stores only a sha256 hash, returns generic message", async () => {
    const res = await requestPasswordReset({ ice: "ICE-A-333333", email: "reset@alpha.com" });
    expect(res.success).toBe(true);
    expect(res.message).toBe(GENERIC_FORGOT);
    expect(capturedToken).toBeTruthy();

    const rows = await prisma.passwordResetToken.findMany({ where: { userId: resUser.id } });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.tokenHash).toBe(sha256(capturedToken!));
    expect(row.tokenHash).not.toBe(capturedToken);
    expect(row.usedAt).toBeNull();
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("L. wrong ICE returns the generic message and creates no token", async () => {
    const before = await prisma.passwordResetToken.count({ where: { userId: resUser.id } });
    const res = await requestPasswordReset({ ice: "ICE-WRONG-999", email: "reset@alpha.com" });
    expect(res.success).toBe(true);
    expect(res.message).toBe(GENERIC_FORGOT);
    expect(capturedToken).toBeNull();
    const after = await prisma.passwordResetToken.count({ where: { userId: resUser.id } });
    expect(after).toBe(before);
  });

  it("M. email belonging to another entreprise returns the generic message and creates no token", async () => {
    // reset@alpha.com exists in tenant A; requesting with tenant B ICE must not mint a token.
    const before = await prisma.passwordResetToken.count({ where: { userId: resUser.id } });
    const res = await requestPasswordReset({ ice: "ICE-B-444444", email: "reset@alpha.com" });
    expect(res.success).toBe(true);
    expect(res.message).toBe(GENERIC_FORGOT);
    expect(capturedToken).toBeNull();
    const after = await prisma.passwordResetToken.count({ where: { userId: resUser.id } });
    expect(after).toBe(before);
  });

  it("M2. unknown email with valid ICE returns the generic message and creates no token", async () => {
    const res = await requestPasswordReset({ ice: "ICE-A-333333", email: "ghost@alpha.com" });
    expect(res.success).toBe(true);
    expect(res.message).toBe(GENERIC_FORGOT);
    expect(capturedToken).toBeNull();
  });

  it("all forgot-password branches (valid/wrong ICE, other tenant, unknown email) share the same response shape", async () => {
    const results = await Promise.all([
      requestPasswordReset({ ice: "ICE-A-333333", email: "reset@alpha.com" }),
      requestPasswordReset({ ice: "ICE-WRONG-999", email: "reset@alpha.com" }),
      requestPasswordReset({ ice: "ICE-B-444444", email: "reset@alpha.com" }),
      requestPasswordReset({ ice: "ICE-A-333333", email: "ghost@alpha.com" }),
    ]);
    for (const r of results) {
      expect(r).toEqual({ success: true, message: GENERIC_FORGOT });
    }
  });

  it("N. resets the password, then rejects token replay", async () => {
    await requestPasswordReset({ ice: "ICE-A-333333", email: "reset@alpha.com" });
    const raw = capturedToken!;

    const first = await resetPassword({
      token: raw,
      newPassword: "newpass1",
      confirmPassword: "newpass1",
    });
    expect(first.success).toBe(true);

    const stored = await prisma.utilisateur.findUnique({ where: { id: resUser.id } });
    expect(stored?.passwordChangedAt).not.toBeNull();
    expect(await bcrypt.compare("newpass1", stored?.password ?? "")).toBe(true);
    expect(await bcrypt.compare("oldpass1", stored?.password ?? "")).toBe(false);

    const replayed = await resetPassword({
      token: raw,
      newPassword: "newpass2",
      confirmPassword: "newpass2",
    });
    expect(replayed.success).toBe(false);
    if (!replayed.success) expect(replayed.error).toBe(GENERIC_RESET);

    // Password untouched after the failed replay.
    const after = await prisma.utilisateur.findUnique({ where: { id: resUser.id } });
    expect(await bcrypt.compare("newpass1", after?.password ?? "")).toBe(true);
  });

  it("P. consuming one token revokes every other unused token for the same user", async () => {
    await requestPasswordReset({ ice: "ICE-A-333333", email: "reset2@alpha.com" });
    const rawPrimary = capturedToken!;

    // A second, still-unused token minted out-of-band (e.g. raced email).
    const rawRacer = randomRawToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: resUser2.id,
        tokenHash: sha256(rawRacer),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await resetPassword({
      token: rawPrimary,
      newPassword: "newpass3",
      confirmPassword: "newpass3",
    });
    expect(res.success).toBe(true);

    const racerRow = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(rawRacer) },
    });
    expect(racerRow?.usedAt).not.toBeNull();
  });

  it("O. rejects an expired reset token without changing the password", async () => {
    const rawExpired = randomRawToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: resUser2.id,
        tokenHash: sha256(rawExpired),
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
    });

    const res = await resetPassword({
      token: rawExpired,
      newPassword: "should-not-apply",
      confirmPassword: "should-not-apply",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe(GENERIC_RESET);

    const stored = await prisma.utilisateur.findUnique({ where: { id: resUser2.id } });
    expect(stored?.password).toBeTruthy();
    expect(await bcrypt.compare("newpass3", stored?.password ?? "")).toBe(true);
    expect(await bcrypt.compare("should-not-apply", stored?.password ?? "")).toBe(false);
  });

  it("keeps reset failure responses non-informative (no token-hash leak, no account oracle)", async () => {
    const res = await resetPassword({
      token: sha256("a-valid-looking-hash-format"),
      newPassword: "newpass1",
      confirmPassword: "newpass1",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe(GENERIC_RESET);
  });

  it("rejects weak/unequal passwords with the generic link error (no schema leak on reset)", async () => {
    await requestPasswordReset({ ice: "ICE-A-333333", email: "reset2@alpha.com" });
    const raw = capturedToken!;
    const res = await resetPassword({
      token: raw,
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe(GENERIC_RESET);
  });
});

// Redundant safety assertion: duplicated email allowed across tenants.
describe("reset tenant-scoping data model", () => {
  it("keeps @@unique([email, entrepriseId]) (non-global emails)", async () => {
    const email = "dup@scope.test";
    const a = await seedEntreprise({ ice: "ICE-D-1", users: [{ email, password: "password1" }] });
    const b = await seedEntreprise({ ice: "ICE-D-2", users: [{ email, password: "password2" }] });
    expect(a.users[0].id).not.toBe(b.users[0].id);
    expect(await prisma.utilisateur.count({ where: { email } })).toBe(2);
    await prisma.$disconnect();
  });
})