import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  parsePrintfulShipmentEvent,
  printfulEventIdempotencyHash,
  PrintfulWebhookInputError,
  verifyPrintfulWebhookSignature,
} from '../services/printful-webhook.service.js';

const secretHex = Buffer.from('printful-fixture-secret').toString('hex');
const publicKey = Buffer.from('printful-fixture-public-key').toString('base64');
const payload = Buffer.from(
  JSON.stringify({
    type: 'shipment_sent',
    occurred_at: '2026-09-03T15:00:00Z',
    retries: 0,
    store_id: 123,
    data: {
      shipment: {
        id: 456,
        status: 'shipped',
        tracking_number: 'TRACK-123',
        tracking_url: 'https://carrier.example/track/TRACK-123',
        shipped_at: '2026-09-03T14:59:00Z',
        delivered_at: null,
        reshipment: false,
      },
      order: { id: 789, external_id: 'OMS-2026-TEST', status: 'fulfilled', store_id: 123 },
    },
  })
);

test('Printful signature verification uses the exact raw body and decoded hex secret', () => {
  const signature = createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(payload)
    .digest('hex');
  assert.equal(
    verifyPrintfulWebhookSignature(payload, publicKey, signature, publicKey, secretHex),
    true
  );
  assert.equal(
    verifyPrintfulWebhookSignature(
      Buffer.from(`${payload.toString()}\n`),
      publicKey,
      signature,
      publicKey,
      secretHex
    ),
    false
  );
  assert.equal(
    verifyPrintfulWebhookSignature(payload, 'wrong-key', signature, publicKey, secretHex),
    false
  );
  assert.equal(
    verifyPrintfulWebhookSignature(payload, publicKey, 'not-hex', publicKey, secretHex),
    false
  );
});

test('shipment webhook parser retains only customer-safe tracking fields', () => {
  const event = parsePrintfulShipmentEvent(payload);
  assert.ok(event);
  assert.equal(event.type, 'shipment_sent');
  assert.equal(event.storeId, '123');
  assert.equal(event.shipment.id, '456');
  assert.equal(event.shipment.trackingNumber, 'TRACK-123');
  assert.equal(event.shipment.trackingUrl, 'https://carrier.example/track/TRACK-123');
  assert.equal(event.order.externalId, 'OMS-2026-TEST');
  assert.equal('dashboardUrl' in event.order, false);
});

test('shipment parser rejects unsafe tracking URLs and malformed required fields', () => {
  const unsafe = JSON.parse(payload.toString()) as Record<string, unknown>;
  const data = unsafe.data as {
    shipment: { tracking_url: string };
    order: { external_id: string };
  };
  data.shipment.tracking_url = 'javascript:alert(1)';
  const event = parsePrintfulShipmentEvent(Buffer.from(JSON.stringify(unsafe)));
  assert.ok(event);
  assert.equal(event.shipment.trackingUrl, undefined);

  data.order.external_id = '';
  assert.throws(
    () => parsePrintfulShipmentEvent(Buffer.from(JSON.stringify(unsafe))),
    PrintfulWebhookInputError
  );
});

test('unsubscribed Printful event types are ignored', () => {
  assert.equal(
    parsePrintfulShipmentEvent(Buffer.from(JSON.stringify({ type: 'catalog_stock_updated' }))),
    null
  );
});

test('Printful retries keep one semantic idempotency key when retry count changes', () => {
  const first = parsePrintfulShipmentEvent(payload);
  const retriedBody = JSON.parse(payload.toString()) as { retries: number };
  retriedBody.retries = 3;
  const retried = parsePrintfulShipmentEvent(Buffer.from(JSON.stringify(retriedBody)));
  assert.ok(first);
  assert.ok(retried);
  assert.equal(printfulEventIdempotencyHash(first), printfulEventIdempotencyHash(retried));
});
