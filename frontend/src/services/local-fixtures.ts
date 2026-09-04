import type {
  CatalogCategory,
  CatalogProduct,
  CheckoutSession,
  CustomerOrderConfirmation,
  CustomerReorderDraft,
  DesignDraft,
  DesignIdea,
  DesignMockup,
  OrderSummary,
  PlacementSelection,
  QuoteBreakdown,
  StudioPass,
  StudioSession,
} from '@app-types/catalog';
import { merchantConfig } from '../generated/merchant-config';

export const localCategories: CatalogCategory[] = [
  {
    id: 'fixture-category-apparel',
    title: 'Apparel',
    slug: 'apparel',
    imageUrl: null,
    isLaunchCategory: true,
  },
  {
    id: 'fixture-category-hats',
    title: 'Hats',
    slug: 'hats',
    imageUrl: null,
    isLaunchCategory: true,
  },
  {
    id: 'fixture-category-drinkware',
    title: 'Drinkware',
    slug: 'drinkware',
    imageUrl: null,
    isLaunchCategory: true,
  },
  {
    id: 'fixture-category-wall-art',
    title: 'Wall art',
    slug: 'wall-art',
    imageUrl: null,
    isLaunchCategory: true,
  },
  {
    id: 'fixture-category-bags',
    title: 'Bags',
    slug: 'bags',
    imageUrl: null,
    isLaunchCategory: true,
  },
  {
    id: 'fixture-category-stickers',
    title: 'Stickers',
    slug: 'stickers',
    imageUrl: null,
    isLaunchCategory: true,
  },
  {
    id: 'fixture-category-phone-cases',
    title: 'Phone cases',
    slug: 'phone-cases',
    imageUrl: null,
    isLaunchCategory: true,
  },
  {
    id: 'fixture-category-stationery',
    title: 'Stationery',
    slug: 'stationery',
    imageUrl: null,
    isLaunchCategory: true,
  },
];

const defaultPlacement = [
  { code: 'default', displayName: 'Default print area', technique: 'dtg', isDefault: true },
];

