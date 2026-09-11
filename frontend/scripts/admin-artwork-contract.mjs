import assert from 'node:assert/strict';
import path from 'node:path';
import sharp from 'sharp';

const headers = { 'x-admin-access': 'fixture-admin-browser' };
const slot = (product, area) =>
  product.getByRole('region', { name: `${area} print artwork`, exact: true });
async function imageLoaded(region, name) {
  const image = region.getByRole('img', { name: `Private artwork: ${name}`, exact: true });
  await image.waitFor();
  await image.evaluate((element) => element.decode());
  assert.match(
    await image.getAttribute('src'),
    /^blob:/,
    'Private previews must use authenticated bytes'
  );
}

export async function attachArtistArtwork({ page, product, viewport }) {
  const files = await Promise.all(
    ['#df753c', '#698777'].map((color, index) =>
      sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1400"><rect width="1200" height="1400" fill="#eee7d8"/><circle cx="600" cy="490" r="330" fill="${color}"/><path d="M130 1120L430 540L710 1030L930 700L1080 1120Z" fill="#263e36"/><text x="600" y="1270" text-anchor="middle" font-family="sans-serif" font-size="44" fill="#263e36">GALLERY STUDY ${index + 1}</text></svg>`
        )
      )
        .png()
        .toBuffer()
    )
  );
  const names = [`gallery-front-${viewport.width}.png`, `gallery-back-${viewport.width}.png`];
  const authorizationIds = [];
  const completionIds = [];
  const capture = async (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === '/api/admin/collection-artwork/authorize' && response.ok())
      authorizationIds.push((await response.json()).data.assetId);
    if (pathname.endsWith('/complete')) completionIds.push(pathname.split('/').at(-2));
  };
  page.on('response', capture);
  // Exercise direct upload without a provider: the browser sees a signed transport, and this
  // local adapter feeds the captured bytes to the real fixture preparation endpoint.
  let signedId;
  let uploadedBytes;
  let signedUploads = 0;
  const authorizeSigned = async (route) => {
    const response = await route.fetch();
    const envelope = await response.json();
    if (route.request().postDataJSON().filename === names[1]) {
      signedId = envelope.data.assetId;
      envelope.data.transport = 'signed';
      envelope.data.signedUrl = `https://owner-artwork-fixture.supabase.co/fixture-private-upload/${signedId}`;
    }
    await route.fulfill({ response, json: envelope });
  };
  const acceptLostUpload = async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': new URL(page.url()).origin,
          'Access-Control-Allow-Methods': 'PUT',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
      return;
    }
    signedUploads += 1;
    assert.equal(route.request().method(), 'PUT');
    assert.equal(
      route.request().headers()['x-admin-access'],
      undefined,
      'Never send the admin credential to signed storage'
    );
    uploadedBytes = route.request().postDataBuffer();
    assert.deepEqual(uploadedBytes, files[1]);
    await route.abort('failed'); // The file arrived but its response was lost.
  };
  await page.route('**/api/admin/collection-artwork/authorize', authorizeSigned);
  await page.route('**/fixture-private-upload/*', acceptLostUpload);
  let intercepted = false;
  const failOnce = async (route) => {
    if (!intercepted) {
      intercepted = true;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Fixture preparation interrupted. Retry this file.',
        }),
      });
    } else if (
      signedId &&
      new URL(route.request().url()).pathname.endsWith(`/${signedId}/complete`)
    ) {
      assert.deepEqual(route.request().postDataJSON(), {});
      assert.ok(uploadedBytes);
      await route.continue({
        postData: JSON.stringify({
          inlineDataUrl: `data:image/png;base64,${uploadedBytes.toString('base64')}`,
        }),
      });
    } else await route.continue();
  };
  await page.route('**/api/admin/collection-artwork/*/complete', failOnce);
  await product.getByRole('checkbox', { name: 'Back print', exact: true }).check();
  for (let index = 0; index < 2; index += 1) {
    const region = slot(product, index === 0 ? 'Front' : 'Back');
    await region.getByText('Upload an original image', { exact: true }).click();
    await region
      .getByLabel('Artwork file', { exact: true })
      .setInputFiles({ name: names[index], mimeType: 'image/png', buffer: files[index] });
    assert.equal(
      await region.getByRole('button', { name: 'Upload and attach', exact: true }).isEnabled(),
      false,
      'Rights consent is required'
    );
    await region.getByRole('checkbox').check();
    await region.getByRole('button', { name: 'Upload and attach', exact: true }).click();
    if (index === 0) {
      await region
        .getByRole('alert')
        .filter({ hasText: 'Fixture preparation interrupted' })
        .waitFor();
      await region.getByRole('button', { name: 'Retry preparation', exact: true }).click();
    } else {
      await region.getByRole('alert').waitFor();
      await region.getByRole('button', { name: 'Retry preparation', exact: true }).click();
    }
    await imageLoaded(region, names[index]);
    assert.equal(
      await region.getByLabel('Artwork file', { exact: true }).inputValue(),
      '',
      'Successful uploads clear the file input'
    );
    assert.match(await region.innerText(), /Original background preserved/);
    assert.match(await region.innerText(), /Review its size, placement, colors, and content/);
    await region.getByText('Upload an original image', { exact: true }).click();
  }
  await page.unroute('**/api/admin/collection-artwork/*/complete', failOnce);
  await page.unroute('**/api/admin/collection-artwork/authorize', authorizeSigned);
  await page.unroute('**/fixture-private-upload/*', acceptLostUpload);
  page.off('response', capture);
  assert.equal(authorizationIds.length, 2, 'Retry must retain the same upload authorization');
  assert.equal(
    signedUploads,
    1,
    'A lost response must not reupload an original that already arrived'
  );
  assert.deepEqual(completionIds, [authorizationIds[0], authorizationIds[0], authorizationIds[1]]);
  assert.equal(
    (
      await page.request.get(`/api/admin/collection-artwork/${authorizationIds[0]}/preview`)
    ).status(),
    401
  );
  const original = await page.request.get(
    `/api/admin/collection-artwork/${authorizationIds[0]}/original`,
    { headers }
  );
  assert.equal(original.status(), 200);
  assert.deepEqual(
    await original.body(),
    files[0],
    'Original artwork bytes must survive unchanged'
  );
  assert.match(original.headers()['cache-control'], /no-store/);
  return { ids: authorizationIds, names };
}

