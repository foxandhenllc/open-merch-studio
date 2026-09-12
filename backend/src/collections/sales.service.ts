import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { withCollectionLock } from '../admin/collection-lock.js';
import {
  readPublications,
  writePublications,
  type Publication,
} from '../admin/collection-publications.repository.js';
import { assertPublicationCurrent } from '../admin/collection-print-source.js';
import { collectionLayoutIssues } from '../admin/collection-print-layout-checks.js';

export const collectionSalesEnabled = (entry: Publication) =>
  Boolean(entry.sales && entry.sales.layoutRevision === entry.printLayouts?.revision);
export function collectionCommerceMode(): 'fixture' | 'live' | 'paused' {
  if (!env.databaseUrl && env.nodeEnv !== 'production' && !env.enableLiveStripe)
    return env.checkoutEnabled ? 'fixture' : 'paused';
  return env.databaseUrl &&
    env.enableLiveStripe &&
    env.stripeSecretKey &&
    env.allowLivePayments &&
    env.checkoutEnabled &&
    env.checkoutAccessMode !== 'closed'
    ? 'live'
    : 'paused';
}
export function setCollectionSales(
  id: string,
  input: { version: unknown; layoutRevision: unknown; enabled: unknown; reviewed: unknown }
) {
  return withCollectionLock(async (tx) => {
    const state = await readPublications(tx);
    const entry = state.publications.find((entry) => entry.id === id);
    if (
      !entry ||
      entry.version !== input.version ||
      (entry.printLayouts?.revision ?? 0) !== input.layoutRevision
    )
      throw new HttpError(
        'The collection changed. Refresh before changing ordering.',
        409,
        'collection_purchase_stale'
      );
    if (typeof input.enabled !== 'boolean' || typeof input.reviewed !== 'boolean')
      throw new HttpError('Invalid ordering settings.', 400);
    if (input.enabled) {
      if (input.reviewed !== true)
        throw new HttpError(
          'Review the published prices and print layouts before enabling ordering.',
          400,
          'collection_sales_review_required'
        );
      const { catalog } = await assertPublicationCurrent(entry, tx);
      const issues = collectionLayoutIssues(entry);
      for (const item of entry.collection.items) {
        if (
          !Number.isSafeInteger(item.targetPriceCents) ||
          Number(item.targetPriceCents) < 1 ||
          Number(item.targetPriceCents) > 1000000
        )
          issues.push(`${item.title}: publish an owner price.`);
        const variant = catalog
          .find((product) => product.id === item.productId)
          ?.variants.find((variant) => variant.id === item.variantId);
        if (
          !Number.isSafeInteger(variant?.printfulVariantId) ||
          Number(variant?.printfulVariantId) < 1
        )
          issues.push(`${item.title}: supplier variant is missing.`);
      }
      if (issues.length) throw new HttpError(issues.join(' '), 409, 'collection_sales_not_ready');
      entry.sales = {
        layoutRevision: entry.printLayouts!.revision,
        revision: state.revision + 1,
        enabledAt: new Date().toISOString(),
      };
    } else delete entry.sales;
    await writePublications(
      { ...state, revision: state.revision + 1 },
      input.enabled ? 'collection_sales_enabled' : 'collection_sales_paused',
      tx
    );
    return { enabled: collectionSalesEnabled(entry), commerceMode: collectionCommerceMode() };
  });
}