export const localProducts: CatalogProduct[] = [
  {
    id: 'fixture-product-heavyweight-shirt',
    title: 'Heavyweight Cotton Tee',
    slug: 'heavyweight-cotton-shirt',
    type: 'apparel',
    brand: 'Fixture',
    description:
      'Premium 100% cotton with a relaxed, true-to-size fit — the everyday canvas for logos, art, and campaign drops.',
    thumbnailUrl: null,
    categorySlug: 'apparel',
    categoryTitle: 'Apparel',
    isSellable: true,
    variants: [
      {
        id: 'fixture-variant-shirt-black-m',
        name: 'Black / M',
        size: 'M',
        color: 'Black',
        colorCode: '#111827',
        imageUrl: null,
        isAvailable: true,
        costCents: 1450,
      },
      {
        id: 'fixture-variant-shirt-white-l',
        name: 'White / L',
        size: 'L',
        color: 'White',
        colorCode: '#f8fafc',
        imageUrl: null,
        isAvailable: true,
        costCents: 1450,
      },
    ],
    placements: [
      {
        code: 'front',
        displayName: 'Front print',
        technique: 'dtg',
        isDefault: true,
        width: 12,
        height: 16,
        additionalPriceCents: 595,
      },
      {
        code: 'back',
        displayName: 'Back print',
        technique: 'dtg',
        isDefault: false,
        width: 12,
        height: 16,
        additionalPriceCents: 595,
      },
    ],
  },
  {
    id: 'fixture-product-embroidered-cap',
    title: 'Structured Embroidered Cap',
    slug: 'structured-embroidered-cap',
    type: 'hat',
    brand: 'Fixture',
    description:
      'A six-panel cap with a flat front panel — built for crisp embroidered logos, badges, and short text.',
    thumbnailUrl: null,
    categorySlug: 'hats',
    categoryTitle: 'Hats',
    isSellable: true,
    variants: [
      {
        id: 'fixture-variant-cap-navy',
        name: 'Navy',
        color: 'Navy',
        colorCode: '#172554',
        imageUrl: null,
        isAvailable: true,
        costCents: 1275,
      },
    ],
    placements: [
      {
        code: 'embroidery_front',
        displayName: 'Front embroidery',
        technique: 'embroidery',
        isDefault: true,
        width: 4,
        height: 2,
      },
    ],
  },
  {
    id: 'fixture-product-ceramic-mug',
    title: 'Classic Ceramic Mug',
    slug: 'ceramic-mug',
    type: 'drinkware',
    brand: 'Fixture',
    description:
      'A dishwasher-safe 11oz mug with a full wraparound print — a go-to gift and desk companion.',
    thumbnailUrl: null,
    categorySlug: 'drinkware',
    categoryTitle: 'Drinkware',
    isSellable: true,
    variants: [
      {
        id: 'fixture-variant-mug-white-11oz',
        name: 'White / 11 oz',
        size: '11 oz',
        color: 'White',
        colorCode: '#ffffff',
        imageUrl: null,
        isAvailable: true,
        costCents: 830,
      },
    ],
    placements: defaultPlacement,
  },
  {
    id: 'fixture-product-matte-poster',
    title: 'Museum Matte Poster',
    slug: 'matte-poster',
    type: 'wall-art',
    brand: 'Fixture',
    description:
      'Gallery-grade matte paper with rich, fade-resistant color for art prints and event graphics.',
    thumbnailUrl: null,
    categorySlug: 'wall-art',
    categoryTitle: 'Wall art',
    isSellable: true,
    variants: [
      {
        id: 'fixture-variant-poster-12x18',
        name: '12 x 18 in',
        size: '12 x 18',
        imageUrl: null,
        isAvailable: true,
        costCents: 700,
      },
    ],
    placements: defaultPlacement,
  },
  {
    id: 'fixture-product-tote',
    title: 'Everyday Canvas Tote',
    slug: 'canvas-tote-bag',
    type: 'bag',
    brand: 'Fixture',
    description:
      'A sturdy cotton tote with a roomy print area — practical merch people actually carry every day.',
    thumbnailUrl: null,
    categorySlug: 'bags',
    categoryTitle: 'Bags',
    isSellable: true,
    variants: [
      {
        id: 'fixture-variant-tote-natural',
        name: 'Natural',
        color: 'Natural',
        colorCode: '#d6c3a3',
        imageUrl: null,
        isAvailable: true,
        costCents: 1125,
      },
    ],
    placements: [
      {
        code: 'front',
        displayName: 'Front print',
        technique: 'dtg',
        isDefault: true,
        additionalPriceCents: 595,
      },
      {
        code: 'back',
        displayName: 'Back print',
        technique: 'dtg',
        isDefault: false,
        additionalPriceCents: 595,
      },
    ],
  },
  {
    id: 'fixture-product-vinyl-sticker',
    title: 'Kiss-Cut Vinyl Sticker',
    slug: 'kiss-cut-sticker',
    type: 'sticker',
    brand: 'Fixture',
    description:
      'Durable, weatherproof vinyl with a glossy finish — the easiest way to spread a logo or mascot.',
    thumbnailUrl: null,
    categorySlug: 'stickers',
    categoryTitle: 'Stickers',
    isSellable: true,
    variants: [
      {
        id: 'fixture-variant-sticker-3x3',
        name: '3 x 3 in',
        size: '3 x 3',
        imageUrl: null,
        isAvailable: true,
        costCents: 250,
      },
    ],
    placements: defaultPlacement,
  },
  {
    id: 'fixture-product-phone-case',
    title: 'Slim Snap Phone Case',
    slug: 'slim-phone-case',
    type: 'phone-case',
    brand: 'Fixture',
    description: 'A lightweight snap-on case with edge-to-edge artwork and a smooth matte finish.',
    thumbnailUrl: null,
    categorySlug: 'phone-cases',
    categoryTitle: 'Phone cases',
    isSellable: true,
    variants: [
      {
        id: 'fixture-variant-phone-case-iphone',
        name: 'iPhone compatible',
        imageUrl: null,
        isAvailable: true,
        costCents: 1025,
      },
    ],
    placements: defaultPlacement,
  },
  {
    id: 'fixture-product-notebook',
    title: 'Spiral-Bound Notebook',
    slug: 'spiral-notebook',
    type: 'stationery',
    brand: 'Fixture',
    description:
      'A wire-bound notebook with a fully custom cover — a handy giveaway or creator-bundle add-on.',
    thumbnailUrl: null,
    categorySlug: 'stationery',
    categoryTitle: 'Stationery',
    isSellable: true,
    variants: [
      {
        id: 'fixture-variant-notebook-ruled',
        name: 'Ruled pages',
        imageUrl: null,
        isAvailable: true,
        costCents: 900,
      },
    ],
    placements: defaultPlacement,
  },
];

