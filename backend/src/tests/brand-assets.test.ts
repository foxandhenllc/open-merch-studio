import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { merchantConfig } from '../generated/merchant-config.js';
import { brandAssets, createBrandAssetsService } from '../admin/brand-assets.service.js';
import type { BrandAsset } from '../admin/brand-assets.types.js';
import { collectionArtwork } from '../admin/collection-artwork.service.js';
import { readMerchantProfile, saveMerchantProfile } from '../admin/merchant-profile.service.js';

test('brand images preserve originals, recover uncertain writes, remain private until deployed, and survive source removal', async () => {
  const previous = {
    database: env.databaseUrl,
    mode: env.nodeEnv,
    admin: env.adminAccessCode,
    logo: merchantConfig.brand.logoPath,
  };
  env.databaseUrl = undefined;
  env.nodeEnv = 'test';
  env.adminAccessCode = 'fixture-brand-admin';
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = (path: string, body?: unknown) =>
    fetch(`${base}/api/admin${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-access': env.adminAccessCode! },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    const original = await sharp({
      create: {
        width: 1300,
        height: 900,
        channels: 4,
        background: { r: 25, g: 96, b: 62, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();
    const auth = (await (
      await api('/collection-artwork/authorize', {
        filename: 'brand-original.png',
        contentType: 'image/png',
        byteSize: original.length,
        rightsConfirmed: true,
      })
    ).json()) as { data: { assetId: string } };
    const assetId = auth.data.assetId;
    assert.equal(
      (
        await api(`/collection-artwork/${assetId}/complete`, {
          inlineDataUrl: `data:image/png;base64,${original.toString('base64')}`,
        })
      ).status,
      200
    );
    assert.equal((await fetch(`${base}/api/admin/brand-assets`, { method: 'POST' })).status, 401);
    assert.equal(
      (await api('/brand-assets', { assetId, kind: 'logo', background: '#ffffff', extra: true }))
        .status,
      400
    );
    const logoResponse = await api('/brand-assets', {
      assetId,
      kind: 'logo',
      background: '#ffffff',
    });
    assert.equal(logoResponse.status, 200);
    const logo = ((await logoResponse.json()) as { data: BrandAsset }).data;
    assert.deepEqual(Object.keys(logo).sort(), [
      'byteSize',
      'hash',
      'height',
      'kind',
      'publicPath',
      'width',
    ]);
    assert.deepEqual(
      (
        await api('/brand-assets', { assetId, kind: 'logo', background: '#ffffff' }).then(
          async (r) => (await r.json()) as { data: BrandAsset }
        )
      ).data,
      logo
    );
    assert.equal((await fetch(`${base}${logo.publicPath}`)).status, 404);
    assert.equal((await fetch(`${base}/api/admin/brand-assets/${logo.hash}/preview`)).status, 401);
    const privatePreview = await api(`/brand-assets/${logo.hash}/preview`);
    assert.match(privatePreview.headers.get('cache-control')!, /private, no-store/);
    const bytes = Buffer.from(await privatePreview.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, 512);
    assert.equal(meta.height, 512);
    assert.equal(meta.hasAlpha, true);
    assert.deepEqual((await collectionArtwork.binary(assetId, 'original'))!.buffer, original);
    const initial = await readMerchantProfile();
    const draft = structuredClone(initial.draft);
    draft.fields['brand.logoPath'] = logo.publicPath;
    assert.equal(
      (await saveMerchantProfile(draft, initial.revision, initial.activeDigest))
        .requiresPolicyReview,
      false
    );
    assert.equal(
      (await fetch(`${base}${logo.publicPath}`)).status,
      404,
      'Saving is not deployment'
    );
    await assert.rejects(
      () => brandAssets.assertProfile({ 'brand.socialImagePath': logo.publicPath }),
      /correct brand slot/
    );
    await assert.rejects(() =>
      brandAssets.assertProfile({ 'brand.logoPath': `/api/brand-assets/${'a'.repeat(64)}.png` })
    );

    const files = new Map<string, Buffer>();
    let writes = 0;
    const adapter = {
      namespace: 'brand-test-uncertain',
      assertPrivate: async () => undefined,
      read: async (path: string) => {
        const value = files.get(path);
        if (!value) throw new Error('missing');
        return value;
      },
      write: async (path: string, buffer: Buffer) => {
        writes++;
        files.set(path, buffer);
        throw new Error('lost response');
      },
    };
    const service = createBrandAssetsService(() => adapter);
    const share = await service.prepare({ assetId, kind: 'share', background: '#eeeeee' });
    assert.equal(writes, 1);
    assert.equal((await sharp(await service.preview(share.hash)).metadata()).width, 1200);
    assert.equal((await sharp(await service.preview(share.hash)).metadata()).height, 630);
    await service.prepare({ assetId, kind: 'share', background: '#eeeeee' });
    assert.equal(writes, 1);
    await assert.rejects(() => brandAssets.preview(share.hash), /could not be prepared/);
    files.set([...files.keys()][0], Buffer.from('corrupted'));
    await assert.rejects(() => service.preview(share.hash), /could not be prepared/);
    Object.assign(merchantConfig.brand, { logoPath: logo.publicPath });
    assert.deepEqual(
      Buffer.from(await (await fetch(`${base}${logo.publicPath}`)).arrayBuffer()),
      bytes
    );
    await collectionArtwork.remove(assetId);
    assert.deepEqual(await brandAssets.preview(logo.hash), bytes);
    Object.assign(merchantConfig.brand, { logoPath: previous.logo });
    assert.equal(
      (await fetch(`${base}${logo.publicPath}`)).status,
      404,
      'Replaced branding is no longer publicly served'
    );
  } finally {
    env.databaseUrl = previous.database;
    env.nodeEnv = previous.mode;
    env.adminAccessCode = previous.admin;
    Object.assign(merchantConfig.brand, { logoPath: previous.logo });
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
