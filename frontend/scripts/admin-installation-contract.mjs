import assert from 'node:assert/strict';
import path from 'node:path';

export async function verifyInstallationGuide({ page, viewport, output, signIn }) {
  const open = () =>
    page
      .getByRole('navigation', { name: 'Store administration' })
      .getByRole('button', { name: /Installation$/ })
      .click();
  await open();
  await page.getByRole('combobox', { name: 'What are you building?' }).selectOption('artist');
  await page.getByRole('status').filter({ hasText: 'Setup progress saved' }).waitFor();
  const task = page.getByRole('checkbox', { name: 'Prepare your first collection', exact: true });
  await task.check();
  await page.getByRole('status').filter({ hasText: 'Setup progress saved' }).waitFor();
  const failedTask = page.getByRole('checkbox', {
    name: 'Choose who operates the store',
    exact: true,
  });
  await page.route('**/api/admin/installation-progress', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Fixture setup save interrupted' }),
      });
    } else await route.continue();
  });
  await failedTask.click();
  await page.getByRole('alert').filter({ hasText: 'Fixture setup save interrupted' }).waitFor();
  assert.equal(
    await failedTask.isChecked(),
    false,
    'Failed persistence must restore the saved task state'
  );
  await page.unroute('**/api/admin/installation-progress');
  await page.getByRole('button', { name: 'Run installation checks', exact: true }).click();
  const checks = page.getByRole('region', { name: 'Installation checks' });
  await checks.getByText('Local simulation', { exact: true }).first().waitFor();
  assert.ok(
    (await checks.getByText('Values present', { exact: true }).count()) === 0 ||
      (await checks.getByText(/Account access, event delivery/).count()) > 0
  );
  assert.ok(await checks.getByText(/Automatic production confirmation is disabled/).isVisible());
  await page.reload({ waitUntil: 'networkidle' });
  await signIn(page);
  await open();
  assert.equal(
    await page.getByRole('combobox', { name: 'What are you building?' }).inputValue(),
    'artist'
  );
  assert.ok(
    await page
      .getByRole('checkbox', { name: 'Prepare your first collection', exact: true })
      .isChecked()
  );
  await page.getByRole('button', { name: 'Run installation checks', exact: true }).click();
  await page
    .getByRole('region', { name: 'Installation checks' })
    .getByText('Local simulation', { exact: true })
    .first()
    .waitFor();
  if (output) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({
      path: path.join(output, `installation-${viewport.width}.png`),
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Open collections →', exact: true }).click();
  await page.getByRole('heading', { name: 'Collections', exact: true }).waitFor();
}
