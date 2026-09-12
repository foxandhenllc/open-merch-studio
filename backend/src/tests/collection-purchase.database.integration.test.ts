import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.OMS_STORE_TEST_DATABASE_URL;
test(
  'collection purchases survive restart and audit rollback with private immutable files and owner prices',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const directory = mkdtempSync(join(tmpdir(), 'oms-artwork-storage-test-'));
    const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
    const productId = randomUUID(),
      variantId = randomUUID(),
      sessionId = randomUUID();
    const keys = [
      'installation-collection-drafts-v1',
      'installation-collection-publications-v1',
      'collection-print-preparation-attempts-v1',
    ];
    const imports = `import assert from 'node:assert/strict'; import { randomUUID } from 'node:crypto';
    import { service, storage, original } from './backend/src/tests/fixtures/collection-artwork-storage.ts';
    import { prisma } from './backend/src/config/database.ts';
    import { collectionArtwork } from './backend/src/admin/collection-artwork.service.ts';
    import { readCollectionDrafts, saveCollectionDrafts } from './backend/src/admin/collection-drafts.service.ts';
    import { prepareCollectionReview, publishCollection, publicationStatus, publicCollections, withdrawCollection } from './backend/src/admin/collection-publications.service.ts';
    import { saveCollectionPrintLayouts } from './backend/src/admin/collection-print-layouts.ts';
    import { setCollectionSales } from './backend/src/collections/sales.service.ts';
    import { createCollectionPurchaseService } from './backend/src/collections/purchase.service.ts';
    import { getQuoteById } from './backend/src/services/order-repository.service.ts';
    import { getDesignAssetImage } from './backend/src/services/design.service.ts';
    collectionArtwork.binary = service.binary;
    const purchases = createCollectionPurchaseService(() => ({ ...storage, providerUrl: async path => { await storage.read(path); return 'https://storage.example.test/private-fixture'; } }));`;
    const run = (code: string) => {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', imports + code],
        {
          env: {
            ...process.env,
            DATABASE_URL: testUrl!,
            NODE_ENV: 'test',
            OMS_ARTWORK_FIXTURE_DIRECTORY: directory,
            ENABLE_LIVE_OPENAI: 'false',
            ENABLE_LIVE_PRINTFUL: 'false',
            ENABLE_LIVE_STRIPE: 'false',
          },
          encoding: 'utf8',
          timeout: 45000,
        }
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim().split('\n').at(-1)!;
    };
    try {
      await db.adminSetting.deleteMany({ where: { key: { in: keys } } });
      await db.catalogProduct.create({
        data: {
          id: productId,
          title: 'Fixture tee',
          slug: `purchase-${productId}`,
          isSellable: true,
          variants: {
            create: { id: variantId, name: 'Fixture variant', printfulVariantId: 12345 },
          },
          placements: { create: { code: 'front', displayName: 'Front', isDefault: true } },
        },
      });
      const origin = JSON.parse(
        run(`const a = await service.authorize({ filename: 'Fixture.png', contentType: 'image/png', byteSize: original.length, rightsConfirmed: true }); await service.complete(a.assetId);
      const state = await readCollectionDrafts(); const id = randomUUID(), itemId = randomUUID();
      const saved = await saveCollectionDrafts([{ id, title: 'Owner gallery', description: '', purpose: 'event', items: [{ id: itemId, title: 'Artist edition', productId: '${productId}', variantId: '${variantId}', placementCodes: ['front'], artworkMode: 'fixed', targetPriceCents: 4200, artwork: [{ assetId: a.assetId, placementCode: 'front' }] }] }], state.revision);
      const printWidths = [{ itemId, placementCode: 'front', widthInches: 4 }];
      const review = await prepareCollectionReview(id, saved.revision, printWidths);
      const publication = await publishCollection(id, { draftRevision: saved.revision, publicationRevision: 0, digest: review.digest, printWidths, templateConfirmed: true, contentConfirmed: true, publicPreviewConfirmed: true });
      await saveCollectionPrintLayouts(id, { version: publication.version, revision: 0, layouts: [{ itemId, placementCode: 'front', templateWidthInches: 6, templateHeightInches: 6, leftInches: 1, topInches: 0 }], templateConfirmed: true });
      await setCollectionSales(id, { version: publication.version, layoutRevision: 1, enabled: true, reviewed: true });
      console.log(JSON.stringify({ collectionId: id, version: publication.version, layoutRevision: 1, items: [{ itemId, quantity: 2 }], assetId: a.assetId })); await prisma.$disconnect();`)
      );
      const { assetId, ...selection } = origin;
      const input = { selection, sessionId, requestId: randomUUID() };
      const quote = JSON.parse(
        run(
          `const quote = await purchases.create(${JSON.stringify(input)}); console.log(JSON.stringify(quote)); await prisma.$disconnect();`
        )
      );
      assert.equal(quote.totalCents, 9070);
      assert.equal(await db.quote.count({ where: { id: quote.id } }), 1);
      assert.equal(await db.designAsset.count({ where: { studioSessionId: sessionId } }), 1);
      run(
        `const quote = await getQuoteById('${quote.id}'); assert.deepEqual(quote, ${JSON.stringify(quote)}); assert.deepEqual(await purchases.create(${JSON.stringify(input)}), quote); assert.equal(await purchases.validate(quote, '${sessionId}'), null); assert.ok(await purchases.providerFiles(quote)); for (const item of quote.items) assert.equal(await getDesignAssetImage(item.designAssetId), null); await prisma.$disconnect();`
      );
      const retry = { ...input, requestId: randomUUID() };
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_purchase_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'collection_quote_prepared' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$`
      );
      await db.$executeRawUnsafe(
        'CREATE TRIGGER reject_purchase_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_purchase_audit()'
      );
      run(
        `await assert.rejects(() => purchases.create(${JSON.stringify(retry)}), error => error.errorCode === 'collection_purchase_storage_unavailable'); await prisma.$disconnect();`
      );
      assert.equal(
        await db.quote.count({
          where: { items: { some: { designAsset: { studioSessionId: sessionId } } } },
        }),
        1
      );
      assert.equal(
        await db.designAsset.count({
          where: { studioSessionId: sessionId, generationStatus: 'pending' },
        }),
        1
      );
      await db.$executeRawUnsafe('DROP TRIGGER reject_purchase_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION reject_purchase_audit()');
      run(
        `assert.equal((await purchases.create(${JSON.stringify(retry)})).totalCents, 9070); await prisma.$disconnect();`
      );
      assert.equal(
        await db.designAsset.count({
          where: { studioSessionId: sessionId, generationStatus: 'complete' },
        }),
        2
      );
      await db.catalogVariant.update({
        where: { id: variantId },
        data: { name: 'Changed catalog label' },
      });
      run(
        `const quote = await getQuoteById('${quote.id}'); assert.equal(quote.items[0].variantName, 'Fixture variant'); assert.equal(quote.items[0].title, 'Artist edition'); assert.ok(await purchases.validate(quote, '${sessionId}')); const s = await publicationStatus(); await withdrawCollection('${selection.collectionId}', s.revision); const d = await readCollectionDrafts(); await saveCollectionDrafts([], d.revision); await service.remove('${assetId}'); assert.ok(await purchases.providerFiles(quote)); await prisma.$disconnect();`
      );
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_purchase_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_purchase_audit()');
      await db.quote.deleteMany({
        where: { items: { some: { designAsset: { studioSessionId: sessionId } } } },
      });
      await db.designAsset.deleteMany({ where: { studioSessionId: sessionId } });
      await db.studioSession.deleteMany({ where: { id: sessionId } });
      await db.catalogProduct.deleteMany({ where: { id: productId } });
      await db.adminSetting.deleteMany({
        where: { OR: [{ key: { in: keys } }, { key: { startsWith: 'installation-artwork-v1:' } }] },
      });
      await db.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  }
);
