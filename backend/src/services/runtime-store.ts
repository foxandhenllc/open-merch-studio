import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { HttpError } from '../middleware.js';
import { classifyOperationalError, logOperationalEvent } from '../utils/operational-logger.js';
import type {
  AdminReport,
  AdminSettings,
  AllowanceState,
  LaunchReadiness,
  QuoteBreakdown,
  StudioPass,
  StudioSession,
} from '../types/catalog.js';
import { getRuntimeArtifactCounts, saveRuntimeQuote } from './runtime-artifact-store.js';
import { assessLaunchReadiness } from './launch-readiness.service.js';
import {
  deriveDesignAllowance,
  designActionDenial,
  designAllowanceSource,
  type DesignAllowanceAction,
  type DesignAllowanceSource,
} from './design-allowance.service.js';
export {
  findReusableRuntimeMockup as findReusableMockup,
  getRuntimeDraft as getDraft,
  getRuntimeOrder as getOrder,
  getRuntimeQuote as getQuote,
  listRuntimeOrders as listOrders,
  saveRuntimeDraft as saveDraft,
  saveRuntimeIdea as saveIdea,
  saveRuntimeMockup as saveMockup,
  saveRuntimeOrder as saveOrder,
} from './runtime-artifact-store.js';

type LedgerEvent = {
  id: string;
  sessionId: string;
  designAssetId?: string;
  action: DesignAllowanceAction;
  provider: 'mock' | 'openai-ready' | 'openai' | 'fixture' | 'printful-ready' | 'printful';
  estimatedCostCents: number;
  createdAt: string;
};

export type LiveDesignSpendReservation = {
  allowed: boolean;
  allowance: AllowanceState;
  message?: string;
  event?: LedgerEvent;
  allowanceSource?: DesignAllowanceSource;
};

type RuntimeState = {
  sessions: Map<string, StudioSession>;
  passes: Map<string, StudioPass>;
  ledger: LedgerEvent[];
  settings: AdminSettings;
};

const nowIso = () => new Date().toISOString();

const createId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const defaultSettings = (): AdminSettings => ({
  studioPassPriceCents: env.studioPassPriceCents,
  freeDraftLimit: env.studioPassEnabled ? env.freeDraftLimit : Math.max(env.freeDraftLimit, 3),
  dailyAiBudgetCents: env.dailyAiBudgetCents,
  perSessionBudgetCents: env.perSessionBudgetCents,
  liveOpenAiEnabled: Boolean(env.openaiApiKey && env.enableLiveOpenAi),
  liveStripeEnabled: Boolean(env.stripeSecretKey && env.enableLiveStripe),
  livePrintfulEnabled: Boolean(env.printfulApiKey && env.enableLivePrintful),
  checkoutEnabled: env.checkoutEnabled,
  fulfillmentEnabled: env.fulfillmentEnabled,
  defaultMarginPercent: env.targetMarginPercent,
  minMarginCents: env.minMarginCents,
});

const state: RuntimeState = {
  sessions: new Map(),
  passes: new Map(),
  ledger: [],
  settings: defaultSettings(),
};

export function runtimeId(prefix: string): string {
  return createId(prefix);
}

export function runtimeNow(): string {
  return nowIso();
}

export function getRuntimeSettings(): AdminSettings {
  return { ...state.settings };
}

export function updateRuntimeSettings(patch: Partial<AdminSettings>): {
  before: AdminSettings;
  after: AdminSettings;
} {
  const before = getRuntimeSettings();
  const requestedOpenAi =
    Object.prototype.hasOwnProperty.call(patch, 'liveOpenAiEnabled') && patch.liveOpenAiEnabled;
  const requestedStripe =
    Object.prototype.hasOwnProperty.call(patch, 'liveStripeEnabled') && patch.liveStripeEnabled;
  const requestedPrintful =
    Object.prototype.hasOwnProperty.call(patch, 'livePrintfulEnabled') && patch.livePrintfulEnabled;
  state.settings = {
    ...state.settings,
    ...patch,
    liveOpenAiEnabled: requestedOpenAi
      ? Boolean(env.openaiApiKey && env.enableLiveOpenAi)
      : before.liveOpenAiEnabled,
    liveStripeEnabled: requestedStripe
      ? Boolean(env.stripeSecretKey && env.enableLiveStripe)
      : before.liveStripeEnabled,
    livePrintfulEnabled: requestedPrintful
      ? Boolean(env.printfulApiKey && env.enableLivePrintful)
      : before.livePrintfulEnabled,
  };
  return { before, after: getRuntimeSettings() };
}

