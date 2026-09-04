import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  readMerchantConfig,
  validateMerchantConfig,
} from "./merchant-config.mjs";
import {
  assertPolicyBuildMode,
  policyDigest,
  readPolicyContent,
  renderPolicyModule,
  validatePolicyContent,
} from "./policy-content.mjs";

const merchant = readMerchantConfig("config/merchant.config.json");
const approved = readPolicyContent(merchant);
const synthetic = readMerchantConfig(
  "config/examples/community-gear-lab.merchant.config.json",
);

test("approved policy paragraphs preserve the pre-extraction rendered copy exactly", () => {
  const original = JSON.parse(
    readFileSync("config/policies/open-merch-studio.json", "utf8"),
  );
  // Captured from App.tsx at 0873c08 with its then-current public support address resolved.
  assert.equal(
    policyDigest(original.pages),
    "2e6709bec48781baa42a63be13ceebde17c81b885c5d5211ea3a20b47f48bad2",
  );
  assert.deepEqual(validatePolicyContent(approved, merchant), []);
  assert.deepEqual(
    validatePolicyContent(readPolicyContent(synthetic), synthetic),
    [],
  );
});

test("operator, identity, version, date and edited prose cannot inherit an old approval", () => {
  for (const mutate of [
    (doc) => {
      doc.merchant.legalName = "Another operator";
    },
    (doc) => {
      doc.merchant.supportEmail = "another@example.org";
    },
    (doc) => {
      doc.approvedVersion = "old";
    },
    (doc) => {
      doc.lastApprovedDate = "2020-01-01";
    },
    (doc) => {
      doc.pages["/terms"].sections[0].body += " changed";
    },
  ]) {
    const doc = structuredClone(approved);
    mutate(doc);
    assert.ok(validatePolicyContent(doc, merchant).length > 0);
  }
  assert.match(
    validatePolicyContent(approved, synthetic).join("\n"),
    /does not match the selected operator/,
  );
});

test("invalid structures and unsafe or missing files fail without echoing their values", () => {
  for (const document of [
    null,
    [],
    {},
    { ...approved, pages: null },
    { ...approved, unexpected: "secret-sentinel" },
  ]) {
    const errors = validatePolicyContent(document, merchant);
    assert.ok(errors.length);
    assert.doesNotMatch(errors.join("\n"), /secret-sentinel/);
  }
  for (const file of ["../.env", "policies/missing.json", "/tmp/policy.json"]) {
    const config = structuredClone(merchant);
    config.policies.contentFile = file;
    assert.throws(() => readPolicyContent(config), /Policy content is missing/);
  }
  for (const mutate of [
    (doc) => {
      delete doc.pages["/privacy"];
    },
    (doc) => {
      doc.pages["/privacy"].sections = [];
    },
    (doc) => {
      doc.pages["/privacy"].sections[0].body = "";
    },
    (doc) => {
      doc.pages["/privacy"].sections.push(doc.pages["/privacy"].sections[0]);
    },
  ]) {
    const doc = structuredClone(approved);
    mutate(doc);
    assert.ok(validatePolicyContent(doc, merchant).length);
  }
});

test("invalid approval dates and unsupported route changes fail before generation", () => {
  for (const date of ["2026-02-30", "2026-99-99"]) {
    const config = structuredClone(merchant);
    config.policies.lastApprovedDate = date;
    assert.match(
      validateMerchantConfig(config).join("\n"),
      /real calendar date/,
    );
  }
  const config = structuredClone(merchant);
  config.policies.termsPath = "/legal/terms";
  assert.match(validateMerchantConfig(config).join("\n"), /deployment route/);
});

test("malformed JSON and symlink escapes never reveal document contents", () => {
  const directory = mkdtempSync(join(tmpdir(), "oms-policy-validation-"));
  try {
    mkdirSync(join(directory, "config"));
    mkdirSync(join(directory, "outside"));
    writeFileSync(
      join(directory, "outside", "private.json"),
      "{secret-sentinel",
    );
    symlinkSync(
      join(directory, "outside"),
      join(directory, "config", "policies"),
      "dir",
    );
    const config = structuredClone(merchant);
    config.policies.contentFile = "policies/private.json";
    assert.throws(
      () => readPolicyContent(config, join(directory, "config")),
      (error) => {
        assert.doesNotMatch(error.message, /secret-sentinel/);
        return /outside config\/policies/.test(error.message);
      },
    );
    assert.throws(
      () => readMerchantConfig(join(directory, "outside", "private.json")),
      (error) => {
        assert.doesNotMatch(error.message, /secret-sentinel/);
        return /invalid JSON/.test(error.message);
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("both policy projections are current and backend receives no prose", async () => {
  assert.equal(
    readFileSync("frontend/src/generated/policy-content.ts", "utf8"),
    await renderPolicyModule(approved),
  );
  const backend = await renderPolicyModule(approved, true);
  assert.equal(
    readFileSync("backend/src/generated/policy-approval.ts", "utf8"),
    backend,
  );
  assert.doesNotMatch(backend, /sections|What we collect/);
});

test("synthetic demonstration policies cannot pass an ordinary or Vercel build", () => {
  const document = readPolicyContent(synthetic);
  assert.throws(
    () => assertPolicyBuildMode(document, {}),
    /cannot be deployed/,
  );
  const safe = {
    OMS_POLICY_FIXTURE_REHEARSAL: "1",
    VITE_PUBLIC_APP_MODE: "oss",
    CHECKOUT_ACCESS_MODE: "closed",
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
    safe[key] = "false";
  assert.doesNotThrow(() => assertPolicyBuildMode(document, safe));
  for (const override of [
    { VERCEL: "1" },
    { ALLOW_LIVE_PAYMENTS: "true" },
    { ENABLE_LIVE_PRINTFUL: "true" },
  ])
    assert.throws(() =>
      assertPolicyBuildMode(document, { ...safe, ...override }),
    );
});
