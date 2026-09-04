import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import prettier from "prettier";

export const policyPaths = [
  "/privacy",
  "/terms",
  "/returns",
  "/content-policy",
  "/support",
];
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 20000;

// The digest pins reviewed content, not whitespace. Generation never updates the approval pin.
export const policyDigest = (document) =>
  createHash("sha256").update(JSON.stringify(document)).digest("hex");

/** Checks structure and explicit ownership only. No machine check establishes legal sufficiency. */
export function validatePolicyContent(document, merchant) {
  const errors = [];
  const shape = (value, keys, label) => {
    if (
      !object(value) ||
      Object.keys(value).sort().join("|") !== [...keys].sort().join("|")
    ) {
      errors.push(`${label} has missing or unsupported fields.`);
      return false;
    }
    return true;
  };
  if (
    !shape(
      document,
      [
        "schemaVersion",
        "purpose",
        "merchant",
        "approvedVersion",
        "lastApprovedDate",
        "pages",
      ],
      "Policy document",
    )
  )
    return errors;
  if (document.schemaVersion !== 1)
    errors.push("Policy schemaVersion must be 1.");
  if (!["operator-approved", "fixture-only"].includes(document.purpose))
    errors.push("Policy purpose must be operator-approved or fixture-only.");
  const identity = {
    displayName: merchant.brand.displayName,
    canonicalUrl: merchant.web.canonicalUrl,
    ...merchant.operator,
  };
  if (shape(document.merchant, Object.keys(identity), "Policy merchant")) {
    for (const key of Object.keys(identity)) {
      if (document.merchant[key] !== identity[key])
        errors.push(
          `Policy merchant.${key} does not match the selected operator; supply explicitly reviewed content.`,
        );
    }
  }
  for (const key of ["approvedVersion", "lastApprovedDate"]) {
    if (document[key] !== merchant.policies[key])
      errors.push(`Policy ${key} does not match the merchant approval record.`);
  }
  if (shape(document.pages, policyPaths, "Policy pages")) {
    for (const path of policyPaths) {
      const page = document.pages[path];
      if (
        !shape(
          page,
          ["eyebrow", "title", "summary", "sections"],
          `Policy page ${path}`,
        )
      )
        continue;
      for (const key of ["eyebrow", "title", "summary"])
        if (!text(page[key]))
          errors.push(
            `Policy page ${path}.${key} must be bounded non-empty text.`,
          );
      if (
        !Array.isArray(page.sections) ||
        page.sections.length < 1 ||
        page.sections.length > 50
      ) {
        errors.push(`Policy page ${path}.sections must contain 1-50 sections.`);
        continue;
      }
      const headings = new Set();
      for (const section of page.sections) {
        if (!shape(section, ["heading", "body"], `Policy section ${path}`))
          continue;
        if (!text(section.heading) || !text(section.body))
          errors.push(
            `Policy section ${path} needs bounded heading and body text.`,
          );
        if (headings.has(section.heading))
          errors.push(`Policy section ${path} headings must be unique.`);
        headings.add(section.heading);
      }
    }
  }
  if (policyDigest(document) !== merchant.policies.contentSha256)
    errors.push(
      "Policy content digest does not match the approval pin; operator review is required.",
    );
  return errors;
}

/** Public committed JSON only: prevent traversal and symlink escape, and never echo file contents. */
export function readPolicyContent(
  merchant,
  configDirectory = resolve("config"),
) {
  try {
    if (
      !/^policies\/[a-z0-9][a-z0-9.-]*\.json$/.test(
        merchant.policies.contentFile,
      )
    )
      throw new Error();
    const root = resolve(realpathSync(configDirectory), "policies");
    const path = realpathSync(
      resolve(configDirectory, merchant.policies.contentFile),
    );
    if (!path.startsWith(root + sep)) throw new Error();
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(
      "Policy content is missing, unreadable, invalid JSON, or outside config/policies.",
    );
  }
}

export function assertPolicyBuildMode(document, source = process.env) {
  if (document.purpose !== "fixture-only") return;
  // An opt-in alone cannot turn demonstration notices into deployable commerce policies.
  const allowed =
    source.OMS_POLICY_FIXTURE_REHEARSAL === "1" &&
    source.VITE_PUBLIC_APP_MODE === "oss" &&
    source.CHECKOUT_ACCESS_MODE === "closed";
  const liveKeys = [
    "ALLOW_LIVE_PAYMENTS",
    "ALLOW_LIVE_FULFILLMENT",
    "PRINTFUL_AUTO_CONFIRM_ORDERS",
    "ENABLE_LIVE_OPENAI",
    "ENABLE_LIVE_STRIPE",
    "ENABLE_LIVE_PRINTFUL",
    "FULFILLMENT_ENABLED",
    "TRANSACTIONAL_EMAILS_ENABLED",
    "VITE_ENABLE_PUBLIC_CHECKOUT",
  ];
  if (
    !allowed ||
    liveKeys.some((key) => source[key] !== "false") ||
    source.VERCEL
  )
    throw new Error(
      "Fixture-only policies require the isolated no-provider rehearsal environment; they cannot be deployed.",
    );
}

export async function renderPolicyModule(document, metadataOnly = false) {
  const { pages, ...approval } = document;
  return prettier.format(
    `// Generated by config:generate. Operator-owned prose is in config/policies.\nexport const policyApproval = ${JSON.stringify(approval)} as const;\n${metadataOnly ? "" : `export const policyPages = ${JSON.stringify(pages)} as const;\n`}`,
    {
      parser: "typescript",
      singleQuote: true,
      printWidth: 100,
      trailingComma: "es5",
    },
  );
}
