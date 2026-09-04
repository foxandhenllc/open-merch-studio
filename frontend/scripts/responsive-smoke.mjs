import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const frontendDirectory = fileURLToPath(new URL('..', import.meta.url));
const viteBinary = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));
const port = Number(process.env.OMS_BROWSER_TEST_PORT || 4178);
const origin = `http://127.0.0.1:${port}`;
const artifactDirectory = process.env.OMS_BROWSER_ARTIFACT_DIR;
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

async function assertBoxContained(inner, outer, label) {
  const [innerBox, outerBox] = await Promise.all([inner.boundingBox(), outer.boundingBox()]);
  assert.ok(innerBox, `${label} should have a visible inner box`);
  assert.ok(outerBox, `${label} should have a visible outer box`);
  const tolerance = 1;
  assert.ok(
    innerBox.x >= outerBox.x - tolerance &&
      innerBox.y >= outerBox.y - tolerance &&
      innerBox.x + innerBox.width <= outerBox.x + outerBox.width + tolerance &&
      innerBox.y + innerBox.height <= outerBox.y + outerBox.height + tolerance,
    `${label} should stay inside its container: ${JSON.stringify({ innerBox, outerBox })}`
  );
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
  return () =>
    assert.deepEqual(errors, [], `${label} emitted browser errors:\n${errors.join('\n')}`);
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
    assert.equal(
      await page.locator('.focused-workbench__canvas .stage__meta').count(),
      0,
      `${label} configure should not duplicate product metadata on the canvas`
    );

    if (viewport.width <= 600) {
      const productChip = await page.locator('.canvas-product-summary').boundingBox();
      const continueAction = await page
        .getByRole('button', { name: 'Continue', exact: true })
        .boundingBox();
      assert.ok(productChip, `${label} should show the compact product chip`);
      assert.ok(
        productChip.height <= 40,
        `${label} product chip should stay compact: ${JSON.stringify(productChip)}`
      );
      assert.ok(continueAction, `${label} should show one primary configure action`);
      assert.ok(
        continueAction.y + continueAction.height <= viewport.height - 8,
        `${label} configure action should clear mobile browser chrome: ${JSON.stringify(continueAction)}`
      );
      const taskScroll = await page.locator('.task-panel__scroll').boundingBox();
      assert.ok(taskScroll, `${label} should expose the internal task scroll region`);
      assert.ok(
        taskScroll.y + taskScroll.height <= continueAction.y,
        `${label} action tray should not overlay task controls: ${JSON.stringify({ taskScroll, continueAction })}`
      );
      const mobileMetrics = await layoutMetrics(page);
      assert.ok(
        mobileMetrics.scrollHeight <= mobileMetrics.clientHeight + 1,
        `${label} workbench should keep document scrolling inside the task panel: ${JSON.stringify(mobileMetrics)}`
      );
    }

    const white = page.getByRole('button', { name: 'White', exact: true });
    if (viewport.width === 768) {
      const whiteTarget = await white.boundingBox();
      const placementTarget = await page.locator('.placement-options button').first().boundingBox();
      assert.ok(
        whiteTarget && whiteTarget.height >= 44,
        `768px color targets should be at least 44px: ${JSON.stringify(whiteTarget)}`
      );
      assert.ok(
        placementTarget && placementTarget.height >= 44,
        `768px placement targets should be at least 44px: ${JSON.stringify(placementTarget)}`
      );
    }
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
  const mockupBodies = [];
  const quoteBodies = [];
  await context.route('**/api/design/drafts', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await route.abort('failed');
  });
  await context.route('**/api/design/mockups', async (route) => {
    const body = route.request().postDataJSON();
    mockupBodies.push(body);
    const imageUrl = body.imageUrl;
    const views = ['Product view', 'Front view', 'Back view', 'Side view', 'Detail view'].map(
      (label, index) => ({ label, imageUrl: `${imageUrl}#view-${index}` })
    );
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: `mockup_mobile_${Date.now()}`,
          status: 'complete',
          provider: 'fixture',
          productId: body.productId,
          variantId: body.variantId,
          placementCodes: body.placementCodes,
          designAssetId: body.designAssetId,
          orientation: body.orientation,
          imageUrl: views[0].imageUrl,
          views,
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });
  await context.route('**/api/catalog/quotes', async (route) => {
    quoteBodies.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.abort('failed');
  });
  const page = await context.newPage();
  const assertNoPageErrors = watchPageErrors(page, '390x844 fixture journey');
  try {
    await openProduct(page);
    await page
      .getByRole('button', { name: /Heavyweight Cotton Tee/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'White', exact: true }).click();
    await page.getByRole('button', { name: /Back print/ }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    const prompt = page.getByRole('textbox', { name: /What should we make/ });
    await prompt.fill(
      'A cheerful red panda tending a tiny garden, bold screen-print style, no words'
    );
    await page.getByRole('button', { name: 'Generate my design', exact: true }).click();
    const progressStatus = page.getByRole('status').filter({ hasText: 'Generating artwork' });
    await progressStatus.waitFor({ timeout: 5000 });
    assert.equal(
      await page.locator('.stage-progress:visible').count(),
      1,
      'mobile generation should show one progress surface'
    );
    assert.equal(
      await page.locator('.progress-orbit:visible').count(),
      1,
      'mobile generation should show one progress icon'
    );
    assert.equal(
      await page.getByRole('heading', { name: 'Making your artwork' }).count(),
      0,
      'mobile generation should not repeat the task-panel heading'
    );
    assert.equal(
      await page.getByRole('button', { name: 'Cancel generation', exact: true }).count(),
      1,
      'mobile generation should expose one cancel action'
    );
    assert.equal(
      await page.getByRole('button', { name: 'Step 2: Make', exact: true }).isEnabled(),
      false,
      'the active progress step should be non-interactive during generation'
    );
    assert.equal(
      await page.evaluate(() => document.activeElement?.matches('.stage-progress')),
      true,
      'mobile generation should move focus to its retained progress surface'
    );
    await assertBoxContained(
      page.locator('.stage-progress'),
      page.locator('.focused-workbench__canvas'),
      'mobile generation progress'
    );
    await assertNoHorizontalOverflow(page, '390x844 generation');

    await page.getByRole('status').filter({ hasText: 'Building product preview' }).waitFor();
    assert.equal(
      await page.locator('.stage-progress:visible').count(),
      1,
      'mobile mockup preparation should keep one progress surface'
    );
    assert.equal(
      await page.getByRole('button', { name: 'Cancel generation', exact: true }).count(),
      0,
      'mockup preparation should not expose a stale generation cancel action'
    );
    await page.getByRole('heading', { name: 'Finishing your preview' }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Review and checkout', exact: true }).count(),
      0,
      'review actions should stay hidden while the mockup and quote are settling'
    );
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor({ timeout: 30_000 });
    await assertNoHorizontalOverflow(page, '390x844 review');
    assert.equal(
      await page.locator('.print-area-row').count(),
      2,
      'a two-sided tee should show both print areas in review'
    );
    await page.getByText('$5.95 for additional printing', { exact: true }).waitFor();
    const initialTotal = await page.locator('.review-total strong').textContent();

    const quantityQuoteRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/catalog/quotes'
    );
    await page.getByLabel('Quantity').selectOption('2');
    const quantityQuoteBody = (await quantityQuoteRequest).postDataJSON();
    assert.equal(
      quantityQuoteBody.items[0]?.quantity,
      2,
      'changing quantity must request a fresh server price for the selected amount'
    );
    await page.waitForFunction(
      (previousTotal) =>
        document.querySelector('.review-total strong')?.textContent !== previousTotal,
      initialTotal
    );
    assert.equal(await page.getByLabel('Quantity').inputValue(), '2');

    await page.getByRole('button', { name: 'Create different artwork', exact: true }).click();
    await page.getByRole('heading', { name: 'Create the Back print' }).waitFor();
    await page
      .getByRole('textbox', { name: /What should we make/ })
      .fill('A small original garden tools badge for the back print, no words');
    await page.getByRole('button', { name: 'Generate my design', exact: true }).click();
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor({ timeout: 30_000 });
    if (artifactDirectory) {
      await mkdir(artifactDirectory, { recursive: true });
      await page.screenshot({ path: join(artifactDirectory, 'multi-print-review-mobile.png') });
    }
    const latestMockupBody = mockupBodies.at(-1);
    const latestQuoteBody = quoteBodies.at(-1);
    assert.equal(latestMockupBody.placements.length, 2);
    assert.notEqual(
      latestMockupBody.placements[0].designAssetId,
      latestMockupBody.placements[1].designAssetId,
      'front and back mockups should carry distinct artwork IDs after customization'
    );
    assert.notEqual(
      latestQuoteBody.items[0].placements[0].designAssetId,
      latestQuoteBody.items[0].placements[1].designAssetId,
      'front and back quote data should preserve distinct artwork IDs'
    );

    const reuseArtwork = page.getByRole('button', { name: 'Use same as Front print' });
    await reuseArtwork.scrollIntoViewIfNeeded();
    const [reuseBox, reviewActionBox] = await Promise.all([
      reuseArtwork.boundingBox(),
      page.getByRole('button', { name: 'Review and checkout', exact: true }).boundingBox(),
    ]);
    assert.ok(reuseBox && reviewActionBox, 'mobile reuse and checkout actions should be visible');
    assert.ok(
      reuseBox.y + reuseBox.height <= reviewActionBox.y,
      `the mobile checkout tray must not cover placement reuse: ${JSON.stringify({ reuseBox, reviewActionBox })}`
    );
    const nextMockupRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/design/mockups'
    );
    const nextQuoteRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/catalog/quotes'
    );
    await reuseArtwork.click();
    const [reusedMockupRequest, reusedQuoteRequest] = await Promise.all([
      nextMockupRequest,
      nextQuoteRequest,
    ]);
    const reusedMockupBody = reusedMockupRequest.postDataJSON();
    const reusedQuoteBody = reusedQuoteRequest.postDataJSON();
    assert.equal(
      reusedMockupBody.placements[0].designAssetId,
      reusedMockupBody.placements[1].designAssetId,
      'reusing the front artwork must update the next mockup request'
    );
    assert.equal(
      reusedQuoteBody.items[0].placements[0].designAssetId,
      reusedQuoteBody.items[0].placements[1].designAssetId,
      'reusing the front artwork must update the next quote request'
    );
    await page.getByText(/Same artwork as Front print/).waitFor();
    assert.equal(
      await page.getByText(/Different artwork can add design work/).count(),
      0,
      'the separate-artwork pricing note should clear after artwork is reused'
    );

    const mobileRail = page.locator('.mockup-viewer__rail--mobile');
    const desktopRail = page.locator('.mockup-viewer__rail--desktop');
    await mobileRail.waitFor();
    assert.equal(
      await page.getByRole('group', { name: 'Product mockup views', exact: true }).count(),
      1,
      'the visible mobile view rail should expose one labeled group'
    );
    assert.equal(
      await mobileRail.getByRole('button').count(),
      5,
      'mobile mockup rail should expose every provider view'
    );
    assert.equal(
      await desktopRail.evaluate((element) => getComputedStyle(element).display),
      'none',
      'desktop More views rail should be hidden on phones'
    );
    const mobileRailMetrics = await mobileRail.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));
    assert.ok(
      ['auto', 'scroll'].includes(mobileRailMetrics.overflowX),
      `mobile mockup rail should scroll horizontally: ${JSON.stringify(mobileRailMetrics)}`
    );
    assert.ok(
      mobileRailMetrics.scrollWidth > mobileRailMetrics.clientWidth,
      `mobile mockup rail should contain swipeable overflow: ${JSON.stringify(mobileRailMetrics)}`
    );
    await assertBoxContained(
      mobileRail,
      page.locator('.focused-workbench__canvas'),
      'mobile mockup view rail'
    );
    const detailView = mobileRail.getByRole('button', { name: 'Show Detail view' });
    await detailView.scrollIntoViewIfNeeded();
    await detailView.click();
    assert.equal(await detailView.getAttribute('aria-pressed'), 'true');
    assert.match(
      (await page.locator('.mockup-preview').getAttribute('src')) || '',
      /#view-4$/,
      'selecting a mobile thumbnail should update the product preview'
    );
    const productView = mobileRail.getByRole('button', { name: 'Show Product view' });
    await productView.scrollIntoViewIfNeeded();
    await productView.click();

    const firstTeePreview = await page.locator('.mockup-preview').getAttribute('src');
    assert.ok(firstTeePreview, 'tee review should show a finished mockup');
    await page.getByRole('button', { name: 'Make changes', exact: true }).click();
    const designOptions = page.locator('.refine-panel');
    assert.equal(
      await designOptions.getAttribute('open'),
      '',
      'Make changes should reveal the contextual design options'
    );
    assert.ok(
      (await designOptions.getByRole('button').count()) > 0,
      'the design options disclosure should never open empty'
    );
    await page.getByRole('button', { name: 'Try it on another product', exact: true }).click();
    assert.equal(
      await page.locator('.product-row.is-selected .product-row__price small').textContent(),
      'current estimate',
      'the reopened catalog should label the selected variant price as the current estimate'
    );
    await page
      .getByRole('button', { name: /Everyday Canvas Tote/ })
      .first()
      .click();
    await page.getByRole('heading', { name: 'Choose color and size' }).waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor();
    await page.locator('.mockup-preview[alt*="Everyday Canvas Tote"]').waitFor();

    await page.getByRole('button', { name: 'Try it on another product', exact: true }).click();
    await page
      .getByRole('button', { name: /Heavyweight Cotton Tee/ })
      .first()
      .click();
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
    assert.equal(
      await page.locator('.task-panel__scroll').evaluate((element) => element.scrollTop),
      0,
      'checkout should open at the top of its task panel'
    );
    assert.equal(
      await page.getByText(/Printful/i).count(),
      0,
      'checkout should use customer-facing language instead of provider terminology'
    );
    const email = page.getByRole('textbox', { name: /Email/ });
    const checkoutAction = page.getByRole('button', {
      name: 'Continue to secure checkout',
      exact: true,
    });
    const policyAssent = page.getByRole('checkbox', {
      name: /I confirm that I am at least 18/i,
    });
    assert.equal(
      await policyAssent.isChecked(),
      false,
      'checkout policy assent should begin unchecked'
    );
    assert.equal(
      await checkoutAction.isDisabled(),
      true,
      'checkout should remain blocked until the current policies are accepted'
    );
    assert.equal(
      await email.getAttribute('aria-invalid'),
      'false',
      'blank checkout email should begin in a neutral state'
    );
    assert.equal(
      await page.getByText('Enter a valid email for your receipt.', { exact: true }).count(),
      0,
      'blank checkout email should not show an error before interaction'
    );
    const checkoutActionBox = await checkoutAction.boundingBox();
    const checkoutScrollBox = await page.locator('.task-panel__scroll').boundingBox();
    assert.ok(checkoutActionBox, 'mobile checkout should show one primary action');
    assert.ok(checkoutScrollBox, 'mobile checkout should retain an internal scroll region');
    assert.ok(
      checkoutActionBox.y + checkoutActionBox.height <= 836,
      `mobile checkout action should clear browser chrome: ${JSON.stringify(checkoutActionBox)}`
    );
    assert.ok(
      checkoutScrollBox.y + checkoutScrollBox.height <= checkoutActionBox.y,
      `mobile checkout action tray should not overlay checkout fields: ${JSON.stringify({ checkoutScrollBox, checkoutActionBox })}`
    );
    await policyAssent.check();
    assert.equal(
      await checkoutAction.isEnabled(),
      true,
      'accepting the current policies should unlock the checkout action'
    );
    await checkoutAction.click();
    assert.equal(
      await email.getAttribute('aria-invalid'),
      'true',
      'submitting without an email should reveal the validation state'
    );
    await email.fill('first.visitor@example.com');
    await checkoutAction.click();
    await page.getByRole('heading', { name: 'Your order' }).waitFor({ timeout: 15_000 });
    await page.getByRole('heading', { name: /OMS-\d{4}-FIXTURE/ }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: /^Step 1: Product/ }).isEnabled(),
      false,
      'paid-order presentation should lock navigation back into product configuration'
    );
    assert.equal(
      await page.getByText('Purchased item', { exact: true }).count(),
      1,
      'paid-order canvas should show a static purchased-item summary'
    );
    await assertNoHorizontalOverflow(page, '390x844 order');
    assertNoPageErrors();
  } finally {
    await context.close();
  }
}

