import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ADMIN_ONLY_PERMISSIONS,
  ADMIN_OPERATIONAL_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  hasPermission,
  requirePermission,
  isValidPermission,
  getPermissionGroups,
} from "@/lib/permissions";

describe("permission catalog", () => {
  it("lists a known permission", () => {
    expect(PERMISSIONS["dossiers.close"]).toBe("Clôturer un dossier (générer la facture)");
  });

  it("validates permission names", () => {
    expect(isValidPermission("dossiers.view")).toBe(true);
    expect(isValidPermission("nope.nope")).toBe(false);
  });

  it("admin-only set is a subset of all permissions", () => {
    for (const p of ADMIN_ONLY_PERMISSIONS) {
      expect(ALL_PERMISSIONS).toContain(p);
    }
  });

  it("staff default excludes admin-only and admin-operational permissions", () => {
    for (const p of ADMIN_ONLY_PERMISSIONS) {
      expect(DEFAULT_STAFF_PERMISSIONS).not.toContain(p);
    }
    for (const p of ADMIN_OPERATIONAL_PERMISSIONS) {
      expect(DEFAULT_STAFF_PERMISSIONS).not.toContain(p);
    }
  });

  it("staff default keeps operational day-to-day rights", () => {
    expect(DEFAULT_STAFF_PERMISSIONS).toContain("dossiers.create");
    expect(DEFAULT_STAFF_PERMISSIONS).toContain("dossiers.send");
    expect(DEFAULT_STAFF_PERMISSIONS).toContain("charges.view");
  });
});

describe("hasPermission", () => {
  const staff = {
    role: "STAFF",
    permissions: ["dossiers.view", "dossiers.create"],
  };

  const admin = {
    role: "ENTREPRISE_ADMIN",
    permissions: [],
  };

  it("grants nothing to a null subject", () => {
    expect(hasPermission("dossiers.view", null)).toBe(false);
  });

  it("granted via explicit permission", () => {
    expect(hasPermission("dossiers.view", staff)).toBe(true);
    expect(hasPermission("dossiers.close", staff)).toBe(false);
  });

  it("grants implicit full access to ENTREPRISE_ADMIN", () => {
    expect(hasPermission("dossiers.close", admin)).toBe(true);
    expect(hasPermission("users.delete", admin)).toBe(true);
  });
});

describe("requirePermission", () => {
  it("throws for unauthorized users", () => {
    expect(() => requirePermission("dossiers.close", { role: "STAFF", permissions: [] })).toThrow();
  });

  it("does not throw for admin", () => {
    expect(() =>
      requirePermission("users.permissions", { role: "ENTREPRISE_ADMIN", permissions: [] })
    ).not.toThrow();
  });
});

describe("getPermissionGroups", () => {
  it("covers every permission in at least one group", () => {
    const grouped = getPermissionGroups().flatMap((g) => g.permissions);
    for (const p of ALL_PERMISSIONS) {
      expect(grouped).toContain(p);
    }
  });
});