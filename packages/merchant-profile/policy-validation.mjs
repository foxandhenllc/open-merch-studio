import { createHash } from "node:crypto";
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