const marginFor = (costCents: number, productType?: string | null) => {
  const multiplier = productType === 'sticker' ? 1.45 : productType === 'wall-art' ? 1.2 : 1;
  return Math.max(500, Math.round(costCents * 0.3 * multiplier));
};
const shippingFor = (quantity: number) =>
  quantity <= 0 ? 0 : 495 + Math.max(0, quantity - 1) * 175;
const paymentFeeFor = (subtotalCents: number) => Math.round(subtotalCents * 0.029 + 30);
let localSession: StudioSession | null = null;
let localPass: StudioPass | null = null;
let localOrder: OrderSummary | null = null;
let localDraftCount = 0;
let localSequence = 0;
const localArtworkUrls = new Map<string, string>();

const localId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(++localSequence).toString(36)}`;

export function localProductsForCategory(category?: string): CatalogProduct[] {
  const products = category
    ? localProducts.filter((product) => product.categorySlug === category)
    : localProducts;
  return products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => {
      const itemRetailCents = variant.costCents + marginFor(variant.costCents, product.type) + 300;
      const shippingEstimateCents = shippingFor(1);
      return {
        ...variant,
        retailEstimateCents:
          itemRetailCents +
          shippingEstimateCents +
          paymentFeeFor(itemRetailCents + shippingEstimateCents),
      };
    }),
  }));
}

export function createLocalQuote(
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    placementCodes: string[];
    placements?: Array<{
      code: string;
      designAssetId?: string;
      layout?: 'center' | 'left' | 'right';
    }>;
    orientation?: 'portrait' | 'landscape' | 'square';
    designAssetId?: string;
  }>,
  studioPassId?: string
): QuoteBreakdown {
  const quoteItems = items.map((item) => {
    const product = localProducts.find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error(`Unknown product ${item.productId}`);
    const variant = product.variants.find((candidate) => candidate.id === item.variantId);
    if (!variant) throw new Error(`Unknown variant ${item.variantId}`);
    const quantity = Math.max(1, Math.floor(item.quantity || 1));
    const placementCodes = item.placements?.length
      ? item.placements.map((placement) => placement.code)
      : item.placementCodes.length
        ? item.placementCodes
        : product.placements
            .filter((placement) => placement.isDefault)
            .map((placement) => placement.code);
    const placements = placementCodes.map((code, index) => {
      const selection = item.placements?.find((placement) => placement.code === code);
      const option = product.placements.find((placement) => placement.code === code);
      return {
        code,
        designAssetId: selection?.designAssetId ?? item.designAssetId,
        layout: selection?.layout,
        technique: option?.technique ?? 'default',
        additionalCostCents: index === 0 ? 0 : (option?.additionalPriceCents ?? 0),
      };
    });
    const placementCostCents = placements.reduce(
      (total, placement) => total + placement.additionalCostCents,
      0
    );
    const unitCostCents = variant.costCents + placementCostCents;
    const uniqueDesignCount = new Set(
      placements.map((placement) => placement.designAssetId).filter(Boolean)
    ).size;
    const designFeeCents = Math.max(1, uniqueDesignCount) * 300;
    return {
      productId: product.id,
      variantId: variant.id,
      printfulVariantId: variant.printfulVariantId,
      title: product.title,
      variantName: variant.name,
      quantity,
      placementCodes,
      placementTechniques: Object.fromEntries(
        placementCodes.map((code) => [
          code,
          product.placements.find((placement) => placement.code === code)?.technique ?? 'default',
        ])
      ),
      placements,
      orientation: item.orientation,
      designAssetId: item.designAssetId,
      designFeeCents,
      placementCostCents,
      pricingSource: 'catalog-snapshot' as const,
      unitCostCents,
      unitRetailCents: unitCostCents + marginFor(unitCostCents, product.type) + designFeeCents,
    };
  });
  const productCostCents = quoteItems.reduce(
    (total, item) => total + item.unitCostCents * item.quantity,
    0
  );
  const placementCostCents = quoteItems.reduce(
    (total, item) => total + item.placementCostCents * item.quantity,
    0
  );
  const retailBeforeFees = quoteItems.reduce(
    (total, item) => total + item.unitRetailCents * item.quantity,
    0
  );
  const quantity = quoteItems.reduce((total, item) => total + item.quantity, 0);
  const aiDesignFeeCents = quoteItems.reduce(
    (total, item) => total + item.designFeeCents * item.quantity,
    0
  );
  const shippingEstimateCents = shippingFor(quantity);
  const paymentFeeCents = paymentFeeFor(retailBeforeFees + shippingEstimateCents);
  const targetMarginCents = quoteItems.reduce((total, item) => {
    const product = localProducts.find((candidate) => candidate.id === item.productId);
    return total + marginFor(item.unitCostCents, product?.type) * item.quantity;
  }, 0);
  const subtotalBeforeCreditsCents = retailBeforeFees + shippingEstimateCents + paymentFeeCents;
  const studioPassCreditCents =
    studioPassId || localPass ? Math.min(500, subtotalBeforeCreditsCents) : 0;

  return {
    id: localId('quote'),
    currency: 'USD',
    productCostCents,
    placementCostCents,
    shippingEstimateCents,
    taxEstimateCents: 0,
    aiDesignFeeCents,
    paymentFeeCents,
    targetMarginCents,
    studioPassCreditCents,
    subtotalBeforeCreditsCents,
    totalCents: subtotalBeforeCreditsCents - studioPassCreditCents,
    estimateFlags: { shipping: true, tax: true, paymentFee: true },
    costLines: [
      {
        code: 'product-cost',
        label: 'Product & first print',
        amountCents: productCostCents - placementCostCents,
        kind: 'cost',
      },
      ...(placementCostCents
        ? [
            {
              code: 'additional-print-areas',
              label: 'Additional print areas',
              amountCents: placementCostCents,
              kind: 'cost' as const,
            },
          ]
        : []),
      {
        code: 'design-allocation',
        label: 'Design work',
        amountCents: aiDesignFeeCents,
        kind: 'fee',
      },
      {
        code: 'margin',
        label: merchantConfig.pricing.marginLabel,
        amountCents: targetMarginCents,
        kind: 'margin',
      },
      {
        code: 'shipping-estimate',
        label: 'Estimated shipping',
        amountCents: shippingEstimateCents,
        kind: 'estimate',
      },
      {
        code: 'payment-fee-estimate',
        label: 'Card processing estimate',
        amountCents: paymentFeeCents,
        kind: 'estimate',
      },
      ...(studioPassCreditCents
        ? [
            {
              code: 'studio-pass-credit',
              label: 'Studio Pass credit',
              amountCents: -studioPassCreditCents,
              kind: 'credit' as const,
            },
          ]
        : []),
    ],
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    items: quoteItems,
  };
}

export function createLocalSession(sessionId?: string): StudioSession {
  if (localSession) return { ...localSession, studioPass: localPass ?? undefined };
  const now = new Date().toISOString();
  localSession = {
    id: sessionId || localId('sess'),
    status: 'guest',
    freeDraftsUsed: 0,
    freeDraftLimit: 3,
    createdAt: now,
    updatedAt: now,
  };
  return { ...localSession };
}

export function createLocalStudioPass(sessionId: string): CheckoutSession {
  const now = new Date().toISOString();
  localPass = {
    id: localId('pass'),
    sessionId,
    status: 'simulated',
    priceCents: 500,
    creditCents: 500,
    includedRoughDrafts: 8,
    includedEdits: 2,
    includedFinals: 1,
    roughDraftsUsed: 0,
    editsUsed: 0,
    finalsUsed: 0,
    createdAt: now,
  };
  return {
    id: localId('checkout'),
    mode: 'fixture',
    status: 'paid',
    checkoutUrl: '#studio-pass-ready',
    studioPassId: localPass.id,
    message: '$5 Studio Pass simulated and ready for this session.',
  };
}

export function createLocalDesignIdea(prompt: string, sessionId?: string): DesignIdea {
  const session = createLocalSession();
  return {
    id: localId('idea'),
    sessionId: sessionId ?? session.id,
    placementCodes: [],
    originalPrompt: prompt,
    refinedPrompt: `${prompt}. Use a centered, high-contrast, production-safe merch composition.`,
    styleTags: ['print-ready', 'high-contrast', 'fixture-mode'],
    warnings: prompt.length < 18 ? ['Add more detail for stronger drafts.'] : [],
    createdAt: new Date().toISOString(),
  };
}

export function createLocalDesignDraft(
  prompt: string,
  sessionId?: string,
  placementCodes: string[] = []
): DesignDraft {
  const normalizedPrompt = prompt.trim() || 'A clean, print-ready merch graphic';
  const session = createLocalSession();
  localDraftCount += 1;
  const safePrompt = normalizedPrompt.replace(/[<>&]/g, '').slice(0, 90);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <circle cx="512" cy="420" r="260" fill="#14b8a6" opacity="0.18"/>
  <path d="M250 582c100-165 425-165 525 0" fill="none" stroke="#111827" stroke-width="36" stroke-linecap="round"/>
  <text x="512" y="505" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="54" font-weight="700" fill="#111827">Open Merch</text>
  <text x="512" y="575" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="30" fill="#334155">${safePrompt}</text>
</svg>`;
  const draft: DesignDraft = {
    id: localId('draft'),
    sessionId: sessionId ?? session.id,
    provider: 'mock',
    generationStatus: 'complete',
    prompt: normalizedPrompt,
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    qualityTier: 'rough',
    allowance: {
      sessionId: sessionId ?? session.id,
      studioPassStatus: localPass
        ? 'available'
        : localDraftCount >= 3
          ? 'required'
          : 'not_required',
      freeDraftsRemaining: Math.max(0, 3 - localDraftCount),
      roughDraftsRemaining: localPass ? Math.max(0, 8 - localPass.roughDraftsUsed) : 0,
      editsRemaining: localPass ? Math.max(0, 2 - localPass.editsUsed) : 0,
      finalsRemaining: localPass ? Math.max(0, 1 - localPass.finalsUsed) : 0,
      nextAction: localPass ? 'continue_free' : localDraftCount >= 3 ? 'checkout' : 'continue_free',
      message: localPass
        ? 'You can keep designing within the current allowance.'
        : localDraftCount >= 3
          ? 'You have used the three free drafts included with this studio session.'
          : `${Math.max(0, 3 - localDraftCount)} free drafts remaining.`,
    },
    policy: {
      status: /nike|disney|marvel|pokemon/i.test(normalizedPrompt) ? 'blocked' : 'pass',
      reasons: /nike|disney|marvel|pokemon/i.test(normalizedPrompt)
        ? ['Use original or rights-cleared concepts before production.']
        : [],
    },
    readiness: {
      status: placementCodes.length ? 'pass' : 'warning',
      checks: [
        {
          label: 'Placement fit',
          result: placementCodes.length
            ? `Prepared for ${placementCodes.join(', ')}.`
            : 'Select a product placement before production.',
          severity: placementCodes.length ? 'pass' : 'warning',
        },
        {
          label: 'Private data',
          result: 'No customer data is required for this draft endpoint.',
          severity: 'pass',
        },
        {
          label: 'Transparent print file',
          result: 'The fixture artwork includes a transparent print file.',
          severity: 'pass',
        },
      ],
    },
    createdAt: new Date().toISOString(),
  };
  if (draft.id) localArtworkUrls.set(draft.id, draft.imageUrl);
  return draft;
}

