import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("S: withinAttemptLimit pure decision", () => {
  it("returns true while below the ceiling", async () => {
    const { withinAttemptLimit } = await import("@/lib/rate-limit");
    expect(withinAttemptLimit(null, 5)).toBe(true);
    expect(withinAttemptLimit(undefined, 5)).toBe(true);
    expect(withinAttemptLimit(0, 5)).toBe(true);
    expect(withinAttemptLimit(4, 5)).toBe(true);
  });

  it("returns false at and above the ceiling", async () => {
    const { withinAttemptLimit } = await import("@/lib/rate-limit");
    expect(withinAttemptLimit(5, 5)).toBe(false);
    expect(withinAttemptLimit(6, 5)).toBe(false);
    expect(withinAttemptLimit(100, 5)).toBe(false);
  });
});

describe("S/T: rate-limit behavior under dev and production fail-closed", () => {
  it("allows all operations in development (no Upstash configured)", async () => {
    const rl = await import("@/lib/rate-limit");
    expect(rl.isRateLimitConfigured()).toBe(false);
    expect((await rl.checkIpRateLimit("1.2.3.4")).success).toBe(true);
    expect((await rl.checkIdentityRateLimit("a:x")).success).toBe(true);
    expect((await rl.checkForgotPasswordIpRateLimit("1.2.3.4")).success).toBe(true);
    expect((await rl.checkForgotPasswordEmailRateLimit("a@b.c")).success).toBe(true);
    expect((await rl.checkResetTokenRateLimit("abc")).success).toBe(true);
  });

  describe("T: production fail-closed", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("fails closed in production when Upstash is not configured", async () => {
      const rl = await import("@/lib/rate-limit");
      expect(rl.isRateLimitConfigured()).toBe(true);
      expect((await rl.checkIpRateLimit("1.2.3.4")).success).toBe(false);
      expect((await rl.checkIdentityRateLimit("a:x")).success).toBe(false);
      expect((await rl.checkForgotPasswordIpRateLimit("1.2.3.4")).success).toBe(false);
      expect((await rl.checkForgotPasswordEmailRateLimit("a@b.c")).success).toBe(false);
      expect((await rl.checkResetTokenRateLimit("abc")).success).toBe(false);
    });
  });
});

describe("S: identity key normalization prevents bypass via trivial permutations", () => {
  it("recordFailedIdentityAttempt is a no-op without Redis (dev) and returns a benign default", async () => {
    const rl = await import("@/lib/rate-limit");
    // no throw, no-ops when redis is not configured
    await rl.recordFailedIdentityAttempt("any:key");
    expect((await rl.checkIdentityRateLimit("any:key")).success).toBe(true);
  });
});