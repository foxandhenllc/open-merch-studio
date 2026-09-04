import { resolve } from "node:path";
import {
  readMerchantConfig,
  validateMerchantConfig,
} from "./merchant-config.mjs";
import { readPolicyContent, validatePolicyContent } from "./policy-content.mjs";

const targets =
  process.argv.length > 2
    ? process.argv.slice(2)
    : [
        "config/merchant.config.json",
        "config/examples/community-gear-lab.merchant.config.json",
      ];
let failed = false;
for (const target of targets) {
  try {
    const config = readMerchantConfig(resolve(target));
    const errors = validateMerchantConfig(config, {
      checkAssets: true,
    });
    if (!errors.length)
      errors.push(...validatePolicyContent(readPolicyContent(config), config));
    console.log(`${errors.length ? "FAIL" : "PASS"} ${target}`);
    for (const error of errors) console.error(`  ${error}`);
    failed ||= errors.length > 0;
  } catch (error) {
    failed = true;
    console.error(
      `FAIL ${target} - ${error instanceof Error ? error.message : "Unreadable JSON."}`,
    );
  }
}
process.exitCode = failed ? 1 : 0;
