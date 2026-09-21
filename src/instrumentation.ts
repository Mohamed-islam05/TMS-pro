// ============================================================
// Next.js Instrumentation — Runs at server startup
// ============================================================
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
