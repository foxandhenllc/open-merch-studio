import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merchantConfig } from "../backend/dist/generated/merchant-config.js";
import { env } from "../backend/dist/config/env.js";
import { policyApproval } from "../backend/dist/generated/policy-approval.js";
import {
  checkoutPolicyAcceptanceIssue,
  CURRENT_CHECKOUT_POLICY_VERSION,
} from "../backend/dist/config/policies.js";
import {
  createQuote,
  listProducts,
} from "../backend/dist/services/catalog.service.js";
import { createDesignDraft } from "../backend/dist/services/design.service.js";
import {
  createCheckoutSession,
  getOrderSummary,
} from "../backend/dist/services/order.service.js";
import { getOrCreateSession } from "../backend/dist/services/runtime-store.js";

const profile = JSON.parse(readFileSync("config/merchant.config.json", "utf8"));
assert.deepEqual(merchantConfig, profile);
assert.equal(env.supportEmail, profile.operator.supportEmail);
assert.equal(env.defaultCurrency, profile.catalog.currency);
assert.equal(env.checkoutAccessMode, "closed");
for (const key of [
  "allowLivePayments",
  "allowLiveFulfillment",
  "printfulAutoConfirmOrders",
  "enableLiveStripe",
  "enableLivePrintful",
  "enableLiveOpenAi",
  "transactionalEmailsEnabled",
])
  assert.equal(env[key], false);
assert.equal(env.databaseUrl, undefined);
assert.equal(policyApproval.purpose, "fixture-only");
assert.equal(CURRENT_CHECKOUT_POLICY_VERSION, profile.policies.approvedVersion);
env.allowLivePayments = true;
assert.match(
  checkoutPolicyAcceptanceIssue({
    policyAccepted: true,
    policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
  }),
  /cannot authorize live commerce/,
);
env.allowLivePayments = false;
const session = getOrCreateSession();
const product = (await listProducts())[0];
const variant = product.variants[0];
const placementCodes = [product.placements[0].code];
const design = await createDesignDraft("Original geometric community badge", {
  sessionId: session.id,
  productId: product.id,
  variantId: variant.id,
  placementCodes,
});
const quote = await createQuote(
  [
    {
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
      placementCodes,
      designAssetId: design.id,
    },
  ],
  { sessionId: session.id },
);
assert.ok(
  quote.costLines.some((line) => line.label === profile.pricing.marginLabel),
);
const checkout = await createCheckoutSession({
  quoteId: quote.id,
  sessionId: session.id,
  designAssetId: design.id,
  email: "fixture@example.org",
  policyAccepted: true,
  policyVersion: CURRENT_CHECKOUT_POLICY_VERSION,
});
assert.equal(checkout.status, "paid");
const order = await getOrderSummary(checkout.orderId);
assert.ok(order.orderNumber.startsWith(profile.orders.prefix + "-"));
assert.equal(order.policyVersion, profile.policies.approvedVersion);
assert.equal(profile.attribution.projectName, "Open Merch Studio");
assert.equal(profile.attribution.licenseName, "MIT");
assert.equal(
  profile.attribution.sourceUrl,
  "https://github.com/foxandhenllc/open-merch-studio",
);
console.log("Compiled server profile and fixture checkout contract passed.");
