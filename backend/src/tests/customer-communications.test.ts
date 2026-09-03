import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { renderCustomerEmail } from '../services/customer-email-template.service.js';
import {
  customerSafeTimeline,
  toCustomerCheckoutConfirmation,
  toCustomerOrderConfirmation,
} from '../services/customer-order.service.js';
import { saveOrder } from '../services/runtime-store.js';
import type { OrderSummary } from '../types/catalog.js';

const sensitiveOrder = (): OrderSummary => ({
  id: 'order_private_internal_id',
  orderNumber: 'OMS-260715-TEST',
  stripeSessionId: 'cs_live_private_bearer_value',
  stripePaymentIntentId: 'pi_private_payment_reference',
  taxCents: 225,
  refundedCents: 500,
  paidAt: '2026-07-15T12:00:00.000Z',
  status: 'failed',
  customerEmail: 'buyer-private@example.com',
  totalCents: 2725,
  currency: 'USD',
  quote: {
    id: 'quote_private_id',
    currency: 'USD',
    productCostCents: 1200,
    placementCostCents: 0,
    shippingEstimateCents: 500,
    taxEstimateCents: 0,
    aiDesignFeeCents: 300,
    paymentFeeCents: 85,
    targetMarginCents: 640,
    studioPassCreditCents: 0,
    totalCents: 2725,
    subtotalBeforeCreditsCents: 2725,
    estimateFlags: { shipping: true, tax: true, paymentFee: true },
    costLines: [],
    items: [
      {
        productId: 'private-product-id',
        variantId: 'private-variant-id',
        printfulVariantId: 12345,
        title: 'Bella + Canvas Tee',
        variantName: 'Navy / XL',
        quantity: 1,
        placementCodes: ['front'],
        placementTechniques: { front: 'dtg' },
        placements: [
          {
            code: 'front',
            designAssetId: 'private-design-id',
            technique: 'dtg',
            additionalCostCents: 0,
          },
        ],
        designAssetId: 'private-design-id',
        placementCostCents: 0,
        pricingSource: 'catalog-snapshot',
        unitCostCents: 1200,
        unitRetailCents: 2725,
      },
    ],
    expiresAt: '2026-07-16T12:00:00.000Z',
  },
  designAssetId: 'private-design-id',
  fulfillment: {
    provider: 'printful',
    status: 'failed',
    message: '[provider_payload_invalid] Printful draft pf_123 failed for 100 Private Street.',
  },
  timeline: [
    {
      at: '2026-07-15T11:58:00.000Z',
      status: 'checkout_pending',
      note: 'Checkout Session cs_live_private_bearer_value was created.',
    },
    {
      at: '2026-07-15T12:00:00.000Z',
      status: 'paid',
      note: 'Stripe checkout completed with pi_private_payment_reference.',
    },
    {
      at: '2026-07-15T12:00:05.000Z',
      status: 'failed',
      note: '[provider_payload_invalid] Printful draft pf_123 failed.',
    },
    {
      at: '2026-07-15T12:00:06.000Z',
      status: 'internal_operator_code',
      note: 'Internal-only note.',
    },
  ],
  createdAt: '2026-07-15T11:57:00.000Z',
});

const privatePattern =
  /buyer-private|cs_live|pi_private|quote_private|private-(?:product|variant|design)|printful|pf_123|provider_payload_invalid|Private Street|Internal-only/i;

test('customer confirmation removes private identifiers and maps raw timeline notes', () => {
  const order = sensitiveOrder();
  const confirmation = toCustomerOrderConfirmation(order, 'support@example.com');
  const serialized = JSON.stringify(confirmation);

  assert.equal(confirmation.status, 'action_needed');
  assert.deepEqual(confirmation.items, [
    { title: 'Bella + Canvas Tee', variantName: 'Navy / XL', quantity: 1 },
  ]);
  assert.deepEqual(
    confirmation.timeline.map(({ status, note }) => ({ status, note })),
    [
      { status: 'awaiting_payment', note: 'Secure checkout was started.' },
      { status: 'received', note: 'Payment was received.' },
      { status: 'action_needed', note: 'Your order needs support review.' },
    ]
  );
  assert.doesNotMatch(serialized, privatePattern);
  assert.equal('customerEmail' in confirmation, false);
  assert.equal('stripeSessionId' in confirmation, false);
  assert.equal('stripePaymentIntentId' in confirmation, false);
  assert.equal('quote' in confirmation, false);
});