async function exercisePersistedGenerationFailure(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.__omsAnalyticsEvents = [];
    window.va = (...args) => window.__omsAnalyticsEvents.push(args);
  });
  await context.route('**/_vercel/insights/**', (route) => route.abort('blockedbyclient'));
  await context.route('**/api/design/drafts', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'asset_persisted_generation_failure',
          sessionId: body.sessionId,
          provider: 'openai-ready',
          generationStatus: 'failed',
          prompt: body.prompt,
          imageUrl: 'data:image/png;base64,',
          qualityTier: 'rough',
          allowance: {
            sessionId: body.sessionId,
            studioPassStatus: 'not_required',
            freeDraftsRemaining: 3,
            roughDraftsRemaining: 0,
            editsRemaining: 0,
            finalsRemaining: 0,
            nextAction: 'continue_free',
            message: '3 beta drafts remaining.',
          },
          policy: {
            status: 'needs_review',
            reasons: ['Artwork generation did not complete. Please retry.'],
          },
          readiness: {
            status: 'blocked',
            checks: [
              {
                label: 'Live generation',
                result: 'OpenAI generation was requested but did not complete.',
                severity: 'block',
              },
            ],
          },
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });
  let mockupRequests = 0;
  context.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/design/mockups') mockupRequests += 1;
  });

  const page = await context.newPage();
  try {
    await openProduct(page);
    await page
      .getByRole('button', { name: /Heavyweight Cotton Tee/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    const promptText = 'A cheerful original fox badge with wildflowers and no words';
    const prompt = page.getByRole('textbox', { name: /What should we make/ });
    await prompt.fill(promptText);
    await page.getByRole('button', { name: 'Generate my design', exact: true }).click();

    const alert = page.getByRole('alert');
    await alert.getByText('The draft was not generated', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
    assert.equal(
      await prompt.inputValue(),
      promptText,
      'a failed generation must preserve the prompt'
    );
    assert.equal(mockupRequests, 0, 'a failed generation must not request a product mockup');
    assert.equal(
      await page.getByRole('button', { name: 'Cancel generation', exact: true }).count(),
      0,
      'a failed generation must leave generating mode'
    );

    const generateButton = page.getByRole('button', { name: 'Generate my design', exact: true });
    assert.equal(
      await generateButton.evaluate((element) => getComputedStyle(element).position),
      'static',
      'mobile recovery should return Generate to document flow'
    );
    const [alertBox, generateBox] = await Promise.all([
      alert.boundingBox(),
      generateButton.boundingBox(),
    ]);
    assert.ok(alertBox && generateBox, 'mobile recovery controls should remain visible');
    assert.ok(
      alertBox.y + alertBox.height <= generateBox.y,
      `the mobile Generate action must not obscure recovery copy: ${JSON.stringify({ alertBox, generateBox })}`
    );

    const analyticsEvents = await page.evaluate(() => window.__omsAnalyticsEvents || []);
    const completionEvents = analyticsEvents.filter(
      ([kind, payload]) => kind === 'event' && payload?.name === 'design_generation_completed'
    );
    assert.equal(completionEvents.length, 1, 'generation should record one completion event');
    assert.equal(completionEvents[0]?.[1]?.data?.result, 'failed');
    assert.equal(
      completionEvents.some((event) => event[1]?.data?.result === 'success'),
      false,
      'a persisted failed asset must never record analytics success'
    );
    await assertNoHorizontalOverflow(page, '390x844 persisted generation failure');
  } finally {
    await context.close();
  }
}

async function exerciseConcisePromptJourney(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  let quoteRequests = 0;
  const page = await context.newPage();
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/catalog/quotes') quoteRequests += 1;
  });
  try {
    await openProduct(page);
    await page
      .getByRole('button', { name: /Heavyweight Cotton Tee/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('textbox', { name: /What should we make/ }).fill('Tiny badge');
    await page.getByRole('button', { name: 'Generate my design', exact: true }).click();

    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor({ timeout: 30_000 });
    assert.ok(
      quoteRequests > 0,
      'concise prompts should still receive an automatic price estimate'
    );
    await page.getByText('Print ready', { exact: true }).waitFor();
    await page.getByText('Estimated total before tax', { exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Review and checkout', exact: true }).isDisabled(),
      false,
      'prompt length should not block an otherwise print-ready design'
    );
    assert.equal(
      await page.locator('.readiness').getAttribute('open'),
      null,
      'print details should be collapsed by default'
    );
    await page.getByText('Print details', { exact: true }).click();
    assert.equal(await page.getByText('Prompt specificity', { exact: true }).count(), 0);
    for (const label of ['Placement fit', 'Private data', 'Transparent print file']) {
      await page.getByText(label, { exact: true }).waitFor();
    }
  } finally {
    await context.close();
  }
}

async function exercisePolicyPages(browser) {
  const routes = [
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
    ['/returns', 'Returns and Refunds Policy'],
    ['/content-policy', 'Content Policy'],
    ['/support', 'Support'],
  ];

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 720 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const label = `${viewport.width}x${viewport.height} policies`;
    const assertNoPageErrors = watchPageErrors(page, label);
    try {
      for (const [route, heading] of routes) {
        await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: heading, exact: true }).waitFor();
        await assertNoHorizontalOverflow(page, `${label} ${route}`);
        assert.equal(
          await page
            .getByText('Effective July 17, 2026. Last updated September 3, 2026.', {
              exact: true,
            })
            .count(),
          route === '/support' ? 0 : 1,
          `${route} should expose the approved policy date where applicable`
        );
        const body = await page.locator('body').innerText();
        assert.doesNotMatch(
          body,
          /governing law|arbitration|class[- ]action|exclusive venue|taxjar|d\/b\/a/i,
          `${route} should omit unapproved legal and tax-service language`
        );
        assert.equal(
          await page.getByRole('link', { name: 'Source on GitHub' }).count(),
          1,
          `${route} should expose the public source repository once`
        );
        assert.equal(
          await page.getByRole('link', { name: 'MIT license' }).count(),
          1,
          `${route} should identify the open-source license once`
        );
      }
      await page.goto(`${origin}/support`, { waitUntil: 'networkidle' });
      assert.equal(
        await page
          .getByText('Open Merch Studio is operated by Fox&Hen, LLC.', {
            exact: false,
          })
          .count(),
        1,
        'support should identify the approved legal operator'
      );
      assert.equal(
        await page.getByRole('link', { name: 'support@openmerchstudio.com' }).count(),
        1,
        'support should expose the branded support mailbox'
      );
      assertNoPageErrors();
    } finally {
      await context.close();
    }
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
      await page
        .getByRole('button', { name: new RegExp(productName) })
        .first()
        .click();
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
    await page
      .getByRole('button', { name: /Heavyweight Cotton Tee/ })
      .first()
      .click();
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
        return trimmed.endsWith('ms')
          ? Number.parseFloat(trimmed)
          : Number.parseFloat(trimmed) * 1000;
      })
    );
    assert.ok(
      maxDurationMs <= 1,
      `reduced motion should collapse transitions, received ${duration}`
    );
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
            shipments: [
              {
                status: 'shipped',
                trackingNumber: 'TRACK-RECOVERY-123',
                trackingUrl: 'https://carrier.example/track/TRACK-RECOVERY-123',
                reshipment: false,
                shippedAt: new Date().toISOString(),
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
    await page.getByRole('heading', { name: 'Shipment' }).waitFor();
    const trackingLink = page.getByRole('link', { name: 'Track package' });
    assert.equal(
      await trackingLink.getAttribute('href'),
      'https://carrier.example/track/TRACK-RECOVERY-123'
    );
    await assertNoHorizontalOverflow(page, 'shipment confirmation');
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
    assert.equal(saved?.version, 5);
    assert.equal(saved?.quantity, 1);
  } finally {
    await context.close();
  }
}

