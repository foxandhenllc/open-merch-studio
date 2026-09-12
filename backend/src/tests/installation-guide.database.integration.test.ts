import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
const testUrl = process.env.OMS_STORE_TEST_DATABASE_URL;
test(
  'setup confirmations and persona survive a new process with atomic audit rollback',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
    const key = 'installation-progress-v1';
    const run = (code: string) => {
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          `import assert from 'node:assert/strict'; import { readInstallationProgress, saveInstallationProgress } from './backend/src/admin/installation-progress.ts'; import { installationChecks } from './backend/src/admin/installation-checks.ts'; import { prisma } from './backend/src/config/database.ts'; ${code}`,
        ],
        {
          env: {
            ...process.env,
            DATABASE_URL: testUrl!,
            NODE_ENV: 'test',
            SUPABASE_SERVICE_ROLE_KEY: '',
            ENABLE_LIVE_OPENAI: 'false',
            ENABLE_LIVE_PRINTFUL: 'false',
            ENABLE_LIVE_STRIPE: 'false',
          },
          encoding: 'utf8',
          timeout: 30000,
        }
      );
      assert.equal(result.status, 0, result.stderr);
    };
    try {
      await db.adminSetting.deleteMany({ where: { key } });
      await db.auditLog.deleteMany({ where: { target: key } });
      run(
        `const before = await readInstallationProgress(); await saveInstallationProgress({ revision: before.revision, basis: before.basis, persona: 'local', completed: ['identity', 'domain'] }); await prisma.$disconnect();`
      );
      run(
        `const after = await readInstallationProgress(); assert.equal(after.persona, 'local'); assert.deepEqual(after.completed, ['identity', 'domain']); assert.equal(after.storage, 'database'); assert.equal((await installationChecks()).checks.find(c => c.id === 'database').status, 'verified'); await prisma.$disconnect();`
      );
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_installation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'installation_progress_saved' THEN RAISE EXCEPTION 'test audit error'; END IF; RETURN NEW; END $$`
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER reject_installation_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_installation_audit()`
      );
      run(
        `const before = await readInstallationProgress(); await assert.rejects(() => saveInstallationProgress({ revision: before.revision, basis: before.basis, persona: 'coffee', completed: [] })); assert.deepEqual(await readInstallationProgress(), before); await prisma.$disconnect();`
      );
      assert.equal(await db.auditLog.count({ where: { target: key } }), 1);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_installation_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_installation_audit()');
      await db.adminSetting.deleteMany({ where: { key } });
      await db.auditLog.deleteMany({ where: { target: key } });
      await db.$disconnect();
    }
  }
);
