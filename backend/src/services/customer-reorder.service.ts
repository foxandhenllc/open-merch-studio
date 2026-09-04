import type { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { HttpError } from '../middleware.js';
import type {
  CustomerReorderDraft,
  DesignDraft,
  OrderSummary,
  QuoteBreakdown,
} from '../types/catalog.js';
import { listProducts } from './catalog.service.js';
import { checkoutDesignIssue, type CheckoutDesignState } from './checkout-validation.service.js';
import { loadOrder } from './order-repository.service.js';
import { getDraft } from './runtime-store.js';

function unavailable(message: string): never {
  throw new HttpError(message, 409, 'reorder_unavailable');
}

const designIdsForQuote = (quote: QuoteBreakdown): string[] =>
  Array.from(
    new Set(
      quote.items
        .flatMap((item) => [
          item.designAssetId,
          ...item.placements.map((placement) => placement.designAssetId),
        ])
        .filter((id): id is string => Boolean(id))
    )
  );

const persistedDesignState = (asset: {
  id: string;
  purpose: string;
  transparentUrl: string | null;
  imageUrl: string | null;
  generationStatus: string;
  policyStatus: string;
  readinessStatus: string;
  readinessReport: Prisma.JsonValue | null;
}): CheckoutDesignState => ({
  id: asset.id,
  purpose: asset.purpose,
  imageUrl: asset.transparentUrl ?? asset.imageUrl,
  generationStatus: asset.generationStatus,
  policyStatus: asset.policyStatus,
  readinessStatus: asset.readinessStatus,
  readinessReport: asset.readinessReport as DesignDraft['readiness'],
});

async function assertReusableArtwork(quote: QuoteBreakdown): Promise<void> {
  const ids = designIdsForQuote(quote);
  if (!ids.length) unavailable('The original order does not have reusable artwork attached.');

  const designs = env.databaseUrl
    ? (
        await prisma.designAsset.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            purpose: true,
            transparentUrl: true,
            imageUrl: true,
            generationStatus: true,
            policyStatus: true,
            readinessStatus: true,
            readinessReport: true,
          },
        })
      ).map(persistedDesignState)
    : ids
        .map((id) => getDraft(id))
        .filter((draft): draft is DesignDraft => Boolean(draft))
        .map((draft) => ({
          id: draft.id ?? '',
          purpose: draft.purpose,
          imageUrl: draft.imageUrl,
          generationStatus: draft.generationStatus,
          policyStatus: draft.policy.status,
          readinessStatus: draft.readiness.status,
          readinessReport: draft.readiness,
        }));

  if (designs.length !== ids.length || designs.some((design) => checkoutDesignIssue(design))) {
    unavailable(
      'The original artwork is no longer available for a new order. Contact support for help.'
    );
  }
}

/**
 * Reconstructs only editable product choices from an authorized historical order.
 *
 * Prices, recipient data, payment state, policy acceptance, and provider state are deliberately
 * excluded. The browser must submit these lines through the normal fresh-quote workflow.
 */
export async function createCustomerReorderDraft(
  orderId: string
): Promise<CustomerReorderDraft | null> {
  const order: OrderSummary | undefined = await loadOrder(orderId);
  if (!order) return null;
  const quote = order.quote;
  if (!quote?.items.length) unavailable('The original order has no reusable product lines.');

  const products = await listProducts();
  for (const item of quote.items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product || !product.isSellable) unavailable(`${item.title} is no longer available.`);
    const variant = product.variants.find((candidate) => candidate.id === item.variantId);
    if (!variant?.isAvailable) unavailable(`${item.variantName} is no longer available.`);
    const missingPlacement = item.placementCodes.find(
      (code) => !product.placements.some((placement) => placement.code === code)
    );
    if (missingPlacement) unavailable(`A print area on ${product.title} is no longer available.`);
  }
  await assertReusableArtwork(quote);

  return {
    sourceOrderNumber: order.orderNumber,
    items: quote.items.map((item) => {
      const designAssetId =
        item.designAssetId ??
        item.placements.find((placement) => placement.designAssetId)?.designAssetId;
      if (!designAssetId) unavailable(`Reusable artwork is missing for ${item.title}.`);
      return {
        productId: item.productId,
        variantId: item.variantId,
        productTitle: item.title,
        variantName: item.variantName,
        quantity: item.quantity,
        placementCodes: item.placementCodes,
        placements: item.placements.map((placement) => ({
          code: placement.code,
          designAssetId: placement.designAssetId ?? designAssetId,
          layout: placement.layout,
        })),
        orientation: item.orientation,
        designAssetId,
      };
    }),
  };
}