async function exerciseUploadedArtworkAndReferences(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const artworkBuffer = await sharp({
    create: { width: 1800, height: 1800, channels: 4, background: '#f3a642' },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="1800" height="1800"><circle cx="900" cy="760" r="520" fill="#17324d"/><path d="M500 720 L900 330 L1300 720 L1180 1260 L620 1260 Z" fill="#f7efe0"/><text x="900" y="1510" text-anchor="middle" font-family="Arial" font-size="170" font-weight="700" fill="#17324d">ORIGINAL</text></svg>'
        ),
      },
    ])
    .png()
    .toBuffer();
  const artworkDataUrl = `data:image/png;base64,${artworkBuffer.toString('base64')}`;
  let uploadCount = 0;
  const quoteBodies = [];
  await context.route('**/api/design/uploads/authorize', async (route) => {
    uploadCount += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          assetId: `uploaded_asset_${uploadCount}`,
          transport: 'inline',
          maxBytes: 2 * 1024 * 1024,
          expiresInSeconds: 900,
        },
      }),
    });
  });
  await context.route('**/api/design/uploads/*/complete', async (route) => {
    const body = route.request().postDataJSON();
    const assetId = new URL(route.request().url()).pathname.split('/').at(-2);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: assetId,
          sessionId: body.sessionId,
          provider: 'upload',
          sourceType: 'uploaded',
          purpose: body.purpose,
          generationStatus: 'complete',
          prompt: `Uploaded artwork: ${body.filename}`,
          imageUrl: artworkDataUrl,
          qualityTier: 'final',
          printPreparation: {
            status: 'prepared',
            provider: 'sharp',
            message: 'A transparent print PNG was prepared without generative changes.',
          },
          asset: {
            originalFilename: body.filename,
            mimeType: body.contentType,
            byteSize: 70,
            width: 1800,
            height: 1800,
            hasAlpha: true,
          },
          allowance: {
            sessionId: body.sessionId,
            studioPassStatus: 'not_required',
            freeDraftsRemaining: 3,
            roughDraftsRemaining: 0,
            editsRemaining: 0,
            finalsRemaining: 0,
            nextAction: 'continue_free',
            message: '3 drafts remaining.',
          },
          policy: { status: 'pass', reasons: ['Reproduction rights confirmed.'] },
          readiness:
            body.purpose === 'reference'
              ? {
                  status: 'needs_review',
                  checks: [
                    {
                      label: 'Reference only',
                      result: 'This image can guide a new design.',
                      severity: 'warning',
                    },
                  ],
                }
              : {
                  status: 'pass',
                  checks: [
                    {
                      label: 'Image resolution',
                      result: '1800 × 1800px is suitable for printing.',
                      severity: 'pass',
                    },
                  ],
                },
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });
  await context.route('**/api/design/drafts/from-references', async (route) => {
    const body = route.request().postDataJSON();
    assert.ok(body.referenceAssetIds.length >= 2, 'reference generation should submit every image');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'reference_generated_asset',
          sessionId: body.sessionId,
          provider: 'fixture',
          sourceType: 'reference_generated',
          purpose: 'print',
          parentAssetIds: body.referenceAssetIds,
          generationStatus: 'complete',
          prompt: body.prompt,
          imageUrl: artworkDataUrl,
          qualityTier: 'rough',
          allowance: {
            sessionId: body.sessionId,
            studioPassStatus: 'not_required',
            freeDraftsRemaining: 2,
            roughDraftsRemaining: 0,
            editsRemaining: 0,
            finalsRemaining: 0,
            nextAction: 'continue_free',
            message: '2 drafts remaining.',
          },
          policy: { status: 'pass', reasons: [] },
          readiness: {
            status: 'pass',
            checks: [{ label: 'Resolution', result: 'Ready.', severity: 'pass' }],
          },
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });
  await context.route('**/api/design/mockups', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: `mockup_${body.designAssetId}`,
          status: 'complete',
          provider: 'fixture',
          productId: body.productId,
          variantId: body.variantId,
          placementCodes: body.placementCodes,
          designAssetId: body.designAssetId,
          imageUrl: artworkDataUrl,
          views: [{ label: 'Product view', imageUrl: artworkDataUrl }],
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });
  await context.route('**/api/catalog/quotes', async (route) => {
    const body = route.request().postDataJSON();
    quoteBodies.push(body);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: `quote_${quoteBodies.length}`,
          subtotalCents: 3000,
          shippingCents: 500,
          taxCents: 0,
          totalCents: 3500,
          currency: 'USD',
          aiDesignFeeCents: body.items[0].designAssetId?.startsWith('uploaded_') ? 0 : 300,
          targetMarginCents: 1000,
          items: [
            {
              ...body.items[0],
              title: 'Heavyweight Cotton Tee',
              variantName: 'White · L',
              unitPriceCents: 3000,
              lineTotalCents: 3000,
              designFeeCents: body.items[0].designAssetId?.startsWith('uploaded_') ? 0 : 300,
            },
          ],
          costLines: [],
          expiresAt: new Date(Date.now() + 900_000).toISOString(),
        },
      }),
    });
  });

  const page = await context.newPage();
  const assertNoPageErrors = watchPageErrors(page, 'uploaded artwork and references');
  const chooseTeeAndContinue = async () => {
    await openProduct(page);
    await page.getByRole('button', { name: /Heavyweight Cotton Tee/ }).first().click();
    await page.getByRole('button', { name: 'White', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  };
  const sampleFile = {
    name: 'original-artwork.png',
    mimeType: 'image/png',
    buffer: artworkBuffer,
  };

  try {
    await chooseTeeAndContinue();
    await page.getByRole('button', { name: /Use my artwork/ }).click();
    const prepare = page.getByRole('button', { name: 'Prepare my artwork', exact: true });
    assert.equal(await prepare.isDisabled(), true, 'direct upload should require a file and rights');
    await page.locator('.upload-drop input[type=file]').setInputFiles(sampleFile);
    assert.equal(await prepare.isDisabled(), true, 'a selected file should still require rights');
    await page.getByRole('checkbox', { name: /permission to reproduce/i }).check();
    assert.equal(await prepare.isEnabled(), true, 'rights confirmation should unlock preparation');
    if (artifactDirectory) {
      await mkdir(artifactDirectory, { recursive: true });
      await page.screenshot({ path: join(artifactDirectory, 'upload-selection-desktop.png') });
    }
    await prepare.click();
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor({ timeout: 15_000 });
    await page.getByText('Print ready', { exact: true }).waitFor();
    assert.ok(
      quoteBodies.some((body) => body.items[0]?.designAssetId === 'uploaded_asset_1'),
      'the uploaded asset should reach quote creation'
    );
    if (artifactDirectory) {
      await mkdir(artifactDirectory, { recursive: true });
      await page.screenshot({ path: join(artifactDirectory, 'uploaded-artwork-desktop.png') });
    }

    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Step 1: Product/ }).click();
    await page.getByRole('button', { name: /Heavyweight Cotton Tee/ }).first().click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: /Use references/ }).click();
    const referenceInput = page.locator('.reference-add input[type=file]');
    assert.equal(await referenceInput.isDisabled(), true, 'reference input should require rights');
    await page.getByRole('checkbox', { name: /creative input/i }).check();
    await referenceInput.setInputFiles([
      sampleFile,
      { ...sampleFile, name: 'palette-reference.png' },
    ]);
    await page.locator('.reference-strip figure').filter({ visible: true }).first().waitFor();
    assert.equal(await page.locator('.reference-strip figure').count(), 2);
    await page.getByRole('textbox', { name: /What new design/ }).fill(
      'Use the warm palette and hand-drawn texture to make a new original fox mechanic badge.'
    );
    if (artifactDirectory) {
      await page.screenshot({ path: join(artifactDirectory, 'reference-selection-desktop.png') });
    }
    await page.getByRole('button', { name: 'Create from references', exact: true }).click();
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor({ timeout: 15_000 });
    assert.equal(
      await page.getByRole('button', { name: 'Remove reference' }).count(),
      0,
      'review should leave reference controls behind'
    );
    await assertNoHorizontalOverflow(page, '1440x900 uploaded artwork review');
    if (artifactDirectory) {
      await page.screenshot({ path: join(artifactDirectory, 'reference-generated-desktop.png') });
    }

    await page.evaluate(() => window.localStorage.clear());
    await page.setViewportSize({ width: 390, height: 844 });
    await chooseTeeAndContinue();
    await page.getByRole('button', { name: /Use my artwork/ }).click();
    await page.locator('.upload-drop input[type=file]').setInputFiles(sampleFile);
    await page.getByRole('checkbox', { name: /permission to reproduce/i }).check();
    await assertNoHorizontalOverflow(page, '390x844 upload selection');
    const mobilePrepare = page.getByRole('button', { name: 'Prepare my artwork', exact: true });
    const mobilePrepareBox = await mobilePrepare.boundingBox();
    assert.ok(mobilePrepareBox, 'mobile upload should expose the preparation action');
    assert.ok(
      mobilePrepareBox.y + mobilePrepareBox.height <= 836,
      `mobile upload action should clear browser chrome: ${JSON.stringify(mobilePrepareBox)}`
    );
    if (artifactDirectory) {
      await page.screenshot({ path: join(artifactDirectory, 'upload-selection-mobile.png') });
    }
    assertNoPageErrors();
  } finally {
    await context.close();
  }
}

