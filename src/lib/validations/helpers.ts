// ============================================================
// Shared Zod Preprocess Helpers
// ============================================================

export function emptyToUndefined(value: unknown): unknown {
  if (value === "" || value === null || (typeof value === "number" && Number.isNaN(value))) {
    return undefined;
  }
  return value;
}

