import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import type { DesignDraft, DesignIdea, DesignMockup } from '../types/catalog.js';
import {
  createMockDesignImage,
  dataUrlToBuffer,
  generateDesignImage,
  canUseLiveOpenAi,
} from './openai-design-provider.js';
import { getProductsByIds } from './catalog.service.js';
import { generatePrintfulMockupPreview } from './printful.service.js';
import {
  authorizeDesignAction,
  getAllowanceState,
  getDraft,
  getOrCreateDurableSession,
  recordDesignSpend,
  runtimeId,
  runtimeNow,
  saveDraft,
  saveIdea,
  saveMockup,
} from './runtime-store.js';

type DesignContext = {
  sessionId?: string;
  productId?: string;
  variantId?: string;
  placementCodes?: string[];
  qualityTier?: 'rough' | 'final';
  skipAllowanceSpend?: boolean;
};

type DesignArtwork = {
  id: string;
  imageUrl: string;
  policyStatus: DesignDraft['policy']['status'];
  readinessStatus: DesignDraft['readiness']['status'];
};

const blockedTerms = ['nike', 'disney', 'marvel', 'pokemon', 'supreme'];

const estimatedGenerationCostCents = (qualityTier: 'rough' | 'final') =>
  canUseLiveOpenAi() ? (qualityTier === 'final' ? 36 : 6) : 1;

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

