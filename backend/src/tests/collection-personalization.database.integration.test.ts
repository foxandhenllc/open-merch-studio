import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
const testUrl = process.env.OMS_STORE_TEST_DATABASE_URL;
test(
  'personalized private originals and generated request receipts survive restart; saved print copies do not depend on temporary sources',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const directory = mkdtempSync(join(tmpdir(), 'oms-artwork-storage-test-'));
    const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
    const imports = `import assert from 'node:assert/strict'; import { randomUUID, createHash } from 'node:crypto'; import { service, storage, original } from './backend/src/tests/fixtures/collection-artwork-storage.ts'; import { collectionArtwork } from './backend/src/admin/collection-artwork.service.ts'; import { personalizedArtwork, readPersonalizedArtwork } from './backend/src/collections/personalized-artwork.ts'; import { readCollectionDrafts, saveCollectionDrafts } from './backend/src/admin/collection-drafts.service.ts'; import { prepareCollectionReview, publishCollection, publicationStatus, publicCollection } from './backend/src/admin/collection-publications.service.ts'; import { saveCollectionPrintLayouts } from './backend/src/admin/collection-print-layouts.ts'; import { setCollectionSales } from './backend/src/collections/sales.service.ts'; import { prepareCollectionPurchase } from './backend/src/admin/collection-purchase-preparation.ts'; import { createCollectionPurchaseService } from './backend/src/collections/purchase.service.ts'; import { readPurchase } from './backend/src/collections/purchase.repository.ts'; import { generateCollectionArtwork } from './backend/src/collections/personalization-generation.ts'; import { env } from './backend/src/config/env.ts'; import { prisma } from './backend/src/config/database.ts'; collectionArtwork.binary = service.binary; personalizedArtwork.read = (id, session, mode) => readPersonalizedArtwork(id, session, mode, storage); globalThis.fetch = async () => { throw new Error('No network provider is allowed in this test'); }; Object.assign(env, { checkoutEnabled: true, enableLiveStripe: true, stripeSecretKey: 'sk_test_never_sent', checkoutAccessMode: 'public', allowLivePayments: true, enableLiveOpenAi: false, studioPassEnabled: false });`;
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
          timeout: 30000,
        }
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim().split('\n').at(-1)!;
    };
    let ownedSession: string | undefined;
    let ownedQuote: string | undefined;
    try {
      await db.adminSetting.deleteMany({
        where: {
          key: {
            in: ['installation-collection-drafts-v1', 'installation-collection-publications-v1'],
          },
        },
      });
      const setup = JSON.parse(
        run(
          `const auth = await service.authorize({ filename: 'Private example.png', contentType: 'image/png', byteSize: original.length, rightsConfirmed: true }); await service.complete(auth.assetId); const state = await readCollectionDrafts(); const product = state.catalog.find(p => p.placements.some(a => a.code === 'front')); const items = ['upload','generate'].map(artworkMode => ({ id: randomUUID(), title: artworkMode, productId: product.id, variantId: product.variants[0].id, placementCodes: ['front'], artworkMode, targetPriceCents: 4100, artwork: [{ placementCode: 'front', assetId: auth.assetId }] })); const id = randomUUID(); const saved = await saveCollectionDrafts([{ id, title: 'Personalized test', description: '', purpose: 'community', items }], state.revision); const widths = items.map(i => ({ itemId: i.id, placementCode: 'front', widthInches: 4 })); const review = await prepareCollectionReview(id, saved.revision, widths); assert.equal(review.ready, true); const published = await publishCollection(id, { draftRevision: saved.revision, publicationRevision: (await publicationStatus()).revision, digest: review.digest, printWidths: widths, templateConfirmed: true, contentConfirmed: true, publicPreviewConfirmed: true }); await saveCollectionPrintLayouts(id, { version: published.version, revision: 0, layouts: items.map(i => ({ itemId: i.id, placementCode: 'front', templateWidthInches: 8, templateHeightInches: 10, leftInches: 2, topInches: 2 })), templateConfirmed: true }); await setCollectionSales(id, { version: published.version, layoutRevision: 1, enabled: true, reviewed: true }); const session = await prisma.studioSession.create({ data: {} }); const originalRecord = (await prisma.adminSetting.findUnique({ where: { key: 'installation-artwork-v1:' + auth.assetId } })).value; const upload = await prisma.designAsset.create({ data: { studioSessionId: session.id, prompt: '', provider: 'upload', sourceType: 'uploaded', purpose: 'collection', originalStoragePath: originalRecord.originalPath, checksumSha256: createHash('sha256').update(original).digest('hex'), rightsConfirmedAt: new Date(), generationStatus: 'complete', policyStatus: 'pass' } }); console.log(JSON.stringify({ id, version: published.version, items: items.map(i => i.id), sessionId: session.id, assetId: upload.id, requestId: randomUUID() })); await prisma.$disconnect();`
        )
      );
      ownedSession = setup.sessionId;
      const selection = {
        collectionId: setup.id,
        version: setup.version,
        layoutRevision: 1,
        items: [{ itemId: setup.items[0], quantity: 2, designAssetId: setup.assetId }],
      };
      const args = JSON.stringify({
        selection,
        sessionId: setup.sessionId,
        requestId: setup.requestId,
      });
      const quoteId = run(
        `const purchases = createCollectionPurchaseService(() => ({ ...storage, providerUrl: async () => { throw new Error('No provider URL'); } })); const quote = await purchases.create(${args}); assert.equal(quote.items[0].unitRetailCents, 4100); console.log(quote.id); await prisma.$disconnect();`
      );
      ownedQuote = quoteId;
      await db.designAsset.delete({ where: { id: setup.assetId } });
      run(
        `const purchases = createCollectionPurchaseService(() => ({ ...storage, providerUrl: async () => { throw new Error('No provider URL'); } })); assert.equal((await purchases.create(${args})).id, '${quoteId}'); const manifest = await readPurchase('${quoteId}'); for (const file of manifest.files) assert.equal(createHash('sha256').update(await storage.read(file.path)).digest('hex'), file.sha256); await assert.rejects(() => prepareCollectionPurchase(${JSON.stringify(selection)}, '${setup.sessionId}')); await prisma.$disconnect();`
      );
      const generation = {
        collectionId: setup.id,
        version: setup.version,
        itemId: setup.items[1],
        sessionId: setup.sessionId,
        requestId: 'generation-restart-1',
        prompt: 'A fox surrounded by flowers',
      };
      const generatedId = run(
        `const draft = await generateCollectionArtwork(${JSON.stringify(generation)}); console.log(draft.id); await prisma.$disconnect();`
      );
      run(
        `assert.equal((await generateCollectionArtwork(${JSON.stringify(generation)})).id, '${generatedId}'); await prisma.$disconnect();`
      );
      assert.equal(
        await db.designAsset.count({
          where: { studioSessionId: setup.sessionId, sourceType: 'generated' },
        }),
        1
      );
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_generation_complete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'collection_generation_complete' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$`
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER reject_generation_complete BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_generation_complete()`
      );
      const pending = { ...generation, requestId: 'generation-uncertain-2' };
      run(
        `await assert.rejects(() => generateCollectionArtwork(${JSON.stringify(pending)})); await prisma.$disconnect();`
      );
      await db.$executeRawUnsafe('DROP TRIGGER reject_generation_complete ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION reject_generation_complete()');
      run(
        `await assert.rejects(() => generateCollectionArtwork(${JSON.stringify(pending)}), /could not be confirmed/); await prisma.$disconnect();`
      );
      assert.equal(
        await db.designAsset.count({
          where: { studioSessionId: setup.sessionId, sourceType: 'generated' },
        }),
        2,
        'Uncertain retry must not call generation again'
      );
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_generation_complete ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_generation_complete()');
      if (ownedQuote) await db.quote.deleteMany({ where: { id: ownedQuote } });
      if (ownedSession) {
        await db.aiSpendEvent.deleteMany({ where: { sessionId: ownedSession } });
        await db.designAsset.deleteMany({ where: { studioSessionId: ownedSession } });
        await db.studioSession.deleteMany({ where: { id: ownedSession } });
      }
      await db.adminSetting.deleteMany({
        where: {
          OR: [
            { key: { startsWith: 'collection-generation-v1:' } },
            {
              key: {
                in: [
                  'installation-collection-drafts-v1',
                  'installation-collection-publications-v1',
                ],
              },
            },
          ],
        },
      });
      await db.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  }
);
