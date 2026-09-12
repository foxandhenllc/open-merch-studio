import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.OMS_STORE_TEST_DATABASE_URL;
test(
  'private artwork metadata and bindings survive restart, rollback on audit failure, and retain deletion tombstones until signed upload expiry',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const directory = mkdtempSync(join(tmpdir(), 'oms-artwork-storage-test-'));
    const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
    const keyPrefix = 'installation-artwork-v1:';
    const draftKey = 'installation-collection-drafts-v1';
    const publicationKey = 'installation-collection-publications-v1';
    const imports = `import assert from 'node:assert/strict'; import { randomUUID } from 'node:crypto'; import { service, original, storageWrites } from './backend/src/tests/fixtures/collection-artwork-storage.ts'; import { readCollectionDrafts, saveCollectionDrafts } from './backend/src/admin/collection-drafts.service.ts'; import { prisma } from './backend/src/config/database.ts'; import { collectionArtwork } from './backend/src/admin/collection-artwork.service.ts'; import { prepareCollectionReview, publishCollection, withdrawCollection, publicCollections, publicationStatus, publicCollectionArtwork } from './backend/src/admin/collection-publications.service.ts'; import { collectionSalesReadiness } from './backend/src/admin/collection-sales-readiness.ts'; import { getCollectionPrintLayouts, saveCollectionPrintLayouts, exportCollectionPrintLayout } from './backend/src/admin/collection-print-layouts.ts'; import { prepareCollectionPurchase } from './backend/src/admin/collection-purchase-preparation.ts'; collectionArtwork.binary = service.binary;`;
    const run = (code: string, extra: Record<string, string> = {}) =>
      spawnSync(
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
            ...extra,
          },
          encoding: 'utf8',
          timeout: 30000,
        }
      );
    const success = (result: ReturnType<typeof run>) =>
      assert.equal(result.status, 0, result.stderr);
    try {
      await db.adminSetting.deleteMany({
        where: {
          OR: [{ key: { startsWith: keyPrefix } }, { key: draftKey }, { key: publicationKey }],
        },
      });
      await db.auditLog.deleteMany({ where: { target: { startsWith: keyPrefix } } });
      const create = run(
        `const auth = await service.authorize({ filename: 'Original fixture.png', contentType: 'image/png', byteSize: original.length, rightsConfirmed: true }); assert.equal(auth.transport, 'signed'); console.log(auth.assetId); await prisma.$disconnect();`
      );
      success(create);
      const id = create.stdout.trim().split('\n').at(-1)!;
      assert.match(id, /^[a-f0-9-]{36}$/);
      const finish = run(
        `await service.complete('${id}'); assert.equal(storageWrites, 2); await service.complete('${id}'); assert.equal(storageWrites, 2); const state = await readCollectionDrafts(); const product = state.catalog.find(p => p.variants.length && p.placements.length); assert.ok(product); await saveCollectionDrafts([{ id: randomUUID(), title: 'Gallery collection', description: '', purpose: 'event', items: [{ id: randomUUID(), title: 'Print', productId: product.id, variantId: product.variants[0].id, placementCodes: [product.placements[0].code], artworkMode: 'fixed', targetPriceCents: 3000, artwork: [{ placementCode: product.placements[0].code, assetId: '${id}' }] }] }], state.revision); await prisma.$disconnect();`
      );
      success(finish);
      success(
        run(
          `const state = await readCollectionDrafts(); assert.equal(state.collections[0].items[0].artwork[0].assetId, '${id}'); assert.deepEqual((await service.binary('${id}', 'original')).buffer, original); await assert.rejects(() => service.remove('${id}'), error => error.errorCode === 'collection_artwork_in_use'); const list = await service.list(); assert.ok(!/originalPath|namespace|checksum|https:/.test(JSON.stringify(list))); await prisma.$disconnect();`
        )
      );
      success(
        run(
          `assert.equal((await service.originalResponse('${id}')).downloadUrl, 'https://storage.example.test/private-download-fixture'); await prisma.$disconnect();`
        )
      );
      // Publication survives process restart and is independent of later draft edits.
      success(
        run(
          `const state = await readCollectionDrafts(); const c = state.collections[0]; const widths = [{ itemId: c.items[0].id, placementCode: c.items[0].placementCodes[0], widthInches: 4 }]; const report = await prepareCollectionReview(c.id, state.revision, widths); assert.equal(report.ready, true); await publishCollection(c.id, { draftRevision: state.revision, publicationRevision: 0, digest: report.digest, printWidths: widths, templateConfirmed: true, contentConfirmed: true, publicPreviewConfirmed: true }); await prisma.$disconnect();`
        )
      );
      success(
        run(
          `const list = await publicCollections(); assert.equal(list.length, 1); assert.equal(list[0].orderingAvailable, false); const readiness = await collectionSalesReadiness(list[0].id, list[0].version); assert.equal(readiness.checks[0].status, 'pass'); assert.equal(readiness.orderingAvailable, false); const state = await readCollectionDrafts(); assert.ok((await publicCollectionArtwork(list[0].id, String(list[0].version), state.collections[0].items[0].id, state.collections[0].items[0].placementCodes[0])).buffer.length); await prisma.$disconnect();`
        )
      );
      success(
        run(
          `const c = (await publicCollections())[0]; const layouts = await getCollectionPrintLayouts(c.id, c.version); const area = layouts.areas[0]; await saveCollectionPrintLayouts(c.id, { version: c.version, revision: 0, layouts: [{ itemId: area.itemId, placementCode: area.placementCode, templateWidthInches: 8, templateHeightInches: 10, leftInches: 1, topInches: 1 }], templateConfirmed: true }); await prisma.$disconnect();`
        )
      );
      success(
        run(
          `const c = (await publicCollections())[0]; const layouts = await getCollectionPrintLayouts(c.id, c.version); assert.equal(layouts.revision, 1); const area = layouts.areas[0]; assert.ok((await exportCollectionPrintLayout(c.id, c.version, 1, area.itemId, area.placementCode, true)).length); await prisma.$disconnect();`
        )
      );
      // A new process prepares the published price and exact file from restored private storage.
      success(
        run(
          `const c = (await publicCollections())[0]; const layouts = await getCollectionPrintLayouts(c.id, c.version); const prepared = await prepareCollectionPurchase({ collectionId: c.id, version: c.version, layoutRevision: layouts.revision, items: [{ itemId: layouts.areas[0].itemId, quantity: 2 }] }); assert.equal(prepared.merchandiseSubtotalCents, 6000); assert.equal(prepared.lines[0].unitPriceCents, 3000); assert.equal(prepared.files.length, 1); assert.ok(prepared.files[0].bytes.length); assert.match(prepared.files[0].sha256, /^[a-f0-9]{64}$/); assert.equal(prepared.orderingAvailable, false); assert.equal((await collectionSalesReadiness(c.id, c.version)).checks.find(check => check.id === 'layouts').status, 'pass'); await prisma.$disconnect();`
        )
      );
      const denied = run(
        `await assert.rejects(() => service.binary('${id}'), /storage/); await prisma.$disconnect();`,
        { OMS_ARTWORK_FIXTURE_PUBLIC: 'true' }
      );
      success(denied);
      const audit = await db.auditLog.findMany({ where: { target: keyPrefix + id } });
      assert.ok(audit.length >= 2);
      assert.ok(audit.every((row) => Object.keys(row.metadata as object).join() === 'status'));
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_test_artwork_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture private audit failure'; END $$`
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER reject_test_artwork_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_test_artwork_audit()`
      );
      success(
        run(
          `await assert.rejects(() => service.authorize({ filename: 'Rejected.png', contentType: 'image/png', byteSize: original.length, rightsConfirmed: true }), /storage/); await prisma.$disconnect();`
        )
      );
      assert.equal(await db.adminSetting.count({ where: { key: { startsWith: keyPrefix } } }), 1);
      success(
        run(
          `const state = await publicationStatus(); await assert.rejects(() => withdrawCollection(state.publications[0].id, state.revision), /publication is unavailable/); assert.equal((await publicCollections()).length, 1); await prisma.$disconnect();`
        )
      );
      success(
        run(
          `const c = (await publicCollections())[0]; const layouts = await getCollectionPrintLayouts(c.id, c.version); await assert.rejects(() => saveCollectionPrintLayouts(c.id, { version: c.version, revision: layouts.revision, layouts: [], templateConfirmed: true }), /publication is unavailable/); assert.equal((await getCollectionPrintLayouts(c.id, c.version)).revision, 1); await prisma.$disconnect();`
        )
      );
      const publicationAudit = await db.auditLog.findMany({ where: { target: publicationKey } });
      assert.equal(publicationAudit.length, 2);
      assert.ok(publicationAudit.some((row) => row.action === 'collection_print_layouts_saved'));
      assert.equal(publicationAudit[0].action, 'collection_preview_published');
      assert.deepEqual(Object.keys(publicationAudit[0].metadata as object).sort(), [
        'collectionCount',
        'revision',
      ]);
      await db.$executeRawUnsafe('DROP TRIGGER reject_test_artwork_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION reject_test_artwork_audit()');
      success(
        run(
          `const state = await readCollectionDrafts(); await saveCollectionDrafts([], state.revision); await assert.rejects(() => service.remove('${id}'), error => error.errorCode === 'collection_artwork_in_use'); const published = await publicationStatus(); await withdrawCollection(published.publications[0].id, published.revision); assert.equal((await publicCollections()).length, 0); const removed = await service.remove('${id}'); assert.equal(removed.pending, true); await assert.rejects(() => service.binary('${id}'), /not found/); await assert.rejects(() => service.complete('${id}'), /not found/); await prisma.$disconnect();`
        )
      );
      const tombstone = await db.adminSetting.findUniqueOrThrow({ where: { key: keyPrefix + id } });
      assert.equal((tombstone.value as { status: string }).status, 'deleting');
      await db.adminSetting.update({
        where: { key: keyPrefix + id },
        data: { value: { ...(tombstone.value as object), uploadAuthorizationSettled: false } },
      });
      success(
        run(
          `const removed = await service.remove('${id}'); assert.equal(removed.pending, true); assert.equal(removed.removeAfter, undefined); await prisma.$disconnect();`,
          { OMS_ARTWORK_FIXTURE_NOW: '2026-09-10T15:00:00.000Z' }
        )
      );
      assert.equal(
        await db.adminSetting.count({ where: { key: keyPrefix + id } }),
        1,
        'An uncertain signing result must remain discoverable even after its initial expiry'
      );
      await db.adminSetting.update({
        where: { key: keyPrefix + id },
        data: { value: { ...(tombstone.value as object), uploadAuthorizationSettled: true } },
      });
      success(
        run(
          `const removed = await service.remove('${id}'); assert.equal(removed.pending, false); await prisma.$disconnect();`,
          { OMS_ARTWORK_FIXTURE_NOW: '2026-09-10T15:00:00.000Z' }
        )
      );
      assert.equal(await db.adminSetting.count({ where: { key: { startsWith: keyPrefix } } }), 0);
      const rls = await db.$queryRaw<
        Array<{ relrowsecurity: boolean }>
      >`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.admin_settings'::regclass`;
      assert.equal(rls[0].relrowsecurity, true);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_test_artwork_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_test_artwork_audit()');
      await db.adminSetting.deleteMany({
        where: {
          OR: [{ key: { startsWith: keyPrefix } }, { key: draftKey }, { key: publicationKey }],
        },
      });
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { target: { startsWith: keyPrefix } },
            { target: draftKey },
            { target: publicationKey },
          ],
        },
      });
      await db.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  }
);
