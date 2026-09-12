import { Prisma } from '@prisma/client';
import {
  profileDraft,
  profileDigest,
  profileFields,
  validateProfileDraft,
  needsPolicyReview,
  prepareProfilePublication,
  type ProfileDraft,
} from '@open-merch-studio/merchant-profile';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { merchantConfig } from '../generated/merchant-config.js';
import { installedPolicy } from '../generated/store-profile.js';
import { HttpError } from '../middleware.js';
import { brandAssets } from './brand-assets.service.js';
import { deploymentSettings } from './deployment-settings.js';

const key = 'merchant-profile-draft-v1';
const activeDraft = () => profileDraft(merchantConfig, installedPolicy);
const activeDigest = () => profileDigest(activeDraft());
type DraftRecord = { draft: ProfileDraft; revision: number; baseDigest: string };
let fixture: DraftRecord | undefined;
let fixtureQueue: Promise<unknown> = Promise.resolve();
const initial = (): DraftRecord => ({
  draft: activeDraft(),
  revision: 0,
  baseDigest: activeDigest(),
});
const unavailable = () =>
  new HttpError(
    'The profile operation could not be confirmed. Refresh status before retrying.',
    503,
    'profile_unavailable'
  );

function parse(value: unknown): DraftRecord {
  const record = value as DraftRecord | null;
  if (
    !record ||
    !Number.isInteger(record.revision) ||
    record.revision < 1 ||
    !/^[a-f0-9]{64}$/.test(record.baseDigest)
  )
    throw unavailable();
  try {
    return { ...record, draft: validateProfileDraft(record.draft, merchantConfig) };
  } catch {
    throw unavailable();
  }
}
const snapshot = (record: DraftRecord) => ({
  ...record,
  digest: profileDigest(record.draft),
  active: activeDraft(),
  activeDigest: activeDigest(),
  fields: profileFields,
  requiresPolicyReview: needsPolicyReview(record.draft, merchantConfig, installedPolicy),
  stale: record.baseDigest !== activeDigest() && profileDigest(record.draft) !== activeDigest(),
  storage: env.databaseUrl ? ('database' as const) : ('fixture' as const),
  fixed: {
    canonicalUrl: merchantConfig.web.canonicalUrl,
    country: merchantConfig.operator.countryCode,
  },
});

export async function readMerchantProfile() {
  if (!env.databaseUrl) {
    if (env.nodeEnv === 'production') throw unavailable();
    return snapshot(structuredClone(fixture ?? initial()));
  }
  try {
    const row = await prisma.adminSetting.findUnique({ where: { key } });
    return snapshot(row ? parse(row.value) : initial());
  } catch {
    throw unavailable();
  }
}

/** Serialize draft writes and publication across replicas so a later draft cannot overtake an older publication. */
async function change<T>(
  operation: (before: DraftRecord) => Promise<{ next: DraftRecord; result: T; action: string }>
): Promise<T> {
  if (!env.databaseUrl) {
    if (env.nodeEnv === 'production') throw unavailable();
    const run = fixtureQueue.then(async () => {
      const update = await operation(structuredClone(fixture ?? initial()));
      fixture = update.next;
      return update.result;
    });
    fixtureQueue = run.catch(() => undefined);
    return run;
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
        const row = await tx.adminSetting.findUnique({ where: { key } });
        const before = row ? parse(row.value) : initial();
        const update = await operation(before);
        const value = JSON.parse(JSON.stringify(update.next)) as Prisma.InputJsonValue;
        await tx.adminSetting.upsert({
          where: { key },
          create: { key, value, updatedBy: 'store-admin' },
          update: { value, updatedBy: 'store-admin' },
        });
        await tx.auditLog.create({
          data: {
            actor: 'store-admin',
            action: update.action,
            target: key,
            metadata: {
              revision: update.next.revision,
              digest: profileDigest(update.next.draft),
              previousDigest: profileDigest(before.draft),
            },
          },
        });
        return update.result;
      },
      { maxWait: 5000, timeout: 60000 }
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw unavailable();
  }
}

function checkRevision(record: DraftRecord, revision: unknown) {
  if (!Number.isInteger(revision) || revision !== record.revision)
    throw new HttpError(
      'This draft changed in another session. Reload it before saving or publishing.',
      409,
      'profile_conflict'
    );
}

export async function saveMerchantProfile(input: unknown, revision: unknown, baseDigest: unknown) {
  let draft: ProfileDraft;
  try {
    draft = validateProfileDraft(input, merchantConfig);
  } catch (error) {
    throw new HttpError(
      error instanceof Error ? error.message : 'Invalid profile.',
      400,
      'invalid_profile'
    );
  }
  if (baseDigest !== activeDigest())
    throw new HttpError(
      'The installed profile changed. Reload before saving.',
      409,
      'profile_base_changed'
    );
  await brandAssets.assertProfile(draft.fields);
  return change(async (before) => {
    checkRevision(before, revision);
    const next = { draft, revision: before.revision + 1, baseDigest: activeDigest() };
    return { next, result: snapshot(next), action: 'merchant_profile_draft_saved' };
  });
}

export async function publishMerchantProfile(
  revision: unknown,
  digest: unknown,
  approved: unknown,
  bridge = deploymentSettings()
) {
  return change(async (before) => {
    checkRevision(before, revision);
    if (before.revision < 1 || digest !== profileDigest(before.draft))
      throw new HttpError(
        'Save and review this exact draft before publishing.',
        409,
        'profile_review_stale'
      );
    if (snapshot(before).stale)
      throw new HttpError(
        'The installed profile changed. Review and save your draft again.',
        409,
        'profile_base_changed'
      );
    let publication;
    try {
      publication = prepareProfilePublication(
        before.draft,
        merchantConfig,
        installedPolicy,
        approved
      );
    } catch (error) {
      throw new HttpError(
        error instanceof Error ? error.message : 'Review the profile.',
        400,
        'profile_review_required'
      );
    }
    await brandAssets.assertProfile(before.draft.fields);
    const receipt = await bridge.saveProfile(JSON.stringify(publication));
    return {
      next: before,
      result: { ...receipt, draftDigest: profileDigest(before.draft) },
      action: 'merchant_profile_sent_to_hosting',
    };
  });
}
