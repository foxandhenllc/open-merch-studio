import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const merchant = JSON.parse(readFileSync('config/merchant.config.json', 'utf8'));
const policy = JSON.parse(readFileSync(resolve('config', merchant.policies.contentFile), 'utf8'));
const reservation = createServer();
await new Promise((done) => reservation.listen(0, '127.0.0.1', done));
const port = reservation.address().port;
await new Promise((done) => reservation.close(done));
const origin = `http://127.0.0.1:${port}`;
// Vite's root must be the frontend; its binary is resolved independently of the working directory.
const preview = spawn(
  process.execPath,
  [
    resolve('node_modules/vite/bin/vite.js'),
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { cwd: resolve('frontend'), stdio: 'ignore', env: process.env }
);
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (preview.exitCode !== null) throw new Error('Policy preview exited before becoming ready.');
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Bounded startup polling. */
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  assert.ok(ready, 'policy preview is ready');
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    const checkoutRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // This contract cannot reach providers, analytics, or even a live local API.
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/checkout/sessions')
          checkoutRequests.push(route.request().postDataJSON());
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Isolated fixture rehearsal' }),
        });
      }
      return route.continue();
    });
    for (const [path, document] of Object.entries(policy.pages)) {
      // Vite preview serves directory indexes; Vercel rewrites the canonical extensionless route.
      await page.goto(origin + path + '/');
      await page.getByRole('heading', { name: document.title, exact: true }).waitFor();
      assert.deepEqual(
        await page.locator('.policy-content article h2').allTextContents(),
        document.sections.map((section) => section.heading)
      );
      assert.deepEqual(
        await page.locator('.policy-content article p').allTextContents(),
        document.sections.map((section) => section.body)
      );
      assert.match(
        await page.locator('.policy-version').innerText(),
        new RegExp(merchant.policies.approvedVersion)
      );
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute('href'),
        merchant.web.canonicalUrl + path
      );
      assert.equal(await page.title(), `${document.title} | ${merchant.brand.displayName}`);
      assert.equal(
        await page.getByRole('link', { name: 'Source on GitHub' }).getAttribute('href'),
        merchant.attribution.sourceUrl
      );
      assert.equal(
        await page.getByRole('link', { name: 'MIT license' }).getAttribute('href'),
        `${merchant.attribution.sourceUrl}/blob/main/LICENSE`
      );
      if (policy.purpose === 'fixture-only')
        assert.doesNotMatch(await page.locator('main').innerText(), /Fox&Hen, LLC/);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `${path} ${viewport.width} overflow`
      );
    }
    assert.equal(
      await page
        .getByRole('link', { name: merchant.operator.supportEmail, exact: true })
        .getAttribute('href'),
      `mailto:${merchant.operator.supportEmail}`
    );
    if (process.env.OMS_POLICY_ARTIFACT_DIR) {
      mkdirSync(process.env.OMS_POLICY_ARTIFACT_DIR, { recursive: true });
      await page.screenshot({
        path: resolve(process.env.OMS_POLICY_ARTIFACT_DIR, `support-${viewport.width}.png`),
        fullPage: true,
      });
    }
    await page.goto(origin);
    await page.getByRole('heading', { name: 'Choose a product' }).waitFor();
    assert.match(await page.locator('body').innerText(), new RegExp(merchant.brand.displayName));
    await page
      .getByRole('button', { name: /Heavyweight Cotton Tee/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page
      .getByRole('textbox', { name: /What should we make/ })
      .fill('An original geometric community garden badge');
    await page.waitForFunction(() =>
      localStorage
        .getItem('open-merch-studio:guest-workbench:v1')
        ?.includes('An original geometric community garden badge')
    );
    await page.reload();
    const restoredPrompt = page.getByRole('textbox', { name: /What should we make/ });
    await restoredPrompt.waitFor();
    assert.equal(await restoredPrompt.inputValue(), 'An original geometric community garden badge');
    await page.getByRole('button', { name: 'Generate my design', exact: true }).click();
    await page.getByRole('heading', { name: 'Your design is ready' }).waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Review and checkout', exact: true }).click();
    await page.getByText('See price details', { exact: true }).click();
    await page.getByText(merchant.pricing.marginLabel, { exact: true }).waitFor();
    await page.getByRole('textbox', { name: /Email/ }).fill('fixture@example.org');
    const assent = page.getByRole('checkbox', { name: /I confirm that I am at least 18/ });
    assert.equal(await assent.isChecked(), false);
    for (const [name, path] of [
      ['Terms of Use', merchant.policies.termsPath],
      ['Privacy Policy', merchant.policies.privacyPath],
      ['Returns and Refunds Policy', merchant.policies.returnsPath],
      ['Content Policy', merchant.policies.contentPolicyPath],
    ]) {
      assert.equal(
        await page
          .locator('.checkout-assent')
          .getByRole('link', { name, exact: true })
          .getAttribute('href'),
        path
      );
    }
    await assent.check();
    await page.getByRole('button', { name: 'Continue to secure checkout', exact: true }).click();
    await page
      .getByRole('heading', { name: new RegExp(`${merchant.orders.prefix}-\\d{4}-FIXTURE`) })
      .waitFor();
    assert.equal(checkoutRequests.length, 1);
    assert.equal(checkoutRequests[0].policyAccepted, true);
    assert.equal(checkoutRequests[0].policyVersion, merchant.policies.approvedVersion);
    await page.getByText('Simulated order.', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    `Policy/profile browser contract passed for ${merchant.brand.displayName}: exact text, mobile/desktop, metadata, attribution, support, persistence, pricing, order prefix, and checkout payload.`
  );
} finally {
  await browser?.close();
  preview.kill();
}
