import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import type { DesignDraft, DesignIdea, DesignMockup } from '../types/catalog.js';
import {
  createMockDesignImage,
  dataUrlToBuffer,
  generateDesignImage,
  canUseLiveOpenAi,
  supportsTransparentBackground,
} from './openai-design-provider.js';
import { getProductsByIds } from './catalog.service.js';
import { describePrintfulError, generatePrintfulMockupPreview } from './printful.service.js';
import { prepareArtworkForPrint } from './background-removal.service.js';
import { resolveDesignAssetProviderUrl } from '../utils/design-asset-url.js';
import { classifyOperationalError, logOperationalEvent } from '../utils/operational-logger.js';
import {
  authorizeDesignAction,
  getAllowanceState,
  getDraft,
  findReusableMockup,
  getOrCreateDurableSession,
  recordDesignSpend,
  releaseLiveDesignSpend,
  reserveLiveDesignSpend,
  runtimeId,
  runtimeNow,
  saveDraft,
  saveIdea,
  saveMockup,
  type LiveDesignSpendReservation,
} from './runtime-store.js';

type DesignContext = {
  sessionId?: string;
  productId?: string;
  variantId?: string;
  placementCodes?: string[];
  qualityTier?: 'rough' | 'final';
  skipAllowanceSpend?: boolean;
  liveSpendReservation?: LiveDesignSpendReservation;
};

type DesignArtwork = {
  id: string;
  imageUrl: string;
  policyStatus: DesignDraft['policy']['status'];
  readinessStatus: DesignDraft['readiness']['status'];
};

const blockedTerms = ['nike', 'disney', 'marvel', 'pokemon', 'supreme'];

const estimatedBackgroundRemovalCostCents = () =>
  canUseLiveOpenAi() &&
  Boolean(env.removeBgApiKey) &&
  !supportsTransparentBackground(env.openaiDesignModel)
    ? Math.max(0, env.removeBgEstimatedCostCents)
    : 0;

const estimatedGenerationCostCents = (qualityTier: 'rough' | 'final') =>
  canUseLiveOpenAi()
    ? (qualityTier === 'final' ? 36 : 6) + estimatedBackgroundRemovalCostCents()
    : 1;

const estimatedRevisionCostCents = () =>
  canUseLiveOpenAi() ? 12 + estimatedBackgroundRemovalCostCents() : 1;

function evaluatePolicy(prompt: string): DesignDraft['policy'] {
  const lowered = prompt.toLowerCase();
  const blocked = blockedTerms.filter((term) => lowered.includes(term));
  if (blocked.length) {
    return {
      status: 'blocked',
      reasons: [
        'This request appears to reference protected brand or character material. Use original concepts or provide rights-cleared artwork.',
      ],
    };
  }
  if (lowered.includes('celebrity') || lowered.includes('logo')) {
    return {
      status: 'needs_review',
      reasons: ['Rights or likeness review may be needed before fulfillment.'],
    };
  }
  return { status: 'pass', reasons: [] };
}

function buildReadiness(placementCodes: string[]): DesignDraft['readiness'] {
  const checks: DesignDraft['readiness']['checks'] = [
    {
      label: 'Placement fit',
      result: placementCodes.length
        ? `Prepared for ${placementCodes.join(', ')}.`
        : 'Select a product placement before production.',
      severity: placementCodes.length ? 'pass' : 'warning',
    },
    {
      label: 'Private data',
      result: 'No customer private data is required for this draft endpoint.',
      severity: 'pass',
    },
  ];
  const hasBlock = checks.some((check) => check.severity === 'block');
  const hasWarning = checks.some((check) => check.severity === 'warning');
  return {
    status: hasBlock ? 'blocked' : hasWarning ? 'warning' : 'pass',
    checks,
  };
}

