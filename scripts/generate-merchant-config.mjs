import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  readMerchantConfig,
  renderMerchantConfigModule,
  validateMerchantConfig,
} from "./merchant-config.mjs";

const outputs = [
  resolve("backend/src/generated/merchant-config.ts"),
  resolve("frontend/src/generated/merchant-config.ts"),
];
const config = readMerchantConfig(resolve("config/merchant.config.json"));
const errors = validateMerchantConfig(config, { checkAssets: true });
if (errors.length)
  throw new Error(`Merchant configuration is invalid:\n${errors.join("\n")}`);
const rendered = await renderMerchantConfigModule(config);
const checkOnly = process.argv.includes("--check");

for (const output of outputs) {
  if (checkOnly) {
    if (!existsSync(output))
      throw new Error(`${output} is missing. Run npm run config:generate.`);
    if (readFileSync(output, "utf8") !== rendered)
      throw new Error(`${output} is stale. Run npm run config:generate.`);
  } else {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, rendered);
  }
}
console.log(
  `${checkOnly ? "Verified" : "Generated"} typed merchant configuration.`,
);
