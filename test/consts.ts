import { readFileSync } from "fs";
import path from "path";

// Isolated PostgreSQL database used by the automated test suite.
// MUST never point at the application/production database.

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/tms_test";

// Minimal .env reader (KEY="value" or KEY=value) — used because Vitest does
// not reliably load non-prefixed vars from .env into process.env before
// globalSetup/config evaluation.
function readDotEnvValue(key: string): string | null {
  try {
    const content = readFileSync(
      path.resolve(__dirname, "..", ".env"),
      "utf8"
    );
    const quoted = new RegExp(
      `^[ \\t]*${key}[ \\t]*=[ \\t]*"([^"]*)"`,
      "m"
    );
    let m = content.match(quoted);
    if (m) return m[1];
    const plain = new RegExp(
      `^[ \\t]*${key}[ \\t]*=[ \\t]*([^#\\r\\n"]+)`,
      "m"
    );
    m = content.match(plain);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

export function appDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? readDotEnvValue("DATABASE_URL");
}

// Remote test targets require explicit local consent. Read from env first,
// then from .env (Vitest does not load non-prefixed .env vars into
// process.env for config/globalSetup evaluation).
export function remoteTestConsentGiven(): boolean {
  const raw =
    process.env.TEST_DATABASE_ALLOW_REMOTE ??
    readDotEnvValue("TEST_DATABASE_ALLOW_REMOTE");
  return raw?.trim().toLowerCase() === "yes";
}

export interface ResolvedTestDb {
  url: string;
  explicit: boolean;
  remote: boolean;
}

function resolveTestDb(): ResolvedTestDb {
  const raw =
    process.env.TEST_DATABASE_URL ?? readDotEnvValue("TEST_DATABASE_URL");
  const url = (raw && raw.trim().length > 0
    ? raw.trim()
    : DEFAULT_TEST_DATABASE_URL
  ).replace(/\/+$/, "");
  const explicit = Boolean(raw && raw.trim().length > 0);
  const hostname = toUrl(url).hostname;
  const remote = !["localhost", "127.0.0.1", "::1"].includes(hostname);
  return { url, explicit, remote };
}

function toUrl(raw: string): URL {
  return new URL(raw.replace(/^postgres:\/\//, "postgresql://"));
}

export function maskUrl(url: string): string {
  try {
    const u = toUrl(url);
    return `postgresql://<creds>@${u.host}${u.pathname}`;
  } catch {
    return "<unparseable url>";
  }
}

export function sameDatabase(a: string, b: string): boolean {
  try {
    const ua = toUrl(a);
    const ub = toUrl(b);
    return ua.host === ub.host && ua.pathname === ub.pathname;
  } catch {
    return false;
  }
}

// Neon specifics: a branch is identified by its host; the pooled endpoint is
// the same host with a "-pooler" suffix. Two URLs are the same branch when
// their hosts match after normalizing that suffix, regardless of database.
export function sameBranch(a: string, b: string): boolean {
  try {
    const ua = toUrl(a);
    const ub = toUrl(b);
    const norm = (h: string) => h.toLowerCase().replace(new RegExp("-pooler$"), "");
    return norm(ua.hostname) === norm(ub.hostname);
  } catch {
    return false;
  }
}

export const TEST_DB = resolveTestDb();
export const TEST_DATABASE_URL = TEST_DB.url;

export function assertTestDatabaseSafety(): void {
  if (TEST_DATABASE_URL.startsWith("file:")) {
    throw new Error(
      `[tests] TEST_DATABASE_URL must be a PostgreSQL URL (got "file:"). ` +
        `Set TEST_DATABASE_URL to an isolated PostgreSQL database.`
    );
  }
  if (!/^(postgres|postgresql):\/\//.test(TEST_DATABASE_URL)) {
    throw new Error(
      `[tests] TEST_DATABASE_URL must be a postgresql:// URL. Got: ${maskUrl(
        TEST_DATABASE_URL
      )}`
    );
  }

  if (TEST_DB.remote && !remoteTestConsentGiven()) {
    throw new Error(
      `[tests] TEST_DATABASE_URL points to a remote host ` +
        `"${toUrl(TEST_DATABASE_URL).hostname}". Adding a remote test target ` +
        `requires explicit local consent: set TEST_DATABASE_ALLOW_REMOTE=yes ` +
        `(intended for an isolated target such as a Neon test branch — never ` +
        `the production database).`
    );
  }

  // Never against the application database or its host, whatever the source.
  const appCandidates = [
    process.env.DATABASE_URL,
    readDotEnvValue("DATABASE_URL"),
    process.env.DIRECT_URL,
    readDotEnvValue("DIRECT_URL"),
  ].filter(Boolean) as string[];
  const clash = appCandidates.find((u) => sameBranch(TEST_DATABASE_URL, u));
  if (clash) {
    throw new Error(
      `[tests] TEST_DATABASE_URL (${maskUrl(TEST_DATABASE_URL)}) points at the ` +
        `same database branch/host as the application database ` +
        `(${maskUrl(clash)}). Refusing to run tests against the application ` +
        `database host. TEST_DATABASE_URL must be a separate isolated TEST ` +
        `branch (distinct host), never the production branch.`
    );
  }

  const target = toUrl(TEST_DATABASE_URL);
  const database = target.pathname.replace(/^\//, "");
  const mode = TEST_DB.remote
    ? remoteTestConsentGiven()
      ? "remote, explicit consent"
      : "remote, NO CONSENT"
    : "local, default";
  console.log(
    `[test-global-setup] Isolated PostgreSQL test target: ` +
      `protocol "${target.protocol.replace(":", "")}" host "${target.hostname}" ` +
      `database "${database}" (${mode})`
  );
  const appRef =
    readDotEnvValue("DATABASE_URL") ??
    process.env.DATABASE_URL ??
    appDatabaseUrl();
  console.log(
    `[test-global-setup] Application DATABASE_URL: ` +
      `${
        appRef
          ? `host "${toUrl(appRef).hostname}" database "${toUrl(
              appRef
            ).pathname.replace(/^\//, "")}" — same branch as TEST target: ${sameBranch(
              TEST_DATABASE_URL,
              appRef
            )}`
          : "not loaded"
      }`
  );
}