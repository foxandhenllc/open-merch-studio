import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
assert.match(baseUrl, /^https?:\/\//, 'Pass the deployed site URL as the first argument.');
const artifactDirectory = process.env.OMS_BROWSER_ARTIFACT_DIR;
const expectCheckoutClosed = process.env.EXPECT_CHECKOUT_CLOSED === 'true';

const artwork = await sharp({
  create: { width: 1600, height: 1400, channels: 4, background: '#e9933e' },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="1600" height="1400"><circle cx="800" cy="650" r="430" fill="#17324d"/><path d="M500 650 L800 350 L1100 650 L1000 1000 L600 1000 Z" fill="#f7efe0"/></svg>'
      ),
    },
  ])
  .png()
  .toBuffer();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const browserErrors = [];
let authorization;
let completedDraft;
let completedMockup;
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
    browserErrors.push(message.text());
  }
});
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('response', async (response) => {
  const pathname = new URL(response.url()).pathname;
  if (pathname === '/api/design/uploads/authorize' && response.ok()) {
    authorization = (await response.json()).data;
  }
  if (/^\/api\/design\/uploads\/[^/]+\/complete$/.test(pathname) && response.ok()) {
    completedDraft = (await response.json()).data;
  }
  if (pathname === '/api/design/mockups' && response.ok()) {
    completedMockup = (await response.json()).data;
  }
});

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Choose a product' }).waitFor();
  await page.locator('button.product-row').first().click();
  await page.getByRole('heading', { name: 'Choose color and size' }).waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /Use my artwork/ }).click();
  const prepare = page.getByRole('button', { name: 'Prepare my artwork', exact: true });
  await page.locator('.upload-drop input[type=file]').setInputFiles({
    name: 'deployed-upload-smoke.png',
    mimeType: 'image/png',
    buffer: artwork,
  });
  assert.equal(await prepare.isDisabled(), true, 'rights confirmation should be required');
  await page.getByRole('checkbox', { name: /permission to reproduce/i }).check();
  await prepare.click();
  await page.getByRole('heading', { name: 'Your design is ready' }).waitFor({ timeout: 60_000 });
  await page.getByText('Print ready', { exact: true }).waitFor();
  const mockupPreview = page.locator('.mockup-preview');
  await mockupPreview.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.mockup-preview');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });
  assert.ok(authorization, 'the browser should complete upload authorization');
  assert.equal(completedDraft?.sourceType, 'uploaded');
  assert.equal(completedDraft?.readiness?.status, 'pass');
  assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join('; ')}`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  assert.equal(overflow, false, 'the deployed review should not overflow horizontally');
  if (artifactDirectory) {
    await mkdir(artifactDirectory, { recursive: true });
    await page.screenshot({ path: join(artifactDirectory, 'deployed-upload-review.png') });
  }
  if (expectCheckoutClosed) {
    await page.getByRole('button', { name: 'Review and checkout', exact: true }).click();
    await page.getByRole('heading', { name: 'Review and checkout' }).waitFor();
    await page.getByText('Secure checkout is temporarily unavailable.', { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: 'Continue to secure checkout', exact: true })
        .isDisabled(),
      true,
      'the public site should not allow checkout'
    );
    await page.locator('.task-panel__scroll').evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.waitForTimeout(300);
    if (artifactDirectory) {
      await page.screenshot({ path: join(artifactDirectory, 'deployed-checkout-closed.png') });
    }
  }
  process.stdout.write(
    `${JSON.stringify({
      status: 'passed',
      transport: authorization.transport,
      readiness: completedDraft.readiness.status,
      dimensions: [completedDraft.asset?.width, completedDraft.asset?.height],
      mockupProvider: completedMockup?.provider,
      checkoutClosed: expectCheckoutClosed,
    })}\n`
  );
} catch (error) {
  if (artifactDirectory) {
    await mkdir(artifactDirectory, { recursive: true });
    await page.screenshot({
      path: join(artifactDirectory, 'deployed-upload-failure.png'),
      fullPage: true,
    });
  }
  process.stderr.write(
    `${JSON.stringify({
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
      authorizationTransport: authorization?.transport,
      completed: Boolean(completedDraft),
      mockupProvider: completedMockup?.provider,
      mockupStatus: completedMockup?.status,
      mockupHost: (() => {
        try {
          return new URL(completedMockup?.imageUrl).hostname;
        } catch {
          return undefined;
        }
      })(),
      browserErrors,
    })}\n`
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
  if (authorization?.assetId && completedDraft?.sessionId) {
    const cleanup = await fetch(
      `${baseUrl}/api/design/uploads/${encodeURIComponent(authorization.assetId)}?sessionId=${encodeURIComponent(completedDraft.sessionId)}`,
      { method: 'DELETE' }
    );
    const cleanupPayload = await cleanup.json().catch(() => null);
    assert.ok(cleanup.ok && cleanupPayload?.data?.deleted, 'temporary upload cleanup should succeed');
  }
}
