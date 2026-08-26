import assert from 'node:assert/strict';
import sharp from 'sharp';

const baseUrl = (process.argv[2] || 'http://127.0.0.1:5001').replace(/\/$/, '');

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  assert.ok(response.ok, `${init?.method || 'GET'} ${path} failed with ${response.status}`);
  assert.equal(payload?.success, true, `${path} should return the API success envelope`);
  return payload.data;
}

const source = await sharp({
  create: { width: 1600, height: 1400, channels: 4, background: '#e9933e' },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="1600" height="1400"><circle cx="800" cy="650" r="430" fill="#17324d"/><path d="M500 650 L800 350 L1100 650 L1000 1000 L600 1000 Z" fill="#f7efe0"/></svg>'
      ),
    },
  ])
  .png()
  .toBuffer();

const session = await request('/api/design/sessions', {
  method: 'POST',
  body: JSON.stringify({}),
});
let assetId;
try {
  const authorization = await request('/api/design/uploads/authorize', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: session.id,
      filename: 'signed-upload-smoke.png',
      contentType: 'image/png',
      byteSize: source.byteLength,
      purpose: 'print',
    }),
  });
  assetId = authorization.assetId;
  assert.equal(authorization.transport, 'supabase');
  assert.ok(authorization.signedUrl, 'a signed private upload URL should be returned');

  const form = new FormData();
  form.append('cacheControl', '3600');
  form.append('', new Blob([source], { type: 'image/png' }), 'signed-upload-smoke.png');
  const uploaded = await fetch(authorization.signedUrl, {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body: form,
  });
  assert.ok(uploaded.ok, `signed storage upload failed with ${uploaded.status}`);

  const draft = await request(`/api/design/uploads/${encodeURIComponent(assetId)}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      sessionId: session.id,
      rightsConfirmed: true,
      placementCodes: ['front'],
      removeBackground: false,
      filename: 'signed-upload-smoke.png',
      contentType: 'image/png',
      purpose: 'print',
    }),
  });
  assert.equal(draft.provider, 'upload');
  assert.equal(draft.sourceType, 'uploaded');
  assert.equal(draft.printPreparation?.provider, 'sharp');
  assert.deepEqual([draft.asset?.width, draft.asset?.height], [1600, 1400]);
  assert.equal(draft.readiness.status, 'pass');
  assert.match(draft.imageUrl, /^https:\/\//);

  const printFile = await fetch(draft.imageUrl);
  assert.ok(printFile.ok, `public print derivative failed with ${printFile.status}`);
  assert.match(printFile.headers.get('content-type') || '', /^image\/png/);

  process.stdout.write(
    `${JSON.stringify({
      status: 'passed',
      transport: authorization.transport,
      dimensions: [draft.asset.width, draft.asset.height],
      readiness: draft.readiness.status,
      printPreparation: draft.printPreparation.status,
    })}\n`
  );
} finally {
  if (assetId) {
    await request(
      `/api/design/uploads/${encodeURIComponent(assetId)}?sessionId=${encodeURIComponent(session.id)}`,
      { method: 'DELETE' }
    );
  }
}
