import assert from "node:assert/strict";
import test from "node:test";
import {
  readMerchantConfig,
  validateMerchantConfig,
} from "./merchant-config.mjs";

test("reference and synthetic merchant profiles satisfy the versioned contract", () => {
  for (const path of [
    "config/merchant.config.json",
    "config/examples/community-gear-lab.merchant.config.json",
  ])
    assert.deepEqual(
      validateMerchantConfig(readMerchantConfig(path), { checkAssets: true }),
      [],
    );
});

test("launch-critical merchant mistakes fail deterministically", () => {
  const config = structuredClone(
    readMerchantConfig("config/merchant.config.json"),
  );
  config.schemaVersion = 2;
  config.web.canonicalUrl = "http://unsafe.example";
  config.orders.prefix = "../BAD";
  config.operator.supportEmail = "not-an-email";
  assert.deepEqual(validateMerchantConfig(config), [
    "schemaVersion must be 1.",
    "web.canonicalUrl must be an HTTPS URL.",
    "operator.supportEmail must be an email address.",
    "orders.prefix must be 2-8 uppercase letters or digits and start with a letter.",
  ]);
});

test("merchant validation output never inspects environment secrets", () => {
  const config = structuredClone(
    readMerchantConfig("config/merchant.config.json"),
  );
  config.operator.legalName = "";
  process.env.STRIPE_SECRET_KEY = "synthetic-secret-that-must-not-appear";
  assert.doesNotMatch(
    JSON.stringify(validateMerchantConfig(config)),
    /synthetic-secret/,
  );
});
