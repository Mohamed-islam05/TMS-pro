// ============================================================
// Session Invalidation - pure comparison helper
// ============================================================
// Compares an entity "changedAt" timestamp (seconds precision) against a
// JWT `iat`. A session is invalidated when the entity changed strictly
// AFTER the token was issued. Pure function so the invalidation rule is
// unit-testable without NextAuth/DB.

export function isSessionInvalidated(
  changedAt: Date | null | undefined,
  tokenIatSeconds: number | null | undefined
): boolean {
  if (!changedAt || tokenIatSeconds == null) return false;
  return Math.floor(changedAt.getTime() / 1000) > tokenIatSeconds;
}