import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredSections = [
  "brand",
  "web",
  "operator",
  "orders",
  "email",
  "catalog",
  "pricing",
  "policies",
  "attribution",
];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pathPattern = /^\/[A-Za-z0-9/_.-]+$/;
const isObject = (value) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value) => typeof value === "string" && value.trim().length > 0;
const httpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** Validates public merchant data without reading or reporting any environment values. */
export function validateMerchantConfig(config, options = {}) {
  const errors = [];
  const requireText = (path, value) => {
    if (!text(value)) errors.push(`${path} must be a non-empty string.`);
  };
  if (!isObject(config))
    return ["Merchant configuration must be a JSON object."];
  if (config.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  for (const section of requiredSections)
    if (!isObject(config[section]))
      errors.push(`${section} must be an object.`);
  if (errors.some((error) => error.endsWith("must be an object.")))
    return errors;

  for (const key of ["displayName", "shortName", "shortDescription"])
    requireText(`brand.${key}`, config.brand[key]);
  for (const key of ["logoPath", "socialImagePath"]) {
    const value = config.brand[key];
    if (!text(value) || !pathPattern.test(value))
      errors.push(`brand.${key} must be a root path.`);
    if (options.checkAssets && pathPattern.test(value ?? "")) {
      const asset = resolve(
        options.publicDirectory ?? "frontend/public",
        `.${value}`,
      );
      if (!existsSync(asset))
        errors.push(`brand.${key} does not resolve to a public asset.`);
    }
  }
  for (const key of ["background", "foreground", "accent"])
    if (!/^#[0-9A-Fa-f]{6}$/.test(config.brand.colors?.[key] ?? ""))
      errors.push(`brand.colors.${key} must be a six-digit hex color.`);
  if (!httpsUrl(config.web.canonicalUrl))
    errors.push("web.canonicalUrl must be an HTTPS URL.");
  requireText("web.title", config.web.title);
  requireText("web.description", config.web.description);
  requireText("operator.legalName", config.operator.legalName);
  requireText("operator.disclosure", config.operator.disclosure);
  if (!emailPattern.test(config.operator.supportEmail ?? ""))
    errors.push("operator.supportEmail must be an email address.");
  if (!/^[A-Z]{2}$/.test(config.operator.countryCode ?? ""))
    errors.push("operator.countryCode must be an ISO two-letter code.");
  if (!/^[A-Z][A-Z0-9]{1,7}$/.test(config.orders.prefix ?? ""))
    errors.push(
      "orders.prefix must be 2-8 uppercase letters or digits and start with a letter.",
    );
  requireText("email.senderName", config.email.senderName);
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(config.email.fromLocalPart ?? ""))
    errors.push("email.fromLocalPart must be a safe mailbox local part.");
  if (!/^[A-Z]{3}$/.test(config.catalog.currency ?? ""))
    errors.push("catalog.currency must be an ISO three-letter code.");
  for (const key of ["shippingCountryCodes", "curatedCategorySlugs"])
    if (!Array.isArray(config.catalog[key]) || config.catalog[key].length === 0)
      errors.push(`catalog.${key} must be a non-empty array.`);
  requireText("pricing.marginLabel", config.pricing.marginLabel);
  for (const key of [
    "privacyPath",
    "termsPath",
    "returnsPath",
    "contentPolicyPath",
  ])
    if (!pathPattern.test(config.policies[key] ?? ""))
      errors.push(`policies.${key} must be a root path.`);
  requireText("policies.approvedVersion", config.policies.approvedVersion);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.policies.lastApprovedDate ?? ""))
    errors.push("policies.lastApprovedDate must use YYYY-MM-DD.");
  for (const key of ["projectName", "licenseName", "creatorName"])
    requireText(`attribution.${key}`, config.attribution[key]);
  for (const key of ["projectUrl", "sourceUrl", "creatorUrl"])
    if (!httpsUrl(config.attribution[key]))
      errors.push(`attribution.${key} must be an HTTPS URL.`);
  return errors;
}

export function readMerchantConfig(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
