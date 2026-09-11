import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { chromium } from 'playwright';
import { verifyProfileEditor } from './admin-profile-contract.mjs';
import { verifyCollectionEditor } from './admin-collections-contract.mjs';

// Explicit fixtures only. Never inherit a deployment, provider, or database credential.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: '',
  OPENAI_API_KEY: '',
  OPENAI_PROJECT_ID: '',
  OPENAI_ORG_ID: '',
  STRIPE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  PRINTFUL_API_KEY: '',
  PRINTFUL_STORE_ID: '',
  PRINTFUL_WEBHOOK_PUBLIC_KEY: '',
  PRINTFUL_WEBHOOK_SECRET: '',
  REMOVE_BG_API_KEY: '',
  SUPABASE_URL: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  RESEND_API_KEY: '',
  RESEND_WEBHOOK_SECRET: '',
  ENABLE_LIVE_OPENAI: 'false',
  ENABLE_LIVE_STRIPE: 'false',
  ENABLE_LIVE_PRINTFUL: 'false',
  ALLOW_LIVE_PAYMENTS: 'false',
  ALLOW_LIVE_FULFILLMENT: 'false',
  CHECKOUT_ACCESS_MODE: 'closed',
  CHECKOUT_ENABLED: 'false',
  FULFILLMENT_ENABLED: 'false',
  PRINTFUL_AUTO_CONFIRM_ORDERS: 'false',
  TRANSACTIONAL_EMAILS_ENABLED: 'false',
  ADMIN_ACCESS_CODE: 'fixture-admin-browser',
  VERCEL_ENV: 'production',
  VERCEL_PROJECT_ID: 'prj_fixture',
  OMS_SETUP_VERCEL_TOKEN: 'fixture-hosting-token',
  OMS_SETUP_VERCEL_PROJECT_ID: 'prj_fixture',
  OMS_SETUP_VERCEL_TEAM_ID: 'team_fixture',
  OMS_CONNECTIONS_REVISION: '',
  OMS_SETUP_DEPLOY_HOOK_URL:
    'https://api.vercel.com/v1/integrations/deploy/prj_fixture/fixtureHook',
});
const realFetch = globalThis.fetch;
let savedVariables = [];
let failHostingSave = false;
let deployRequests = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  assert.equal(
    url.origin,
    'https://api.vercel.com',
    'Unexpected external request in fixture suite'
  );
  if (url.pathname.startsWith('/v9/projects/'))
    return Response.json({ id: 'prj_fixture', accountId: 'team_fixture' });
  if (url.pathname.startsWith('/v1/integrations/deploy/')) {
    deployRequests += 1;
    return Response.json({ job: { id: 'fixture-job', state: 'PENDING' } });
  }
  assert.equal(url.searchParams.get('teamId'), 'team_fixture');
  if (init?.method === 'POST') {
    if (failHostingSave) return new Response('fixture private upstream error', { status: 403 });
    savedVariables = JSON.parse(String(init.body));
    return Response.json({ created: savedVariables, failed: [] });
  }
  return Response.json({ envs: savedVariables });
};
const { createApp } = await import('../../backend/dist/app.js');
const { setOperationalSink } = await import('../../backend/dist/utils/operational-logger.js');
setOperationalSink(() => undefined);
const api = createApp();
const staticApp = express();
const deployment = JSON.parse(
  await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')
);
const contentPolicy = deployment.headers
  .flatMap((entry) => entry.headers)
  .find((header) => header.key === 'Content-Security-Policy').value;
staticApp.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', contentPolicy);
  next();
});
const dist = fileURLToPath(new URL('../dist', import.meta.url));
staticApp.use(express.static(dist));
staticApp.get('/collections/:id', (_req, res) =>
  res.sendFile(path.join(dist, 'collections/index.html'))
);
const server = createServer((req, res) =>
  req.url.startsWith('/api/') ? api(req, res) : staticApp(req, res)
);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const output = process.env.OMS_ADMIN_ARTIFACT_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function signIn(page) {
  await page.getByLabel('Admin access code').fill('fixture-admin-browser');
  await page.getByRole('button', { name: 'Open store admin' }).click();
  await page.getByRole('heading', { name: 'Store overview', exact: true }).waitFor();
}
async function assertLayout(page) {
  const { width, scrollWidth } = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(scrollWidth <= width + 1, `Admin overflow: ${scrollWidth} > ${width}`);
}

