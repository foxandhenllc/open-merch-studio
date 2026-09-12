import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export async function verifyPrintLayouts({ page, panel, publication, viewport, output }) {
  const region = panel.getByRole('region', {
    name: `Print layouts for ${publication.title}`,
    exact: true,
  });
  await region.getByRole('button', { name: 'Prepare print layouts', exact: true }).click();
  await region.getByLabel('Template width (inches)', { exact: true }).fill('8');
  await region.getByLabel('Template height (inches)', { exact: true }).fill('10');
  await region.getByLabel('Distance from left (inches)', { exact: true }).fill('3');
  await region.getByLabel('Distance from top (inches)', { exact: true }).fill('1');
  await region.getByRole('checkbox').check();
  await region.getByRole('button', { name: 'Save print layout', exact: true }).click();
  await region.getByRole('alert').filter({ hasText: 'inside the template' }).waitFor();
  await region.getByLabel('Distance from left (inches)', { exact: true }).fill('1');
  assert.equal(await region.getByRole('checkbox').isChecked(), false);
  await region.getByRole('checkbox').check();
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith('/print-layouts') && response.request().method() === 'PUT'
  );
  await region.getByRole('button', { name: 'Save print layout', exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const body = response.request().postDataJSON();
  assert.equal(body.version, publication.version);
  assert.equal(body.revision, 0);
  assert.equal(body.templateConfirmed, true);
  assert.deepEqual(
    [
      body.layouts[0].templateWidthInches,
      body.layouts[0].templateHeightInches,
      body.layouts[0].leftInches,
      body.layouts[0].topInches,
    ],
    [8, 10, 1, 1]
  );
  await region.getByRole('status').filter({ hasText: 'Print layout saved' }).waitFor();
  await region.getByRole('button', { name: 'Reopen saved print layouts', exact: true }).click();
  assert.equal(
    await region.getByLabel('Template width (inches)', { exact: true }).inputValue(),
    '8'
  );
  assert.equal(
    await region.getByLabel('Distance from left (inches)', { exact: true }).inputValue(),
    '1'
  );
  await region.getByRole('button', { name: 'Preview saved canvas', exact: true }).click();
  const canvas = region.getByRole('img', { name: /Template canvas/ });
  await canvas.waitFor();
  await canvas.evaluate((image) => image.decode());
  assert.ok((await canvas.getAttribute('src')).startsWith('blob:'));
  const downloadPromise = page.waitForEvent('download');
  await region.getByRole('button', { name: 'Download prepared PNG', exact: true }).click();
  const download = await downloadPromise;
  const bytes = await readFile(await download.path());
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 2400);
  assert.equal(metadata.height, 3000);
  assert.equal(metadata.density, 300);
  const privateUrl = `/api/admin/collection-publications/${publication.id}/print-layouts/${body.layouts[0].itemId}/${body.layouts[0].placementCode}/export?version=${publication.version}&revision=1`;
  assert.equal((await page.request.get(privateUrl)).status(), 401);
  if (output)
    await region.screenshot({ path: path.join(output, `print-layout-${viewport.width}.png`) });
  await region.getByLabel('Distance from top (inches)', { exact: true }).fill('2');
  assert.equal(
    await region.getByRole('button', { name: 'Download prepared PNG' }).isDisabled(),
    true
  );
  assert.equal(await region.getByRole('img', { name: /Template canvas/ }).count(), 0);
  await region.getByRole('button', { name: 'Reopen saved print layouts', exact: true }).click();
  // Saving only the front must not report the whole product prepared.
  const check = panel.getByRole('button', { name: 'Check sales readiness', exact: true });
  await check.click();
  await panel.getByText('Saved print layouts · Owner action', { exact: true }).waitFor();
  await panel.getByText(/back: save and confirm a print layout/).waitFor();
  await region
    .getByRole('combobox')
    .selectOption(`${body.layouts[0].itemId}:back`);
  await region.getByLabel('Template width (inches)', { exact: true }).fill('8');
  await region.getByLabel('Template height (inches)', { exact: true }).fill('10');
  await region.getByLabel('Distance from left (inches)', { exact: true }).fill('1');
  await region.getByLabel('Distance from top (inches)', { exact: true }).fill('1');
  await region.getByRole('checkbox').check();
  await region.getByRole('button', { name: 'Save print layout', exact: true }).click();
  await region.getByRole('status').filter({ hasText: 'Print layout saved' }).waitFor();
  await check.click();
  await panel.getByText('Saved print layouts · Checked', { exact: true }).waitFor();
  await panel.getByText('Collection checkout · Owner action', { exact: true }).waitFor();
  if (output)
    await panel
      .locator('.collection-sales-readiness')
      .screenshot({ path: path.join(output, `complete-layout-readiness-${viewport.width}.png`) });
}