async function exerciseGuestCartJourney(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const quoteBodies = [];
  await context.route('**/api/design/drafts', (route) => route.abort('failed'));
  await context.route('**/api/catalog/quotes', async (route) => {
    quoteBodies.push(route.request().postDataJSON());
    await route.abort('failed');
  });
  const page = await context.newPage();
  const makeProduct = async (productName, prompt) => {
    await page.getByRole('button', { name: productName }).first().click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('textbox', { name: /What should we make/ }).fill(prompt);
    await page.getByRole('button', { name: 'Generate my design', exact: true }).click();
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor({ timeout: 30_000 });
  };

  try {
    await openProduct(page);
    await makeProduct(
      /Heavyweight Cotton Tee/,
      'An original orange workshop badge with a bold ampersand and no other words'
    );
    await page.getByLabel('Quantity').selectOption('2');
    await page.getByRole('button', { name: /Add to cart/ }).click();
    await page.getByRole('heading', { name: 'Choose a product' }).waitFor();
    await page.getByLabel('2 items').waitFor();

    await page.getByRole('button', { name: 'Bags', exact: true }).click();
    await makeProduct(/Everyday Canvas Tote/, 'A simple original black linework fox and hen emblem');
    await page.getByRole('button', { name: /Add to cart/ }).click();
    await page.getByLabel('3 items').waitFor();
    await page.getByRole('button', { name: /Cart/ }).click();
    await page.getByRole('heading', { name: 'Your cart' }).waitFor();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.cart-line').length === 2 &&
        document.querySelector('.cart-total strong')?.textContent !== 'Updating…'
    );
    const combinedQuote = quoteBodies.findLast((body) => body.items.length === 2);
    assert.deepEqual(
      combinedQuote.items.map((item) => item.quantity),
      [2, 1],
      'the cart quote must submit both configured products and their quantities'
    );

    const updatedQuoteRequest = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === '/api/catalog/quotes' &&
        request.postDataJSON()?.items?.length === 2
    );
    await page.getByLabel('Quantity for Everyday Canvas Tote').selectOption('3');
    const updatedQuote = (await updatedQuoteRequest).postDataJSON();
    assert.deepEqual(updatedQuote.items.map((item) => item.quantity), [2, 3]);
    await page.getByLabel('5 items').waitFor();
    await assertNoHorizontalOverflow(page, '390x844 guest cart');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByLabel('5 items').waitFor();
    await page.getByRole('button', { name: /Cart/ }).click();
    assert.equal(await page.locator('.cart-line').count(), 2, 'guest cart should survive a reload');
    await page.waitForFunction(
      () => document.querySelector('.cart-total strong')?.textContent !== 'Updating…'
    );
    await page.getByRole('button', { name: 'Review cart and checkout' }).click();
    await page.getByRole('heading', { name: 'Review and checkout' }).waitFor();
    await page.getByRole('textbox', { name: 'Email for receipt' }).fill('cart.test@example.com');
    await page.getByRole('checkbox', { name: /I confirm that I am at least 18/ }).check();
    await page.getByRole('button', { name: 'Continue to secure checkout' }).click();
    await page.getByRole('heading', { name: 'Your order' }).waitFor();
    const orderItems = page.locator('.customer-order-items');
    await orderItems.getByText('Heavyweight Cotton Tee', { exact: true }).waitFor();
    await orderItems.getByText('Everyday Canvas Tote', { exact: true }).waitFor();
    const orderItemDetails = await orderItems.locator('span').allTextContents();
    assert.match(orderItemDetails[0] ?? '', /Qty 2$/);
    assert.match(orderItemDetails[1] ?? '', /Qty 3$/);
    await page.getByLabel('0 items').waitFor();

    const reorderQuoteRequest = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === '/api/catalog/quotes' &&
        request.postDataJSON()?.items?.length === 2
    );
    await page.getByRole('button', { name: 'Buy again', exact: true }).click();
    await page.getByRole('heading', { name: 'Your cart' }).waitFor();
    const reorderQuote = (await reorderQuoteRequest).postDataJSON();
    assert.deepEqual(
      reorderQuote.items.map((item) => item.quantity),
      [2, 3],
      'Buy again should create a fresh quote from the prior product choices'
    );
    await page.getByLabel('5 items').waitFor();
    assert.equal(await page.locator('.cart-line').count(), 2);
    await assertNoHorizontalOverflow(page, '390x844 buy again cart');
  } finally {
    await context.close();
  }
}

