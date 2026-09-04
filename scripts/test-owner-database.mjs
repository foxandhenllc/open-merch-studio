import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

assert.ok(
  process.env.OMS_OWNER_TEST_DATABASE_URL,
  "Set OMS_OWNER_TEST_DATABASE_URL to an isolated local PostgreSQL database. This gate cannot skip.",
);
const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    "backend/src/tests/owner-database.integration.test.ts",
  ],
  { stdio: "inherit", env: process.env },
);
process.exitCode = result.status ?? 1;
