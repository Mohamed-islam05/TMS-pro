import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { getEntrepriseSettings, updateEntrepriseSettings } from "@/lib/actions/settings";
import { clearAllData, seedEntreprise } from "./helpers/auth-db";

const sessionMock = vi.hoisted(() => ({ getServerSession: vi.fn() }));

vi.mock("next-auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next-auth")>();
  return { ...mod, getServerSession: sessionMock.getServerSession };
});

const validLogo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("S: entreprise settings - tenant-scoped company settings + branding", () => {
  let adminId: string;
  let staffId: string;
  let tenantAId: string;
  let tenantBId: string;
  let adminBId: string;

  beforeAll(async () => {
    await clearAllData();
    const a = await seedEntreprise({
      ice: "ICE-A-SETT",
      nom: "Entreprise A",
      users: [
        { email: "admin@s.com", password: "passwordA1", role: "ENTREPRISE_ADMIN" },
        { email: "staff@s.com", password: "passwordS1", role: "STAFF" },
      ],
    });
    const b = await seedEntreprise({
      ice: "ICE-B-SETT",
      nom: "Entreprise B",
      users: [{ email: "adminb@s.com", password: "passwordB1", role: "ENTREPRISE_ADMIN" }],
    });
    tenantAId = a.entreprise.id;
    tenantBId = b.entreprise.id;
    adminId = a.users[0].id;
    staffId = a.users[1].id;
    adminBId = b.users[0].id;
  });

  beforeEach(() => {
    sessionMock.getServerSession.mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("S1. unauthenticated access to settings is rejected", async () => {
    sessionMock.getServerSession.mockResolvedValue(null);
    const res = await getEntrepriseSettings();
    expect(res.success).toBe(false);
  });

  it("S2. STAFF cannot read settings (admin-only surface)", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: staffId } });
    const res = await getEntrepriseSettings();
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("Accès réservé à l'administrateur");
  });

  it("S3. admin reads their own tenant settings (no config row yet)", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminId } });
    const res = await getEntrepriseSettings();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.id).toBe(tenantAId);
      expect(res.data.nom).toBe("Entreprise A");
      expect(res.data.config).toBeNull();
    }
  });

  it("S4. update persists identity + branding and creates the 1:1 config", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminId } });
    const res = await updateEntrepriseSettings({
      nom: "Entreprise A Édition",
      adresse: "12 rue du Trasport",
      telephone: "0600000000",
      email: "contact@a.com",
      ice: "ICE-A-SETT",
      logoUrl: validLogo,
      footerText: "Merci de votre confiance",
      templateId: "modern",
    });
    expect(res.success).toBe(true);

    const configs = await prisma.entrepriseConfig.findMany({ where: { entrepriseId: tenantAId } });
    expect(configs).toHaveLength(1);
    expect(configs[0].templateId).toBe("modern");
    expect(configs[0].logoUrl).toBe(validLogo);
    expect(configs[0].footerText).toBe("Merci de votre confiance");

    const entreprise = await prisma.entreprise.findUnique({ where: { id: tenantAId } });
    expect(entreprise?.nom).toBe("Entreprise A Édition");
    expect(entreprise?.telephone).toBe("0600000000");
    expect(entreprise?.email).toBe("contact@a.com");

    const audit = await prisma.auditLog.findFirst({
      where: { module: "settings", entrepriseId: tenantAId, action: "update" },
    });
    expect(audit).toBeTruthy();
    expect(audit?.targetType).toBe("EntrepriseConfig");
  });

  it("S5. update is idempotent - no duplicate config row on re-save", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminId } });
    const res = await updateEntrepriseSettings({
      nom: "Entreprise A Édition",
      adresse: "12 rue du Trasport",
      telephone: "0600000000",
      email: "contact@a.com",
      ice: "ICE-A-SETT",
      logoUrl: validLogo,
      footerText: "Nouveau pied de page",
      templateId: "compact",
    });
    expect(res.success).toBe(true);

    const configs = await prisma.entrepriseConfig.findMany({ where: { entrepriseId: tenantAId } });
    expect(configs).toHaveLength(1);
    expect(configs[0].footerText).toBe("Nouveau pied de page");
    expect(configs[0].templateId).toBe("compact");
  });

  it("S6. clearing the logo and footer stores null (empty string normalized)", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminId } });
    await updateEntrepriseSettings({
      nom: "Entreprise A Édition",
      adresse: "",
      telephone: "",
      email: "",
      ice: "ICE-A-SETT",
      logoUrl: "",
      footerText: "",
      templateId: "classic",
    });

    const config = await prisma.entrepriseConfig.findUnique({
      where: { entrepriseId: tenantAId },
    });
    expect(config?.logoUrl).toBeNull();
    expect(config?.footerText).toBeNull();
    expect(config?.templateId).toBe("classic");

    const entreprise = await prisma.entreprise.findUnique({ where: { id: tenantAId } });
    expect(entreprise?.adresse).toBeNull();
    expect(entreprise?.email).toBeNull();
  });

  it("S7. validation rejects forged/corrupt data (bad logo format)", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminId } });
    const res = await updateEntrepriseSettings({
      nom: "Entreprise A Édition",
      adresse: "",
      telephone: "",
      email: "",
      ice: "ICE-A-SETT",
      logoUrl: "data:image/gif;base64,R0lGODlhAQABAAAA",
      footerText: "",
      templateId: "classic",
    });
    expect(res.success).toBe(false);
  });

  it("S8. validation rejects an unknown template id", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminId } });
    const res = await updateEntrepriseSettings({
      nom: "Entreprise A Édition",
      adresse: "",
      telephone: "",
      email: "",
      ice: "ICE-A-SETT",
      logoUrl: "",
      footerText: "",
      templateId: "fancy" as "classic",
    });
    expect(res.success).toBe(false);
  });

  it("S9. STAFF cannot update settings (implicit admin-only write path)", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: staffId } });
    const res = await updateEntrepriseSettings({
      nom: "Piraté",
      adresse: "",
      telephone: "",
      email: "",
      ice: "ICE-A-SETT",
      logoUrl: "",
      footerText: "",
      templateId: "classic",
    });
    expect(res.success).toBe(false);

    const entreprise = await prisma.entreprise.findUnique({ where: { id: tenantAId } });
    expect(entreprise?.nom).toBe("Entreprise A Édition");
  });

  it("S10. tenant isolation: admin of A never reads or mutates B's settings", async () => {
    sessionMock.getServerSession.mockResolvedValue({ user: { id: adminBId } });
    const readsB = await getEntrepriseSettings();
    expect(readsB.success).toBe(true);
    if (readsB.success) {
      expect(readsB.data.id).toBe(tenantBId);
      // Company identity is tenant-scoped: B never sees A's branding.
      expect(readsB.data.nom).not.toBe("Entreprise A Édition");
    }

    // A's branding is untouched by B acting on its own tenant.
    const configB = await prisma.entrepriseConfig.findUnique({
      where: { entrepriseId: tenantBId },
    });
    expect(configB).toBeNull();
  });
});