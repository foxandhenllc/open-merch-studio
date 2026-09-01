import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const cases = [
  {
    name: 'oms-collection',
    url: 'https://openmerchstudio.com/examples/fox-and-hen',
    heading: 'One clear system,',
  },
  {
    name: 'foxhen-merch',
    url: 'https://foxandhenllc.com/merch',
    heading: 'One clear system,',
  },
  {
    name: 'foxhen-service',
    url: 'https://foxandhenllc.com/services/merch-studio',
    heading: 'Launch a merch studio',
  },
];

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
];

const artifactDirectory = process.env.OMS_BROWSER_ARTIFACT_DIR || '/tmp';
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const testCase of cases) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto(testCase.url, { waitUntil: 'networkidle' });
      const matchedHeading = await page
        .getByText(testCase.heading, { exact: false })
        .first()
        .textContent();
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(250);
      const metrics = await page.evaluate(() => ({
        overflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        brokenImages: [...document.images]
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.src),
        imageCount: document.images.length,
      }));

      assert.ok(matchedHeading, `${testCase.name} should render its primary heading`);
      assert.ok(
        metrics.overflow <= 1,
        `${testCase.name} ${viewport.label} should not overflow horizontally`
      );
      assert.deepEqual(
        metrics.brokenImages,
        [],
        `${testCase.name} ${viewport.label} should not contain broken images`
      );
      assert.deepEqual(
        errors,
        [],
        `${testCase.name} ${viewport.label} should not emit page errors`
      );

      const screenshotPath = `${artifactDirectory}/${testCase.name}-${viewport.label}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.push({
        name: testCase.name,
        viewport: viewport.label,
        title: await page.title(),
        heading: matchedHeading.trim(),
        imageCount: metrics.imageCount,
        screenshotPath,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(`${JSON.stringify({ status: 'passed', results }, null, 2)}\n`);
