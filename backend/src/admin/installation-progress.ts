import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { merchantConfig } from '../generated/merchant-config.js';
import { installedPolicy } from '../generated/store-profile.js';
import { HttpError } from '../middleware.js';
import { withCollectionLock } from './collection-lock.js';
import {
  installationPersonas,
  installationTasks,
  type InstallationPersona,
  type InstallationTask,
} from './installation-tasks.js';

const key = 'installation-progress-v1';
type Progress = {
  version: 1;
  revision: number;
  persona: InstallationPersona;
  completed: InstallationTask[];
  context: string;
};
let fixture: Progress | undefined;
// Only a digest is retained. Changing the deployed identity or provider credentials clears earlier attestations.
const context = () =>
  createHash('sha256')
    .update(
      JSON.stringify({
        merchantConfig,
        installedPolicy,
        database: env.databaseUrl,
        storage: env.supabaseUrl,
        uploadBucket: env.supabaseUploadBucket,
        storageKey: env.supabaseServiceRoleKey,
        printful: env.printfulApiKey,
        printfulStore: env.printfulStoreId,
        stripe: env.stripeSecretKey,
        webhook: env.stripeWebhookSecret,
        sender: env.emailFrom,
        resend: env.resendApiKey,
        openai: env.openaiApiKey,
        openaiProject: env.openaiProjectId,
        openaiOrganization: env.openaiOrganizationId,
        printfulWebhook: env.printfulWebhookSecret,
        printfulWebhookKey: env.printfulWebhookPublicKey,
        resendWebhook: env.resendWebhookSecret,
        emailProvider: env.emailProvider,
        emailEnabled: env.transactionalEmailsEnabled,
        liveOpenai: env.enableLiveOpenAi,
        livePrintful: env.enableLivePrintful,
        liveStripe: env.enableLiveStripe,
        checkoutMode: env.checkoutAccessMode,
        paymentsAuthorized: env.allowLivePayments,
        fulfillmentAuthorized: env.allowLiveFulfillment,
        autoConfirm: env.printfulAutoConfirmOrders,
      })
    )
    .digest('hex');
const initial = (): Progress => ({
  version: 1,
  revision: 0,
  persona: 'creator',
  completed: [],
  context: context(),
});
const unavailable = () =>
  new HttpError(
    'Setup progress could not be loaded or saved. Check the database and retry.',
    503,
    'installation_progress_unavailable'
  );
function parse(value: unknown): Progress {
  const r = value as Progress;
  if (
    !r ||
    r.version !== 1 ||
    !Number.isSafeInteger(r.revision) ||
    r.revision < 1 ||
    !installationPersonas.some(({ id }) => id === r.persona) ||
    !Array.isArray(r.completed) ||
    r.completed.some((id) => !installationTasks.some((task) => task.id === id)) ||
    new Set(r.completed).size !== r.completed.length ||
    !/^[a-f0-9]{64}$/.test(r.context)
  )
    throw unavailable();
  return r;
}
async function record(tx?: Prisma.TransactionClient) {
  if (!env.databaseUrl) {
    if (env.nodeEnv === 'production') throw unavailable();
    return structuredClone(fixture ?? initial());
  }
  const row = await (tx ?? prisma).adminSetting.findUnique({ where: { key } });
  return row ? parse(row.value) : initial();
}
const snapshot = (r: Progress) => ({
  revision: r.revision,
  basis: context(),
  persona: r.persona,
  completed: r.context === context() ? r.completed : [],
  contextChanged: r.context !== context(),
  storage: env.databaseUrl ? ('database' as const) : ('fixture' as const),
  personas: installationPersonas,
  tasks: installationTasks,
});
export async function readInstallationProgress() {
  try {
    return snapshot(await record());
  } catch {
    throw unavailable();
  }
}
export async function saveInstallationProgress(input: unknown) {
  const value = input as {
    revision: number;
    basis: string;
    persona: InstallationPersona;
    completed: InstallationTask[];
  };
  if (
    !value ||
    Object.keys(value).sort().join() !== 'basis,completed,persona,revision' ||
    !Number.isSafeInteger(value.revision) ||
    !installationPersonas.some(({ id }) => id === value.persona) ||
    !Array.isArray(value.completed) ||
    value.completed.length > installationTasks.length ||
    value.completed.some((id) => !installationTasks.some((task) => task.id === id)) ||
    new Set(value.completed).size !== value.completed.length
  )
    throw new HttpError('Choose a supported store type and setup tasks.', 400);
  try {
    return await withCollectionLock(async (tx) => {
      if (value.basis !== context())
        throw new HttpError(
          'The deployed store changed. Reload setup progress before confirming tasks.',
          409
        );
      const before = await record(tx);
      if (before.revision !== value.revision)
        throw new HttpError(
          'Setup progress changed in another session. Reload it before saving.',
          409
        );
      const next: Progress = {
        version: 1,
        revision: before.revision + 1,
        persona: value.persona,
        completed: [...value.completed],
        context: context(),
      };
      if (tx) {
        const data = JSON.parse(JSON.stringify(next)) as Prisma.InputJsonValue;
        await tx.adminSetting.upsert({
          where: { key },
          create: { key, value: data, updatedBy: 'store-admin' },
          update: { value: data, updatedBy: 'store-admin' },
        });
        await tx.auditLog.create({
          data: {
            actor: 'store-admin',
            action: 'installation_progress_saved',
            target: key,
            metadata: {
              revision: next.revision,
              persona: next.persona,
              completedCount: next.completed.length,
            },
          },
        });
      } else fixture = next;
      return snapshot(next);
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw unavailable();
  }
}
