import assert from 'node:assert/strict';
import path from 'node:path';

export async function verifyProfileEditor({
  page,
  origin,
  viewport,
  output,
  signIn,
  savedVariables,
}) {
  const name = `Community Merch ${viewport.width}`;
  const editor = page.locator('.profile-editor');
  await page.getByRole('navigation', { name: 'Store administration' }).getByRole('button', { name: /Overview$/ }).click();
  await page.getByRole('button', { name: /Make it your store/ }).click();
  await page.getByLabel('Store name', { exact: true }).fill(name);
  await page.getByLabel('Store initials').fill('CM');
  await page.getByLabel('Accent color').fill('#315542');
  await page.getByLabel('Support email', { exact: true }).fill('help@example.org');
  await page
    .getByLabel('Short description', { exact: true })
    .fill('Original designs for our community.');
  await page.getByLabel('Search title', { exact: true }).fill(name);
  await page
    .getByLabel('Search description', { exact: true })
    .fill('Create original merch for the community.');
  await page.getByLabel('Legal business name', { exact: true }).fill('Example Fixtures LLC');
  await page
    .getByLabel('Operator disclosure', { exact: true })
    .fill('A synthetic operator used only for local tests.');
  await page.getByLabel('Email sender name', { exact: true }).fill(name);
  await page.getByLabel('Order number prefix', { exact: true }).fill('CM');
  await page.getByLabel('Margin label', { exact: true }).fill('Community store margin');
  assert.equal(await page.locator('.profile-preview-brand strong').textContent(), name);
  if (viewport.width < 800) {
    await page.getByRole('button', { name: 'Preview storefront identity', exact: true }).click();
    assert.ok(await page.locator('.profile-preview-brand strong').isVisible());
    await page.getByRole('button', { name: 'Hide preview', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await editor.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
  // Navigate away and back with an unsaved edit: the editor keeps it without changing live state.
  await page.getByLabel('Store name', { exact: true }).fill(name + ' draft');
  await page.getByRole('button', { name: /01Overview|01 Overview/ }).click();
  await page.getByRole('navigation', { name: 'Store administration' }).getByRole('button', { name: /Store profile$/ }).click();
  assert.equal(await page.getByLabel('Store name', { exact: true }).inputValue(), name + ' draft');
  await page.getByLabel('Store name', { exact: true }).fill(name);
  await page.reload({ waitUntil: 'networkidle' });
  await signIn(page);
  await page.getByRole('navigation', { name: 'Store administration' }).getByRole('button', { name: /Store profile$/ }).click();
  assert.equal(await page.getByLabel('Store name', { exact: true }).inputValue(), name);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.mouse.move(0, 0);
  if (output) {
    await page.screenshot({
      path: path.join(output, `profile-${viewport.width}.png`),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(output, `profile-${viewport.width}-full.png`),
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Policy pages', exact: true }).click();
  await page.getByLabel('Page to edit').selectOption('/privacy');
  await page
    .getByLabel('Page summary', { exact: true })
    .fill('Synthetic policy text for a local browser test.');
  await page
    .getByLabel('Policy version', { exact: true })
    .fill(`fixture-browser-${viewport.width}`);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await editor.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
  await page.getByRole('button', { name: 'Review & publish', exact: true }).click();
  const publish = page.getByRole('button', { name: 'Publish saved profile', exact: true });
  assert.ok(await publish.isDisabled());
  await page.getByRole('checkbox', { name: /I reviewed all five pages/ }).check();
  await publish.click();
  await editor.getByRole('status').filter({ hasText: 'Profile saved to hosting' }).waitFor();
  const profile = savedVariables().find((item) => item.key === 'OMS_MERCHANT_PROFILE');
  assert.deepEqual(profile.target, ['production']);
  assert.equal(profile.type, 'encrypted');
  const published = JSON.parse(profile.value);
  assert.equal(published.config.brand.displayName, name);
  assert.equal(published.config.operator.supportEmail, 'help@example.org');
  assert.equal(published.policy.approvedVersion, `fixture-browser-${viewport.width}`);
  assert.equal(
    published.policy.pages['/privacy'].summary,
    'Synthetic policy text for a local browser test.'
  );
  assert.ok(!(await page.getByRole('checkbox', { name: /I reviewed all five pages/ }).isChecked()));
  // A successful hosting write is not activation. The current storefront retains its built identity.
  const storefront = await page.context().newPage();
  await storefront.goto(origin, { waitUntil: 'networkidle' });
  await storefront.locator('.brand b').waitFor();
  assert.notEqual(await storefront.locator('.brand b').textContent(), name);
  await storefront.close();
  await page.getByRole('button', { name: 'Brand & details', exact: true }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}
