import { defineConfig } from "vitest/config";
import path from "path";
import { TEST_DATABASE_URL } from "./test/consts";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Tests run against the ISOLATED PostgreSQL test database (see test/consts.ts).
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
    setupFiles: ["./test/setup.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Single shared test DB across files: run files sequentially.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});