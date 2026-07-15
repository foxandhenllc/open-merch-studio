import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const frontendDirectory = fileURLToPath(new URL('..', import.meta.url));
const viteBinary = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));
const port = Number(process.env.OMS_BROWSER_TEST_PORT || 4178);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [viteBinary, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    cwd: frontendDirectory,
    env: {
      ...process.env,
      VITE_PUBLIC_APP_MODE: 'oss',
      VITE_ENABLE_LOCAL_FALLBACKS: 'true',
      VITE_ENABLE_PUBLIC_CHECKOUT: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Vite preview exited early.\n${serverOutput}`);
    }
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for Vite preview.\n${serverOutput}`);
}

async function layoutMetrics(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await layoutMetrics(page);
  assert.ok(
    metrics.scrollWidth <= metrics.clientWidth + 1,
    `${label} overflowed horizontally: ${JSON.stringify(metrics)}`
  );
  return metrics;
}

function watchPageErrors(page, label) {
  const errors = [];
  page.on('console', (message) => {
    const value = message.text();
    if (message.type() === 'error' && !value.startsWith('Failed to load resource:')) {
      errors.push(`console: ${value}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('response', (response) => {
    const url = new URL(response.url());
    const expectedFallback = url.origin === origin && url.pathname.startsWith('/api/');
    const expectedAnalytics =
      url.hostname.endsWith('vercel-insights.com') || url.pathname.startsWith('/_vercel/insights');
    if (response.status() >= 400 && !expectedFallback && !expectedAnalytics) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return () => assert.deepEqual(errors, [], `${label} emitted browser errors:\n${errors.join('\n')}`);
}

async function openProduct(page) {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Choose a product' }).waitFor();
}

async function exerciseResponsiveConfigure(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const label = `${viewport.width}x${viewport.height}`;
  const assertNoPageErrors = watchPageErrors(page, label);
  try {
    await openProduct(page);
    await assertNoHorizontalOverflow(page, `${label} product`);

    if (viewport.width < 1024) {
      const canvasDisplay = await page
        .locator('.focused-workbench__canvas')
        .evaluate((element) => getComputedStyle(element).display);
      assert.equal(
        canvasDisplay,
        'none',
        `${label} should open with the catalog sheet, not a canvas`
      );
    }

    const product = page.getByRole('button', { name: /Heavyweight Cotton Tee/ }).first();
    await product.click();
    await page.getByRole('heading', { name: 'Choose color and size' }).waitFor();
    await assertNoHorizontalOverflow(page, `${label} configure`);

    const white = page.getByRole('button', { name: 'White', exact: true });
    await white.click();
    await page.getByText('White · L', { exact: true }).waitFor();

    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('heading', { name: 'Describe your design' }).waitFor();
    await assertNoHorizontalOverflow(page, `${label} describe`);
    await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA');

    if (viewport.width >= 1024) {
      const desktopMetrics = await layoutMetrics(page);
      assert.ok(
        desktopMetrics.scrollHeight <= desktopMetrics.clientHeight + 1,
        `${label} core desktop flow should not scroll the document: ${JSON.stringify(desktopMetrics)}`
      );
    }
    assertNoPageErrors();
  } finally {
    await context.close();
  }
}

async function exerciseFixtureJourney(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const assertNoPageErrors = watchPageErrors(page, '390x844 fixture journey');
  try {
    await openProduct(page);
    await page
      .getByRole('button', { name: /Heavyweight Cotton Tee/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'White', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    const prompt = page.getByRole('textbox', { name: /What should we make/ });
    await prompt.fill(
      'A cheerful red panda tending a tiny garden, bold screen-print style, no words'
    );
    await page.getByRole('button', { name: 'Generate my design', exact: true }).click();
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor({ timeout: 30_000 });
    await assertNoHorizontalOverflow(page, '390x844 review');

    const firstTeePreview = await page.locator('.mockup-preview').getAttribute('src');
    assert.ok(firstTeePreview, 'tee review should show a finished mockup');
    await page.getByRole('button', { name: 'Try it on another product', exact: true }).click();
    await page.getByRole('button', { name: /Everyday Canvas Tote/ }).first().click();
    await page.getByRole('heading', { name: 'Choose color and size' }).waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor();
    await page.locator('.mockup-preview[alt*="Everyday Canvas Tote"]').waitFor();

    await page.getByRole('button', { name: 'Try it on another product', exact: true }).click();
    await page.getByRole('button', { name: /Heavyweight Cotton Tee/ }).first().click();
    await page.getByRole('heading', { name: 'Choose color and size' }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'White', exact: true }).getAttribute('aria-pressed'),
      'true',
      'returning to a product should restore its selected color'
    );
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor();
    await page.locator('.mockup-preview[alt*="Heavyweight Cotton Tee"]').waitFor();
    assert.equal(
      await page.locator('.mockup-preview').getAttribute('src'),
      firstTeePreview,
      'returning to the same design/product/variant should reuse its mockup'
    );

    await page.getByRole('button', { name: 'Review and checkout', exact: true }).click();
    await page.getByRole('heading', { name: 'Review and checkout' }).waitFor();
    await page.getByRole('textbox', { name: /Email/ }).fill('first.visitor@example.com');
    await page.getByRole('button', { name: 'Continue to secure checkout', exact: true }).click();
    await page.getByRole('heading', { name: 'Your order' }).waitFor({ timeout: 15_000 });
    await page.getByRole('heading', { name: /OMS-\d{4}-FIXTURE/ }).waitFor();
    await assertNoHorizontalOverflow(page, '390x844 order');
    assertNoPageErrors();
  } finally {
    await context.close();
  }
}

async function exerciseCheckoutUrlCleanup(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/?checkout=cancelled&campaign=smoke`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !new URL(window.location.href).searchParams.has('checkout'));
    const url = new URL(page.url());
    assert.equal(url.searchParams.get('campaign'), 'smoke');
    assert.equal(url.searchParams.has('session_id'), false);
  } finally {
    await context.close();
  }
}

async function exerciseProductMatrix(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const assertNoPageErrors = watchPageErrors(page, 'five-product matrix');
  try {
    await openProduct(page);
    for (const productName of [
      'Heavyweight Cotton Tee',
      'Everyday Canvas Tote',
      'Classic Ceramic Mug',
      'Kiss-Cut Vinyl Sticker',
      'Museum Matte Poster',
    ]) {
      await page.getByRole('button', { name: new RegExp(productName) }).first().click();
      await page.getByRole('heading', { name: 'Choose color and size' }).waitFor();
      await page.getByText(productName, { exact: true }).first().waitFor();
      await assertNoHorizontalOverflow(page, `${productName} configure`);
      await page.getByRole('button', { name: /Change product/ }).click();
      await page.getByRole('heading', { name: 'Choose a product' }).waitFor();
    }
    assertNoPageErrors();
  } finally {
    await context.close();
  }
}

async function exerciseKeyboardAndReducedMotion(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const assertNoPageErrors = watchPageErrors(page, 'keyboard and reduced motion');
  try {
    await openProduct(page);
    await page.getByRole('button', { name: /Heavyweight Cotton Tee/ }).first().click();
    const makeStep = page.getByRole('button', { name: /Step 2: Make/ });
    await makeStep.focus();
    await makeStep.press('ArrowRight');
    assert.match(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || ''),
      /^Step 1: Product/,
      'arrow navigation should skip the disabled Checkout step'
    );
    const duration = await page
      .getByRole('button', { name: 'Continue', exact: true })
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    const maxDurationMs = Math.max(
      ...duration.split(',').map((value) => {
        const trimmed = value.trim();
        return trimmed.endsWith('ms') ? Number.parseFloat(trimmed) : Number.parseFloat(trimmed) * 1000;
      })
    );
    assert.ok(maxDurationMs <= 1, `reduced motion should collapse transitions, received ${duration}`);
    assertNoPageErrors();
  } finally {
    await context.close();
  }
}

async function exerciseCheckoutReloadRecovery(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const assertNoPageErrors = watchPageErrors(page, 'checkout reload recovery');
  let reloaded = false;
  await context.route('**/api/checkout/sessions/cs_test_resume/order', async (route) => {
    const data = reloaded
      ? {
          state: 'paid',
          message: 'Payment received.',
          order: {
            orderNumber: 'OMS-2026-RECOVERY',
            status: 'received',
            message: 'Payment was received. Your order will be reviewed before production.',
            totalCents: 2855,
            taxCents: 205,
            currency: 'USD',
            items: [{ title: 'Heavyweight Cotton Tee', variantName: 'White · L', quantity: 1 }],
            fulfillment: {
              provider: 'production',
              status: 'received',
              message: 'Order details were prepared for review.',
            },
            timeline: [
              {
                at: new Date().toISOString(),
                status: 'received',
                note: 'Payment was received.',
              },
            ],
            support: { email: 'support@example.com' },
            createdAt: new Date().toISOString(),
          },
        }
      : { state: 'processing', message: 'Confirmation is still processing.' };
    await route.fulfill({
      status: data.state === 'processing' ? 202 : 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
  try {
    await page.goto(`${origin}/?checkout=success&session_id=cs_test_resume&campaign=smoke`, {
      waitUntil: 'networkidle',
    });
    await page.getByText('Confirmation is still processing.', { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() =>
        window.sessionStorage.getItem('open-merch-studio:pending-checkout:v1')
      ),
      'cs_test_resume'
    );
    page.once('framenavigated', (frame) => {
      if (frame === page.mainFrame()) reloaded = true;
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'OMS-2026-RECOVERY' }).waitFor();
    assert.equal(
      await page.evaluate(() =>
        window.sessionStorage.getItem('open-merch-studio:pending-checkout:v1')
      ),
      null,
      'terminal confirmation should clear the pending handoff'
    );
    const url = new URL(page.url());
    assert.equal(url.searchParams.get('campaign'), 'smoke');
    assert.equal(url.searchParams.has('session_id'), false);
    assertNoPageErrors();
  } finally {
    await context.close();
  }
}

async function exerciseLegacyRecoveryExpiry(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.localStorage.setItem(
      'open-merch-studio:guest-workbench:v1',
      JSON.stringify({ version: 1, sessionId: 'sess_legacy_unknown_age' })
    );
  });
  const page = await context.newPage();
  try {
    await openProduct(page);
    const saved = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('open-merch-studio:guest-workbench:v1') || 'null')
    );
    assert.notEqual(saved?.sessionId, 'sess_legacy_unknown_age');
    assert.equal(saved?.version, 2);
  } finally {
    await context.close();
  }
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 820, height: 1180 },
      { width: 1024, height: 768 },
      { width: 1280, height: 720 },
      { width: 1365, height: 768 },
      { width: 1440, height: 900 },
      { width: 1728, height: 1117 },
      { width: 2048, height: 1152 },
    ]) {
      process.stdout.write(`Checking responsive flow at ${viewport.width}x${viewport.height}…\n`);
      await exerciseResponsiveConfigure(browser, viewport);
    }
    await exerciseProductMatrix(browser);
    await exerciseFixtureJourney(browser);
    await exerciseCheckoutUrlCleanup(browser);
    await exerciseKeyboardAndReducedMotion(browser);
    await exerciseCheckoutReloadRecovery(browser);
    await exerciseLegacyRecoveryExpiry(browser);
    process.stdout.write(
      'Responsive browser smoke passed across 11 viewports, five products, and the recoverable fixture checkout flow.\n'
    );
  } finally {
    await browser.close();
  }
} finally {
  if (server.exitCode === null) server.kill('SIGTERM');
}