export async function verifySavedArtwork({ page, product, artwork, viewport, output }) {
  const front = slot(product, 'Front');
  const back = slot(product, 'Back');
  await imageLoaded(front, artwork.names[0]);
  await imageLoaded(back, artwork.names[1]);
  // A lost preview can be retried without reloading or discarding collection edits.
  const failPreview = (route) => route.fulfill({ status: 503, body: 'Fixture preview failure' });
  await page.route(`**/api/admin/collection-artwork/${artwork.ids[0]}/preview`, failPreview);
  await front.getByRole('button', { name: 'Detach artwork' }).click();
  await front.getByLabel('Use a library file').selectOption(artwork.ids[0]);
  await front.getByRole('button', { name: 'Retry preview' }).waitFor();
  await page.unroute(`**/api/admin/collection-artwork/${artwork.ids[0]}/preview`, failPreview);
  await front.getByRole('button', { name: 'Retry preview' }).click();
  await imageLoaded(front, artwork.names[0]);
  // Detaching/reusing does not upload or generate a replacement file.
  assert.equal(
    (
      await (await page.request.get('/api/admin/collection-artwork', { headers })).json()
    ).data.assets.filter((asset) => artwork.ids.includes(asset.id)).length,
    2
  );
  await page.getByText(/^Private artwork library ·/).click();
  const row = page.locator('.collection-library li').filter({ hasText: artwork.names[0] });
  await row.getByRole('button', { name: 'Remove file', exact: true }).click();
  await row.getByRole('button', { name: 'Confirm file removal', exact: true }).click();
  await page
    .locator('.collection-library')
    .getByRole('alert')
    .filter({ hasText: 'Detach this artwork from every collection and save' })
    .waitFor();
  await row.getByRole('button', { name: 'Keep file' }).click();
  await page.getByText(/^Private artwork library ·/).click();
  if (output) {
    await product.screenshot({ path: path.join(output, `attached-artwork-${viewport.width}.png`) });
    await page.screenshot({
      path: path.join(output, `collections-with-artwork-${viewport.width}.png`),
      fullPage: true,
    });
  }
  // Removing a print area clears only its binding. The file remains reusable.
  await product.getByRole('checkbox', { name: 'Back print', exact: true }).uncheck();
  assert.equal(await back.count(), 0);
  await product.getByRole('checkbox', { name: 'Back print', exact: true }).check();
  assert.equal(await back.getByLabel('Use a library file').inputValue(), '');
  await back.getByLabel('Use a library file').selectOption(artwork.ids[1]);
  await imageLoaded(back, artwork.names[1]);
}
