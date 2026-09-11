import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { imageModels, type ImageModelId } from './image-models.js';

export type StoreSettings = {
  imageModel: string;
  dailyAiBudgetCents: number;
  perSessionBudgetCents: number;
  freeDraftLimit: number;
};
export type SettingsSnapshot = {
  values: StoreSettings;
  revision: number;
  storage: 'database' | 'fixture';
};
export const storeSettingsKey = 'store-operations-v1';
const requestSettings = new AsyncLocalStorage<StoreSettings>();
let fixtureSnapshot: SettingsSnapshot | undefined;

const defaults = (): StoreSettings => ({
  imageModel: env.openaiDesignModel,
  dailyAiBudgetCents: env.dailyAiBudgetCents,
  perSessionBudgetCents: env.perSessionBudgetCents,
  freeDraftLimit: env.studioPassEnabled ? env.freeDraftLimit : Math.max(env.freeDraftLimit, 3),
});

export const currentStoreSettings = () => requestSettings.getStore();
export const activeImageModel = () => currentStoreSettings()?.imageModel ?? env.openaiDesignModel;
export const withStoreSettings = <T>(values: StoreSettings, operation: () => T): T =>
  requestSettings.run(values, operation);

function unavailable(): never {
  throw new HttpError(
    'Store settings could not be loaded or saved. Check the database connection.',
    503,
    'store_settings_unavailable'
  );
}

function parseSaved(value: unknown): { values: StoreSettings; revision: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable();
  const saved = value as { values: unknown; revision: unknown };
  if (!Number.isInteger(saved.revision) || Number(saved.revision) < 1) return unavailable();
  try {
    const patch = validateSettingsPatch(saved.values);
    if (Object.keys(patch).length !== 4) return unavailable();
    return { values: patch as StoreSettings, revision: Number(saved.revision) };
  } catch {
    return unavailable();
  }
}

export function validateSettingsPatch(value: unknown): Partial<StoreSettings> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError('Choose settings to save.', 400, 'invalid_store_settings');
  }
  const entries = Object.entries(value);
  if (!entries.length)
    throw new HttpError('Choose settings to save.', 400, 'invalid_store_settings');
  const limits: Record<string, [number, number]> = {
    dailyAiBudgetCents: [1, 1000000],
    perSessionBudgetCents: [1, 100000],
    freeDraftLimit: [0, 100],
  };
  for (const [key, input] of entries) {
    if (key === 'imageModel') {
      if (typeof input !== 'string' || !imageModels.some((model) => model.id === input)) {
        throw new HttpError('Choose a supported image model.', 400, 'invalid_image_model');
      }
    } else if (
      !Object.hasOwn(limits, key) ||
      typeof input !== 'number' ||
      !Number.isInteger(input) ||
      input < limits[key][0] ||
      input > limits[key][1]
    ) {
      throw new HttpError(
        'A setting is unknown or outside its allowed range.',
        400,
        'invalid_store_settings'
      );
    }
  }
  return Object.fromEntries(entries) as Partial<StoreSettings>;
}

/** There is no production in-memory fallback: a failed write must never look durable. */
export async function readStoreSettings(): Promise<SettingsSnapshot> {
  if (!env.databaseUrl) {
    if (env.nodeEnv === 'production') return unavailable();
    return structuredClone(
      fixtureSnapshot ?? { values: defaults(), revision: 0, storage: 'fixture' }
    );
  }
  try {
    const row = await prisma.adminSetting.findUnique({ where: { key: storeSettingsKey } });
    return {
      ...(row ? parseSaved(row.value) : { values: defaults(), revision: 0 }),
      storage: 'database',
    };
  } catch {
    return unavailable();
  }
}

export async function saveStoreSettings(
  input: unknown,
  expectedRevision: unknown
): Promise<SettingsSnapshot> {
  const patch = validateSettingsPatch(input);
  if (!Number.isInteger(expectedRevision) || Number(expectedRevision) < 0) {
    throw new HttpError('Refresh settings before saving.', 400, 'invalid_settings_revision');
  }
  const merge = (before: SettingsSnapshot): SettingsSnapshot => {
    if (before.revision !== expectedRevision) {
      throw new HttpError(
        'Settings changed in another session. Refresh and try again.',
        409,
        'settings_conflict'
      );
    }
    const values = { ...before.values, ...patch };
    if (values.perSessionBudgetCents > values.dailyAiBudgetCents) {
      throw new HttpError(
        'The session budget cannot exceed the daily budget.',
        400,
        'invalid_store_settings'
      );
    }
    // An environment-only custom model remains usable until the owner explicitly selects a reviewed choice.
    if (!imageModels.some((model) => model.id === values.imageModel)) {
      throw new HttpError(
        'Select a supported image model before saving store settings.',
        400,
        'invalid_image_model'
      );
    }
    return { values, revision: before.revision + 1, storage: before.storage };
  };
  if (!env.databaseUrl) {
    const next = merge(await readStoreSettings());
    fixtureSnapshot = structuredClone(next);
    return next;
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        const row = await tx.adminSetting.findUnique({ where: { key: storeSettingsKey } });
        const before: SettingsSnapshot = {
          ...(row ? parseSaved(row.value) : { values: defaults(), revision: 0 }),
          storage: 'database',
        };
        const next = merge(before);
        await tx.adminSetting.upsert({
          where: { key: storeSettingsKey },
          create: {
            key: storeSettingsKey,
            value: { values: next.values, revision: next.revision },
            updatedBy: 'store-admin',
          },
          update: {
            value: { values: next.values, revision: next.revision },
            updatedBy: 'store-admin',
          },
        });
        await tx.auditLog.create({
          data: {
            actor: 'store-admin',
            action: 'store_settings_updated',
            target: storeSettingsKey,
            metadata: { before: before.values, after: next.values, revision: next.revision },
          },
        });
        return next;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2034', 'P2002'].includes(error.code)
    ) {
      throw new HttpError(
        'Settings changed in another session. Refresh and try again.',
        409,
        'settings_conflict'
      );
    }
    return unavailable();
  }
}

export function isSelectableImageModel(model: string): model is ImageModelId {
  return imageModels.some((item) => item.id === model);
}
