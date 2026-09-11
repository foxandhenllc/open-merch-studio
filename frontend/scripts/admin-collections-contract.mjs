import assert from 'node:assert/strict';
import path from 'node:path';
import { verifyCollectionPublication } from './admin-publications-contract.mjs';
import { attachArtistArtwork, verifySavedArtwork } from './admin-artwork-contract.mjs';

export async function verifyCollectionEditor({ page, context, origin, viewport, output, signIn }) {
  const nav = () =>
    page
      .getByRole('navigation', { name: 'Store administration' })
      .getByRole('button', { name: /Collections$/ });
  const payloads = [];
  const capture = (request) => {
    if (new URL(request.url()).pathname === '/api/admin/collections' && request.method() === 'PUT')
      payloads.push(request.postDataJSON());
  };
  page.on('request', capture);
  await nav().click();
  await page.getByRole('heading', { name: 'Collection drafts', exact: true }).waitFor();
  await page.getByRole('button', { name: '+ New collection', exact: true }).click();
  const name = `Gallery weekend ${viewport.width}`;
  await page.getByLabel('Collection name', { exact: true }).fill(name);
  await page.getByLabel('Collection purpose').selectOption('event');
  await page.getByLabel(/^Description/).fill('Original artwork for our community.');
  await page.getByRole('button', { name: '+ Add product', exact: true }).click();
  const first = page.getByRole('region', { name: 'Product 1', exact: true });
  await first.getByLabel('Product name', { exact: true }).fill('Artist edition tee');
  await first.getByLabel('Target price').fill('29.95');
  assert.equal(await first.getByLabel('Planned customer options').inputValue(), 'fixed');
  await page.getByLabel('Collection purpose').selectOption('drop');
  assert.equal(
    await first.getByLabel('Planned customer options').inputValue(),
    'fixed',
    'Purpose guidance must not silently enable AI'
  );
  await page.getByLabel('Collection purpose').selectOption('event');
  const artwork = await attachArtistArtwork({ page, product: first, viewport });
  await page.getByRole('button', { name: '+ Add product', exact: true }).click();
  const second = page.getByRole('region', { name: 'Product 2', exact: true });
  await second.getByLabel('Product name', { exact: true }).fill('Community print');
  await second.getByLabel('Planned customer options').selectOption('upload');
  await second.getByRole('button', { name: 'Move product 2 up' }).click();
  assert.equal(
    await first.getByLabel('Product name', { exact: true }).inputValue(),
    'Community print'
  );
  // Section navigation retains unsaved drafts instead of remounting the editor.
  await page
    .getByRole('navigation', { name: 'Store administration' })
    .getByRole('button', { name: /Overview$/ })
    .click();
  await nav().click();
  assert.equal(await page.getByLabel('Collection name', { exact: true }).inputValue(), name);
  await page.getByRole('button', { name: 'Preview draft', exact: true }).click();
  const preview = page.getByRole('region', { name: 'Draft text preview' });
  await preview.getByRole('heading', { name, exact: true }).waitFor();
  assert.match(await preview.innerText(), /Target \$29\.95/);
  await page.getByRole('button', { name: 'Save drafts', exact: true }).click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Drafts saved for this local server session' })
    .waitFor();
  const sent = payloads.at(-1);
  const collection = sent.collections.find((item) => item.title === name);
  assert.equal(collection.purpose, 'event');
  assert.equal(collection.items[0].artworkMode, 'upload');
  assert.equal(collection.items[1].artworkMode, 'fixed');
  assert.equal(collection.items[1].targetPriceCents, 2995);
  assert.deepEqual(collection.items[1].artwork, [
    { placementCode: 'front', assetId: artwork.ids[0] },
    { placementCode: 'back', assetId: artwork.ids[1] },
  ]);
  assert.deepEqual(Object.keys(sent).sort(), ['collections', 'revision']);
  if (output)
    await page.screenshot({
      path: path.join(output, `collections-${viewport.width}.png`),
      fullPage: true,
    });
  await page.reload({ waitUntil: 'networkidle' });
  await signIn(page);
  await nav().click();
  await page
    .getByRole('complementary', { name: 'Collection drafts' })
    .getByRole('button')
    .filter({ hasText: name })
    .click();
  assert.equal(await page.getByLabel('Collection name', { exact: true }).inputValue(), name);
  assert.equal(await second.getByLabel('Target price').inputValue(), '29.95');
  await verifySavedArtwork({ page, product: second, artwork, viewport, output });
  // A second authenticated tab saves a newer revision; the first tab must retain its rejected local edits.
  const other = await context.newPage();
  await other.goto(`${origin}/admin/`, { waitUntil: 'networkidle' });
  await signIn(other);
  await other
    .getByRole('navigation', { name: 'Store administration' })
    .getByRole('button', { name: /Collections$/ })
    .click();
  await other
    .getByRole('complementary', { name: 'Collection drafts' })
    .getByRole('button')
    .filter({ hasText: name })
    .click();
  await other.getByLabel('Collection name', { exact: true }).fill(`${name} revised`);
  await other.getByRole('button', { name: 'Save drafts', exact: true }).click();
  await other.getByRole('status').filter({ hasText: 'Drafts saved' }).waitFor();
  await other.close();
  await page.getByLabel(/^Description/).fill('Unsaved local work');
  await page.getByRole('button', { name: 'Save drafts', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'changed in another session' }).waitFor();
  assert.equal(await page.getByLabel(/^Description/).inputValue(), 'Unsaved local work');
  await page.getByRole('button', { name: 'Reload saved drafts', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  assert.equal(await page.getByLabel(/^Description/).inputValue(), 'Unsaved local work');
  await page.getByRole('button', { name: 'Reload saved drafts', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes and reload', exact: true }).click();
  await page.waitForFunction(
    (expected) => document.querySelector('.collection-editor input')?.value === expected,
    `${name} revised`
  );
  assert.equal(
    await page.getByLabel(/^Description/).inputValue(),
    'Original artwork for our community.'
  );
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(layout.scroll <= layout.width + 1, 'Collection editor overflows horizontally');
  await verifyCollectionPublication({ page, context, origin, viewport, output });
  page.off('request', capture);
}
