import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

assert.equal(
  process.versions.node,
  readFileSync(".nvmrc", "utf8").trim(),
  "Use the exact Node version in .nvmrc.",
);
const root = process.cwd();
const destination = mkdtempSync(join(tmpdir(), "oms-merchant-rehearsal-"));
// Deliberately allowlist environment keys. Neither dotenv files nor ambient credentials cross here.
const environment = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  CI: "1",
  OMS_POLICY_FIXTURE_REHEARSAL: "1",
  VITE_PUBLIC_APP_MODE: "oss",
  VITE_ENABLE_LOCAL_FALLBACKS: "true",
  CHECKOUT_ACCESS_MODE: "closed",
  CHECKOUT_ENABLED: "true",
  EMAIL_PROVIDER: "fixture",
};
for (const key of [
  "ALLOW_LIVE_PAYMENTS",
  "ALLOW_LIVE_FULFILLMENT",
  "PRINTFUL_AUTO_CONFIRM_ORDERS",
  "ENABLE_LIVE_OPENAI",
  "ENABLE_LIVE_STRIPE",
  "ENABLE_LIVE_PRINTFUL",
  "FULFILLMENT_ENABLED",
  "TRANSACTIONAL_EMAILS_ENABLED",
  "VITE_ENABLE_PUBLIC_CHECKOUT",
])
  environment[key] = "false";
const npm = process.env.npm_execpath;
assert.ok(npm, "Run through npm run config:rehearse.");
function run(args, expectedFailure = false) {
  const result = spawnSync(process.execPath, args, {
    cwd: destination,
    env: environment,
    stdio: expectedFailure ? "pipe" : "inherit",
    encoding: "utf8",
  });
  if (expectedFailure) {
    assert.notEqual(
      result.status,
      0,
      "The unapproved profile must fail generation.",
    );
    assert.match(result.stderr, /does not match the selected operator/);
  } else
    assert.equal(result.status, 0, `Rehearsal step failed: ${args.join(" ")}`);
}
try {
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  for (const file of files) {
    assert.ok(
      !/(^|\/)\.env(?:\.|$)/.test(file) || file.endsWith(".env.example"),
      "Only empty public environment examples can be copied.",
    );
    const target = join(destination, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
  run([npm, "ci", "--no-audit", "--no-fund"]);
  const profile = JSON.parse(
    readFileSync(
      join(
        destination,
        "config/examples/community-gear-lab.merchant.config.json",
      ),
      "utf8",
    ),
  );
  const original = JSON.parse(
    readFileSync(join(destination, "config/merchant.config.json"), "utf8"),
  );
  // Prove that selecting another brand without its explicit content cannot reuse OMS approval.
  writeFileSync(
    join(destination, "config/merchant.config.json"),
    JSON.stringify({ ...profile, policies: original.policies }),
  );
  run(["scripts/generate-merchant-config.mjs"], true);
  writeFileSync(
    join(destination, "config/merchant.config.json"),
    JSON.stringify(profile, null, 2) + "\n",
  );
  for (const script of [
    "config:generate",
    "config:validate",
    "config:check",
    "doctor",
    "lint",
    "type-check",
    "build",
    "smoke:fixture",
  ])
    run([npm, "run", script]);
  run(["scripts/verify-merchant-profile.mjs"]);
  run([npm, "run", "test:policy-browser"]);
  console.log(
    "PASS: isolated Community Gear Lab installation, fixture lifecycle, runtime identity, static metadata, policy ownership, attribution, and mobile/desktop checkout. No live providers or deployment were used.",
  );
} finally {
  // The only deletion target is the fresh directory created by this invocation.
  rmSync(destination, { recursive: true, force: true });
}