async function getArtworkForProvider(designAssetId?: string): Promise<DesignArtwork | null> {
  if (!designAssetId) return null;
  const draft = getDraft(designAssetId);
  if (draft?.id && draft.imageUrl) {
    const imageUrl = resolveDesignAssetProviderUrl({
      assetId: draft.id,
      storedUrl: draft.imageUrl,
      backendUrl: env.backendUrl,
    });
    if (!imageUrl) return null;
    return {
      id: draft.id,
      imageUrl,
      policyStatus: draft.policy.status,
      readinessStatus: draft.readiness.status,
    };
  }

  if (!env.databaseUrl) return null;
  const asset = await prisma.designAsset.findUnique({ where: { id: designAssetId } });
  const storedUrl = asset?.transparentUrl ?? asset?.imageUrl;
  if (!asset || !storedUrl) return null;
  const imageUrl = resolveDesignAssetProviderUrl({
    assetId: asset.id,
    storedUrl,
    backendUrl: env.backendUrl,
  });
  if (!imageUrl) return null;
  return {
    id: asset.id,
    imageUrl,
    policyStatus: asset.policyStatus as DesignDraft['policy']['status'],
    readinessStatus: asset.readinessStatus as DesignDraft['readiness']['status'],
  };
}

async function persistMockup(mockup: DesignMockup, providerTaskId?: string): Promise<DesignMockup> {
  const saved = saveMockup(mockup);
  if (!env.databaseUrl) return saved;
  try {
    await prisma.mockupTask.upsert({
      where: { id: saved.id },
      update: {
        productId: saved.productId,
        variantId: saved.variantId,
        designAssetId: saved.designAssetId,
        provider: saved.provider,
        status: saved.status,
        placementCodes: saved.placementCodes,
        imageUrl: saved.imageUrl,
        providerTaskId,
        errorMessage: saved.errorMessage,
      },
      create: {
        id: saved.id,
        productId: saved.productId,
        variantId: saved.variantId,
        designAssetId: saved.designAssetId,
        provider: saved.provider,
        status: saved.status,
        placementCodes: saved.placementCodes,
        imageUrl: saved.imageUrl,
        providerTaskId,
        errorMessage: saved.errorMessage,
      },
    });
  } catch {
    // Runtime mockup state remains available if persistence is unavailable.
  }
  return saved;
}

