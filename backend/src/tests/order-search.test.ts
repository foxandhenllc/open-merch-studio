import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env.js';
import { saveOrder } from '../services/runtime-store.js';
import { parseOperationQuery, queryOperationOrders } from '../admin/order-operations-query.js';

test('order search reaches older exceptions with stable scoped pages and no private customer fields', async () => {
  const previous = env.databaseUrl;
  env.databaseUrl = undefined;
  try {
    for (let i = 0; i < 125; i++)
      saveOrder({
        id: `search-fixture-${String(i).padStart(3, '0')}`,
        orderNumber: `FIND-${String(i).padStart(3, '0')}`,
        status: i === 0 ? 'refunded' : 'delivered',
        totalCents: 2500,
        taxCents: 0,
        currency: 'USD',
        createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
        customerEmail: 'private-buyer@example.test',
        stripeSessionId: 'cs_private-fixture',
        fulfillment: {
          provider: 'fixture',
          status: i === 0 ? 'needs_review' : 'submitted',
          message: 'private provider message',
        },
        timeline: [],
      });
    const query = { search: 'find-', filter: 'all' };
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const result = await queryOperationOrders(
        { ...query, ...(cursor ? { cursor } : {}) },
        () => 'unreviewed'
      );
      assert.ok(result.orders.length <= 25);
      assert.ok(
        !/private-buyer|cs_private-fixture|provider message|customerEmail|stripeSessionId/.test(
          JSON.stringify(result)
        )
      );
      ids.push(...result.orders.map((order) => order.id));
      cursor = result.nextCursor;
    } while (cursor);
    assert.equal(ids.length, 125);
    assert.equal(new Set(ids).size, 125);
    assert.equal(ids.at(-1), 'search-fixture-000');
    const attention = await queryOperationOrders(
      { ...query, filter: 'attention' },
      () => 'unreviewed'
    );
    assert.deepEqual(
      attention.orders.map((order) => order.id),
      ['search-fixture-000']
    );
    assert.equal(
      (await queryOperationOrders({ ...query, filter: 'attention' }, () => 'resolved')).orders
        .length,
      0
    );
    const first = await queryOperationOrders(query, () => 'unreviewed');
    assert.throws(
      () => parseOperationQuery({ ...query, filter: 'attention', cursor: first.nextCursor }),
      { statusCode: 400 }
    );
    assert.throws(() => parseOperationQuery({ ...query, search: 'buyer@example.test' }), {
      statusCode: 400,
    });
    assert.throws(() => parseOperationQuery({ ...query, cursor: 'broken' }), { statusCode: 400 });
    assert.throws(() => parseOperationQuery({ ...query, includeEmail: true }), { statusCode: 400 });
    assert.equal(
      (await queryOperationOrders({ ...query, search: 'FIND-000' }, () => 'unreviewed')).orders
        .length,
      1
    );
  } finally {
    env.databaseUrl = previous;
  }
});
