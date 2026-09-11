export type PolicyPage = {
  eyebrow: string;
  title: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
};
export type PolicyDocument = {
  schemaVersion: number;
  purpose: string;
  merchant: Record<string, string>;
  approvedVersion: string;
  lastApprovedDate: string;
  pages: Record<string, PolicyPage>;
};
export type ProfileConfig = {
  schemaVersion: number;
  brand: {
    displayName: string;
    shortName: string;
    shortDescription: string;
    logoPath: string;
    socialImagePath: string;
    colors: { background: string; foreground: string; accent: string };
  };
  web: { canonicalUrl: string; title: string; description: string };
  operator: {
    legalName: string;
    disclosure: string;
    supportEmail: string;
    countryCode: string;
  };
  orders: { prefix: string };
  email: { senderName: string; fromLocalPart: string };
  catalog: {
    currency: string;
    shippingCountryCodes: readonly string[];
    curatedCategorySlugs: readonly string[];
  };
  pricing: { marginLabel: string };
  policies: {
    approvedVersion: string;
    lastApprovedDate: string;
    contentSha256: string;
    contentFile: string;
    privacyPath: string;
    termsPath: string;
    returnsPath: string;
    contentPolicyPath: string;
  };
  attribution: Record<string, string>;
};
export type ProfileDraft = {
  fields: Record<string, string>;
  pages: Record<string, PolicyPage>;
  policyVersion: string;
  policyDate: string;
};
export type PublishedProfile = {
  version: number;
  config: ProfileConfig;
  policy: PolicyDocument;
};
export const profileFields: Array<{
  path: string;
  label: string;
  group: string;
  maxLength: number;
  type: string;
}>;
export const policyPaths: string[];
export function profileDigest(value: unknown): string;
export function policyDigest(value: unknown): string;
export function profileDraft(
  config: ProfileConfig,
  policy: PolicyDocument,
): ProfileDraft;
export function validateProfileDraft(
  input: unknown,
  baseConfig: ProfileConfig,
): ProfileDraft;
export function needsPolicyReview(
  draft: ProfileDraft,
  config: ProfileConfig,
  policy: PolicyDocument,
): boolean;
export function prepareProfilePublication(
  input: unknown,
  config: ProfileConfig,
  policy: PolicyDocument,
  approved: unknown,
): PublishedProfile;
export function parsePublishedProfile(
  encoded: string,
  baseConfig: ProfileConfig,
): PublishedProfile;
export function validateMerchantConfig(
  config: unknown,
  options?: { checkAssets?: boolean; publicDirectory?: string },
): string[];
export function validatePolicyContent(
  policy: unknown,
  config: ProfileConfig,
): string[];
