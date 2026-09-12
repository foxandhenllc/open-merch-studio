import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export async function verifyOrderOperations({ page, viewport, output }) {
  await page
    .getByRole('navigation', { name: 'Store administration' })
    .getByRole('button', { name: /Orders & review$/ })
    .click();
  const panel = page.getByRole('region', { name: 'Order operations', exact: true });
  await panel.getByRole('heading', { name: 'Orders & review', exact: true }).waitFor();
  const rows = panel.getByRole('button', { name: /^Review order / });
  await rows.first().waitFor();
  const response = page.waitForResponse((res) =>
    /\/order-operations\/[^/]+$/.test(new URL(res.url()).pathname)
  );
  await rows.first().click();
  const detail = (await (await response).json()).data;
  const raw = JSON.stringify(detail);
  assert.ok(
    !/stripeSessionId|shippingAddress|purchase.png|sourceChecksum|customerEmail|providerEventId/.test(
      raw
    )
  );
  const selected = panel.getByRole('region', {
    name: `Selected order ${detail.summary.orderNumber}`,
  });
  await selected.getByText(/Reviews are simulated/).waitFor();
  assert.equal(await selected.getByRole('button', { name: 'Retry draft preparation' }).count(), 0);
  const downloads = selected.getByRole('button', { name: /^Download .* print/ });
  assert.equal(await downloads.count(), 2);
  const downloadPending = page.waitForEvent('download');
  await downloads.first().click();
  const download = await downloadPending;
  const metadata = await sharp(await readFile(await download.path())).metadata();
  assert.equal(metadata.width, 2400);
  assert.equal(metadata.height, 3000);
  assert.equal(
    (
      await page.request.get(
        `/api/admin/order-operations/${detail.summary.id}/prints/${detail.prints[0].assetId}`
      )
    ).status(),
    401
  );
  await selected.getByRole('button', { name: 'Acknowledge review' }).click();
  await panel.getByRole('status').filter({ hasText: 'Simulated review saved' }).waitFor();
  await selected
    .getByLabel('Review note')
    .fill('Checked both print areas. Owner handles the next production review.');
  const reviewPending = page.waitForResponse(
    (res) => res.url().endsWith('/review') && res.request().method() === 'POST'
  );
  await selected.getByRole('button', { name: 'Mark issue resolved' }).click();
  const review = await reviewPending;
  assert.equal(review.status(), 200);
  assert.equal(review.request().postDataJSON().status, 'resolved');
  await selected
    .getByText('Checked both print areas. Owner handles the next production review.', {
      exact: true,
    })
    .waitFor();
  assert.equal((await review.json()).data.summary.status, detail.summary.status);
  await panel.getByRole('button', { name: 'Refresh orders', exact: true }).click();
  await rows.first().click();
  await selected
    .getByText('Checked both print areas. Owner handles the next production review.', {
      exact: true,
    })
    .waitFor();
  await verifyPreparationRetention(page, panel);
  await verifyRefundReviewFilter(page, panel, detail.summary);
  await verifyOrderPaging(page, panel, detail.summary);
  const sizes = await page.evaluate(() => [
    document.documentElement.clientWidth,
    document.documentElement.scrollWidth,
  ]);
  assert.ok(sizes[1] <= sizes[0] + 1, 'Order operations must fit the viewport');
  await page.evaluate(() => window.scrollTo(0, 0));
  if (output)
    await page.screenshot({
      path: path.join(output, `order-operations-${viewport.width}.png`),
      fullPage: true,
    });
}

async function verifyPreparationRetention(page, panel) {
  const maintenance = panel.getByRole('region', { name: 'Private storage maintenance' });
  await maintenance
    .getByRole('button', { name: 'Review expired preparations', exact: true })
    .click();
  await maintenance
    .getByText('Fixture mode has no durable storage to clean.', { exact: false })
    .waitFor();
  const calls = [];
  let clearedOnce = false;
  await page.route('**/api/admin/preparation-retention', async (route) => {
    const input = route.request().postDataJSON();
    calls.push(input);
    const wasCleared = clearedOnce;
    if (input.clear) clearedOnce = true;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          available: true,
          graceDays: 7,
          scanned: 3,
          eligible: wasCleared ? 1 : 2,
          fileCount: 3,
          bytes: 2097152,
          cleared: input.clear ? 1 : 0,
          failed: input.clear && !wasCleared ? 1 : 0,
        },
      }),
    });
  });
  try {
    await maintenance
      .getByRole('button', { name: 'Review expired preparations', exact: true })
      .click();
    await maintenance.getByText(/2 eligible preparations in this batch/).waitFor();
    await maintenance
      .getByRole('button', { name: 'Clear eligible preparations', exact: true })
      .click();
    assert.equal(calls.length, 1, 'Opening confirmation must not delete anything');
    await maintenance.getByRole('button', { name: 'Keep files', exact: true }).click();
    assert.equal(calls.length, 1);
    await maintenance
      .getByRole('button', { name: 'Clear eligible preparations', exact: true })
      .click();
    await maintenance
      .getByRole('button', { name: 'Confirm clearing expired files', exact: true })
      .click();
    await maintenance.getByRole('status').filter({ hasText: '1 could not finish' }).waitFor();
    assert.deepEqual(calls.at(-1), { clear: true });
    await maintenance
      .getByRole('button', { name: 'Review expired preparations', exact: true })
      .click();
    await maintenance.getByText(/1 eligible preparation in this batch/).waitFor();
    await maintenance
      .getByRole('button', { name: 'Clear eligible preparations', exact: true })
      .click();
    await maintenance
      .getByRole('button', { name: 'Confirm clearing expired files', exact: true })
      .click();
    await maintenance
      .getByRole('status')
      .filter({ hasText: 'Order files and original artwork are retained.' })
      .waitFor();
    assert.equal(
      await maintenance
        .getByRole('button', { name: 'Clear eligible preparations', exact: true })
        .count(),
      0
    );
  } finally {
    await page.unroute('**/api/admin/preparation-retention');
  }
  await maintenance
    .getByRole('button', { name: 'Review expired preparations', exact: true })
    .click();
  await maintenance
    .getByText('Fixture mode has no durable storage to clean.', { exact: false })
    .waitFor();
}

