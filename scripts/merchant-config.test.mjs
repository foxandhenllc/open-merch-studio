import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  readMerchantConfig,
  renderMerchantConfigModule,
  validateMerchantConfig,
} from "./merchant-config.mjs";
import { buildStaticRouteConfig } from "../frontend/scripts/static-route-config.mjs";

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

test("committed frontend and backend typed modules match the active manifest", async () => {
  const rendered = await renderMerchantConfigModule(
    readMerchantConfig("config/merchant.config.json"),
  );
  for (const path of [
    "backend/src/generated/merchant-config.ts",
    "frontend/src/generated/merchant-config.ts",
  ]) {
    assert.equal(readFileSync(path, "utf8"), rendered);
  }
});

test("the synthetic merchant profile renders without Open Merch Studio brand coupling", async () => {
  const syntheticConfig = readMerchantConfig(
    "config/examples/community-gear-lab.merchant.config.json",
  );
  const rendered = await renderMerchantConfigModule(syntheticConfig);
  const staticConfig = buildStaticRouteConfig(syntheticConfig);
  assert.match(rendered, /Community Gear Lab/);
  assert.match(rendered, /CGL/);
  assert.doesNotMatch(rendered, /Fox&Hen, LLC/);
  assert.equal(staticConfig.canonicalOrigin, "https://merch.example.org");
  assert.equal(staticConfig.staticRoutes[0].title, "Community Gear Lab");
  assert.match(staticConfig.notFoundRoute.title, /Community Gear Lab/);
});