async function getReusableMockup(params: {
  productId: string;
  variantId: string;
  placementCodes: string[];
  designAssetId?: string;
  orientation?: DesignMockup['orientation'];
}): Promise<DesignMockup | null> {
  const runtime = findReusableMockup(params);
  if (runtime) return runtime;
  if (!env.databaseUrl || params.orientation || !params.designAssetId) return null;
  try {
    const cached = await prisma.mockupTask.findFirst({
      where: {
        productId: params.productId,
        variantId: params.variantId,
        designAssetId: params.designAssetId,
        placementCodes: { equals: params.placementCodes },
        status: 'complete',
        imageUrl: { not: null },
        createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!cached?.imageUrl) return null;
    return saveMockup({
      id: cached.id,
      status: 'complete',
      provider: cached.provider as DesignMockup['provider'],
      productId: cached.productId,
      variantId: cached.variantId,
      placementCodes: cached.placementCodes,
      designAssetId: cached.designAssetId ?? undefined,
      imageUrl: cached.imageUrl,
      views: [{ label: 'Saved mockup', imageUrl: cached.imageUrl }],
      createdAt: cached.createdAt.toISOString(),
    });
  } catch {
    return null;
  }
}

export async function createDesignIdea(params: {
  prompt: string;
  sessionId?: string;
  productId?: string;
  placementCodes?: string[];
}): Promise<DesignIdea> {
  const session = await getOrCreateDurableSession(params.sessionId);
  const originalPrompt = params.prompt.trim() || 'A clean, print-ready merch graphic';
  const placementText = params.placementCodes?.length
    ? ` for ${params.placementCodes.join(', ')} placement`
    : '';
  const refinedPrompt = `${originalPrompt}${placementText}. Use a centered, high-contrast composition, simple readable shapes, and production-safe artwork.`;
  const idea: DesignIdea = {
    id: runtimeId('idea'),
    sessionId: session.id,
    productId: params.productId,
    placementCodes: params.placementCodes ?? [],
    originalPrompt,
    refinedPrompt,
    styleTags: ['print-ready', 'high-contrast', 'centered-composition'],
    warnings:
      originalPrompt.length < 18
        ? ['The idea is short. Add audience, tone, text, or visual style for better drafts.']
        : [],
    createdAt: runtimeNow(),
  };
  await recordDesignSpend({
    sessionId: session.id,
    action: 'idea',
    provider: canUseLiveOpenAi() ? 'openai-ready' : 'mock',
    estimatedCostCents: 1,
  });
  return saveIdea(idea);
}

export async function createDesignDraft(
  prompt: string,
  context: DesignContext = {}
): Promise<DesignDraft> {
  const session = await getOrCreateDurableSession(context.sessionId);
  const normalizedPrompt = prompt.trim() || 'A clean, print-ready merch graphic';
  const qualityTier = context.qualityTier ?? 'rough';
  const liveOpenAi = canUseLiveOpenAi();
  const provider = liveOpenAi ? 'openai-ready' : 'mock';
  const policy = evaluatePolicy(normalizedPrompt);
  if (
    liveOpenAi &&
    context.skipAllowanceSpend &&
    (!context.liveSpendReservation?.allowed || !context.liveSpendReservation.event)
  ) {
    throw new HttpError(
      'Live design generation requires a durable spend reservation.',
      503,
      'live_ai_spend_reservation_required'
    );
  }
  const action = qualityTier === 'final' ? 'final' : 'rough_draft';
  const authorization: LiveDesignSpendReservation =
    context.liveSpendReservation ??
    (context.skipAllowanceSpend || policy.status === 'blocked'
      ? { allowed: true, allowance: getAllowanceState(session.id) }
      : liveOpenAi
        ? await reserveLiveDesignSpend({
            sessionId: session.id,
            action,
            provider: 'openai',
            estimatedCostCents: estimatedGenerationCostCents(qualityTier),
          })
        : await authorizeDesignAction(
            session.id,
            action,
            estimatedGenerationCostCents(qualityTier)
          ));
  if (!authorization.allowed || policy.status === 'blocked') {
    const blockedImage = createMockDesignImage('Generation unavailable');
    const draft: DesignDraft = {
      id: null,
      sessionId: session.id,
      provider,
      generationStatus: 'failed',
      prompt: normalizedPrompt,
      imageUrl: blockedImage.imageUrl,
      qualityTier,
      allowance: authorization.allowance,
      policy,
      readiness: {
        status: 'blocked',
        checks: [
          {
            label: 'Generation paused',
            result: authorization.message ?? policy.reasons[0] ?? 'This design request is blocked.',
            severity: 'block',
          },
        ],
      },
      createdAt: runtimeNow(),
    };
    return draft;
  }

  let generated = createMockDesignImage(normalizedPrompt);
  try {
    generated = await generateDesignImage({
      prompt: normalizedPrompt,
      sessionId: session.id,
      qualityTier,
    });
  } catch (error) {
    const failedReadiness: DesignDraft['readiness'] = {
      status: 'blocked',
      checks: [
        {
          label: 'Live generation',
          result:
            'OpenAI generation was requested but did not complete. No checkout should proceed with this draft.',
          severity: 'block',
        },
      ],
    };
    const failureReason = error instanceof Error ? error.message : 'OpenAI generation failed.';
    const failureContext = classifyOperationalError(error);
    const publicFailureReason = 'Artwork generation did not complete. Please retry.';
    let failedAssetId: string | undefined;
    if (env.databaseUrl) {
      try {
        const failedAsset = await prisma.designAsset.create({
          data: {
            prompt: normalizedPrompt,
            provider: 'openai-ready',
            imageUrl: createMockDesignImage('Generation paused').imageUrl,
            transparentUrl: null,
            generationStatus: 'failed',
            policyStatus: 'needs_review',
            policyReport: { status: 'needs_review', reasons: [failureReason] },
            failureReason,
            readinessStatus: 'blocked',
            readinessReport: failedReadiness,
          },
        });
        failedAssetId = failedAsset.id;
      } catch {
        if (liveOpenAi) {
          if (authorization.allowed && authorization.event) {
            await releaseLiveDesignSpend(authorization);
          }
          logOperationalEvent('error', 'openai_generation_failed', {
            ...failureContext,
            outcome: 'allowance_released_persistence_failed',
          });
          throw new HttpError(
            'Live artwork generation failed and its failure record could not be stored safely.',
            503,
            'live_design_persistence_failed'
          );
        }
        // Fixture failures may fall through to the runtime-only failed draft.
      }
    }
    const allowance =
      liveOpenAi && authorization.allowed && authorization.event
        ? await releaseLiveDesignSpend(authorization, { designAssetId: failedAssetId })
        : authorization.allowance;
    if (liveOpenAi) {
      logOperationalEvent('error', 'openai_generation_failed', {
        ...failureContext,
        outcome: 'allowance_released',
      });
    }
    return saveDraft({
      id: failedAssetId ?? null,
      sessionId: session.id,
      provider: 'openai-ready',
      generationStatus: 'failed',
      prompt: normalizedPrompt,
      imageUrl: failedAssetId
        ? `${env.backendUrl}/api/design/assets/${failedAssetId}.png`
        : createMockDesignImage('Generation paused').imageUrl,
      qualityTier,
      allowance,
      policy: {
        status: 'needs_review',
        reasons: [publicFailureReason],
      },
      readiness: failedReadiness,
      createdAt: runtimeNow(),
    });
  }
  const printPreparation =
    generated.provider === 'mock'
      ? {
          imageUrl: generated.imageUrl,
          transparentUrl: generated.imageUrl,
          status: 'transparent' as const,
          provider: 'none' as const,
          message: 'The fixture artwork includes a transparent print file.',
        }
      : await prepareArtworkForPrint({
          imageUrl: generated.imageUrl,
          model: env.openaiDesignModel,
        });
  const baseReadiness = buildReadiness(context.placementCodes ?? []);
  const preparationReady = ['transparent', 'removed'].includes(printPreparation.status);
  const readiness: DesignDraft['readiness'] = {
    status:
      baseReadiness.status === 'blocked'
        ? 'blocked'
        : preparationReady
          ? baseReadiness.status
          : 'warning',
    checks: [
      ...baseReadiness.checks,
      {
        label: 'Transparent print file',
        result: printPreparation.message,
        severity: preparationReady ? 'pass' : 'warning',
      },
    ],
  };
  const allowance = getAllowanceState(session.id);
  const preparedImageUrl = printPreparation.transparentUrl ?? printPreparation.imageUrl;

  if (!env.databaseUrl) {
    if (liveOpenAi) {
      throw new HttpError(
        'Live artwork cannot be returned without durable PostgreSQL storage.',
        503,
        'live_design_durable_storage_required'
      );
    }
    const draft = saveDraft({
      id: runtimeId('draft'),
      sessionId: session.id,
      provider: generated.provider,
      generationStatus: 'complete',
      prompt: normalizedPrompt,
      imageUrl: preparedImageUrl,
      qualityTier,
      printPreparation,
      allowance,
      policy,
      readiness,
      createdAt: runtimeNow(),
    });
    if (!context.skipAllowanceSpend) {
      await recordDesignSpend({
        sessionId: session.id,
        designAssetId: draft.id ?? undefined,
        action: qualityTier === 'final' ? 'final' : 'rough_draft',
        provider: generated.provider,
        estimatedCostCents: generated.estimatedCostCents,
      });
    }
    return saveDraft({ ...draft, allowance: getAllowanceState(session.id) });
  }

  try {
    const asset = await prisma.designAsset.create({
      data: {
        prompt: normalizedPrompt,
        provider: generated.provider,
        imageUrl: generated.imageUrl,
        transparentUrl: printPreparation.transparentUrl ?? null,
        generationStatus: 'complete',
        policyStatus: policy.status,
        policyReport: policy,
        readinessStatus: readiness.status,
        readinessReport: readiness,
      },
    });
    if (!context.skipAllowanceSpend && !liveOpenAi) {
      await recordDesignSpend({
        sessionId: session.id,
        designAssetId: asset.id,
        action: qualityTier === 'final' ? 'final' : 'rough_draft',
        provider: generated.provider,
        estimatedCostCents: generated.estimatedCostCents,
      });
    }
    return saveDraft({
      id: asset.id,
      sessionId: session.id,
      provider: generated.provider,
      generationStatus: 'complete',
      prompt: normalizedPrompt,
      imageUrl: `${env.backendUrl}/api/design/assets/${asset.id}.png`,
      qualityTier,
      printPreparation,
      allowance: getAllowanceState(session.id),
      policy,
      readiness,
      createdAt: runtimeNow(),
    });
  } catch {
    if (liveOpenAi) {
      throw new HttpError(
        'Generated artwork could not be stored safely. The reserved provider spend remains counted.',
        503,
        'live_design_persistence_failed'
      );
    }
    if (!context.skipAllowanceSpend) {
      await recordDesignSpend({
        sessionId: session.id,
        action: qualityTier === 'final' ? 'final' : 'rough_draft',
        provider: generated.provider,
        estimatedCostCents: generated.estimatedCostCents,
      });
    }
    return saveDraft({
      id: runtimeId('draft'),
      sessionId: session.id,
      provider: generated.provider,
      generationStatus: 'complete',
      prompt: normalizedPrompt,
      imageUrl: preparedImageUrl,
      qualityTier,
      printPreparation,
      allowance: getAllowanceState(session.id),
      policy,
      readiness,
      createdAt: runtimeNow(),
    });
  }
}

export async function reviseDesignDraft(params: {
  draftId: string;
  instructions: string;
  sessionId?: string;
}): Promise<DesignDraft> {
  const base = getDraft(params.draftId);
  const session = await getOrCreateDurableSession(params.sessionId ?? base?.sessionId);
  const liveOpenAi = canUseLiveOpenAi();
  const authorization = liveOpenAi
    ? await reserveLiveDesignSpend({
        sessionId: session.id,
        designAssetId: base?.id ?? undefined,
        action: 'edit',
        provider: 'openai',
        estimatedCostCents: estimatedRevisionCostCents(),
      })
    : await authorizeDesignAction(session.id, 'edit', estimatedRevisionCostCents());
  if (!authorization.allowed) {
    throw new HttpError(
      authorization.message ?? 'No more generated variations are available in this beta session.',
      409,
      'revision_allowance_required'
    );
  }
  if (!liveOpenAi) {
    await recordDesignSpend({
      sessionId: session.id,
      action: 'edit',
      provider: 'mock',
      estimatedCostCents: estimatedRevisionCostCents(),
    });
  }
  return createDesignDraft(
    `${base?.prompt ?? 'Selected design'}; revision: ${params.instructions}`,
    {
      sessionId: session.id,
      qualityTier: 'rough',
      skipAllowanceSpend: true,
      liveSpendReservation: liveOpenAi ? authorization : undefined,
    }
  );
}

export async function getDesignDraftById(
  draftId: string,
  sessionId?: string
): Promise<DesignDraft | null> {
  const runtimeDraft = getDraft(draftId);
  if (runtimeDraft) {
    const allowance = sessionId
      ? getAllowanceState((await getOrCreateDurableSession(sessionId)).id)
      : runtimeDraft.allowance;
    return { ...runtimeDraft, allowance };
  }

  if (!env.databaseUrl) return null;
  try {
    const asset = await prisma.designAsset.findUnique({ where: { id: draftId } });
    if (!asset || !asset.imageUrl || asset.generationStatus !== 'complete') return null;
    const session = await getOrCreateDurableSession(sessionId);
    const policy = (asset.policyReport as DesignDraft['policy'] | null) ?? {
      status: asset.policyStatus as DesignDraft['policy']['status'],
      reasons: [],
    };
    const readiness = (asset.readinessReport as DesignDraft['readiness'] | null) ?? {
      status: asset.readinessStatus as DesignDraft['readiness']['status'],
      checks: [],
    };
    return saveDraft({
      id: asset.id,
      sessionId: session.id,
      provider: asset.provider as DesignDraft['provider'],
      generationStatus: 'complete',
      prompt: asset.prompt,
      imageUrl: `${env.backendUrl}/api/design/assets/${asset.id}.png`,
      qualityTier: 'rough',
      allowance: getAllowanceState(session.id),
      policy,
      readiness,
      createdAt: asset.createdAt.toISOString(),
    });
  } catch {
    return null;
  }
}

export function checkReadiness(params: {
  prompt: string;
  placementCodes?: string[];
}): DesignDraft['readiness'] {
  return buildReadiness(params.placementCodes ?? []);
}

export async function createDesignMockup(params: {
  sessionId?: string;
  productId: string;
  variantId: string;
  placementCodes: string[];
  designAssetId?: string;
  orientation?: DesignMockup['orientation'];
}): Promise<DesignMockup> {
  const session = await getOrCreateDurableSession(params.sessionId);
  const reusable = await getReusableMockup(params);
  if (reusable) return reusable;
  await recordDesignSpend({
    sessionId: session.id,
    designAssetId: params.designAssetId,
    action: 'mockup',
    provider: env.printfulApiKey && env.enableLivePrintful ? 'printful-ready' : 'fixture',
    estimatedCostCents: 1,
  });
  const artwork = await getArtworkForProvider(params.designAssetId);
  if (env.printfulApiKey && env.enableLivePrintful) {
    try {
      const [product] = await getProductsByIds([params.productId]);
      const variant = product?.variants.find((candidate) => candidate.id === params.variantId);
      const placement = params.placementCodes[0];
      const placementOption = product?.placements.find((candidate) => candidate.code === placement);
      if (!product?.printfulId || !variant?.printfulVariantId || !placement || !artwork?.imageUrl) {
        throw new Error(
          'Live Printful mockup requires synced product, variant, placement, and artwork.'
        );
      }
      if (artwork.policyStatus !== 'pass' || artwork.readinessStatus === 'blocked') {
        throw new Error(
          'Live Printful mockup requires policy-passing artwork without blocked checks.'
        );
      }
      const mockup = await generatePrintfulMockupPreview({
        printfulProductId: String(product.printfulId),
        printfulVariantId: variant.printfulVariantId,
        placement,
        designImageUrl: artwork.imageUrl,
        technique: placementOption?.technique,
        orientation: params.orientation,
        preferFrontView: product.categorySlug === 'drinkware',
      });
      return persistMockup(
        {
          id: mockup.taskKey,
          status: 'complete',
          provider: 'printful',
          productId: params.productId,
          variantId: params.variantId,
          placementCodes: params.placementCodes,
          designAssetId: params.designAssetId,
          orientation: params.orientation,
          imageUrl: mockup.imageUrl,
          views: mockup.views,
          createdAt: runtimeNow(),
        },
        mockup.taskKey
      );
    } catch (error) {
      return persistMockup({
        id: runtimeId('mockup'),
        status: 'failed',
        provider: 'printful-ready',
        productId: params.productId,
        variantId: params.variantId,
        placementCodes: params.placementCodes,
        designAssetId: params.designAssetId,
        orientation: params.orientation,
        imageUrl: artwork?.imageUrl ?? createMockDesignImage('Mockup preview').imageUrl,
        errorMessage: describePrintfulError(error),
        createdAt: runtimeNow(),
      });
    }
  }
  return persistMockup({
    id: runtimeId('mockup'),
    status: 'complete',
    provider: env.printfulApiKey && env.enableLivePrintful ? 'printful-ready' : 'fixture',
    productId: params.productId,
    variantId: params.variantId,
    placementCodes: params.placementCodes,
    designAssetId: params.designAssetId,
    orientation: params.orientation,
    imageUrl: artwork?.imageUrl ?? createMockDesignImage('Mockup preview').imageUrl,
    createdAt: runtimeNow(),
  });
}

export async function getDesignAssetImage(
  assetId: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const draft = getDraft(assetId);
  const runtimeImage = draft ? dataUrlToBuffer(draft.imageUrl) : null;
  if (runtimeImage) return runtimeImage;

  if (!env.databaseUrl) return null;

  const asset = await prisma.designAsset.findUnique({ where: { id: assetId } });
  const imageUrl = asset?.transparentUrl ?? asset?.imageUrl;
  return imageUrl ? dataUrlToBuffer(imageUrl) : null;
}
