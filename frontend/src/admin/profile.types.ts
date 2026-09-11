import type { ProfileDraft } from '@open-merch-studio/merchant-profile';
export type { ProfileDraft, PolicyPage } from '@open-merch-studio/merchant-profile';
export type ProfileSnapshot = {
  draft: ProfileDraft;
  active: ProfileDraft;
  revision: number;
  baseDigest: string;
  activeDigest: string;
  digest: string;
  requiresPolicyReview: boolean;
  stale: boolean;
  storage: 'database' | 'fixture';
  fixed: { canonicalUrl: string; country: string };
  fields: Array<{ path: string; label: string; group: string; maxLength: number; type: string }>;
};
