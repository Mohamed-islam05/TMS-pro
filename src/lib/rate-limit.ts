import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const isConfigured = Boolean(url && token);
const isProduction = process.env.NODE_ENV === "production";
const isBlocking = isProduction && !isConfigured;

const redis = isConfigured
  ? new Redis({ url: url!, token: token! })
  : null;

const ipLimiter = isConfigured
  ? new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(20, "600s"),
      analytics: true,
    })
  : null;

const FAILED_IDENTITY_PREFIX = "auth:failed:";
const FAILED_IDENTITY_MAX = 5;
const FAILED_IDENTITY_WINDOW_SECONDS = 600;

// Pure decision helper: true while the current attempt count stays under the
// configured maximum. Single source of truth for all sliding/count limits.
export function withinAttemptLimit(
  currentCount: number | null | undefined,
  max: number
): boolean {
  return (currentCount ?? 0) < max;
}

export function isRateLimitConfigured(): boolean {
  return isConfigured || isBlocking;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "127.0.0.1";
}

export async function checkIpRateLimit(
  ip: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (isBlocking) {
    return { success: false, remaining: 0, reset: Date.now() + 60000 };
  }
  if (!ipLimiter) {
    return { success: true, remaining: 999, reset: 0 };
  }
  try {
    const result = await ipLimiter.limit(ip);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch {
    return { success: false, remaining: 0, reset: Date.now() + 60000 };
  }
}

export async function checkIdentityRateLimit(
  identity: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (isBlocking) {
    return { success: false, remaining: 0, reset: Date.now() + 60000 };
  }
  if (!redis) {
    return { success: true, remaining: 999, reset: 0 };
  }
  try {
    const key = `${FAILED_IDENTITY_PREFIX}${identity}`;
    const count = await redis.get<number>(key);
    const blocked = !withinAttemptLimit(count, FAILED_IDENTITY_MAX);
    return {
      success: !blocked,
      remaining: Math.max(0, FAILED_IDENTITY_MAX - (count ?? 0)),
      reset: Date.now() + FAILED_IDENTITY_WINDOW_SECONDS * 1000,
    };
  } catch {
    return { success: false, remaining: 0, reset: Date.now() + 60000 };
  }
}

export async function recordFailedIdentityAttempt(
  identity: string
): Promise<void> {
  if (!redis) {
    return;
  }
  try {
    const key = `${FAILED_IDENTITY_PREFIX}${identity}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, FAILED_IDENTITY_WINDOW_SECONDS);
    }
  } catch {
    // Redis unavailable — fail silently, next check will fail-closed
  }
}

const FORGOT_PASSWORD_IP_PREFIX = "fp:ip:";
const FORGOT_PASSWORD_IP_MAX = 5;
const FORGOT_PASSWORD_EMAIL_PREFIX = "fp:email:";
const FORGOT_PASSWORD_EMAIL_MAX = 3;
const FORGOT_PASSWORD_WINDOW_SECONDS = 3600;

export async function checkForgotPasswordIpRateLimit(
  ip: string
): Promise<{ success: boolean; remaining: number }> {
  if (isBlocking) {
    return { success: false, remaining: 0 };
  }
  if (!redis) {
    return { success: true, remaining: 999 };
  }
  try {
    const key = `${FORGOT_PASSWORD_IP_PREFIX}${ip}`;
    const newCount = await redis.incr(key);
    if (newCount === 1) {
      await redis.expire(key, FORGOT_PASSWORD_WINDOW_SECONDS);
    }
    return {
      success: withinAttemptLimit(newCount, FORGOT_PASSWORD_IP_MAX),
      remaining: Math.max(0, FORGOT_PASSWORD_IP_MAX - newCount),
    };
  } catch {
    return { success: false, remaining: 0 };
  }
}

export async function checkForgotPasswordEmailRateLimit(
  email: string
): Promise<{ success: boolean; remaining: number }> {
  if (isBlocking) {
    return { success: false, remaining: 0 };
  }
  if (!redis) {
    return { success: true, remaining: 999 };
  }
  try {
    const key = `${FORGOT_PASSWORD_EMAIL_PREFIX}${email.toLowerCase()}`;
    const newCount = await redis.incr(key);
    if (newCount === 1) {
      await redis.expire(key, FORGOT_PASSWORD_WINDOW_SECONDS);
    }
    return {
      success: withinAttemptLimit(newCount, FORGOT_PASSWORD_EMAIL_MAX),
      remaining: Math.max(0, FORGOT_PASSWORD_EMAIL_MAX - newCount),
    };
  } catch {
    return { success: false, remaining: 0 };
  }
}

const RESET_TOKEN_PREFIX = "reset:token:";
const RESET_TOKEN_MAX = 5;
const RESET_TOKEN_WINDOW_SECONDS = 3600;

export async function checkResetTokenRateLimit(
  tokenHash: string
): Promise<{ success: boolean; remaining: number }> {
  if (isBlocking) {
    return { success: false, remaining: 0 };
  }
  if (!redis) {
    return { success: true, remaining: 999 };
  }
  try {
    const key = `${RESET_TOKEN_PREFIX}${tokenHash}`;
    const newCount = await redis.incr(key);
    if (newCount === 1) {
      await redis.expire(key, RESET_TOKEN_WINDOW_SECONDS);
    }
    return {
      success: withinAttemptLimit(newCount, RESET_TOKEN_MAX),
      remaining: Math.max(0, RESET_TOKEN_MAX - newCount),
    };
  } catch {
    return { success: false, remaining: 0 };
  }
}