export function createLocalMockup(params: {
  productId: string;
  variantId: string;
  placementCodes: string[];
  placements?: PlacementSelection[];
  designAssetId?: string;
  imageUrl?: string;
  orientation?: 'portrait' | 'landscape' | 'square';
}): DesignMockup {
  const product = localProducts.find((candidate) => candidate.id === params.productId);
  const placementSelections = params.placements?.length
    ? params.placements
    : params.placementCodes.map((code) => ({ code, designAssetId: params.designAssetId }));
  const fallbackImageUrl =
    params.imageUrl ??
    (params.designAssetId ? localArtworkUrls.get(params.designAssetId) : undefined) ??
    '';
  const views = placementSelections.map((placement) => ({
    label:
      product?.placements.find((candidate) => candidate.code === placement.code)?.displayName ??
      placement.code,
    imageUrl:
      (placement.designAssetId ? localArtworkUrls.get(placement.designAssetId) : undefined) ??
      fallbackImageUrl,
  }));
  return {
    id: localId('mockup'),
    status: 'complete',
    provider: 'fixture',
    productId: params.productId,
    variantId: params.variantId,
    placementCodes: params.placementCodes,
    designAssetId: params.designAssetId,
    orientation: params.orientation,
    imageUrl: views[0]?.imageUrl ?? fallbackImageUrl,
    views,
    createdAt: new Date().toISOString(),
  };
}

