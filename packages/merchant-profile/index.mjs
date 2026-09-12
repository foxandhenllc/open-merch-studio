import { validateMerchantConfig } from "./merchant-validation.mjs";
import {
  policyDigest,
  policyPaths,
  validatePolicyContent,
} from "./policy-validation.mjs";
export {
  validateMerchantConfig,
  policyDigest,
  policyPaths,
  validatePolicyContent,
};

// This contract is shared by the admin API and the build. No provider or launch flags belong here.
export const profileFields = [
  ["brand.displayName", "Store name", "Brand", 80],
  ["brand.shortName", "Store initials", "Brand", 12],
  ["brand.shortDescription", "Short description", "Brand", 160],
  ["brand.logoPath", "Store logo", "Brand images", 120, "asset"],
  ["brand.socialImagePath", "Sharing image", "Brand images", 120, "asset"],
  ["web.canonicalUrl", "Store website URL", "Search & sharing", 255, "url"],
  ["brand.colors.background", "Background color", "Colors", 7, "color"],
  ["brand.colors.foreground", "Text color", "Colors", 7, "color"],
  ["brand.colors.accent", "Accent color", "Colors", 7, "color"],
  ["web.title", "Search title", "Search & sharing", 120],
  ["web.description", "Search description", "Search & sharing", 320],
  ["operator.legalName", "Legal business name", "Merchant & support", 120],
  ["operator.disclosure", "Operator disclosure", "Merchant & support", 240],
  [
    "operator.supportEmail",
    "Support email",
    "Merchant & support",
    160,
    "email",
  ],
  ["orders.prefix", "Order number prefix", "Orders & email", 8],
  ["email.senderName", "Email sender name", "Orders & email", 80],
  ["pricing.marginLabel", "Margin label", "Orders & email", 80],
].map(([path, label, group, maxLength, type = "text"]) => ({
  path,
  label,
  group,
  maxLength,
  type,
}));

const at = (value, path) =>
  path.split(".").reduce((node, key) => node[key], value);
const set = (value, path, input) => {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((node, key) => node[key], value)[last] = input;
};
const object = (input) =>
  input && typeof input === "object" && !Array.isArray(input);