export function createStudioSession(sessionId?: string): StudioSession {
  const now = nowIso();
  const session: StudioSession = {
    id: sessionId || createId('sess'),
    status: 'guest',
    freeDraftsUsed: 0,
    freeDraftLimit: state.settings.freeDraftLimit,
    createdAt: now,
    updatedAt: now,
  };
  state.sessions.set(session.id, session);
  return { ...session };
}

export function getOrCreateSession(sessionId?: string): StudioSession {
  if (sessionId) {
    const existing = state.sessions.get(sessionId);
    if (existing) return { ...existing, studioPass: getStudioPassForSession(existing.id) };
  }
  return createStudioSession(sessionId);
}

export async function getOrCreateDurableSession(sessionId?: string): Promise<StudioSession> {
  const runtimeSession = sessionId ? state.sessions.get(sessionId) : undefined;
  if (runtimeSession) {
    return { ...runtimeSession, studioPass: getStudioPassForSession(runtimeSession.id) };
  }

  if (env.databaseUrl && sessionId) {
    try {
      const persisted = await prisma.studioSession.findUnique({
        where: { id: sessionId },
        include: { passes: { orderBy: { createdAt: 'desc' } } },
      });
      if (persisted) {
        const restored: StudioSession = {
          id: persisted.id,
          status: persisted.status as StudioSession['status'],
          freeDraftsUsed: persisted.freeDraftsUsed,
          freeDraftLimit: Math.max(persisted.freeDraftLimit, state.settings.freeDraftLimit),
          createdAt: persisted.createdAt.toISOString(),
          updatedAt: persisted.updatedAt.toISOString(),
        };
        state.sessions.set(restored.id, restored);
        for (const pass of persisted.passes) {
          state.passes.set(pass.id, {
            id: pass.id,
            sessionId: pass.sessionId,
            status: pass.status as StudioPass['status'],
            priceCents: pass.priceCents,
            creditCents: pass.creditCents,
            includedRoughDrafts: pass.includedRoughDrafts,
            includedEdits: pass.includedEdits,
            includedFinals: pass.includedFinals,
            roughDraftsUsed: pass.roughDraftsUsed,
            editsUsed: pass.editsUsed,
            finalsUsed: pass.finalsUsed,
            appliedOrderId: pass.appliedOrderId ?? undefined,
            createdAt: pass.createdAt.toISOString(),
            expiresAt: pass.expiresAt?.toISOString(),
          });
        }
        return { ...restored, studioPass: getStudioPassForSession(restored.id) };
      }
    } catch {
      // Fall through to a runtime session when persistence is unavailable.
    }
  }

  const session = createStudioSession(sessionId);
  if (env.databaseUrl) {
    try {
      await prisma.studioSession.upsert({
        where: { id: session.id },
        update: {},
        create: {
          id: session.id,
          status: session.status,
          freeDraftsUsed: session.freeDraftsUsed,
          freeDraftLimit: session.freeDraftLimit,
          createdAt: new Date(session.createdAt),
        },
      });
    } catch {
      // Runtime session remains available if persistence is unavailable.
    }
  }
  return session;
}

export function touchSession(sessionId: string, patch: Partial<StudioSession>): StudioSession {
  const existing = getOrCreateSession(sessionId);
  const next: StudioSession = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: nowIso(),
  };
  state.sessions.set(next.id, next);
  return { ...next, studioPass: getStudioPassForSession(next.id) };
}

export function getStudioPassForSession(sessionId: string): StudioPass | undefined {
  return Array.from(state.passes.values()).find(
    (pass) => pass.sessionId === sessionId && pass.status !== 'expired'
  );
}

export function getStudioPassById(passId?: string): StudioPass | undefined {
  return passId ? state.passes.get(passId) : undefined;
}

