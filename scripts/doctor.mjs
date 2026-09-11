import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { diagnoseConfiguration } from "./doctor-core.mjs";
import { loadInstallationProfile } from "./installation-profile.mjs";

const source = { ...process.env };
for (const file of [".env", "backend/.env", "frontend/.env"]) {
  const path = resolve(file);
  if (existsSync(path))
    Object.assign(source, dotenv.parse(readFileSync(path)), process.env);
}

const result = diagnoseConfiguration(source);
let merchantErrors;
try {
  loadInstallationProfile(source);
  merchantErrors = [];
} catch {
  merchantErrors = ["Merchant or policy document is unreadable."];
}
console.log(`Open Merch Studio doctor: ${result.mode}`);
for (const item of result.checks) {
  console.log(
    `${item.status === "pass" ? "PASS" : "FAIL"}  ${item.label}${item.status === "fail" ? ` - ${item.detail}` : ""}`,
  );
}
console.log(
  merchantErrors.length === 0
    ? "PASS  Merchant configuration"
    : `FAIL  Merchant configuration - run npm run config:validate for ${merchantErrors.length} issue(s).`,
);
console.log(
  result.ok && merchantErrors.length === 0
    ? "Ready for the mode shown above."
    : "Fix failed checks before enabling providers or commerce.",
);
process.exitCode = result.ok && merchantErrors.length === 0 ? 0 : 1;
