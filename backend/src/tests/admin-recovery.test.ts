import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { setOperationalSink } from '../utils/operational-logger.js';

test('admin recovery APIs enforce access, validate filters, and require durable storage', async () => {
  const originalAdminCode = env.adminAccessCode;
  const originalDatabaseUrl = env.databaseUrl;
  setOperationalSink(() => undefined);
  env.adminAccessCode = undefined;
  env.databaseUrl = undefined;
  const server = createApp().listen(0);
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const disabled = await fetch(`${baseUrl}/api/admin/orders`);
    assert.equal(disabled.status, 403);

    env.adminAccessCode = 'test-admin-code';
    const unauthorized = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { 'x-admin-access': 'wrong-code' },
    });
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/api/admin/orders?attention=failed`, {
      headers: { 'x-admin-access': 'test-admin-code' },
    });
    assert.equal(authorized.status, 200);
    assert.match(authorized.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/i);
    const authorizedBody = (await authorized.json()) as { success: boolean; data: unknown[] };
    assert.equal(authorizedBody.success, true);
    assert.ok(Array.isArray(authorizedBody.data));

    const polluted = await fetch(`${baseUrl}/api/admin/orders?status=failed&status=needs_review`, {
      headers: { 'x-admin-access': 'test-admin-code' },
    });
    assert.equal(polluted.status, 400);

    const retryUnauthorized = await fetch(
      `${baseUrl}/api/admin/orders/order_test/fulfillment/retry`,
      { method: 'POST' }
    );
    assert.equal(retryUnauthorized.status, 401);

    const retryWithoutDatabase = await fetch(
      `${baseUrl}/api/admin/orders/order_test/fulfillment/retry`,
      {
        method: 'POST',
        headers: { 'x-admin-access': 'test-admin-code' },
      }
    );
    assert.equal(retryWithoutDatabase.status, 409);
    const retryBody = (await retryWithoutDatabase.json()) as { errorCode?: string };
    assert.equal(retryBody.errorCode, 'durable_order_required');

    const reviewWithoutDatabase = await fetch(`${baseUrl}/api/admin/orders/order_test/review`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-access': 'test-admin-code',
      },
      body: JSON.stringify({ status: 'acknowledged', note: 'Checked provider dashboard.' }),
    });
    assert.equal(reviewWithoutDatabase.status, 409);

    const unresolvedWithoutNote = await fetch(`${baseUrl}/api/admin/orders/order_test/review`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-access': 'test-admin-code',
      },
      body: JSON.stringify({ status: 'resolved' }),
    });
    assert.equal(unresolvedWithoutNote.status, 400);
  } finally {
    server.close();
    await once(server, 'close');
    env.adminAccessCode = originalAdminCode;
    env.databaseUrl = originalDatabaseUrl;
    setOperationalSink();
  }
});
