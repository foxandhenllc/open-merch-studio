import type { Prisma } from '@prisma/client';
import type {
  CollectionDraft,
  CollectionPrintLayout,
  CollectionReview,
  CollectionPublicationSummary,
} from '@open-merch-studio/collection-drafts';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

export const publicationsKey = 'installation-collection-publications-v1';
export type Publication = CollectionPublicationSummary & {
  printLayouts?: {
    revision: number;
    layouts: CollectionPrintLayout[];
    templateConfirmedAt: string;
  };
  collection: CollectionDraft;
  review: CollectionReview;
  approval: {
    actor: 'store-admin';
    templateConfirmed: true;
    contentConfirmed: true;
    publicPreviewConfirmed: true;
  };
};
export type PublicationState = { revision: number; publications: Publication[] };
let fixture: PublicationState = { revision: 0, publications: [] };
export async function readPublications(tx?: Prisma.TransactionClient): Promise<PublicationState> {
  if (!env.databaseUrl) return structuredClone(fixture);
  const row = await (tx ?? prisma).adminSetting.findUnique({ where: { key: publicationsKey } });
  if (!row) return { revision: 0, publications: [] };
  const value = row.value as unknown as PublicationState;
  if (
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !Array.isArray(value.publications) ||
    value.publications.length > 20
  )
    throw new Error('Invalid publication state.');
  return value;
}
export async function writePublications(
  state: PublicationState,
  action: string,
  tx?: Prisma.TransactionClient
) {
  if (!tx) {
    fixture = structuredClone(state);
    return;
  }
  const value = JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
  await tx.adminSetting.upsert({
    where: { key: publicationsKey },
    create: { key: publicationsKey, value, updatedBy: 'store-admin' },
    update: { value, updatedBy: 'store-admin' },
  });
  await tx.auditLog.create({
    data: {
      actor: 'store-admin',
      action,
      target: publicationsKey,
      metadata: { revision: state.revision, collectionCount: state.publications.length },
    },
  });
}
export async function publishedArtworkIsReferenced(assetId: string, tx?: Prisma.TransactionClient) {
  return (await readPublications(tx)).publications.some((entry) =>
    entry.collection.items.some((item) =>
      item.artwork?.some((binding) => binding.assetId === assetId)
    )
  );
}
