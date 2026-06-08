import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import type {
  AdminReport,
  AdminSettings,
  AllowanceState,
  DesignDraft,
  DesignIdea,
  DesignMockup,
  LaunchReadiness,
  OrderSummary,
  QuoteBreakdown,
  StudioPass,
  StudioSession,
} from '../types/catalog.js';

type LedgerEvent = {
  id: string;
  sessionId: string;
  designAssetId?: string;
  action: 'idea' | 'rough_draft' | 'edit' | 'final' | 'review' | 'mockup';
  provider: 'mock' | 'openai-ready' | 'openai' | 'fixture' | 'printful-ready' | 'printful';
  estimatedCostCents: number;
  createdAt: string;
};

type RuntimeState = {
  sessions: Map<string, StudioSession>;
  passes: Map<string, StudioPass>;
  ideas: Map<string, DesignIdea>;
  drafts: Map<string, DesignDraft>;
  mockups: Map<string, DesignMockup>;
  quotes: Map<string, QuoteBreakdown>;
  orders: Map<string, OrderSummary>;
  ledger: LedgerEvent[];
  settings: AdminSettings;
};

const nowIso = () => new Date().toISOString();

const createId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const defaultSettings = (): AdminSettings => ({
  studioPassPriceCents: env.studioPassPriceCents,
  freeDraftLimit: env.freeDraftLimit,
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
  ideas: new Map(),
  drafts: new Map(),
  mockups: new Map(),
  quotes: new Map(),
  orders: new Map(),
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

export function createStudioSession(): StudioSession {
  const now = nowIso();
  const session: StudioSession = {
    id: createId('sess'),
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
  return createStudioSession();
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
  const freeDraftsRemaining = Math.max(0, session.freeDraftLimit - session.freeDraftsUsed);
  const roughDraftsRemaining = pass
    ? Math.max(0, pass.includedRoughDrafts - pass.roughDraftsUsed)
    : 0;
  const editsRemaining = pass ? Math.max(0, pass.includedEdits - pass.editsUsed) : 0;
  const finalsRemaining = pass ? Math.max(0, pass.includedFinals - pass.finalsUsed) : 0;
  const studioPassStatus = pass
    ? pass.status === 'applied'
      ? 'applied'
      : roughDraftsRemaining || editsRemaining || finalsRemaining
        ? 'available'
        : 'exhausted'
    : freeDraftsRemaining
      ? 'not_required'
      : 'required';

  return {
    sessionId: session.id,
    studioPassStatus,
    freeDraftsRemaining,
    roughDraftsRemaining,
    editsRemaining,
    finalsRemaining,
    nextAction:
      studioPassStatus === 'required' || studioPassStatus === 'exhausted'
        ? 'buy_studio_pass'
        : 'continue_free',
    message:
      studioPassStatus === 'required'
        ? 'A $5 Studio Pass unlocks deeper drafting and applies to an eligible purchase.'
        : studioPassStatus === 'exhausted'
          ? 'This Studio Pass allowance is used. Checkout or contact support for more design help.'
          : 'You can keep designing within the current allowance.',
  };
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
  const session = getOrCreateSession(sessionId);
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

  const session = getOrCreateSession(params.sessionId);
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

export function saveIdea(idea: DesignIdea): DesignIdea {
  state.ideas.set(idea.id, idea);
  return { ...idea };
}

export function saveDraft(draft: DesignDraft): DesignDraft {
  if (draft.id) state.drafts.set(draft.id, draft);
  return { ...draft };
}

export function getDraft(id?: string | null): DesignDraft | undefined {
  return id ? state.drafts.get(id) : undefined;
}

export function saveMockup(mockup: DesignMockup): DesignMockup {
  state.mockups.set(mockup.id, mockup);
  return { ...mockup };
}

function normalizedPlacementCodes(codes: string[]): string[] {
  return [...codes].filter(Boolean).sort();
}

function samePlacementCodes(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizedPlacementCodes(left);
  const normalizedRight = normalizedPlacementCodes(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((code, index) => code === normalizedRight[index])
  );
}

export function getMockupForSelection(params: {
  designAssetId?: string;
  productId: string;
  variantId: string;
  placementCodes: string[];
}): DesignMockup | undefined {
  if (!params.designAssetId) return undefined;
  return Array.from(state.mockups.values())
    .filter(
      (mockup) =>
        mockup.designAssetId === params.designAssetId &&
        mockup.productId === params.productId &&
        mockup.variantId === params.variantId &&
        samePlacementCodes(mockup.placementCodes, params.placementCodes)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function getMockupForDesignAsset(designAssetId?: string): DesignMockup | undefined {
  if (!designAssetId) return undefined;
  return Array.from(state.mockups.values())
    .filter((mockup) => mockup.designAssetId === designAssetId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function saveQuote(quote: QuoteBreakdown): QuoteBreakdown {
  const id = quote.id || createId('quote');
  const saved = { ...quote, id };
  state.quotes.set(id, saved);
  return { ...saved };
}

export function getQuote(id?: string | null): QuoteBreakdown | undefined {
  return id ? state.quotes.get(id) : undefined;
}

export function saveOrder(order: OrderSummary): OrderSummary {
  state.orders.set(order.id, order);
  return { ...order };
}

export function getOrder(id: string): OrderSummary | undefined {
  return state.orders.get(id);
}

export function listOrders(): OrderSummary[] {
  return Array.from(state.orders.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildLaunchReadiness(): LaunchReadiness {
  const settings = getRuntimeSettings();
  const gates: LaunchReadiness['gates'] = [
    {
      code: 'fixture-mode',
      label: 'Clean fixture mode',
      status: 'pass',
      detail:
        'Catalog, design, quote, checkout simulation, and fixture fulfillment run without live credentials.',
    },
    {
      code: 'openai-live',
      label: 'Live OpenAI generation',
      status: 'manual',
      detail: settings.liveOpenAiEnabled
        ? 'OpenAI credentials are configured, but live image generation remains blocked until provider calls and spend alerts are verified.'
        : 'Provide OpenAI credentials, model policy, spend alerts, and enable live generation after OPS review.',
    },
    {
      code: 'stripe-live',
      label: 'Production checkout',
      status: 'manual',
      detail:
        settings.liveStripeEnabled && settings.checkoutEnabled
          ? 'Stripe credentials are configured, but live checkout remains blocked until Checkout Sessions, webhooks, tax, refunds, and accounting review are verified.'
          : 'Stripe remains in fixture simulation until private setup and implementation verification are complete.',
    },
    {
      code: 'printful-live',
      label: 'Real fulfillment',
      status: 'manual',
      detail:
        settings.livePrintfulEnabled && settings.fulfillmentEnabled
          ? 'Printful credentials are configured, but real fulfillment remains blocked until live order submission and status sync are verified.'
          : 'Printful remains disabled until private store, shipping, support review, and implementation verification are complete.',
    },
    {
      code: 'ops-review',
      label: 'Private ops review',
      status: 'manual',
      detail:
        'Review OPS-001 through OPS-008 before enabling live money, generation, or fulfillment.',
    },
  ];

  return {
    readyForPaidBeta: gates.every((gate) => gate.status === 'pass'),
    gates,
  };
}

export function buildAdminReport(): AdminReport {
  return {
    settings: getRuntimeSettings(),
    sessions: state.sessions.size,
    studioPasses: state.passes.size,
    designDrafts: state.drafts.size,
    orders: state.orders.size,
    estimatedAiSpendCents: state.ledger.reduce(
      (total, event) => total + event.estimatedCostCents,
      0
    ),
    launchReadiness: buildLaunchReadiness(),
  };
}