test('customer timeline falls back to one safe event when internal events are not publishable', () => {
  assert.deepEqual(
    customerSafeTimeline({
      status: 'needs_review',
      createdAt: '2026-07-15T12:00:00.000Z',
      timeline: [
        {
          at: '2026-07-15T12:00:00.000Z',
          status: 'operator_internal',
          note: 'provider secret and private recipient data',
        },
      ],
    }),
    [
      {
        at: '2026-07-15T12:00:00.000Z',
        status: 'under_review',
        note: 'Your order is receiving an additional review. We will contact you if anything is needed.',
      },
    ]
  );
});

test('a provider draft is described as review preparation, not active production', () => {
  const order = sensitiveOrder();
  order.status = 'submitted';
  order.timeline = [
    {
      at: '2026-07-15T12:00:00.000Z',
      status: 'submitted',
      note: 'Printful draft pf_123 was created for operator review.',
    },
  ];
  const confirmation = toCustomerOrderConfirmation(order, 'support@example.com');
  assert.equal(confirmation.timeline[0]?.note, 'Your order details were prepared for review.');
  assert.doesNotMatch(confirmation.timeline[0]?.note ?? '', /entered production|in production/i);
});

test('checkout confirmation ignores internal reconciliation messages and identifiers', () => {
  const confirmation = toCustomerCheckoutConfirmation(
    {
      state: 'failed',
      message: '[provider_payload_invalid] Printful draft pf_123 failed.',
      order: sensitiveOrder(),
    },
    'support@example.com'
  );
  assert.equal(confirmation.state, 'failed');
  assert.doesNotMatch(JSON.stringify(confirmation), privatePattern);
  assert.match(confirmation.message, /support review/i);
});

test('all prepared customer templates provide HTML and plain text without provider internals', () => {
  const confirmation = toCustomerOrderConfirmation(sensitiveOrder(), 'support@example.com');
  confirmation.shipments = [
    {
      status: 'shipped',
      trackingNumber: 'SAFE-TRACKING-123',
      trackingUrl: 'https://carrier.example/track/SAFE-TRACKING-123',
      reshipment: false,
      shippedAt: '2026-07-16T12:00:00.000Z',
    },
  ];
  for (const kind of [
    'order_received',
    'shipment_sent',
    'shipment_delivered',
    'refund_update',
    'action_needed',
  ] as const) {
    const rendered = renderCustomerEmail(kind, confirmation);
    assert.ok(rendered.subject);
    assert.match(rendered.html, /Open Merch Studio/);
    assert.match(rendered.text, /OMS-260715-TEST/);
    assert.match(rendered.text, /support@example\.com/);
    assert.match(rendered.text, /Bella \+ Canvas Tee/);
    assert.doesNotMatch(JSON.stringify(rendered), privatePattern);
  }
});

test('customer confirmation exposes safe shipment tracking without provider identifiers', () => {
  const order = sensitiveOrder();
  order.shipments = [
    {
      id: 'internal-shipment-id',
      status: 'shipped',
      trackingNumber: 'SAFE-TRACKING-123',
      trackingUrl: 'https://carrier.example/track/SAFE-TRACKING-123',
      reshipment: false,
      shippedAt: '2026-07-16T12:00:00.000Z',
    },
  ];
  const confirmation = toCustomerOrderConfirmation(order, 'support@example.com');
  assert.deepEqual(confirmation.shipments, [
    {
      status: 'shipped',
      trackingNumber: 'SAFE-TRACKING-123',
      trackingUrl: 'https://carrier.example/track/SAFE-TRACKING-123',
      reshipment: false,
      shippedAt: '2026-07-16T12:00:00.000Z',
      deliveredAt: undefined,
    },
  ]);
  assert.doesNotMatch(JSON.stringify(confirmation), /internal-shipment-id/);
});

test('customer template escapes catalog text before placing it in HTML', () => {
  const confirmation = toCustomerOrderConfirmation(sensitiveOrder(), 'support@example.com');
  confirmation.items[0] = {
    ...confirmation.items[0],
    title: '<script>alert("unsafe")</script> Poster',
  };
  const rendered = renderCustomerEmail('order_received', confirmation);
  assert.doesNotMatch(rendered.html, /<script>/i);
  assert.match(rendered.html, /&lt;script&gt;/i);
});

test('public commerce endpoints return only customer-safe confirmations', async () => {
  const originalDatabaseUrl = env.databaseUrl;
  env.databaseUrl = undefined;
  const order = sensitiveOrder();
  order.id = 'order_customer_boundary_test';
  order.stripeSessionId = 'cs_test_customer_boundary';
  saveOrder(order);
  const server = createApp().listen(0);
  const port = (server.address() as AddressInfo).port;

  try {
    for (const path of [
      `/api/orders/${order.id}`,
      `/api/checkout/sessions/${order.stripeSessionId}/order`,
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { data: unknown };
      assert.doesNotMatch(JSON.stringify(body.data), privatePattern);
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    env.databaseUrl = originalDatabaseUrl;
  }
});
