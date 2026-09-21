// ============================================================
// Facture reference numbering - pure helpers (unit-testable)
// ============================================================

export function buildFacturePrefix(date: Date = new Date()): string {
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `FAC-${yy}${mm}-`;
}

export function nextFactureReference(
  prefix: string,
  lastReference: string | null | undefined
): string {
  const first = `${prefix}${String(1).padStart(3, "0")}`;
  if (!lastReference) return first;

  const suffix = lastReference.startsWith(prefix)
    ? lastReference.slice(prefix.length)
    : "";
  const seq = Number.parseInt(suffix, 10);

  if (!Number.isFinite(seq) || seq < 1) return first;

  const width = Math.max(3, suffix.length);
  return `${prefix}${String(seq + 1).padStart(width, "0")}`;
}