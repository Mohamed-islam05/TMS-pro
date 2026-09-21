// ============================================================
// Environment Validation — Fail-closed in production
// Validates required environment variables at server startup time
// ============================================================

const DEV_SECRET_PLACEHOLDER = "tms-pro-dev-secret-change-in-production-2024";

function isObviouslyWeakSecret(value: string): boolean {
  if (value.length < 32) return true;
  if (value === DEV_SECRET_PLACEHOLDER) return true;
  if (/^[a-z\-]+$/.test(value)) return true;
  if (/^[0-9]+$/.test(value)) return true;
  if (value.toLowerCase().includes("secret")) return true;
  if (value.toLowerCase().includes("password")) return true;
  if (value.toLowerCase().includes("change")) return true;
  if (value.toLowerCase().includes("replace")) return true;
  if (value.toLowerCase().includes("default")) return true;
  if (value.toLowerCase().includes("example")) return true;
  if (value === "changeme") return true;
  if (value === "your-secret-here") return true;
  return false;
}

function requireEnv(name: string, reason: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `${name} is missing in production. ${reason}`
    );
  }
  return value;
}

export function validateEnv() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // NEXTAUTH_SECRET — required always
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret || secret.trim() === "") {
    throw new Error(
      "NEXTAUTH_SECRET is missing in production. " +
      "Set a strong random secret (minimum 32 characters). " +
      "Generate one with: openssl rand -base64 32"
    );
  }

  if (secret.length < 32) {
    throw new Error(
      "NEXTAUTH_SECRET is too short in production. " +
      "Must be at least 32 characters."
    );
  }

  if (isObviouslyWeakSecret(secret)) {
    throw new Error(
      "NEXTAUTH_SECRET is obviously weak in production. " +
      "Set a strong random secret (minimum 32 characters). " +
      "Generate one with: openssl rand -base64 32"
    );
  }

  // DATABASE_URL — required always
  requireEnv("DATABASE_URL", "Set DATABASE_URL to your database connection string.");

  // UPSTASH_REDIS_REST_URL + TOKEN — required in production (rate limiting
  // fails closed: without Redis, all logins/resets are blocked at runtime).
  // Production must have Redis configured; this bootstrap check makes the
  // fail-closed posture explicit at startup too.
  requireEnv(
    "UPSTASH_REDIS_REST_URL",
    "Upstash Redis is required in production for rate limiting. " +
    "Set UPSTASH_REDIS_REST_URL from your Upstash dashboard."
  );
  requireEnv(
    "UPSTASH_REDIS_REST_TOKEN",
    "Upstash Redis is required in production for rate limiting. " +
    "Set UPSTASH_REDIS_REST_TOKEN from your Upstash dashboard."
  );

  // RESEND_API_KEY — required in production (emails fail silently without it)
  requireEnv(
    "RESEND_API_KEY",
    "Resend API key is required in production for password reset emails. " +
    "Set RESEND_API_KEY from your Resend dashboard."
  );

  // EMAIL_FROM — required when RESEND_API_KEY is set
  requireEnv(
    "EMAIL_FROM",
    "EMAIL_FROM is required in production for sending password reset emails."
  );

  // APP_URL — required for correct password reset links in emails
  requireEnv(
    "APP_URL",
    "APP_URL is the public base URL of the app (e.g. https://tms.example.com). " +
    "Password reset emails link to it; without it links point to localhost."
  );
}
