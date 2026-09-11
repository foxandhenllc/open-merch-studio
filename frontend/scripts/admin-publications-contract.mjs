import assert from 'node:assert/strict';
import path from 'node:path';
import { verifyPrintLayouts } from './admin-print-layouts-contract.mjs';

export async function verifyCollectionPublication({ page, context, origin, viewport, output }) {
  // Keep the artist's original-artwork product; personalization is a later purchase contract.
  await page
    .getByRole('region', { name: 'Product 1', exact: true })
    .getByRole('button', { name: 'Remove product', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save drafts', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Drafts saved' }).waitFor();
  const panel = page.getByRole('region', { name: 'Collection publication', exact: true });
  const front = panel.getByLabel('Intended print width · Artist edition tee · front (inches)');
  const back = panel.getByLabel('Intended print width · Artist edition tee · back (inches)');
  await front.fill('12');
  await back.fill('12');
  await panel.getByRole('button', { name: 'Review saved collection' }).click();
  await panel.getByRole('heading', { name: 'Resolve these items before publishing' }).waitFor();
  assert.equal(await panel.getByRole('button', { name: 'Publish collection preview' }).count(), 0);
  await front.fill('6');
  await back.fill('6');
  const approve = async () => {
    await panel.getByRole('button', { name: 'Review saved collection' }).click();
    await panel.getByRole('heading', { name: 'Ready for your review' }).waitFor();
    assert.equal(
      await panel.getByRole('button', { name: 'Publish collection preview' }).isDisabled(),
      true
    );
    for (const checkbox of await panel.getByRole('checkbox').all()) await checkbox.check();
  };
  const publish = async () => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().endsWith('/publish') && res.request().method() === 'POST'
    );
    await panel.getByRole('button', { name: 'Publish collection preview' }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    const sent = response.request().postDataJSON();
    assert.match(sent.digest, /^[a-f0-9]{64}$/);
    assert.ok(sent.templateConfirmed && sent.contentConfirmed && sent.publicPreviewConfirmed);
    assert.deepEqual(
      sent.printWidths.map((area) => [area.placementCode, area.widthInches]),
      [
        ['front', 6],
        ['back', 6],
      ]
    );
    await panel.getByRole('status').filter({ hasText: 'Collection preview published' }).waitFor();
    return (await response.json()).data;
  };
  await approve();
  await panel.locator('.collection-review-area img').first().waitFor();
  if (output)
    await panel.screenshot({ path: path.join(output, `print-review-${viewport.width}.png`) });
  const publication = await publish();
  const checkSales = panel.getByRole('button', { name: 'Check sales readiness', exact: true });
  const failReadiness = (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: 'Sales check temporarily unavailable.' },
    });
  await page.route('**/sales-readiness', failReadiness);
  await checkSales.click();
  await panel.locator('.collection-sales-readiness').getByRole('alert').waitFor();
  await page.unroute('**/sales-readiness', failReadiness);
  const salesResponse = page.waitForResponse((response) =>
    response.url().endsWith('/sales-readiness')
  );
  await checkSales.click();
  const sales = await salesResponse;
  assert.equal(sales.status(), 200);
  assert.deepEqual(sales.request().postDataJSON(), { version: publication.version });
  await panel
    .getByText('Published artwork and product choices · Checked', { exact: true })
    .waitFor();
  await panel.getByText('Owner product prices · Checked', { exact: true }).waitFor();
  await panel.getByText('Collection checkout · In development', { exact: true }).waitFor();
  if (output)
    await panel
      .locator('.collection-sales-readiness')
      .screenshot({ path: path.join(output, `sales-readiness-${viewport.width}.png`) });
  await verifyPrintLayouts({ page, panel, publication, viewport, output });
  const guest = await context.newPage();
  const requestHeaders = [];
  const guestErrors = [];
  guest.on('pageerror', (error) => guestErrors.push(error.message));
  guest.on('request', (request) => requestHeaders.push(request.headers()));
  await guest.goto(`${origin}${publication.url}`, { waitUntil: 'domcontentloaded' });
  await guest.getByRole('heading', { name: publication.title, exact: true }).waitFor();
  assert.equal(await guest.getByRole('button', { name: /buy|checkout|add to cart/i }).count(), 0);
  await guest
    .getByText(
      'Explore the artwork and planned pieces. Ordering is not available from these pages yet.'
    )
    .waitFor();
  await guest.locator('.published-collection img').evaluateAll(async (images) => {
    await Promise.all(images.map((image) => image.decode()));
  });
  assert.equal(await guest.locator('.published-collection img').count(), 2);
  assert.ok(requestHeaders.every((headers) => !headers['x-admin-access']));
  assert.match(await guest.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
  const oldImage = await guest.locator('.published-collection img').first().getAttribute('src');
  for (const surface of [page, guest]) {
    const sizes = await surface.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ]);
    assert.ok(sizes[1] <= sizes[0] + 1, 'Publication view must fit the viewport');
  }
  if (output)
    await guest.screenshot({
      path: path.join(output, `published-collection-${viewport.width}.png`),
      fullPage: true,
    });
  await page
    .getByLabel('Collection name', { exact: true })
    .fill(`${publication.title} new edition`);
  await page.getByRole('button', { name: 'Save drafts', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Drafts saved' }).waitFor();
  await guest.reload({ waitUntil: 'domcontentloaded' });
  await guest.getByRole('heading', { name: publication.title, exact: true }).waitFor();
  await approve();
  const updated = await publish();
  assert.ok(updated.version > publication.version);
  assert.equal(
    await panel.locator('.collection-sales-readiness h4').count(),
    0,
    'Replacement must clear the old readiness result'
  );
  assert.equal((await guest.request.get(`${origin}${oldImage}`)).status(), 404);
  await guest.reload({ waitUntil: 'domcontentloaded' });
  await guest.getByRole('heading', { name: updated.title, exact: true }).waitFor();
  const updatedImage = await guest.locator('.published-collection img').first().getAttribute('src');
  await panel.getByRole('button', { name: 'Withdraw preview', exact: true }).click();
  await panel.getByRole('button', { name: 'Keep published', exact: true }).click();
  assert.equal(
    (await guest.request.get(`${origin}/api/collections/${publication.id}`)).status(),
    200
  );
  await panel.getByRole('button', { name: 'Withdraw preview', exact: true }).click();
  await panel.getByRole('button', { name: 'Confirm withdrawal', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: 'Collection withdrawn' }).waitFor();
  await guest.reload({ waitUntil: 'domcontentloaded' });
  await guest.getByRole('alert').filter({ hasText: 'no longer published' }).waitFor();
  assert.equal((await guest.request.get(`${origin}${updatedImage}`)).status(), 404);
  assert.equal(await guest.locator('.published-collection img').count(), 0);
  assert.deepEqual(guestErrors, []);
  await guest.close();
}
