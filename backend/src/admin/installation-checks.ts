import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { collectionArtworkStorage } from './collection-artwork-storage.js';
import { requiredMigrations } from './migration-contract.js';
import { connectionSummaries } from './provider-connections.js';

type Check = {
  id: string;
  title: string;
  status: 'verified' | 'action' | 'simulated' | 'configured';
  detail: string;
};
type Migration = { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null };
export function assessMigrations(rows: Migration[]): Check {
  const finished = new Set(
    rows.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name)
  );
  const missing = requiredMigrations.filter((name) => !finished.has(name));
  const interrupted = rows.some((row) => !row.finished_at && !row.rolled_back_at);
  return {
    id: 'database',
    title: 'Database & migrations',
    status: missing.length || interrupted ? 'action' : 'verified',
    detail:
      missing.length || interrupted
        ? `${missing.length} required migrations are missing${interrupted ? '; an unfinished migration also needs repair' : ''}. Follow the database recovery steps in the installation checklist before operating the store.`
        : `Database reached. All ${requiredMigrations.length} required migrations are recorded complete. This check does not create or change data.`,
  };
}
export async function installationChecks() {
  const checks: Check[] = [];
  if (!env.databaseUrl)
    checks.push({
      id: 'database',
      title: 'Database & migrations',
      status: 'simulated',
      detail:
        'Local server-session storage. Connect your PostgreSQL account and apply migrations for durable settings and orders.',
    });
  else {
    try {
      const rows = await prisma.$queryRaw<
        Migration[]
      >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
      // Also check the application table independently of migration bookkeeping.
      await prisma.adminSetting.findFirst({ select: { key: true } });
      checks.push(assessMigrations(rows));
    } catch {
      checks.push({
        id: 'database',
        title: 'Database & migrations',
        status: 'action',
        detail:
          'Database or migration history could not be read. Check the saved connection, redeploy, and follow the migration steps. Your existing data has not been changed.',
      });
    }
  }
  const storage = collectionArtworkStorage();
  if (!storage)
    checks.push({
      id: 'storage',
      title: 'Private artwork storage',
      status: env.databaseUrl ? 'action' : 'simulated',
      detail: env.databaseUrl
        ? 'Connect the private upload bucket in Connections. Artwork needs its original private files as well as database records.'
        : 'Artwork uses local fixtures in this server session. No external storage has been verified.',
    });
  else {
    try {
      await storage.assertPrivate();
      checks.push({
        id: 'storage',
        title: 'Private artwork storage',
        status: 'verified',
        detail:
          'The configured upload bucket was reached and reports private access. Prepare a sample upload to verify writing and readback.',
      });
    } catch {
      checks.push({
        id: 'storage',
        title: 'Private artwork storage',
        status: 'action',
        detail:
          'Private bucket access could not be verified. Check the project, service role and bucket settings. Do not make artwork public to resolve this.',
      });
    }
  }
  for (const [id, required] of [
    ['stripe', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']],
    ['printful', ['PRINTFUL_API_KEY', 'PRINTFUL_STORE_ID']],
    ['openai', ['OPENAI_API_KEY']],
    ['email', ['RESEND_API_KEY', 'EMAIL_FROM']],
  ] as const) {
    const provider = connectionSummaries().find((item) => item.id === id)!;
    const complete = required.every((key) =>
      provider.fields.some((field) => field.key === key && field.configured)
    );
    checks.push({
      id,
      title: provider.name,
      status: complete ? 'configured' : 'action',
      detail: complete
        ? 'Required values are present in this running deployment. Account access, event delivery and live behavior still need verification.'
        : id === 'openai'
          ? 'Optional: connect this account only if you want AI generation. Uploaded artwork does not require it.'
          : id === 'email'
            ? 'Connect and verify a sender before enabling customer emails. Manual support remains available through your published contact details.'
            : 'Connect the account and required values, redeploy, then refresh. Opening an account or saving a key does not enable sales.',
    });
  }
  checks.push({
    id: 'production',
    title: 'Production review',
    status: env.printfulAutoConfirmOrders ? 'action' : 'verified',
    detail: env.printfulAutoConfirmOrders
      ? 'Automatic production confirmation is enabled. Restore the supported manual-review configuration before launch.'
      : 'Automatic production confirmation is disabled. Paid orders require review before production.',
  });
  return {
    checkedAt: new Date().toISOString(),
    checks,
    checkoutAccessMode: env.checkoutAccessMode,
  };
}