export function createLocalCheckout(quote: QuoteBreakdown, email?: string): CheckoutSession {
  localOrder = {
    id: localId('order'),
    orderNumber: `${merchantConfig.orders.prefix}-${new Date().getFullYear()}-FIXTURE`,
    taxCents: 0,
    status: 'submitted',
    customerEmail: email,
    totalCents: quote.totalCents,
    currency: quote.currency,
    quote,
    fulfillment: {
      provider: 'fixture',
      status: 'submitted',
      message: 'Fixture fulfillment submitted. No real charge or provider order was created.',
    },
    timeline: [
      {
        at: new Date().toISOString(),
        status: 'checkout_pending',
        note: 'Fixture checkout opened.',
      },
      { at: new Date().toISOString(), status: 'paid', note: 'Fixture checkout marked paid.' },
      { at: new Date().toISOString(), status: 'submitted', note: 'Fixture fulfillment submitted.' },
    ],
    createdAt: new Date().toISOString(),
  };
  return {
    id: localId('checkout'),
    mode: 'fixture',
    status: 'paid',
    checkoutUrl: `/order/${localOrder.id}`,
    quoteId: quote.id,
    studioPassId: localPass?.id,
    orderId: localOrder.id,
    orderAccess: { orderId: localOrder.id, token: `oma_${'f'.repeat(43)}` },
    message: 'Fixture checkout completed. No real charge was created.',
  };
}

