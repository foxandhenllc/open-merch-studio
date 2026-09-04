import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseConfiguration } from "./doctor-core.mjs";

const runtime = { node: "22.12.0" };

test("a clean clone is honestly fixture-ready", () => {
  const result = diagnoseConfiguration({}, runtime);
  assert.equal(result.ok, true);
  assert.equal(result.mode, "fixture-ready");
});

test("live gates require complete provider configuration", () => {
  const result = diagnoseConfiguration(
    {
      ENABLE_LIVE_STRIPE: "true",
      ALLOW_LIVE_PAYMENTS: "true",
      CHECKOUT_ACCESS_MODE: "public",
    },
    runtime,
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.checks.some(
      ({ label, status }) => label === "Stripe provider" && status === "fail",
    ),
  );
});

test("diagnostics never echo secret values", () => {
  const sentinel = "never-print-this-secret";
  const result = diagnoseConfiguration(
    {
      ENABLE_LIVE_STRIPE: "true",
      STRIPE_SECRET_KEY: sentinel,
      STRIPE_WEBHOOK_SECRET: sentinel,
      DATABASE_URL: sentinel,
      FRONTEND_URL: sentinel,
    },
    runtime,
  );
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sentinel));
});
