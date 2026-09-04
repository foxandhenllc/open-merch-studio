import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApp } from '../app.js';
import { createQuote, listProducts } from '../services/catalog.service.js';
import { createDesignDraft } from '../services/design.service.js';
import { createCustomerReorderDraft } from '../services/customer-reorder.service.js';
import { issueCustomerOrderAccess } from '../services/customer-order-access.service.js';
import { getOrCreateSession, saveOrder } from '../services/runtime-store.js';

test('Buy again reconstructs editable choices without replaying commerce state', async () => {
  const session = getOrCreateSession();
  const product = (await listProducts()).find((candidate) => candidate.placements.length > 1);
  assert.ok(product);
  const variant = product.variants[0];
  const [front, back] = product.placements;
  assert.ok(variant && front && back);
  const artwork = await createDesignDraft('Reusable fixture emblem', {
    sessionId: session.id,
    productId: product.id,
    variantId: variant.id,
    placementCodes: [front.code, back.code],
  });
  assert.ok(artwork.id);
  const quote = await createQuote([
    {
      productId: product.id,
      variantId: variant.id,
      quantity: 2,
      placementCodes: [front.code, back.code],
      placements: [
        { code: front.code, designAssetId: artwork.id },
        { code: back.code, designAssetId: artwork.id },
      ],
      designAssetId: artwork.id,
    },
  ]);
  const orderId = `reorder-fixture-${Date.now()}`;
  saveOrder({
    id: orderId,
    orderNumber: 'OMS-REORDER-FIXTURE',
    status: 'submitted',
    customerEmail: 'not-returned@example.com',
    totalCents: quote.totalCents,
    taxCents: 425,
    currency: quote.currency,
    quote,
    designAssetId: artwork.id,
    fulfillment: {
      provider: 'fixture',
      status: 'submitted',
      message: 'Old provider state must not be copied.',
    },
    timeline: [],
    createdAt: new Date().toISOString(),
  });

  const reorder = await createCustomerReorderDraft(orderId);
  assert.deepEqual(reorder, {
    sourceOrderNumber: 'OMS-REORDER-FIXTURE',
    items: [
      {
        productId: product.id,
        variantId: variant.id,
        productTitle: product.title,
        variantName: variant.name,
        quantity: 2,
        placementCodes: [front.code, back.code],
        placements: [
          { code: front.code, designAssetId: artwork.id, layout: undefined },
          { code: back.code, designAssetId: artwork.id, layout: undefined },
        ],
        orientation: undefined,
        designAssetId: artwork.id,
      },
    ],
  });
  assert.doesNotMatch(JSON.stringify(reorder), /not-returned|425|Old provider state/i);

  const access = await issueCustomerOrderAccess(orderId);
  const server = createApp().listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/orders/${orderId}/reorder-draft`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access.token}` },
    });
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { data: unknown };
    assert.deepEqual(payload.data, JSON.parse(JSON.stringify(reorder)));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('Buy again fails closed when retained artwork cannot be verified', async () => {
  const products = await listProducts();
  const product = products[0];
  const variant = product.variants[0];
  const placement = product.placements[0];
  assert.ok(product && variant && placement);
  const quote = await createQuote([
    {
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
      placementCodes: [placement.code],
      designAssetId: 'missing-reorder-artwork',
    },
  ]);
  const orderId = `reorder-missing-art-${Date.now()}`;
  saveOrder({
    id: orderId,
    orderNumber: 'OMS-REORDER-MISSING',
    status: 'cancelled',
    totalCents: quote.totalCents,
    taxCents: 0,
    currency: quote.currency,
    quote,
    fulfillment: { provider: 'fixture', status: 'not_submitted', message: '' },
    timeline: [],
    createdAt: new Date().toISOString(),
  });

  await assert.rejects(
    createCustomerReorderDraft(orderId),
    (error: { statusCode?: number; errorCode?: string }) =>
      error.statusCode === 409 && error.errorCode === 'reorder_unavailable'
  );
});