export function createStudioPass(
  sessionId: string,
  status: 'simulated' | 'purchased' = 'simulated'
) {
  const existing = getStudioPassForSession(sessionId);
  if (existing) return existing;

  const pass: StudioPass = {
    id: createId('pass'),
    sessionId,
    status,
    priceCents: state.settings.studioPassPriceCents,
    creditCents: state.settings.studioPassPriceCents,
    includedRoughDrafts: 8,
    includedEdits: 2,
    includedFinals: 1,
    roughDraftsUsed: 0,
    editsUsed: 0,
    finalsUsed: 0,
    createdAt: nowIso(),
  };
  state.passes.set(pass.id, pass);
  touchSession(sessionId, {});
  return { ...pass };
}

export function getAllowanceState(sessionId: string): AllowanceState {
  const session = getOrCreateSession(sessionId);
  const pass = getStudioPassForSession(session.id);
  return deriveDesignAllowance(session, pass, env.studioPassEnabled);
}

const startOfToday = (): Date => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

function runtimeSpendTotals(sessionId: string): { sessionSpend: number; dailySpend: number } {
  const start = startOfToday().toISOString();
  const todaysEvents = state.ledger.filter((event) => event.createdAt >= start);
  return {
    sessionSpend: todaysEvents
      .filter((event) => event.sessionId === sessionId)
      .reduce((total, event) => total + event.estimatedCostCents, 0),
    dailySpend: todaysEvents.reduce((total, event) => total + event.estimatedCostCents, 0),
  };
}

async function durableSpendTotals(
  sessionId: string
): Promise<{ sessionSpend: number; dailySpend: number }> {
  if (!env.databaseUrl) return runtimeSpendTotals(sessionId);
  const today = startOfToday();
  try {
    const [sessionTotal, dailyTotal] = await Promise.all([
      prisma.aiSpendEvent.aggregate({
        where: { sessionId, createdAt: { gte: today } },
        _sum: { estimatedCostCents: true },
      }),
      prisma.aiSpendEvent.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { estimatedCostCents: true },
      }),
    ]);
    return {
      sessionSpend: sessionTotal._sum.estimatedCostCents ?? 0,
      dailySpend: dailyTotal._sum.estimatedCostCents ?? 0,
    };
  } catch {
    return runtimeSpendTotals(sessionId);
  }
}

export async function authorizeDesignAction(
  sessionId: string,
  action: LedgerEvent['action'],
  pendingCostCents = 0
): Promise<{ allowed: boolean; allowance: AllowanceState; message?: string }> {
  const session = await getOrCreateDurableSession(sessionId);
  const allowance = getAllowanceState(session.id);
  const { sessionSpend, dailySpend } = await durableSpendTotals(session.id);

  if (dailySpend + pendingCostCents > state.settings.dailyAiBudgetCents) {
    return {
      allowed: false,
      allowance,
      message: 'Daily design budget is paused. Try again later or contact support.',
    };
  }
  if (sessionSpend + pendingCostCents > state.settings.perSessionBudgetCents) {
    return {
      allowed: false,
      allowance,
      message: 'This design session reached its generation budget. Checkout or contact support.',
    };
  }

  if (action === 'rough_draft') {
    if (allowance.freeDraftsRemaining > 0 || allowance.roughDraftsRemaining > 0) {
      return { allowed: true, allowance };
    }
    return { allowed: false, allowance, message: allowance.message };
  }

  if (action === 'edit' && allowance.editsRemaining <= 0) {
    return { allowed: false, allowance, message: allowance.message };
  }

  if (action === 'final' && allowance.finalsRemaining <= 0) {
    return { allowed: false, allowance, message: allowance.message };
  }

  return { allowed: true, allowance };
}

const liveAiSpendLockName = 'open-merch-studio:live-ai-spend:v1';

