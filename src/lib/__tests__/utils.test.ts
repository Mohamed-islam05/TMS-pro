import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  numberFromInput,
  formatDate,
  formatShortDate,
  daysUntil,
  isExpiringSoon,
  documentStatus,
  truncate,
  cn,
} from "@/lib/utils";

describe("formatCurrency", () => {
  it("renders a dash for null/undefined", () => {
    expect(formatCurrency(null)).toBe("-");
    expect(formatCurrency(undefined as unknown as number)).toBe("-");
  });

  it("formats in fr-MA currency style", () => {
    expect(formatCurrency(1234.5)).toContain("234,50");
    expect(formatCurrency(1234.5)).toContain("MAD");
  });
});

describe("numberFromInput", () => {
  it("returns undefined for empty/NaN input", () => {
    expect(numberFromInput("")).toBeUndefined();
    expect(numberFromInput("abc")).toBeUndefined();
  });

  it("parses numeric strings", () => {
    expect(numberFromInput("12.5")).toBe(12.5);
    expect(numberFromInput("0")).toBe(0);
  });
});

describe("formatDate / formatShortDate", () => {
  it("handles null and dates", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatShortDate(null)).toBe("-");
    const d = new Date(2026, 8, 11);
    expect(formatShortDate(d)).toBe("11/09/2026");
    expect(formatDate(d)).toContain("2026");
  });

  it("accepts date strings", () => {
    expect(formatShortDate("2026-09-11")).toBe("11/09/2026");
  });
});

describe("daysUntil", () => {
  it("computes day difference relative to today", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(daysUntil(tomorrow)).toBe(1);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(daysUntil(yesterday)).toBe(-1);
  });
});

describe("documentStatus", () => {
  it("classifies documents", () => {
    expect(documentStatus(null)).toBe("ABSENT");

    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 90);
    expect(documentStatus(farFuture)).toBe("VALIDE");

    const near = new Date();
    near.setDate(near.getDate() + 10);
    expect(documentStatus(near, 15)).toBe("BIENTOT_EXPIRE");

    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(documentStatus(past)).toBe("EXPIRE");
  });
});

describe("isExpiringSoon", () => {
  it("returns true only within the window", () => {
    const near = new Date();
    near.setDate(near.getDate() + 5);
    expect(isExpiringSoon(near, 15)).toBe(true);

    const far = new Date();
    far.setDate(far.getDate() + 40);
    expect(isExpiringSoon(far, 15)).toBe(false);
  });
});

describe("truncate & cn", () => {
  it("truncates long strings", () => {
    expect(truncate("aaaaaaaaaa", 5)).toBe("aaaaa...");
    expect(truncate("short", 10)).toBe("short");
  });

  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("a", undefined, "b", false && "c")).toBe("a b");
  });
});