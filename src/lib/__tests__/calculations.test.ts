import { describe, it, expect } from "vitest";
import {
  roundMoney,
  calculerTVA,
  calculerMontantTTC,
  calculerBenefice,
  calculerMarge,
  calculerDepuisPrixVente,
} from "@/lib/calculations";

describe("roundMoney", () => {
  it("rounds to 2 decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(10.999)).toBe(11);
    expect(roundMoney(0)).toBe(0);
  });
});

describe("calculerTVA", () => {
  it("computes TVA at given rate", () => {
    expect(calculerTVA(100, 20)).toBe(20);
    expect(calculerTVA(100, 10)).toBe(10);
    expect(calculerTVA(100, 0)).toBe(0);
    expect(calculerTVA(33.33, 20)).toBe(6.67);
  });
});

describe("calculerMontantTTC", () => {
  it("computes TTC = HT + TVA", () => {
    expect(calculerMontantTTC(100, 20)).toBe(120);
    expect(calculerMontantTTC(100, 10)).toBe(110);
    expect(calculerMontantTTC(100, 0)).toBe(100);
    expect(calculerMontantTTC(33.33, 20)).toBe(40);
  });
});

describe("calculerBenefice", () => {
  it("returns null when prixAchat is missing", () => {
    expect(calculerBenefice(500, null, 50)).toBeNull();
    expect(calculerBenefice(500, undefined, 50)).toBeNull();
  });

  it("computes net benefit", () => {
    expect(calculerBenefice(500, 350, 50)).toBe(100);
    expect(calculerBenefice(500, 550, 50)).toBe(-100);
  });
});

describe("calculerMarge", () => {
  it("returns null when benefice is null", () => {
    expect(calculerMarge(null, 500)).toBeNull();
  });

  it("handles zero prixVente", () => {
    expect(calculerMarge(0, 0)).toBe(0);
  });

  it("computes margin percentage", () => {
    expect(calculerMarge(100, 500)).toBe(20);
  });
});

describe("calculerDepuisPrixVente", () => {
  it("returns consistent totals", () => {
    const res = calculerDepuisPrixVente(1000, 700, 100, 20);
    expect(res.montantHT).toBe(1000);
    expect(res.tva).toBe(200);
    expect(res.montantTTC).toBe(1200);
    expect(res.benefice).toBe(200);
    expect(res.marge).toBe(20);
    expect(res.totalCharges).toBe(100);
  });
});