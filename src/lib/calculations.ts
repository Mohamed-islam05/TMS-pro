// ============================================================
// Calculations - Auto-calc utilities for TMS Pro
// ============================================================

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculerTVA(montantHT: number, taux: number): number {
  return roundMoney(montantHT * (taux / 100))
}

export function calculerMontantTTC(montantHT: number, taux: number): number {
  const tva = calculerTVA(montantHT, taux)
  return roundMoney(montantHT + tva)
}

export function calculerBenefice(prixVente: number, prixAchat: number | null | undefined, totalCharges: number): number | null {
  if (prixAchat == null) return null
  return roundMoney(prixVente - prixAchat - totalCharges)
}

export function calculerMarge(benefice: number | null, prixVente: number): number | null {
  if (benefice == null) return null
  if (prixVente === 0) return 0
  return (benefice / prixVente) * 100
}

export function calculerDepuisPrixVente(
  prixVente: number,
  prixAchat: number | null | undefined,
  totalCharges: number,
  tauxTVA: number
) {
  const benefice = calculerBenefice(prixVente, prixAchat, totalCharges)
  const marge = calculerMarge(benefice, prixVente)

  const montantHT = roundMoney(prixVente)
  const tva = calculerTVA(montantHT, tauxTVA)
  const montantTTC = calculerMontantTTC(montantHT, tauxTVA)

  return {
    benefice,
    marge,
    montantHT,
    tva,
    montantTTC,
    totalCharges,
  }
}
