import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const baseUrl = (process.argv[2] || 'https://openmerchstudio.com').replace(/\/$/, '');
const root = new URL('../', import.meta.url).pathname;
const printDirectory = join(root, 'frontend/public/examples/fox-and-hen/print-files');
const proofDirectory = join(root, 'frontend/public/examples/fox-and-hen/mockups');

const allProducts = [
  {
    id: 'workbench-tee',
    productId: 'df8b8554-c205-4f83-ae08-495bc54711de',
    variantId: 'printful-variant-4017',
    orientation: 'portrait',
    placements: [
      { code: 'front', file: 'workbench-tee-front.png' },
      { code: 'back', file: 'workbench-tee-back.png' },
    ],
  },
  {
    id: 'studio-notes-tote',
    productId: '7a1c0013-0655-4cc9-af8b-e26fa78acbc4',
    variantId: 'printful-variant-10458',
    orientation: 'portrait',
    placements: [
      { code: 'front', file: 'studio-notes-tote-front.png' },
      { code: 'back', file: 'studio-notes-tote-back.png' },
    ],
  },
  {
    id: 'connected-systems-mug',
    productId: '052e3ae7-4027-4367-93d7-42cd4373a341',
    variantId: 'printful-variant-1320',
    orientation: 'landscape',
    placements: [{ code: 'default', file: 'connected-systems-mug-wrap.png' }],
  },
  {
    id: 'system-map-poster',
    productId: '88792ee3-f35b-4aa8-9fb8-c401863f65c6',
    variantId: 'printful-variant-3876',
    orientation: 'portrait',
    placements: [{ code: 'default', file: 'system-map-poster.png' }],
  },
  {
    id: 'studio-mark-sticker',
    productId: 'b4a367e8-e61c-494c-9aa8-609b258b6da4',
    variantId: 'printful-variant-10163',
    orientation: 'square',
    placements: [{ code: 'default', file: 'studio-mark-sticker.png' }],
  },
];
const requestedProductId = process.argv[3];
const products = requestedProductId
  ? allProducts.filter((product) => product.id === requestedProductId)
  : allProducts;
assert.ok(products.length, `Unknown product filter: ${requestedProductId}`);

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  assert.ok(response.ok, `${init?.method || 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert.equal(payload?.success, true, `${path} did not return the success envelope`);
  return payload.data;
}

async function uploadArtwork(sessionId, placement) {
  const source = await readFile(join(printDirectory, placement.file));
  const authorization = await request('/api/design/uploads/authorize', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      filename: placement.file,
      contentType: 'image/png',
      byteSize: source.byteLength,
      purpose: 'print',
    }),
  });
  assert.equal(authorization.transport, 'supabase');
  assert.ok(authorization.signedUrl);

  const form = new FormData();
  form.append('cacheControl', '3600');
  form.append('', new Blob([source], { type: 'image/png' }), placement.file);
  const uploaded = await fetch(authorization.signedUrl, {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body: form,
  });
  assert.ok(uploaded.ok, `Upload failed for ${placement.file} with ${uploaded.status}`);

  const draft = await request(`/api/design/uploads/${encodeURIComponent(authorization.assetId)}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      rightsConfirmed: true,
      placementCodes: [placement.code],
      removeBackground: false,
      filename: placement.file,
      contentType: 'image/png',
      purpose: 'print',
    }),
  });
  assert.equal(draft.readiness?.status, 'pass', `${placement.file} did not pass print readiness`);
  return {
    code: placement.code,
    file: placement.file,
    assetId: authorization.assetId,
    imageUrl: draft.imageUrl,
    width: draft.asset?.width,
    height: draft.asset?.height,
  };
}

function slug(value) {
  return String(value || 'view')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'view';
}

async function download(url, destination) {
  const response = await fetch(url);
  assert.ok(response.ok, `Unable to download ${url}: ${response.status}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

await mkdir(proofDirectory, { recursive: true });
const session = await request('/api/design/sessions', { method: 'POST', body: '{}' });
const manifest = { baseUrl, sessionId: session.id, generatedAt: new Date().toISOString(), products: [] };

for (const product of products) {
  const uploadedPlacements = [];
  for (const placement of product.placements) {
    uploadedPlacements.push(await uploadArtwork(session.id, placement));
  }

  const mockup = await request('/api/design/mockups', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: session.id,
      productId: product.productId,
      variantId: product.variantId,
      placementCodes: uploadedPlacements.map((placement) => placement.code),
      placements: uploadedPlacements.map((placement) => ({
        code: placement.code,
        designAssetId: placement.assetId,
      })),
      designAssetId: uploadedPlacements[0].assetId,
      orientation: product.orientation,
    }),
  });
  assert.equal(mockup.status, 'complete', `${product.id} mockup failed: ${mockup.errorMessage || 'unknown error'}`);
  assert.equal(mockup.provider, 'printful', `${product.id} did not use Printful`);

  const views = Array.isArray(mockup.views) && mockup.views.length
    ? mockup.views
    : [{ label: 'Primary', imageUrl: mockup.imageUrl }];
  const savedViews = [];
  for (let index = 0; index < views.length; index += 1) {
    const view = views[index];
    const filename = `${product.id}-${String(index + 1).padStart(2, '0')}-${slug(view.label)}.png`;
    await download(view.imageUrl, join(proofDirectory, filename));
    savedViews.push({ label: view.label, imageUrl: view.imageUrl, filename });
  }
  manifest.products.push({
    id: product.id,
    productId: product.productId,
    variantId: product.variantId,
    mockupTaskId: mockup.id,
    primaryImageUrl: mockup.imageUrl,
    placements: uploadedPlacements,
    views: savedViews,
  });
  process.stdout.write(`${product.id}: ${mockup.id} (${savedViews.map((view) => view.label).join(', ')})\n`);
}

await writeFile(
  join(proofDirectory, 'printful-proof-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);
process.stdout.write(`Saved ${manifest.products.length} Printful proof sets for session ${session.id}\n`);