async function exerciseMiniStore(browser) {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport });
    await context.route('**/api/storefronts/**', (route) => route.abort('failed'));
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/stores/fox-and-hen/one-clear-system`, {
        waitUntil: 'networkidle',
      });
      await page.getByRole('heading', { name: 'One Clear System', level: 1 }).waitFor();
      await page.getByText('Web + Workflow Studio', { exact: true }).waitFor();
      assert.equal(await page.locator('.mini-store__products article').count(), 5);
      const brokenImages = await page.locator('.mini-store img').evaluateAll((images) =>
        images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src)
      );
      assert.deepEqual(brokenImages, [], 'published mini-store artwork must load without broken images');
      await assertNoHorizontalOverflow(page, `${viewport.width}x${viewport.height} mini-store`);
    } finally {
      await context.close();
    }
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
    await exercisePersistedGenerationFailure(browser);
    await exerciseConcisePromptJourney(browser);
    await exerciseCheckoutUrlCleanup(browser);
    await exerciseKeyboardAndReducedMotion(browser);
    await exerciseCheckoutReloadRecovery(browser);
    await exerciseLegacyRecoveryExpiry(browser);
    await exerciseUploadedArtworkAndReferences(browser);
    await exerciseGuestCartJourney(browser);
    await exerciseMiniStore(browser);
    await exercisePolicyPages(browser);
    process.stdout.write(
      'Responsive browser smoke passed across 11 viewports, five products, upload/reference artwork paths, the persisted generation-failure contract, recoverable fixture checkout, and Buy again cart reconstruction.\n'
    );
  } finally {
    await browser.close();
  }
} finally {
  if (server.exitCode === null) server.kill('SIGTERM');
}
