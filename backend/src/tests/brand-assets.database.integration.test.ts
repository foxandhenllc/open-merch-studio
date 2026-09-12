import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.OMS_STORE_TEST_DATABASE_URL;
test(
  'brand assets survive restart and audit failures leave recoverable staged copies',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const directory = mkdtempSync(join(tmpdir(), 'oms-artwork-storage-test-'));
    const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
    const prefix = 'installation-brand-asset-v1:';
    const imports = `import assert from 'node:assert/strict'; import { service, original, storage, storageWrites } from './backend/src/tests/fixtures/collection-artwork-storage.ts'; import { collectionArtwork } from './backend/src/admin/collection-artwork.service.ts'; import { createBrandAssetsService } from './backend/src/admin/brand-assets.service.ts'; import { prisma } from './backend/src/config/database.ts'; collectionArtwork.binary = service.binary; const brands = createBrandAssetsService(() => storage);`;
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
    try {
      await db.adminSetting.deleteMany({ where: { key: { startsWith: prefix } } });
      const id = run(
        `const auth = await service.authorize({ filename: 'Brand.png', contentType: 'image/png', byteSize: original.length, rightsConfirmed: true }); await service.complete(auth.assetId); console.log(auth.assetId); await prisma.$disconnect();`
      );
      const hash = run(
        `const result = await brands.prepare({ assetId: '${id}', kind: 'logo', background: '#ffffff' }); console.log(result.hash); await prisma.$disconnect();`
      );
      assert.match(hash, /^[a-f0-9]{64}$/);
      run(
        `assert.ok((await brands.preview('${hash}')).length); await brands.prepare({ assetId: '${id}', kind: 'logo', background: '#ffffff' }); assert.equal(storageWrites, 0); await prisma.$disconnect();`
      );
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_brand_complete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'brand_asset_complete' THEN RAISE EXCEPTION 'test brand audit failure'; END IF; RETURN NEW; END $$`
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER reject_brand_complete BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_brand_complete()`
      );
      run(
        `await assert.rejects(() => brands.prepare({ assetId: '${id}', kind: 'share', background: '#ffffff' })); await prisma.$disconnect();`
      );
      const staged = await db.adminSetting.findMany({ where: { key: { startsWith: prefix } } });
      assert.equal(staged.length, 2);
      const pending = staged.find((row) => (row.value as { status: string }).status === 'staged')!;
      assert.ok(pending);
      await db.$executeRawUnsafe('DROP TRIGGER reject_brand_complete ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION reject_brand_complete()');
      run(
        `const result = await brands.prepare({ assetId: '${id}', kind: 'share', background: '#ffffff' }); assert.equal(storageWrites, 0); assert.ok((await brands.preview(result.hash)).length); await service.remove('${id}'); assert.ok((await brands.preview('${hash}')).length); await prisma.$disconnect();`
      );
      const audits = await db.auditLog.findMany({ where: { target: { startsWith: prefix } } });
      assert.equal(audits.filter((row) => row.action === 'brand_asset_complete').length, 2);
      assert.ok(
        audits.every((row) => !/namespace|path|filename/.test(JSON.stringify(row.metadata)))
      );
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_brand_complete ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_brand_complete()');
      await db.adminSetting.deleteMany({ where: { key: { startsWith: prefix } } });
      await db.auditLog.deleteMany({ where: { target: { startsWith: prefix } } });
      await db.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  }
);