try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, baseURL: origin });
    context.setDefaultTimeout(15000);
    const page = await context.newPage();
    const errors = [];
    const payloads = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      const url = new URL(request.url());
      assert.ok(!request.url().includes('fixture-admin-browser'));
      assert.ok(!request.url().includes('fixture-new-openai-key'));
      if (url.pathname === '/api/admin/store-settings' && request.method() === 'PATCH')
        payloads.push(request.postDataJSON());
      assert.ok(!/vercel-insights|\/insights|\/speed-insights/.test(url.pathname + url.hostname));
    });
    await page.goto(`${origin}/admin/`, { waitUntil: 'networkidle' });
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
    await page.getByLabel('Admin access code').fill('incorrect-fixture-code');
    await page.getByRole('button', { name: 'Open store admin' }).click();
    await page.getByRole('alert').filter({ hasText: 'Admin access is required.' }).waitFor();
    await signIn(page);
    await assertLayout(page);
    if (output)
      await page.screenshot({
        path: path.join(output, `overview-${viewport.width}.png`),
        fullPage: true,
      });
    await page
      .getByRole('navigation', { name: 'Store administration' })
      .getByRole('button', { name: /Artwork & limits$/ })
      .click();
    const target = viewport.width === 1440 ? '2.5 Sunburst' : '2.5 Flare';
    await page.getByRole('button', { name: `Use ${target}`, exact: true }).click();
    await page.getByRole('status').waitFor();
    assert.equal(
      payloads.at(-1).values.imageModel,
      target.includes('Sunburst') ? 'gpt-image-2.5-sunburst' : 'gpt-image-2.5-flare'
    );
    await page.getByLabel('Daily budget (USD)').fill('20');
    await page.getByLabel('Budget per session (USD)').fill('3');
    await page.getByLabel('Free drafts for new visitors').fill('5');
    await page.getByRole('button', { name: 'Save limits' }).click();
    await page.getByRole('status').waitFor();
    assert.deepEqual(payloads.at(-1).values, {
      dailyAiBudgetCents: 2000,
      perSessionBudgetCents: 300,
      freeDraftLimit: 5,
    });
    await assertLayout(page);
    await page.locator('button:enabled').filter({ hasText: 'Save limits' }).waitFor();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    if (output)
      await page.screenshot({
        path: path.join(output, `artwork-${viewport.width}.png`),
        fullPage: true,
      });
    await page.reload({ waitUntil: 'networkidle' });
    await signIn(page);
    await page
      .getByRole('navigation', { name: 'Store administration' })
      .getByRole('button', { name: /Artwork & limits$/ })
      .click();
    await page
      .getByRole('article')
      .filter({ hasText: `GPT Image ${target}` })
      .getByRole('button', { name: 'Selected' })
      .waitFor();
    assert.equal(await page.getByLabel('Daily budget (USD)').inputValue(), '20.00');
    await page
      .getByRole('navigation', { name: 'Store administration' })
      .getByRole('button', { name: /Connections$/ })
      .click();
    await page.getByRole('button', { name: /^OpenAI/ }).click();
    await page.getByLabel('API key', { exact: false }).fill('fixture-new-openai-key');
    await page.getByRole('button', { name: 'Save OpenAI settings' }).click();
    await page.getByRole('status').filter({ hasText: 'saved to production hosting' }).waitFor();
    assert.equal(savedVariables.find((item) => item.key === 'OPENAI_API_KEY').type, 'sensitive');
    assert.equal(
      savedVariables.find((item) => item.key === 'OPENAI_API_KEY').value,
      'fixture-new-openai-key'
    );
    assert.equal(await page.getByLabel('API key', { exact: false }).inputValue(), '');
    await page.getByRole('button', { name: 'Refresh status' }).click();
    await page.getByText('Deployment changes are waiting').waitFor();
    assert.equal(await page.getByLabel('API key', { exact: false }).inputValue(), '');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    if (output)
      await page.screenshot({
        path: path.join(output, `connections-${viewport.width}.png`),
        fullPage: true,
      });
    failHostingSave = true;
    await page.getByLabel('API key', { exact: false }).fill('fixture-rejected-key');
    await page.getByRole('button', { name: 'Save OpenAI settings' }).click();
    await page.getByRole('alert').filter({ hasText: 'Vercel could not complete' }).waitFor();
    assert.ok(!(await page.locator('body').innerText()).includes('fixture private upstream error'));
    failHostingSave = false;
    await page.getByRole('button', { name: 'Redeploy with saved values' }).click();
    await page.getByRole('status').filter({ hasText: 'Deployment requested' }).waitFor();
    assert.ok(deployRequests > 0);
    await verifyProfileEditor({
      page,
      origin,
      viewport,
      output,
      signIn,
      savedVariables: () => savedVariables,
    });
    await verifyCollectionEditor({ page, context, origin, viewport, output, signIn });
    const stored = await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })
    );
    assert.ok(!stored.includes('fixture-'));
    await assertLayout(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByLabel('Admin access code').waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Admin browser contracts passed at ${viewport.width}px.`);
  }
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = realFetch;
  setOperationalSink();
}