async function verifyRefundReviewFilter(page, panel, summary) {
  const orders = [
    {
      ...summary,
      id: 'refund-review-fixture',
      orderNumber: 'OMS-REFUND-REVIEW',
      status: 'refunded',
      fulfillmentStatus: 'needs_review',
      reviewStatus: 'unreviewed',
    },
    {
      ...summary,
      id: 'refund-resolved-fixture',
      orderNumber: 'OMS-REFUND-RESOLVED',
      status: 'refunded',
      fulfillmentStatus: 'needs_review',
      reviewStatus: 'resolved',
    },
    {
      ...summary,
      id: 'delivery-fixture',
      orderNumber: 'OMS-DELIVERED',
      status: 'delivered',
      fulfillmentStatus: 'submitted',
      reviewStatus: 'unreviewed',
    },
  ];
  await page.route('**/api/admin/order-operations/search', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { orders } }),
    })
  );
  try {
    await panel.getByRole('button', { name: 'Refresh orders', exact: true }).click();
    await panel
      .getByRole('button', { name: 'Review order OMS-REFUND-REVIEW', exact: true })
      .waitFor();
    const filtered = page.waitForResponse(
      (response) =>
        response.url().endsWith('/order-operations/search') &&
        response.request().postDataJSON().filter === 'attention'
    );
    await panel.getByRole('combobox', { name: /Show orders/ }).selectOption('attention');
    await filtered;
    await panel
      .getByRole('button', { name: 'Review order OMS-REFUND-REVIEW', exact: true })
      .waitFor();
    assert.equal(await panel.getByRole('button', { name: /^Review order / }).count(), 1);
    await panel
      .getByRole('button', { name: 'Review order OMS-REFUND-REVIEW', exact: true })
      .waitFor();
  } finally {
    await page.unroute('**/api/admin/order-operations/search');
  }
  await panel.getByRole('combobox', { name: /Show orders/ }).selectOption('all');
  await panel.getByRole('button', { name: 'Refresh orders', exact: true }).click();
  await panel
    .getByRole('button', { name: `Review order ${summary.orderNumber}`, exact: true })
    .waitFor();
}

async function verifyOrderPaging(page, panel, summary) {
  let failed = false;
  const calls = [];
  const older = { ...summary, id: 'older-search-fixture', orderNumber: 'OMS-OLDER-SEARCH' };
  await page.route('**/api/admin/order-operations/search', async (route) => {
    const query = route.request().postDataJSON();
    calls.push(query);
    if (query.cursor && !failed) {
      failed = true;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Older orders could not be loaded. Try again.',
        }),
      });
      return;
    }
    const orders = query.search
      ? [older]
      : query.cursor
        ? [older]
        : Array.from({ length: 25 }, (_, index) => ({
            ...summary,
            id: `page-fixture-${index}`,
            orderNumber: `OMS-PAGE-${index}`,
          }));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          orders,
          ...(!query.search && !query.cursor ? { nextCursor: 'fixture-page-cursor' } : {}),
        },
      }),
    });
  });
  try {
    await panel.getByRole('button', { name: 'Refresh orders', exact: true }).click();
    await panel.getByRole('button', { name: 'Load older orders', exact: true }).waitFor();
    assert.equal(await panel.getByRole('button', { name: /^Review order / }).count(), 25);
    await panel.getByRole('button', { name: 'Load older orders', exact: true }).click();
    await panel
      .getByRole('alert')
      .filter({ hasText: 'Older orders could not be loaded' })
      .waitFor();
    assert.equal(await panel.getByRole('button', { name: /^Review order / }).count(), 25);
    await panel.getByRole('button', { name: 'Load older orders', exact: true }).click();
    await panel
      .getByRole('button', { name: 'Review order OMS-OLDER-SEARCH', exact: true })
      .waitFor();
    assert.equal(await panel.getByRole('button', { name: /^Review order / }).count(), 26);
    await panel.getByLabel('Find an order number', { exact: true }).fill('OLDER-SEARCH');
    const searched = page.waitForResponse(
      (response) =>
        response.url().endsWith('/order-operations/search') &&
        response.request().postDataJSON().search === 'OLDER-SEARCH'
    );
    await panel.getByRole('button', { name: 'Find orders', exact: true }).click();
    await searched;
    await panel
      .getByRole('button', { name: 'Review order OMS-OLDER-SEARCH', exact: true })
      .waitFor();
    assert.equal(await panel.getByRole('button', { name: /^Review order / }).count(), 1);
    assert.equal(calls.at(-1).cursor, undefined, 'New searches reset pagination');
    assert.equal(calls.filter((call) => call.cursor).length, 2, 'Retry reuses the same page');
  } finally {
    await page.unroute('**/api/admin/order-operations/search');
  }
  await panel.getByRole('button', { name: 'Clear search', exact: true }).click();
  await panel
    .getByRole('button', { name: `Review order ${summary.orderNumber}`, exact: true })
    .waitFor();
}