function buildReadiness(prompt: string, placementCodes: string[]): DesignDraft['readiness'] {
  const checks: DesignDraft['readiness']['checks'] = [
    {
      label: 'Placement fit',
      result: placementCodes.length
        ? `Prepared for ${placementCodes.join(', ')}.`
        : 'Select a product placement before production.',
      severity: placementCodes.length ? 'pass' : 'warning',
    },
    {
      label: 'Prompt specificity',
      result:
        prompt.length < 24
          ? 'Add subject, style, and text details before final production.'
          : 'Prompt has enough detail for a first-pass artwork draft.',
      severity: prompt.length < 24 ? 'warning' : 'pass',
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

function publicArtworkUrl(id: string, imageUrl: string): string {
  return /^https?:\/\//.test(imageUrl)
    ? imageUrl
    : `${env.backendUrl}/api/design/assets/${encodeURIComponent(id)}.png`;
}

async function getArtworkForProvider(designAssetId?: string): Promise<DesignArtwork | null> {
  if (!designAssetId) return null;
  const draft = getDraft(designAssetId);
  if (draft?.id && draft.imageUrl) {
    return {
      id: draft.id,
      imageUrl: publicArtworkUrl(draft.id, draft.imageUrl),
      policyStatus: draft.policy.status,
      readinessStatus: draft.readiness.status,
    };
  }

  if (!env.databaseUrl) return null;
  const asset = await prisma.designAsset.findUnique({ where: { id: designAssetId } });
  const imageUrl = asset?.transparentUrl ?? asset?.imageUrl;
  if (!asset || !imageUrl) return null;
  return {
    id: asset.id,
    imageUrl: publicArtworkUrl(asset.id, imageUrl),
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
  const authorization = context.skipAllowanceSpend
    ? { allowed: true, allowance: getAllowanceState(session.id) }
    : await authorizeDesignAction(
        session.id,
        qualityTier === 'final' ? 'final' : 'rough_draft',
        estimatedGenerationCostCents(qualityTier)
      );
  const provider = canUseLiveOpenAi() ? 'openai-ready' : 'mock';
  const policy = evaluatePolicy(normalizedPrompt);
  if (!authorization.allowed || policy.status === 'blocked') {
    const blockedImage = createMockDesignImage('Studio Pass required');
    const draft: DesignDraft = {
      id: null,
      sessionId: session.id,
      provider,
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
        return saveDraft({
          id: failedAsset.id,
          sessionId: session.id,
          provider: 'openai-ready',
          prompt: normalizedPrompt,
          imageUrl: `${env.backendUrl}/api/design/assets/${failedAsset.id}.png`,
          qualityTier,
          allowance: authorization.allowance,
          policy: {
            status: 'needs_review',
            reasons: [failureReason],
          },
          readiness: failedReadiness,
          createdAt: runtimeNow(),
        });
      } catch {
        // Fall through to the runtime-only failed draft.
      }
    }
    return {
      id: null,
      sessionId: session.id,
      provider: 'openai-ready',
      prompt: normalizedPrompt,
      imageUrl: createMockDesignImage('Generation paused').imageUrl,
      qualityTier,
      allowance: authorization.allowance,
      policy: {
        status: 'needs_review',
        reasons: [failureReason],
      },
      readiness: failedReadiness,
      createdAt: runtimeNow(),
    };
  }
  const readiness = buildReadiness(normalizedPrompt, context.placementCodes ?? []);
  const allowance = getAllowanceState(session.id);

  if (!env.databaseUrl) {
    const draft = saveDraft({
      id: runtimeId('draft'),
      sessionId: session.id,
      provider: generated.provider,
      prompt: normalizedPrompt,
      imageUrl: generated.imageUrl,
      qualityTier,
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
    return draft;
  }

  try {
    const asset = await prisma.designAsset.create({
      data: {
        prompt: normalizedPrompt,
        provider: generated.provider,
        imageUrl: generated.imageUrl,
        transparentUrl: generated.imageUrl,
        generationStatus: 'complete',
        policyStatus: policy.status,
        policyReport: policy,
        readinessStatus: readiness.status,
        readinessReport: readiness,
      },
    });
    if (!context.skipAllowanceSpend) {
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
      prompt: normalizedPrompt,
      imageUrl: `${env.backendUrl}/api/design/assets/${asset.id}.png`,
      qualityTier,
      allowance,
      policy,
      readiness,
      createdAt: runtimeNow(),
    });
  } catch {
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
      prompt: normalizedPrompt,
      imageUrl: generated.imageUrl,
      qualityTier,
      allowance,
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
  const authorization = await authorizeDesignAction(
    session.id,
    'edit',
    canUseLiveOpenAi() ? 12 : 1
  );
  if (!authorization.allowed) {
    return {
      id: null,
      sessionId: session.id,
      provider: 'mock',
      prompt: params.instructions,
      imageUrl: createMockDesignImage('Studio Pass required').imageUrl,
      qualityTier: 'rough',
      allowance: authorization.allowance,
      policy: {
        status: 'needs_review',
        reasons: [authorization.message ?? authorization.allowance.message],
      },
      readiness: {
        status: 'blocked',
        checks: [
          {
            label: 'Revision paused',
            result: authorization.message ?? 'Buy a Studio Pass to continue revisions.',
            severity: 'block',
          },
        ],
      },
      createdAt: runtimeNow(),
    };
  }
  await recordDesignSpend({
    sessionId: session.id,
    action: 'edit',
    provider: canUseLiveOpenAi() ? 'openai-ready' : 'mock',
    estimatedCostCents: canUseLiveOpenAi() ? 12 : 1,
  });
  return createDesignDraft(
    `${base?.prompt ?? 'Selected design'}; revision: ${params.instructions}`,
    {
      sessionId: session.id,
      qualityTier: 'rough',
      skipAllowanceSpend: true,
    }
  );
}

export function checkReadiness(params: {
  prompt: string;
  placementCodes?: string[];
}): DesignDraft['readiness'] {
  return buildReadiness(params.prompt, params.placementCodes ?? []);
}

export async function createDesignMockup(params: {
  sessionId?: string;
  productId: string;
  variantId: string;
  placementCodes: string[];
  designAssetId?: string;
}): Promise<DesignMockup> {
  const session = await getOrCreateDurableSession(params.sessionId);
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
      if (!product?.printfulId || !variant?.printfulVariantId || !placement || !artwork?.imageUrl) {
        throw new Error(
          'Live Printful mockup requires synced product, variant, placement, and artwork.'
        );
      }
      if (artwork.policyStatus !== 'pass' || artwork.readinessStatus !== 'pass') {
        throw new Error('Live Printful mockup requires policy-passing, print-ready artwork.');
      }
      const mockup = await generatePrintfulMockupPreview({
        printfulProductId: String(product.printfulId),
        printfulVariantId: variant.printfulVariantId,
        placement,
        designImageUrl: artwork.imageUrl,
        technique: placement.includes('embroidery') ? 'embroidery' : 'dtg',
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
          imageUrl: mockup.imageUrl,
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
        imageUrl: artwork?.imageUrl ?? createMockDesignImage('Mockup preview').imageUrl,
        errorMessage: error instanceof Error ? error.message : 'Printful mockup generation failed.',
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
