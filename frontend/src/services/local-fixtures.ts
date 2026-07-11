import type {
  AdminReport,
  CatalogCategory,
  CatalogProduct,
  CheckoutSession,
  DesignDraft,
  DesignIdea,
  DesignMockup,
  LaunchReadiness,
  OrderSummary,
  QuoteBreakdown,
  StudioPass,
  StudioSession,
} from '@app-types/catalog';

export const localCategories: CatalogCategory[] = [
  { id: 'fixture-category-apparel', title: 'Apparel', slug: 'apparel', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-hats', title: 'Hats', slug: 'hats', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-drinkware', title: 'Drinkware', slug: 'drinkware', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-wall-art', title: 'Wall art', slug: 'wall-art', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-bags', title: 'Bags', slug: 'bags', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-stickers', title: 'Stickers', slug: 'stickers', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-phone-cases', title: 'Phone cases', slug: 'phone-cases', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-stationery', title: 'Stationery', slug: 'stationery', imageUrl: null, isLaunchCategory: true },
];

const defaultPlacement = [{ code: 'default', displayName: 'Default print area', technique: 'dtg', isDefault: true }];

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
      { code: 'front', displayName: 'Front print', technique: 'dtg', isDefault: true, width: 12, height: 16 },
      { code: 'back', displayName: 'Back print', technique: 'dtg', isDefault: false, width: 12, height: 16 },
    ],
  },
  {
    id: 'fixture-product-embroidered-cap',
    title: 'Structured Embroidered Cap',
    slug: 'structured-embroidered-cap',
    type: 'hat',
    brand: 'Fixture',
    description: 'A six-panel cap with a flat front panel — built for crisp embroidered logos, badges, and short text.',
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
    description: 'A dishwasher-safe 11oz mug with a full wraparound print — a go-to gift and desk companion.',
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
    description: 'Gallery-grade matte paper with rich, fade-resistant color for art prints and event graphics.',
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
    description: 'A sturdy cotton tote with a roomy print area — practical merch people actually carry every day.',
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
    placements: [{ code: 'front', displayName: 'Front print', technique: 'dtg', isDefault: true }],
  },
  {
    id: 'fixture-product-vinyl-sticker',
    title: 'Kiss-Cut Vinyl Sticker',
    slug: 'kiss-cut-sticker',
    type: 'sticker',
    brand: 'Fixture',
    description: 'Durable, weatherproof vinyl with a glossy finish — the easiest way to spread a logo or mascot.',
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
    description: 'A wire-bound notebook with a fully custom cover — a handy giveaway or creator-bundle add-on.',
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
const shippingFor = (quantity: number) => (quantity <= 0 ? 0 : 495 + Math.max(0, quantity - 1) * 175);
const paymentFeeFor = (subtotalCents: number) => Math.round(subtotalCents * 0.029 + 30);
let localSession: StudioSession | null = null;
let localPass: StudioPass | null = null;
let localOrder: OrderSummary | null = null;
let localDraftCount = 0;

const localId = (prefix: string) => `${prefix}_${Date.now().toString(36)}`;

export function localProductsForCategory(category?: string): CatalogProduct[] {
  return category ? localProducts.filter((product) => product.categorySlug === category) : localProducts;
}

export function createLocalQuote(
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    placementCodes: string[];
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
    const placementCodes = item.placementCodes.length
      ? item.placementCodes
      : product.placements.filter((placement) => placement.isDefault).map((placement) => placement.code);
    return {
      productId: product.id,
      variantId: variant.id,
      printfulVariantId: variant.printfulVariantId,
      title: product.title,
      variantName: variant.name,
      quantity,
      placementCodes,
      orientation: item.orientation,
      designAssetId: item.designAssetId,
      unitCostCents: variant.costCents,
      unitRetailCents: variant.costCents + marginFor(variant.costCents, product.type) + 300,
    };
  });
  const productCostCents = quoteItems.reduce((total, item) => total + item.unitCostCents * item.quantity, 0);
  const retailBeforeFees = quoteItems.reduce((total, item) => total + item.unitRetailCents * item.quantity, 0);
  const quantity = quoteItems.reduce((total, item) => total + item.quantity, 0);
  const shippingEstimateCents = shippingFor(quantity);
  const paymentFeeCents = paymentFeeFor(retailBeforeFees + shippingEstimateCents);
  const targetMarginCents = quoteItems.reduce((total, item) => {
    const product = localProducts.find((candidate) => candidate.id === item.productId);
    return total + marginFor(item.unitCostCents, product?.type) * item.quantity;
  }, 0);
  const subtotalBeforeCreditsCents = retailBeforeFees + shippingEstimateCents + paymentFeeCents;
  const studioPassCreditCents = studioPassId || localPass ? Math.min(500, subtotalBeforeCreditsCents) : 0;

  return {
    id: localId('quote'),
    currency: 'USD',
    productCostCents,
    shippingEstimateCents,
    taxEstimateCents: 0,
    aiDesignFeeCents: quantity * 300,
    paymentFeeCents,
    targetMarginCents,
    studioPassCreditCents,
    subtotalBeforeCreditsCents,
    totalCents: subtotalBeforeCreditsCents - studioPassCreditCents,
    estimateFlags: { shipping: true, tax: true, paymentFee: true },
    costLines: [
      { code: 'product-cost', label: 'Product and fulfillment base', amountCents: productCostCents, kind: 'cost' },
      { code: 'design-allocation', label: 'Design readiness allocation', amountCents: quantity * 300, kind: 'fee' },
      { code: 'margin', label: 'Studio margin', amountCents: targetMarginCents, kind: 'margin' },
      { code: 'shipping-estimate', label: 'Shipping estimate', amountCents: shippingEstimateCents, kind: 'estimate' },
      { code: 'payment-fee-estimate', label: 'Payment fee estimate', amountCents: paymentFeeCents, kind: 'estimate' },
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

export function createLocalSession(): StudioSession {
  if (localSession) return { ...localSession, studioPass: localPass ?? undefined };
  const now = new Date().toISOString();
  localSession = {
    id: localId('sess'),
    status: 'guest',
    freeDraftsUsed: 0,
    freeDraftLimit: 1,
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

export function createLocalDesignDraft(prompt: string, sessionId?: string): DesignDraft {
  const normalizedPrompt = prompt.trim() || 'A clean, print-ready merch graphic';
  const session = createLocalSession();
  localDraftCount += 1;
  const safePrompt = normalizedPrompt.replace(/[<>&]/g, '').slice(0, 90);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#f8fafc"/>
  <circle cx="512" cy="420" r="260" fill="#14b8a6" opacity="0.18"/>
  <path d="M250 582c100-165 425-165 525 0" fill="none" stroke="#111827" stroke-width="36" stroke-linecap="round"/>
  <text x="512" y="505" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="54" font-weight="700" fill="#111827">Open Merch</text>
  <text x="512" y="575" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="30" fill="#334155">${safePrompt}</text>
</svg>`;
  return {
    id: localId('draft'),
    sessionId: sessionId ?? session.id,
    provider: 'mock',
    prompt: normalizedPrompt,
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    qualityTier: 'rough',
    allowance: {
      sessionId: sessionId ?? session.id,
      studioPassStatus: localPass ? 'available' : localDraftCount > 1 ? 'required' : 'not_required',
      freeDraftsRemaining: localDraftCount > 1 ? 0 : 1,
      roughDraftsRemaining: localPass ? Math.max(0, 8 - localPass.roughDraftsUsed) : 0,
      editsRemaining: localPass ? Math.max(0, 2 - localPass.editsUsed) : 0,
      finalsRemaining: localPass ? Math.max(0, 1 - localPass.finalsUsed) : 0,
      nextAction: localPass || localDraftCount <= 1 ? 'continue_free' : 'buy_studio_pass',
      message: localPass || localDraftCount <= 1
        ? 'You can keep designing within the current allowance.'
        : 'A $5 Studio Pass unlocks more drafts and applies to purchase.',
    },
    policy: {
      status: /nike|disney|marvel|pokemon/i.test(normalizedPrompt) ? 'blocked' : 'pass',
      reasons: /nike|disney|marvel|pokemon/i.test(normalizedPrompt)
        ? ['Use original or rights-cleared concepts before production.']
        : [],
    },
    readiness: {
      status: normalizedPrompt.length < 12 ? 'warning' : 'pass',
      checks: [
        {
          label: 'Transparent-ready composition',
          result: 'Generated as a centered graphic intended for placement mockups.',
          severity: 'pass',
        },
        {
          label: 'Prompt specificity',
          result:
            normalizedPrompt.length < 12
              ? 'Add more subject and style detail before production.'
              : 'Prompt has enough detail for a first-pass artwork draft.',
          severity: normalizedPrompt.length < 12 ? 'warning' : 'pass',
        },
        {
          label: 'Private data',
          result: 'No customer data is required for this draft endpoint.',
          severity: 'pass',
        },
      ],
    },
    createdAt: new Date().toISOString(),
  };
}

export function createLocalMockup(params: {
  productId: string;
  variantId: string;
  placementCodes: string[];
  designAssetId?: string;
  imageUrl?: string;
  orientation?: 'portrait' | 'landscape' | 'square';
}): DesignMockup {
  return {
    id: localId('mockup'),
    status: 'complete',
    provider: 'fixture',
    productId: params.productId,
    variantId: params.variantId,
    placementCodes: params.placementCodes,
    designAssetId: params.designAssetId,
    orientation: params.orientation,
    imageUrl: params.imageUrl ?? createLocalDesignDraft('Mockup preview').imageUrl,
    createdAt: new Date().toISOString(),
  };
}

export function createLocalCheckout(quote: QuoteBreakdown, email?: string): CheckoutSession {
  localOrder = {
    id: localId('order'),
    orderNumber: `OMS-${new Date().getFullYear()}-FIXTURE`,
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
      { at: new Date().toISOString(), status: 'checkout_pending', note: 'Fixture checkout opened.' },
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
    message: 'Fixture checkout completed. No real charge was created.',
  };
}

export function getLocalOrder(): OrderSummary | null {
  return localOrder;
}

export const localLaunchReadiness: LaunchReadiness = {
  readyForPaidBeta: false,
  gates: [
    {
      code: 'fixture-mode',
      label: 'Clean fixture mode',
      status: 'pass',
      detail: 'Catalog, design, quote, checkout simulation, and fixture fulfillment run without credentials.',
    },
    {
      code: 'openai-live',
      label: 'Live OpenAI generation',
      status: 'manual',
      detail: 'Provide OpenAI credentials and explicitly enable live generation.',
    },
    {
      code: 'stripe-live',
      label: 'Production checkout',
      status: 'manual',
      detail: 'Provide Stripe private setup and enable live checkout.',
    },
    {
      code: 'printful-live',
      label: 'Real fulfillment',
      status: 'manual',
      detail: 'Provide Printful private setup and enable fulfillment.',
    },
  ],
};

export const localAdminReport: AdminReport = {
  settings: {
    studioPassPriceCents: 500,
    freeDraftLimit: 1,
    dailyAiBudgetCents: 2500,
    perSessionBudgetCents: 800,
    liveOpenAiEnabled: false,
    liveStripeEnabled: false,
    livePrintfulEnabled: false,
    checkoutEnabled: true,
    fulfillmentEnabled: false,
    defaultMarginPercent: 30,
    minMarginCents: 500,
  },
  sessions: localSession ? 1 : 0,
  studioPasses: localPass ? 1 : 0,
  designDrafts: localDraftCount,
  orders: localOrder ? 1 : 0,
  estimatedAiSpendCents: localDraftCount,
  launchReadiness: localLaunchReadiness,
};
