import { execSync } from "child_process";
import path from "path";
import {
  TEST_DATABASE_URL,
  assertTestDatabaseSafety,
} from "./consts";

// Recreates a pristine PostgreSQL schema before the suite runs, by replaying
// the PostgreSQL migration baseline against the ISOLATED test database.
// Safety invariants enforced in assertTestDatabaseSafety():
//   - must be postgresql:// (never file:)
//   - must not be the same host+database as DATABASE_URL
//   - remote targets require explicit TEST_DATABASE_ALLOW_REMOTE=yes
export default function setup(): void {
  assertTestDatabaseSafety();

  execSync("npx prisma migrate reset --force --skip-seed", {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
    stdio: "inherit",
  });
}