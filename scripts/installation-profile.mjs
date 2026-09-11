import { fileURLToPath } from "node:url";
import {
  readMerchantConfig,
  validateMerchantConfig,
} from "./merchant-config.mjs";
import {
  readPolicyContent,
  validatePolicyContent,
  assertPolicyBuildMode,
} from "./policy-content.mjs";
import { parsePublishedProfile } from "../packages/merchant-profile/index.mjs";

const configDirectory = fileURLToPath(new URL("../config/", import.meta.url));
export function loadInstallationProfile(source = process.env) {
  const base = readMerchantConfig(
    fileURLToPath(new URL("../config/merchant.config.json", import.meta.url)),
  );
  const installed = source.OMS_MERCHANT_PROFILE
    ? parsePublishedProfile(source.OMS_MERCHANT_PROFILE, base)
    : {
        version: 1,
        config: base,
        policy: readPolicyContent(base, configDirectory),
      };
  const errors = [
    ...validateMerchantConfig(installed.config, {
      checkAssets: true,
      publicDirectory: fileURLToPath(
        new URL("../frontend/public/", import.meta.url),
      ),
    }),
    ...validatePolicyContent(installed.policy, installed.config),
  ];
  if (errors.length)
    throw new Error(`Installation profile is invalid: ${errors.join(" ")}`);
  assertPolicyBuildMode(installed.policy, source);
  return installed;
}
