import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  profileDraft,
  prepareProfilePublication,
  parsePublishedProfile,
  validateProfileDraft,
} from "../packages/merchant-profile/index.mjs";
import { loadInstallationProfile } from "./installation-profile.mjs";

const base = JSON.parse(readFileSync("config/merchant.config.json", "utf8"));
const policy = JSON.parse(
  readFileSync(`config/${base.policies.contentFile}`, "utf8"),
);

test("identity changes require explicit approval of a new policy version; visual-only edits preserve approval", () => {
  const draft = profileDraft(base, policy);
  draft.fields["brand.colors.accent"] = "#315542";
  const visual = prepareProfilePublication(draft, base, policy, false);
  assert.deepEqual(visual.policy, policy);
  draft.fields["brand.displayName"] = "Sample Community Merch";
  assert.throws(
    () => prepareProfilePublication(draft, base, policy, false),
    /approve this exact saved draft/,
  );
  assert.throws(
    () => prepareProfilePublication(draft, base, policy, true),
    /new policy version/,
  );
  draft.policyVersion = "fixture-review-2";
  const publication = prepareProfilePublication(draft, base, policy, true);
  assert.equal(
    publication.policy.merchant.displayName,
    "Sample Community Merch",
  );
  // Identity metadata changes, while every operator-owned prose character remains untouched.
  assert.deepEqual(publication.policy.pages, policy.pages);
  assert.deepEqual(
    parsePublishedProfile(JSON.stringify(publication), base),
    publication,
  );
  assert.deepEqual(
    loadInstallationProfile({
      OMS_MERCHANT_PROFILE: JSON.stringify(publication),
    }),
    publication,
  );
});

test("deployment profile validation rejects arbitrary overrides, approval drift, executable colors, and unreadable palettes", () => {
  const draft = profileDraft(base, policy);
  assert.throws(
    () => validateProfileDraft({ ...draft, secrets: {} }, base),
    /unsupported fields/,
  );
  draft.fields["brand.colors.accent"] = "url(https://example.com)";
  assert.throws(() => validateProfileDraft(draft, base), /accent color/);
  draft.fields["brand.colors.accent"] = "#ffff00";
  assert.throws(() => validateProfileDraft(draft, base), /darker accent/);
  const publication = prepareProfilePublication(
    profileDraft(base, policy),
    base,
    policy,
    false,
  );
  for (const mutate of [
    (value) => {
      value.config.attribution.creatorName = "Someone else";
    },
    (value) => {
      value.config.web.canonicalUrl = "https://example.com";
    },
    (value) => {
      value.config.brand.logoPath = "/evil.svg";
    },
    (value) => {
      value.policy.pages["/privacy"].sections[0].body = "Unreviewed";
    },
    (value) => {
      value.config.CHECKOUT_ACCESS_MODE = "public";
    },
    (value) => {
      value.policy.purpose = "fixture-only";
    },
  ]) {
    const tampered = structuredClone(publication);
    mutate(tampered);
    assert.throws(
      () => parsePublishedProfile(JSON.stringify(tampered), base),
      /validation/,
    );
  }
  assert.throws(
    () => parsePublishedProfile("{invalid-json", base),
    /invalid JSON/,
  );
  assert.throws(
    () => parsePublishedProfile("x".repeat(32769), base),
    /too large/,
  );
});

test("prepared brand assets round trip through the build and legacy drafts gain only the new fields", () => {
  const draft = profileDraft(base, policy);
  const legacy = structuredClone(draft);
  for (const key of [
    "brand.logoPath",
    "brand.socialImagePath",
    "web.canonicalUrl",
  ])
    delete legacy.fields[key];
  assert.deepEqual(validateProfileDraft(legacy, base), draft);
  delete legacy.fields["brand.displayName"];
  assert.throws(
    () => validateProfileDraft(legacy, base),
    /missing or unsupported/,
  );
  draft.fields["brand.logoPath"] = `/api/brand-assets/${"a".repeat(64)}.png`;
  draft.fields["brand.socialImagePath"] =
    `/api/brand-assets/${"b".repeat(64)}.png`;
  const publication = prepareProfilePublication(draft, base, policy, false);
  assert.deepEqual(publication.policy, policy);
  assert.deepEqual(
    loadInstallationProfile({
      OMS_MERCHANT_PROFILE: JSON.stringify(publication),
    }),
    publication,
  );
  for (const invalid of [
    "/another-logo.svg",
    "https://example.com/logo.png",
    "/api/brand-assets/../secret",
    "data:image/svg+xml,test",
  ]) {
    const bad = structuredClone(draft);
    bad.fields["brand.logoPath"] = invalid;
    assert.throws(() => validateProfileDraft(bad, base));
  }
  draft.fields["web.canonicalUrl"] = "https://creator.example";
  assert.throws(
    () => prepareProfilePublication(draft, base, policy, false),
    /approve/,
  );
  assert.throws(
    () => prepareProfilePublication(draft, base, policy, true),
    /new policy version/,
  );
  draft.policyVersion = "domain-change-2";
  assert.equal(
    prepareProfilePublication(draft, base, policy, true).policy.merchant
      .canonicalUrl,
    "https://creator.example",
  );
  for (const invalid of [
    "http://creator.example",
    "https://creator.example/path",
    "https://user:password@creator.example",
    "https://creator.example?key=secret",
    "https://creator.example#fragment",
  ]) {
    draft.fields["web.canonicalUrl"] = invalid;
    assert.throws(
      () => validateProfileDraft(draft, base),
      /HTTPS store address/,
    );
  }
});
