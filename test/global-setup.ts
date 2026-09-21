import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import path from "path";
import { TEST_DB_PATH, TEST_DB_URL } from "./consts";

// Recreates a pristine SQLite test database before the suite runs.
export default function setup(): void {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (existsSync(file)) rmSync(file, { force: true });
  }

  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });
}