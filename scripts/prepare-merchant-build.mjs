import { spawnSync } from "node:child_process";

// A deployment's reviewed profile generates every consumer together before compilation.
// Repository builds retain the existing stale-generated-file check.
const result = spawnSync(
  process.execPath,
  [
    "scripts/generate-merchant-config.mjs",
    ...(process.env.OMS_MERCHANT_PROFILE ? [] : ["--check"]),
  ],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