function syncDurableAllowanceState(params: {
  session: {
    id: string;
    status: string;
    freeDraftsUsed: number;
    freeDraftLimit: number;
    createdAt: Date;
    updatedAt: Date;
  };
  pass?: {
    id: string;
    sessionId: string;
    status: string;
    priceCents: number;
    creditCents: number;
    includedRoughDrafts: number;
    includedEdits: number;
    includedFinals: number;
    roughDraftsUsed: number;
    editsUsed: number;
    finalsUsed: number;
    appliedOrderId: string | null;
    createdAt: Date;
    expiresAt: Date | null;
  } | null;
}): void {
  state.sessions.set(params.session.id, {
    id: params.session.id,
    status: params.session.status as StudioSession['status'],
    freeDraftsUsed: params.session.freeDraftsUsed,
    freeDraftLimit: params.session.freeDraftLimit,
    createdAt: params.session.createdAt.toISOString(),
    updatedAt: params.session.updatedAt.toISOString(),
  });

  for (const [passId, pass] of state.passes.entries()) {
    if (pass.sessionId === params.session.id && passId !== params.pass?.id) {
      state.passes.delete(passId);
    }
  }
  if (params.pass) {
    state.passes.set(params.pass.id, {
      id: params.pass.id,
      sessionId: params.pass.sessionId,
      status: params.pass.status as StudioPass['status'],
      priceCents: params.pass.priceCents,
      creditCents: params.pass.creditCents,
      includedRoughDrafts: params.pass.includedRoughDrafts,
      includedEdits: params.pass.includedEdits,
      includedFinals: params.pass.includedFinals,
      roughDraftsUsed: params.pass.roughDraftsUsed,
      editsUsed: params.pass.editsUsed,
      finalsUsed: params.pass.finalsUsed,
      appliedOrderId: params.pass.appliedOrderId ?? undefined,
      createdAt: params.pass.createdAt.toISOString(),
      expiresAt: params.pass.expiresAt?.toISOString(),
    });
  }
}

/**
 * Atomically reserves live provider spend before any provider call. One
 * transaction-level PostgreSQL advisory lock serializes the daily and session
 * total checks with the insert, preventing concurrent requests from both
 * observing the same remaining budget. Provider failures release the matching
 * reservation through `releaseLiveDesignSpend`.
 */
export async function reserveLiveDesignSpend(
  params: {
    sessionId: string;
    designAssetId?: string;
    action: LedgerEvent['action'];
    provider: 'openai';
    estimatedCostCents: number;
  },
  db: typeof prisma = prisma
): Promise<LiveDesignSpendReservation> {
  if (!env.databaseUrl) {
    throw new HttpError(
      'Live design generation requires durable PostgreSQL spend controls.',
      503,
      'live_ai_durable_storage_required'
    );
  }

  const estimatedCostCents = Math.max(0, Math.ceil(params.estimatedCostCents));
  const eventId = createId('ledger');
  const createdAt = new Date();
  try {
    const reserved = await db.$transaction(async (tx) => {
      // PostgreSQL returns `void` from pg_advisory_xact_lock, which Prisma
      // cannot deserialize. Casting preserves the transaction-scoped lock
      // while returning a supported scalar type.
      await tx.$queryRaw<Array<{ locked: string }>>`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${liveAiSpendLockName}, 0)
        )::text AS locked
      `;

      let durableSession = await tx.studioSession.upsert({
        where: { id: params.sessionId },
        update: {},
        create: {
          id: params.sessionId,
          status: 'guest',
          freeDraftsUsed: 0,
          freeDraftLimit: state.settings.freeDraftLimit,
        },
      });
      if (durableSession.freeDraftLimit < state.settings.freeDraftLimit) {
        durableSession = await tx.studioSession.update({
          where: { id: durableSession.id },
          data: { freeDraftLimit: state.settings.freeDraftLimit },
        });
      }

      let durablePass = await tx.studioPass.findFirst({
        where: { sessionId: durableSession.id, status: { not: 'expired' } },
        orderBy: { createdAt: 'desc' },
      });
      const today = startOfToday();
      const sessionTotal = await tx.aiSpendEvent.aggregate({
        where: { sessionId: durableSession.id, createdAt: { gte: today } },
        _sum: { estimatedCostCents: true },
      });
      const dailyTotal = await tx.aiSpendEvent.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { estimatedCostCents: true },
      });
      const sessionSpend = sessionTotal._sum.estimatedCostCents ?? 0;
      const dailySpend = dailyTotal._sum.estimatedCostCents ?? 0;

      if (dailySpend + estimatedCostCents > state.settings.dailyAiBudgetCents) {
        return {
          allowed: false as const,
          message: 'Daily design budget is paused. Try again later or contact support.',
          session: durableSession,
          pass: durablePass,
        };
      }
      if (sessionSpend + estimatedCostCents > state.settings.perSessionBudgetCents) {
        return {
          allowed: false as const,
          message:
            'This design session reached its generation budget. Checkout or contact support.',
          session: durableSession,
          pass: durablePass,
        };
      }

      const allowance = deriveDesignAllowance(durableSession, durablePass, env.studioPassEnabled);
      const denial = designActionDenial(params.action, allowance);
      if (denial) {
        return {
          allowed: false as const,
          message: denial,
          session: durableSession,
          pass: durablePass,
        };
      }

      const allowanceSource = designAllowanceSource(params.action, allowance);

      await tx.aiSpendEvent.create({
        data: {
          id: eventId,
          sessionId: durableSession.id,
          designAssetId: params.designAssetId,
          action: params.action,
          provider: params.provider,
          estimatedCostCents,
          createdAt,
        },
      });

      if (allowanceSource === 'free_draft') {
        durableSession = await tx.studioSession.update({
          where: { id: durableSession.id },
          data: { freeDraftsUsed: { increment: 1 } },
        });
      } else if (allowanceSource === 'rough_draft' && durablePass) {
        durablePass = await tx.studioPass.update({
          where: { id: durablePass.id },
          data: { roughDraftsUsed: { increment: 1 } },
        });
      } else if (allowanceSource === 'edit' && durablePass) {
        durablePass = await tx.studioPass.update({
          where: { id: durablePass.id },
          data: { editsUsed: { increment: 1 } },
        });
      } else if (allowanceSource === 'final' && durablePass) {
        durablePass = await tx.studioPass.update({
          where: { id: durablePass.id },
          data: { finalsUsed: { increment: 1 } },
        });
      }

      return {
        allowed: true as const,
        session: durableSession,
        pass: durablePass,
        allowanceSource,
      };
    });

    syncDurableAllowanceState({ session: reserved.session, pass: reserved.pass });
    if (!reserved.allowed) {
      return {
        allowed: false,
        allowance: getAllowanceState(reserved.session.id),
        message: reserved.message,
      };
    }

    const event: LedgerEvent = {
      id: eventId,
      sessionId: reserved.session.id,
      designAssetId: params.designAssetId,
      action: params.action,
      provider: params.provider,
      estimatedCostCents,
      createdAt: createdAt.toISOString(),
    };
    if (!state.ledger.some((candidate) => candidate.id === event.id)) {
      state.ledger.push(event);
    }
    return {
      allowed: true,
      allowance: getAllowanceState(reserved.session.id),
      event,
      allowanceSource: reserved.allowanceSource,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    logOperationalEvent('error', 'openai_spend_reservation_failed', {
      ...classifyOperationalError(error),
      outcome: 'generation_blocked',
    });
    throw new HttpError(
      'Live design generation is temporarily unavailable because spend could not be durably reserved.',
      503,
      'live_ai_spend_reservation_failed'
    );
  }
}

