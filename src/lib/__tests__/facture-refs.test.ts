import { describe, it, expect } from "vitest";
import { buildFacturePrefix, nextFactureReference } from "@/lib/facture-refs";

describe("buildFacturePrefix", () => {
  it("builds a YYMM prefix", () => {
    expect(buildFacturePrefix(new Date(2026, 8, 11))).toBe("FAC-2609-");
    expect(buildFacturePrefix(new Date(2027, 0, 5))).toBe("FAC-2701-");
    expect(buildFacturePrefix(new Date(2030, 11, 31))).toBe("FAC-3012-");
  });
});

describe("nextFactureReference", () => {
  const prefix = "FAC-2609-";

  it("starts at 001 when nothing exists", () => {
    expect(nextFactureReference(prefix, null)).toBe("FAC-2609-001");
    expect(nextFactureReference(prefix, undefined)).toBe("FAC-2609-001");
  });

  it("increments a simple sequence", () => {
    expect(nextFactureReference(prefix, "FAC-2609-005")).toBe("FAC-2609-006");
  });

  it("handles the 999 → 1000 boundary without truncation", () => {
    expect(nextFactureReference(prefix, "FAC-2609-999")).toBe("FAC-2609-1000");
  });

  it("grows width beyond 3 digits", () => {
    expect(nextFactureReference(prefix, "FAC-2609-1000")).toBe("FAC-2609-1001");
    expect(nextFactureReference(prefix, "FAC-2609-9999")).toBe("FAC-2609-10000");
  });

  it("ignores a reference from another prefix", () => {
    expect(nextFactureReference("FAC-2609-", "FAC-2608-042")).toBe("FAC-2609-001");
  });

  it("falls back on a non-numeric suffix", () => {
    expect(nextFactureReference(prefix, "FAC-2609-ABC")).toBe("FAC-2609-001");
    expect(nextFactureReference(prefix, "garbage")).toBe("FAC-2609-001");
  });

  it("keeps 3-digit padding for small sequences", () => {
    expect(nextFactureReference(prefix, "FAC-2609-099")).toBe("FAC-2609-100");
  });
});