export function getLocalCustomerReorderDraft(): CustomerReorderDraft | null {
  if (!localOrder?.quote?.items.length) return null;
  return {
    sourceOrderNumber: localOrder.orderNumber,
    items: localOrder.quote.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.title,
      variantName: item.variantName,
      quantity: item.quantity,
      placementCodes: item.placementCodes,
      placements: item.placements.map((placement) => ({
        code: placement.code,
        designAssetId: placement.designAssetId ?? item.designAssetId,
        layout: placement.layout,
      })),
      orientation: item.orientation,
      designAssetId:
        item.designAssetId ??
        item.placements.find((placement) => placement.designAssetId)?.designAssetId ??
        '',
    })),
  };
}

export function getLocalCustomerOrder(supportEmail: string): CustomerOrderConfirmation | null {
  if (!localOrder) return null;
  return {
    orderNumber: localOrder.orderNumber,
    status: 'received',
    message: 'This simulated order was received. No real payment or production order was created.',
    totalCents: localOrder.totalCents,
    taxCents: localOrder.taxCents,
    refundedCents: localOrder.refundedCents,
    paidAt: localOrder.paidAt,
    currency: localOrder.currency,
    items:
      localOrder.quote?.items.map((item) => ({
        title: item.title,
        variantName: item.variantName,
        quantity: item.quantity,
      })) ?? [],
    fulfillment: {
      provider: 'fixture',
      status: 'received',
      message: 'Fixture fulfillment was simulated for product testing only.',
    },
    timeline: [
      {
        at: localOrder.createdAt,
        status: 'awaiting_payment',
        note: 'Simulated secure checkout was started.',
      },
      {
        at: localOrder.createdAt,
        status: 'received',
        note: 'The simulated order was received.',
      },
    ],
    shipments: [],
    support: { email: supportEmail },
    createdAt: localOrder.createdAt,
  };
}
