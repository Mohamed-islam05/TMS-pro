import { describe, it, expect } from "vitest";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createUserSchema,
  updateUserRoleSchema,
} from "@/lib/validations/password";
import { createChargeSchema, updateChargeSchema } from "@/lib/validations/charge";

describe("password schemas", () => {
  it("rejects confirm mismatch", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "oldpass1",
      newPassword: "newpass1",
      confirmPassword: "different",
    });
    expect(r.success).toBe(false);
  });

  it("rejects short new password", () => {
    const r = resetPasswordSchema.safeParse({
      token: "abc",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid reset", () => {
    const r = resetPasswordSchema.safeParse({
      token: "abc",
      newPassword: "longenough1",
      confirmPassword: "longenough1",
    });
    expect(r.success).toBe(true);
  });

  it("validates forgot password email format", () => {
    expect(forgotPasswordSchema.safeParse({ ice: "12345", email: "nope" }).success).toBe(false);
    expect(
      forgotPasswordSchema.safeParse({ ice: "12345", email: "u@example.com" }).success
    ).toBe(true);
  });

  it("only allows known roles", () => {
    expect(
      createUserSchema.safeParse({ nom: "X", email: "a@b.c", password: "longenough1", role: "ROOT" })
        .success
    ).toBe(false);
    expect(
      updateUserRoleSchema.safeParse({ userId: "00000000-0000-4000-8000-000000000000", role: "STAFF" })
        .success
    ).toBe(true);
  });
});

describe("charge schemas", () => {
  const validDossier = {
    categorie: "DOSSIER",
    dossierId: "00000000-0000-4000-8000-000000000000",
    type: "CARBURANT",
    montant: 100,
  };

  it("accepts a valid DOSSIER charge", () => {
    expect(createChargeSchema.safeParse(validDossier).success).toBe(true);
  });

  it("rejects a negative amount", () => {
    expect(createChargeSchema.safeParse({ ...validDossier, montant: -5 }).success).toBe(false);
  });

  it("requires dossierId for DOSSIER charges", () => {
    expect(
      createChargeSchema.safeParse({
        categorie: "DOSSIER",
        type: "AUTRE",
        montant: 10,
      }).success
    ).toBe(false);
  });

  it("rejects a malformed submissionKey", () => {
    expect(
      createChargeSchema.safeParse({ ...validDossier, submissionKey: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("accepts a valid submissionKey", () => {
    expect(
      createChargeSchema.safeParse({
        ...validDossier,
        submissionKey: "00000000-0000-4000-8000-000000000000",
      }).success
    ).toBe(true);
  });

  it("coerces string amounts for GENERALE charges", () => {
    const r = createChargeSchema.safeParse({
      categorie: "GENERALE",
      type: "Loyer",
      montant: "1500",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.montant).toBe(1500);
  });

  it("update schema requires a uuid id", () => {
    expect(updateChargeSchema.safeParse({ id: "nope", type: "X" }).success).toBe(false);
  });
});