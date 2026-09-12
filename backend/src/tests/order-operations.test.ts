import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { OperationDetail, OperationOrder } from '../admin/order-operations.types.js';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { saveOrder, getOrder } from '../services/runtime-store.js';
import { setOperationalSink } from '../utils/operational-logger.js';

test('owner operations protect sensitive fields and persist simulated reviews without touching commerce', async () => {
  const previous = { adminAccessCode: env.adminAccessCode, databaseUrl: env.databaseUrl };
  env.adminAccessCode = 'operations-fixture-access';
  env.databaseUrl = undefined;
  setOperationalSink(() => undefined);
  const id = 'operations-private-fixture';
  saveOrder({
    id,
    orderNumber: 'OMS-REVIEW-TEST',
    status: 'failed',
    totalCents: 2500,
    taxCents: 0,
    currency: 'usd',
    createdAt: new Date().toISOString(),
    customerEmail: 'private-buyer@example.test',
    stripeSessionId: 'cs_private_bearer',
    fulfillment: { provider: 'fixture', status: 'failed', message: 'private provider payload' },
    timeline: [
      { at: new Date().toISOString(), status: 'failed', note: 'private provider payload' },
    ],
  });
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/order-operations`;
  const headers = { 'x-admin-access': env.adminAccessCode, 'content-type': 'application/json' };
  const post = (suffix: string, body: unknown) =>
    fetch(`${base}/${id}/${suffix}`, { method: 'POST', headers, body: JSON.stringify(body) });
  try {
    for (const path of ['', `/${id}`, `/${id}/prints/foreign-asset`])
      assert.equal((await fetch(base + path)).status, 401);
    assert.equal(
      (
        await fetch(`${base}/${id}/review`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'resolved', note: 'Unauthorized' }),
        })
      ).status,
      401
    );
    for (const path of ['', `/${id}`]) {
      const response = await fetch(base + path, { headers });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      const body = await response.text();
      assert.ok(
        !/private-buyer|cs_private_bearer|private provider payload|stripeSessionId|customerEmail|failureReason/.test(
          body
        )
      );
    }
    assert.equal(
      (
        await fetch(`${base}/search`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ search: '', filter: 'all' }),
        })
      ).status,
      401
    );
    const search = await fetch(`${base}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ search: 'OMS-REVIEW-TEST', filter: 'all' }),
    });
    assert.equal(search.status, 200);
    assert.equal(
      ((await search.json()) as { data: { orders: Array<{ id: string }> } }).data.orders[0].id,
      id
    );
    assert.equal((await fetch(`${base}/unknown-order`, { headers })).status, 404);
    assert.equal((await fetch(`${base}/${id}/prints/foreign-asset`, { headers })).status, 404);
    for (const body of [
      { status: 'resolved', note: '' },
      { status: 'paid', note: 'No' },
      { status: 'resolved', note: 'x'.repeat(501) },
      { status: 'resolved', note: 'test\u0000' },
      { status: 'resolved', note: 'Fine', orderStatus: 'paid' },
      [],
    ])
      assert.equal((await post('review', body)).status, 400);
    assert.equal((await post('review', { status: 'acknowledged', note: '' })).status, 200);
    const resolved = await post('review', {
      status: 'resolved',
      note: '  Reviewed both prints.  ',
    });
    assert.equal(resolved.status, 200);
    const detail = ((await resolved.json()) as { data: OperationDetail }).data;
    assert.equal(detail.mode, 'fixture');
    assert.equal(detail.retryAvailable, false);
    assert.equal(detail.summary.reviewStatus, 'resolved');
    assert.equal(detail.summary.status, 'failed');
    assert.deepEqual(
      detail.reviews.map((review: { status: string }) => review.status),
      ['acknowledged', 'resolved']
    );
    assert.equal(detail.reviews[1].note, 'Reviewed both prints.');
    const reloaded = (
      (await (await fetch(`${base}/${id}`, { headers })).json()) as { data: OperationDetail }
    ).data;
    assert.deepEqual(reloaded, detail);
    const list = ((await (await fetch(base, { headers })).json()) as { data: OperationOrder[] })
      .data;
    assert.equal(list.find((order: { id: string }) => order.id === id)?.reviewStatus, 'resolved');
    const retentionUrl = base.replace('order-operations', 'preparation-retention');
    assert.equal((await fetch(retentionUrl, { method: 'POST' })).status, 401);
    for (const body of [
      {},
      { clear: true, namespace: 'foreign' },
      { clear: 'true' },
      { clear: true, cursor: 3 },
    ])
      assert.equal(
        (await fetch(retentionUrl, { method: 'POST', headers, body: JSON.stringify(body) })).status,
        400
      );
    const retention = await fetch(retentionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ clear: false }),
    });
    assert.equal(retention.status, 200);
    assert.equal(
      ((await retention.json()) as { data: { available: boolean } }).data.available,
      false
    );
    assert.equal((await post('retry', { confirmed: false })).status, 400);
    assert.equal((await post('retry', { confirmed: true })).status, 409);
    assert.equal(getOrder(id)?.stripeSessionId, 'cs_private_bearer');
    assert.equal(getOrder(id)?.status, 'failed');
    assert.equal(getOrder(id)?.timeline.length, 1);
  } finally {
    server.close();
    await once(server, 'close');
    Object.assign(env, previous);
    setOperationalSink();
  }
});