const sameKeys = (value, keys) =>
  object(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const luminance = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((pair) => {
      const value = parseInt(pair, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );
const contrast = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
// PostgreSQL JSONB may reorder object keys. Arrays and every text character remain significant.
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : object(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
export const profileDigest = (value) => policyDigest(stable(value));

export function profileDraft(config, policy) {
  return {
    fields: Object.fromEntries(
      profileFields.map(({ path }) => [path, at(config, path)]),
    ),
    pages: structuredClone(policy.pages),
    policyVersion: policy.approvedVersion,
    policyDate: policy.lastApprovedDate,
  };
}

function compose(draft, baseConfig, purpose) {
  const config = structuredClone(baseConfig);
  for (const { path } of profileFields) set(config, path, draft.fields[path]);
  config.policies.approvedVersion = draft.policyVersion;
  config.policies.lastApprovedDate = draft.policyDate;
  const policy = {
    schemaVersion: 1,
    purpose,
    merchant: {
      displayName: config.brand.displayName,
      canonicalUrl: config.web.canonicalUrl,
      ...config.operator,
    },
    approvedVersion: draft.policyVersion,
    lastApprovedDate: draft.policyDate,
    pages: structuredClone(draft.pages),
  };
  config.policies.contentSha256 = policyDigest(policy);
  return { version: 1, config, policy };
}

export function validateProfileDraft(input, baseConfig) {
  // Only these newly editable fields may be absent in a draft saved by an older version.
  if (object(input) && object(input.fields)) {
    input = structuredClone(input);
    for (const path of [
      "brand.logoPath",
      "brand.socialImagePath",
      "web.canonicalUrl",
    ])
      if (!Object.hasOwn(input.fields, path))
        input.fields[path] = at(baseConfig, path);
  }
  if (
    !sameKeys(input, ["fields", "pages", "policyVersion", "policyDate"]) ||
    !sameKeys(
      input.fields,
      profileFields.map(({ path }) => path),
    )
  )
    throw new Error(
      "The profile has missing or unsupported fields. Reload the editor.",
    );
  for (const { path, label, maxLength, type } of profileFields) {
    const value = input.fields[path];
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value !== value.trim() ||
      value.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(value) ||
      (type === "color" && !/^#[0-9a-fA-F]{6}$/.test(value))
    )
      throw new Error(`Check ${label.toLowerCase()}.`);
    if (
      type === "asset" &&
      value !== at(baseConfig, path) &&
      !/^\/api\/brand-assets\/[a-f0-9]{64}\.png$/.test(value)
    )
      throw new Error(
        `Prepare ${label.toLowerCase()} in the brand image editor.`,
      );
    if (type === "url") {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new Error("Enter the HTTPS address of your store.");
      }
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/" ||
        !url.hostname.includes(".")
      )
        throw new Error(
          "Use an HTTPS store address without a page path, password, or query.",
        );
    }
  }
  if (
    typeof input.policyVersion !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(input.policyVersion)
  )
    throw new Error(
      "Use a policy version of 1–64 letters, numbers, dots, dashes, or underscores.",
    );
  const payload = compose(input, baseConfig, "operator-approved");
  if (
    contrast(
      payload.config.brand.colors.background,
      payload.config.brand.colors.foreground,
    ) < 4.5
  )
    throw new Error(
      "Choose background and text colors with at least 4.5:1 contrast.",
    );
  if (contrast(payload.config.brand.colors.accent, "#ffffff") < 4.5)
    throw new Error(
      "Choose a darker accent so white button text has at least 4.5:1 contrast.",
    );
  const errors = [
    ...validateMerchantConfig(payload.config),
    ...validatePolicyContent(payload.policy, payload.config),
  ];
  if (errors.length) throw new Error(errors[0]);
  // Leave room for provider credentials within Vercel's shared environment allowance.
  if (Buffer.byteLength(JSON.stringify(payload)) > 32768)
    throw new Error(
      "The store profile exceeds 32 KB. Shorten the policy text before saving.",
    );
  return structuredClone(input);
}

export function needsPolicyReview(draft, activeConfig, activePolicy) {
  const candidate = compose(draft, activeConfig, activePolicy.purpose).policy;
  return profileDigest(candidate) !== profileDigest(activePolicy);
}

export function prepareProfilePublication(
  input,
  activeConfig,
  activePolicy,
  approved,
) {
  const draft = validateProfileDraft(input, activeConfig);
  if (needsPolicyReview(draft, activeConfig, activePolicy)) {
    if (approved !== true)
      throw new Error(
        "Review all five policy pages and approve this exact saved draft before publishing.",
      );
    if (draft.policyVersion === activePolicy.approvedVersion)
      throw new Error(
        "Give changed merchant or policy content a new policy version.",
      );
  }
  if (activePolicy.purpose !== "operator-approved")
    throw new Error(
      "Fixture-only policies cannot be published through this installation. Supply an approved installation profile first.",
    );
  return compose(draft, activeConfig, "operator-approved");
}

/** Reconstruct from the allowlist, rejecting changes outside reviewed identity, prepared assets, and policy fields. */
export function parsePublishedProfile(encoded, baseConfig) {
  if (typeof encoded !== "string" || Buffer.byteLength(encoded) > 32768)
    throw new Error("Published merchant profile is invalid or too large.");
  let payload;
  try {
    payload = JSON.parse(encoded);
  } catch {
    throw new Error("Published merchant profile is invalid JSON.");
  }
  if (
    !sameKeys(payload, ["version", "config", "policy"]) ||
    payload.version !== 1 ||
    !object(payload.config) ||
    !object(payload.policy)
  )
    throw new Error("Published merchant profile has an unsupported shape.");
  try {
    const draft = validateProfileDraft(
      profileDraft(payload.config, payload.policy),
      baseConfig,
    );
    const expected = compose(draft, baseConfig, "operator-approved");
    if (JSON.stringify(expected) !== JSON.stringify(payload)) throw new Error();
    return expected;
  } catch {
    throw new Error(
      "Published merchant profile failed its identity, policy, or field validation.",
    );
  }
}

export {
  emptyProfileDraft,
  validateSavedProfileDraft,
} from "./draft-storage.mjs";
