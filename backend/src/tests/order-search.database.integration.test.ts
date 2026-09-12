import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
const testUrl = process.env.OMS_STORE_TEST_DATABASE_URL;

test(
  'durable order search finds older exceptions and pages tied dates without exposing payment or customer fields',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const db = new PrismaClient({ datasources: { db: { url: testUrl! } }, log: [] });
    const prefix = `SEARCH-${randomUUID().slice(0, 8)}`;
    const ids = Array.from({ length: 126 }, () => randomUUID());
    try {
      await db.order.createMany({
        data: ids.map((id, i) => ({
          id,
          orderNumber: `${prefix}-${String(i).padStart(3, '0')}`,
          status: i === 0 ? 'REFUNDED' : 'DELIVERED',
          fulfillmentStatus: i === 0 ? 'needs_review' : 'submitted',
          operatorReviewStatus: i === 125 ? 'resolved' : 'unreviewed',
          totalCents: 5000,
          createdAt: new Date(Date.UTC(2026, 0, 1) + Math.floor(i / 3) * 1000),
          email: 'private-customer@example.test',
          stripeSessionId: 'cs_private_bearer',
          recipient: { street: 'private-shipping-address' },
        })),
      });
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          `
      import assert from 'node:assert/strict';
      import { queryOperationOrders } from './backend/src/admin/order-operations-query.ts';
      import { prisma } from './backend/src/config/database.ts';
      let cursor, ids = [];
      do { const p = await queryOperationOrders({ search: '${prefix}', filter: 'all', ...(cursor ? { cursor } : {}) }, () => 'unreviewed'); assert.ok(!/private-customer|cs_private_bearer|private-shipping-address|email|stripeSessionId|recipient/.test(JSON.stringify(p))); ids.push(...p.orders.map(o => o.id)); cursor = p.nextCursor; } while (cursor);
      assert.equal(ids.length, 126); assert.equal(new Set(ids).size, 126);
      const issue = await queryOperationOrders({ search: '${prefix}', filter: 'attention' }, () => 'unreviewed'); assert.deepEqual(issue.orders.map(o => o.id), ['${ids[0]}']);
      const exact = await queryOperationOrders({ search: '${prefix.toLowerCase()}-001', filter: 'all' }, () => 'unreviewed'); assert.deepEqual(exact.orders.map(o => o.id), ['${ids[1]}']);
      await prisma.$disconnect();
    `,
        ],
        {
          encoding: 'utf8',
          timeout: 20000,
          env: {
            ...process.env,
            DATABASE_URL: testUrl!,
            NODE_ENV: 'test',
            ENABLE_LIVE_OPENAI: 'false',
            ENABLE_LIVE_STRIPE: 'false',
            ENABLE_LIVE_PRINTFUL: 'false',
          },
        }
      );
      assert.equal(result.status, 0, result.stderr);
    } finally {
      await db.order.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    }
  }
);
