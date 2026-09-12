import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.OMS_STORE_TEST_DATABASE_URL;
test(
  'legacy model migration and image usage reconciliation survive restart and audit failure',
  { skip: !testUrl },
  async () => {
    const url = new URL(testUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/oms_store_admin_test');
    const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
    const sessionId = randomUUID(),
      key = 'store-operations-v1';
    const imports = `import assert from 'node:assert/strict'; import { prisma } from './backend/src/config/database.ts';
    import { readStoreSettings, withStoreSettings } from './backend/src/admin/store-settings.ts';
    import { reserveLiveDesignSpend, releaseLiveDesignSpend } from './backend/src/services/runtime-store.ts';
    import { imageUsageReceipt } from './backend/src/services/image-usage.ts';
    import { reconcileImageUsage } from './backend/src/services/image-usage-reconciliation.ts';`;
    const run = (code: string) => {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', imports + code],
        {
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DATABASE_URL: testUrl!,
            OPENAI_API_KEY: '',
            STRIPE_SECRET_KEY: '',
            PRINTFUL_API_KEY: '',
            ENABLE_LIVE_OPENAI: 'false',
            ENABLE_LIVE_STRIPE: 'false',
            ENABLE_LIVE_PRINTFUL: 'false',
          },
          encoding: 'utf8',
          timeout: 30000,
        }
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim().split('\n').at(-1)!;
    };
    try {
      await db.adminSetting.upsert({
        where: { key },
        create: {
          key,
          value: {
            revision: 7,
            values: {
              imageModel: 'gpt-image-2',
              dailyAiBudgetCents: 1000,
              perSessionBudgetCents: 800,
              freeDraftLimit: 10,
            },
          },
        },
        update: {
          value: {
            revision: 7,
            values: {
              imageModel: 'gpt-image-2',
              dailyAiBudgetCents: 1000,
              perSessionBudgetCents: 800,
              freeDraftLimit: 10,
            },
          },
        },
      });
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_model_migration_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'legacy_image_model_migrated' THEN RAISE EXCEPTION 'fixture migration audit failure'; END IF; RETURN NEW; END $$`
      );
      await db.$executeRawUnsafe(
        'CREATE TRIGGER reject_model_migration_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_model_migration_audit()'
      );
      run(
        `await assert.rejects(readStoreSettings, e => e.errorCode === 'store_settings_unavailable'); await prisma.$disconnect();`
      );
      assert.equal(
        (await db.adminSetting.findUniqueOrThrow({ where: { key } })).value &&
          (
            (await db.adminSetting.findUniqueOrThrow({ where: { key } })).value as {
              revision: number;
            }
          ).revision,
        7
      );
      await db.$executeRawUnsafe('DROP TRIGGER reject_model_migration_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION reject_model_migration_audit()');
      run(
        `const first = await readStoreSettings(); assert.equal(first.values.imageModel, 'gpt-image-2.5-flare'); assert.equal(first.revision, 8); assert.equal(first.values.perSessionBudgetCents, 800); await prisma.$disconnect();`
      );
      run(`assert.equal((await readStoreSettings()).revision, 8); await prisma.$disconnect();`);
      assert.equal(
        await db.auditLog.count({ where: { action: 'legacy_image_model_migrated', target: key } }),
        1
      );
      const reservation = JSON.parse(
        run(
          `const settings = await readStoreSettings(); const reservation = await withStoreSettings(settings.values, () => reserveLiveDesignSpend({ sessionId: '${sessionId}', action: 'rough_draft', provider: 'openai', estimatedCostCents: 50 })); assert.equal(reservation.allowed, true); console.log(JSON.stringify(reservation)); await prisma.$disconnect();`
        )
      );
      const usage = {
        input_tokens: 3000,
        input_tokens_details: { text_tokens: 1000, image_tokens: 2000 },
        output_tokens: 1000,
        total_tokens: 4000,
      };
      const settle = `const reservation = ${JSON.stringify(reservation)}; const usage = imageUsageReceipt('gpt-image-2.5-flare', ${JSON.stringify(usage)});`;
      await db.$executeRawUnsafe(
        `CREATE FUNCTION reject_image_usage_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'image_usage_recorded' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$`
      );
      await db.$executeRawUnsafe(
        'CREATE TRIGGER reject_image_usage_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_image_usage_audit()'
      );
      run(
        `${settle} await assert.rejects(() => reconcileImageUsage(reservation, usage), e => e.errorCode === 'image_usage_unavailable'); await prisma.$disconnect();`
      );
      assert.equal(
        (await db.aiSpendEvent.findUniqueOrThrow({ where: { id: reservation.event.id } }))
          .estimatedCostCents,
        50
      );
      await db.$executeRawUnsafe('DROP TRIGGER reject_image_usage_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION reject_image_usage_audit()');
      run(`${settle} await reconcileImageUsage(reservation, usage); await prisma.$disconnect();`);
      run(
        `${settle} await reconcileImageUsage(reservation, usage); await assert.rejects(() => releaseLiveDesignSpend(reservation)); await prisma.$disconnect();`
      );
      assert.equal(
        (await db.aiSpendEvent.findUniqueOrThrow({ where: { id: reservation.event.id } }))
          .estimatedCostCents,
        6
      );
      assert.equal(
        await db.auditLog.count({ where: { id: `${reservation.event.id}:image-usage` } }),
        1
      );
      assert.equal(
        await db.aiSpendEvent.count({ where: { id: `${reservation.event.id}:released` } }),
        0
      );
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS reject_model_migration_audit ON audit_logs'
      );
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_model_migration_audit()');
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_image_usage_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS reject_image_usage_audit()');
      await db.studioSession.deleteMany({ where: { id: sessionId } });
      await db.auditLog.deleteMany({
        where: { action: { in: ['image_usage_recorded', 'legacy_image_model_migrated'] } },
      });
      await db.adminSetting.deleteMany({ where: { key } });
      await db.$disconnect();
    }
  }
);