/**
 * Reconciles a provider request that failed after its durable reservation was
 * created. The negative ledger event preserves the spend audit trail while the
 * exact allowance bucket is restored. The deterministic release id makes this
 * safe to retry.
 */
export async function releaseLiveDesignSpend(
  reservation: LiveDesignSpendReservation,
  params: { designAssetId?: string } = {},
  db: typeof prisma = prisma
): Promise<AllowanceState> {
  const event = reservation.event;
  const allowanceSource = reservation.allowanceSource;
  if (!reservation.allowed || !event || !allowanceSource || allowanceSource === 'none') {
    return reservation.allowance;
  }
  if (!env.databaseUrl) {
    throw new HttpError(
      'Failed design generation could not restore its durable allowance.',
      503,
      'live_ai_spend_release_failed'
    );
  }

  const releaseEventId = `${event.id}:released`;
  try {
    const released = await db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: string }>>`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${liveAiSpendLockName}, 0)
        )::text AS locked
      `;

      const existingRelease = await tx.aiSpendEvent.findUnique({
        where: { id: releaseEventId },
      });
      let durableSession = await tx.studioSession.findUniqueOrThrow({
        where: { id: event.sessionId },
      });
      let durablePass = await tx.studioPass.findFirst({
        where: { sessionId: event.sessionId, status: { not: 'expired' } },
        orderBy: { createdAt: 'desc' },
      });

      if (!existingRelease) {
        await tx.aiSpendEvent.update({
          where: { id: event.id },
          data: { designAssetId: params.designAssetId },
        });
        await tx.aiSpendEvent.create({
          data: {
            id: releaseEventId,
            sessionId: event.sessionId,
            designAssetId: params.designAssetId,
            action: event.action,
            provider: event.provider,
            estimatedCostCents: -Math.abs(event.estimatedCostCents),
          },
        });

        if (allowanceSource === 'free_draft' && durableSession.freeDraftsUsed > 0) {
          durableSession = await tx.studioSession.update({
            where: { id: durableSession.id },
            data: { freeDraftsUsed: { decrement: 1 } },
          });
        } else if (durablePass) {
          const counter =
            allowanceSource === 'rough_draft'
              ? 'roughDraftsUsed'
              : allowanceSource === 'edit'
                ? 'editsUsed'
                : 'finalsUsed';
          if (durablePass[counter] > 0) {
            durablePass = await tx.studioPass.update({
              where: { id: durablePass.id },
              data: { [counter]: { decrement: 1 } },
            });
          }
        }
      }

      return { session: durableSession, pass: durablePass };
    });

    syncDurableAllowanceState(released);
    if (!state.ledger.some((candidate) => candidate.id === releaseEventId)) {
      state.ledger.push({
        ...event,
        id: releaseEventId,
        designAssetId: params.designAssetId,
        estimatedCostCents: -Math.abs(event.estimatedCostCents),
        createdAt: nowIso(),
      });
    }
    return getAllowanceState(event.sessionId);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    logOperationalEvent('error', 'openai_spend_release_failed', {
      ...classifyOperationalError(error),
      outcome: 'manual_reconciliation_required',
    });
    throw new HttpError(
      'Failed design generation could not restore its durable allowance.',
      503,
      'live_ai_spend_release_failed'
    );
  }
}

