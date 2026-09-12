import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.OMS_STORE_TEST_DATABASE_URL;

test(
  'collection drafts persist in a fresh process, reject catalog drift, and roll back when audit fails',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
    const key = 'installation-collection-drafts-v1';
    const productId = randomUUID();
    const variantId = randomUUID();
    const imports = `import { readCollectionDrafts, saveCollectionDrafts } from './backend/src/admin/collection-drafts.service.ts'; import { prisma } from './backend/src/config/database.ts';`;
    const run = (code: string) =>
      spawnSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', imports + code],
        {
          env: {
            ...process.env,
            DATABASE_URL: testUrl!,
            NODE_ENV: 'test',
            ENABLE_LIVE_OPENAI: 'false',
            ENABLE_LIVE_STRIPE: 'false',
            ENABLE_LIVE_PRINTFUL: 'false',
          },
          encoding: 'utf8',
          timeout: 30000,
        }
      );
    try {
      await db.adminSetting.deleteMany({ where: { key } });
      await db.auditLog.deleteMany({ where: { target: key } });
      await db.catalogProduct.create({
        data: {
          id: productId,
          title: 'Collection fixture',
          slug: `collection-test-${productId}`,
          isSellable: true,
          variants: { create: { id: variantId, name: 'Test variant' } },
          placements: { create: { code: 'front', displayName: 'Front', isDefault: true } },
        },
      });
      const collection = {
        id: randomUUID(),
        title: 'Private artist collection',
        description: 'Fixture description excluded from audit',
        purpose: 'event',
        items: [
          {
            id: randomUUID(),
            title: 'Artwork print',
            productId,
            variantId,
            placementCodes: ['front'],
            artworkMode: 'fixed',
            targetPriceCents: 2500,
          },
        ],
      };
      const write = run(
        `const before = await readCollectionDrafts(); await saveCollectionDrafts(${JSON.stringify([collection])}, before.revision); await prisma.$disconnect();`
      );
      assert.equal(write.status, 0, write.stderr);
      const read = run(
        `const saved = await readCollectionDrafts(); if (saved.storage !== 'database' || saved.revision !== 1 || saved.collections[0].items[0].targetPriceCents !== 2500) process.exitCode = 1; await prisma.$disconnect();`
      );
      assert.equal(read.status, 0, read.stderr);
      const event = await db.auditLog.findFirstOrThrow({ where: { target: key } });
      assert.deepEqual(event.metadata, { revision: 1, collectionCount: 1, productCount: 1 });
      const stale = run(
        `const saved = await readCollectionDrafts(); try { await saveCollectionDrafts(saved.collections, 0); process.exitCode = 1; } catch (error) { if (error.errorCode !== 'collection_conflict') process.exitCode = 1; } await prisma.$disconnect();`
      );
      assert.equal(stale.status, 0, stale.stderr);
      await db.catalogVariant.update({ where: { id: variantId }, data: { isAvailable: false } });
      const drift = run(
        `const saved = await readCollectionDrafts(); if (saved.collections.length !== 1) process.exitCode = 1; try { await saveCollectionDrafts(saved.collections, 1); process.exitCode = 1; } catch (error) { if (error.errorCode !== 'collection_catalog_changed') process.exitCode = 1; } await prisma.$disconnect();`
      );
      assert.equal(drift.status, 0, drift.stderr);
      await db.catalogVariant.update({ where: { id: variantId }, data: { isAvailable: true } });
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_test_collection_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture private failure'; END $$`
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER reject_test_collection_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_test_collection_audit()`
      );
      const rejected = run(
        `const saved = await readCollectionDrafts(); saved.collections[0].title = 'Later edit'; try { await saveCollectionDrafts(saved.collections, 1); process.exitCode = 1; } catch (error) { if (error.errorCode !== 'collection_drafts_unavailable') process.exitCode = 1; } await prisma.$disconnect();`
      );
      assert.equal(rejected.status, 0, rejected.stderr);
      const savedRow = await db.adminSetting.findUniqueOrThrow({ where: { key } });
      assert.equal((savedRow.value as { revision: number }).revision, 1);
      assert.equal(await db.auditLog.count({ where: { target: key } }), 1);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS reject_test_collection_audit ON audit_logs'
      );
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_test_collection_audit()');
      await db.adminSetting.deleteMany({ where: { key } });
      await db.auditLog.deleteMany({ where: { target: key } });
      await db.catalogProduct.deleteMany({ where: { id: productId } });
      await db.$disconnect();
    }
  }
);

test(
  'merchant profile drafts survive a new process and roll back with a failed audit',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
    const key = 'merchant-profile-draft-v1';
    const imports = `import { readMerchantProfile, saveMerchantProfile, publishMerchantProfile } from './backend/src/admin/merchant-profile.service.ts'; import { prisma } from './backend/src/config/database.ts';`;
    const run = (code: string) =>
      spawnSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', imports + code],
        {
          env: {
            ...process.env,
            DATABASE_URL: testUrl!,
            NODE_ENV: 'test',
            ENABLE_LIVE_OPENAI: 'false',
            ENABLE_LIVE_STRIPE: 'false',
            ENABLE_LIVE_PRINTFUL: 'false',
          },
          encoding: 'utf8',
          timeout: 30000,
        }
      );
    try {
      await db.adminSetting.deleteMany({ where: { key } });
      await db.auditLog.deleteMany({ where: { target: key } });
      const write = run(
        `const before = await readMerchantProfile(); before.draft.fields['brand.colors.accent'] = '#315542'; const saved = await saveMerchantProfile(before.draft, before.revision, before.activeDigest); const receipt = await publishMerchantProfile(saved.revision, saved.digest, false, { saveProfile: async () => ({ savedKeys: ['OMS_MERCHANT_PROFILE'], pending: true }) }); if (receipt.draftDigest !== saved.digest) process.exitCode = 1; await prisma.$disconnect();`
      );
      assert.equal(write.status, 0, write.stderr);
      const read = run(
        `const saved = await readMerchantProfile(); if (saved.revision !== 1 || saved.draft.fields['brand.colors.accent'] !== '#315542' || saved.storage !== 'database') process.exitCode = 1; await prisma.$disconnect();`
      );
      assert.equal(read.status, 0, read.stderr);
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_test_profile_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$`
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER reject_test_profile_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_test_profile_audit()`
      );
      const rejected = run(
        `const saved = await readMerchantProfile(); saved.draft.fields['brand.colors.accent'] = '#24354b'; try { await saveMerchantProfile(saved.draft, saved.revision, saved.activeDigest); process.exitCode = 1; } catch (error) { if (error.errorCode !== 'profile_unavailable') process.exitCode = 1; } await prisma.$disconnect();`
      );
      assert.equal(rejected.status, 0, rejected.stderr);
      const row = await db.adminSetting.findUniqueOrThrow({ where: { key } });
      assert.equal((row.value as { revision: number }).revision, 1);
      assert.equal(await db.auditLog.count({ where: { target: key } }), 2);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_test_profile_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_test_profile_audit()');
      await db.adminSetting.deleteMany({ where: { key } });
      await db.auditLog.deleteMany({ where: { target: key } });
      await db.$disconnect();
    }
  }
);

test(
  'store settings persist across processes and settings/audit writes are atomic',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
    const childEnvironment = {
      ...process.env,
      DATABASE_URL: testUrl!,
      NODE_ENV: 'test',
      OPENAI_API_KEY: '',
      PRINTFUL_API_KEY: '',
      STRIPE_SECRET_KEY: '',
      ENABLE_LIVE_OPENAI: 'false',
      ENABLE_LIVE_STRIPE: 'false',
      ENABLE_LIVE_PRINTFUL: 'false',
    };
    function run(code: string) {
      return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
        env: childEnvironment,
        encoding: 'utf8',
        timeout: 30000,
      });
    }
    const imports = `import { readStoreSettings, saveStoreSettings } from './backend/src/admin/store-settings.ts'; import { prisma } from './backend/src/config/database.ts';`;
    try {
      await db.adminSetting.deleteMany({ where: { key: 'store-operations-v1' } });
      await db.auditLog.deleteMany({ where: { action: 'store_settings_updated' } });
      const write = run(
        `${imports} const before = await readStoreSettings(); const saved = await saveStoreSettings({ imageModel: 'gpt-image-2.5-sunburst' }, before.revision); console.log(JSON.stringify(saved)); await prisma.$disconnect();`
      );
      assert.equal(write.status, 0, write.stderr);
      assert.match(write.stdout, /gpt-image-2.5-sunburst/);
      const read = run(
        `${imports} const saved = await readStoreSettings(); if (saved.values.imageModel !== 'gpt-image-2.5-sunburst' || saved.revision !== 1 || saved.storage !== 'database') process.exitCode = 1; await prisma.$disconnect();`
      );
      assert.equal(read.status, 0, read.stderr);
      assert.equal(await db.auditLog.count({ where: { action: 'store_settings_updated' } }), 1);
      // A failed audit insert must roll back the setting change as part of the same transaction.
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_test_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$`
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER reject_test_admin_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_test_admin_audit()`
      );
      const rejected = run(
        `${imports} try { await saveStoreSettings({ imageModel: 'gpt-image-2.5-flare' }, 1); process.exitCode = 1; } catch (error) { if (error.errorCode !== 'store_settings_unavailable') process.exitCode = 1; } await prisma.$disconnect();`
      );
      assert.equal(rejected.status, 0, rejected.stderr);
      const row = await db.adminSetting.findUniqueOrThrow({
        where: { key: 'store-operations-v1' },
      });
      assert.equal(
        (row.value as { values: { imageModel: string } }).values.imageModel,
        'gpt-image-2.5-sunburst'
      );
      assert.equal(await db.auditLog.count({ where: { action: 'store_settings_updated' } }), 1);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_test_admin_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_test_admin_audit()');
      await db.adminSetting.deleteMany({ where: { key: 'store-operations-v1' } });
      await db.auditLog.deleteMany({ where: { action: 'store_settings_updated' } });
      await db.$disconnect();
    }
  }
);