export async function recordDesignSpend(params: {
  sessionId: string;
  designAssetId?: string;
  action: LedgerEvent['action'];
  provider: LedgerEvent['provider'];
  estimatedCostCents: number;
}): Promise<LedgerEvent> {
  const event = {
    id: createId('ledger'),
    createdAt: nowIso(),
    ...params,
  };
  state.ledger.push(event);

  const session = await getOrCreateDurableSession(params.sessionId);
  const pass = getStudioPassForSession(session.id);
  if (params.action === 'rough_draft') {
    if (pass && session.freeDraftsUsed >= session.freeDraftLimit) {
      state.passes.set(pass.id, { ...pass, roughDraftsUsed: pass.roughDraftsUsed + 1 });
    } else {
      touchSession(session.id, { freeDraftsUsed: session.freeDraftsUsed + 1 });
    }
  }
  if (params.action === 'edit' && pass) {
    state.passes.set(pass.id, { ...pass, editsUsed: pass.editsUsed + 1 });
  }
  if (params.action === 'final' && pass) {
    state.passes.set(pass.id, { ...pass, finalsUsed: pass.finalsUsed + 1 });
  }
  if (env.databaseUrl) {
    try {
      await prisma.studioSession.upsert({
        where: { id: session.id },
        update: {
          freeDraftsUsed: getOrCreateSession(session.id).freeDraftsUsed,
          freeDraftLimit: session.freeDraftLimit,
        },
        create: {
          id: session.id,
          status: session.status,
          freeDraftsUsed: getOrCreateSession(session.id).freeDraftsUsed,
          freeDraftLimit: session.freeDraftLimit,
        },
      });
      await prisma.aiSpendEvent.create({
        data: {
          id: event.id,
          sessionId: session.id,
          designAssetId: params.designAssetId,
          action: params.action,
          provider: params.provider,
          estimatedCostCents: params.estimatedCostCents,
          createdAt: new Date(event.createdAt),
        },
      });
    } catch {
      // Runtime ledger remains the fallback source if persistence is unavailable.
    }
  }
  return event;
}

export function saveQuote(quote: QuoteBreakdown): QuoteBreakdown {
  return saveRuntimeQuote(quote, createId);
}

export function buildLaunchReadiness(): LaunchReadiness {
  return assessLaunchReadiness(getRuntimeSettings());
}

export function buildAdminReport(): AdminReport {
  const artifactCounts = getRuntimeArtifactCounts();
  return {
    settings: getRuntimeSettings(),
    sessions: state.sessions.size,
    studioPasses: state.passes.size,
    designDrafts: artifactCounts.designDrafts,
    orders: artifactCounts.orders,
    estimatedAiSpendCents: state.ledger.reduce(
      (total, event) => total + event.estimatedCostCents,
      0
    ),
    launchReadiness: buildLaunchReadiness(),
  };
}
