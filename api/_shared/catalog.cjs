const categories = [
  { id: 'fixture-category-apparel', title: 'Apparel', slug: 'apparel', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-hats', title: 'Hats', slug: 'hats', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-drinkware', title: 'Drinkware', slug: 'drinkware', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-wall-art', title: 'Wall art', slug: 'wall-art', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-bags', title: 'Bags', slug: 'bags', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-stickers', title: 'Stickers', slug: 'stickers', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-phone-cases', title: 'Phone cases', slug: 'phone-cases', imageUrl: null, isLaunchCategory: true },
  { id: 'fixture-category-stationery', title: 'Stationery', slug: 'stationery', imageUrl: null, isLaunchCategory: true },
];

const placements = {
  front: [{ code: 'front', displayName: 'Front print', technique: 'dtg', isDefault: true }],
  default: [{ code: 'default', displayName: 'Default print area', technique: 'dtg', isDefault: true }],
};

const products = [
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
      { id: 'fixture-variant-shirt-black-m', name: 'Black / M', size: 'M', color: 'Black', colorCode: '#111827', imageUrl: null, isAvailable: true, costCents: 1450 },
      { id: 'fixture-variant-shirt-white-l', name: 'White / L', size: 'L', color: 'White', colorCode: '#f8fafc', imageUrl: null, isAvailable: true, costCents: 1450 },
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
    description:
      'A six-panel cap with a flat front panel — built for crisp embroidered logos, badges, and short text.',
    thumbnailUrl: null,
    categorySlug: 'hats',
    categoryTitle: 'Hats',
    isSellable: true,
    variants: [{ id: 'fixture-variant-cap-navy', name: 'Navy', color: 'Navy', colorCode: '#172554', imageUrl: null, isAvailable: true, costCents: 1275 }],
    placements: [{ code: 'embroidery_front', displayName: 'Front embroidery', technique: 'embroidery', isDefault: true, width: 4, height: 2 }],
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
    variants: [{ id: 'fixture-variant-mug-white-11oz', name: 'White / 11 oz', size: '11 oz', color: 'White', colorCode: '#ffffff', imageUrl: null, isAvailable: true, costCents: 830 }],
    placements: placements.default,
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
    variants: [{ id: 'fixture-variant-poster-12x18', name: '12 x 18 in', size: '12 x 18', imageUrl: null, isAvailable: true, costCents: 700 }],
    placements: placements.default,
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
    variants: [{ id: 'fixture-variant-tote-natural', name: 'Natural', color: 'Natural', colorCode: '#d6c3a3', imageUrl: null, isAvailable: true, costCents: 1125 }],
    placements: placements.front,
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
    variants: [{ id: 'fixture-variant-sticker-3x3', name: '3 x 3 in', size: '3 x 3', imageUrl: null, isAvailable: true, costCents: 250 }],
    placements: placements.default,
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
    variants: [{ id: 'fixture-variant-phone-case-iphone', name: 'iPhone compatible', imageUrl: null, isAvailable: true, costCents: 1025 }],
    placements: placements.default,
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
    variants: [{ id: 'fixture-variant-notebook-ruled', name: 'Ruled pages', imageUrl: null, isAvailable: true, costCents: 900 }],
    placements: placements.default,
  },
];

const moneySettings = {
  currency: 'USD',
  targetMarginPercent: 30,
  minMarginCents: 500,
  aiDesignFeeCents: 300,
  paymentFeePercent: 2.9,
  paymentFeeFixedCents: 30,
};

function listProducts({ category, q } = {}) {
  return products.filter((product) => {
    const categoryMatches = !category || product.categorySlug === category;
    const query = q && String(q).trim().toLowerCase();
    const queryMatches = !query || [product.title, product.description, product.type, product.brand]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
    return categoryMatches && queryMatches;
  });
}

function estimateShippingCents(productCount) {
  if (productCount <= 0) return 0;
  return 495 + Math.max(0, productCount - 1) * 175;
}

function marginFor(costCents) {
  return Math.max(moneySettings.minMarginCents, Math.round(costCents * (moneySettings.targetMarginPercent / 100)));
}

function paymentFeeFor(subtotalCents) {
  return Math.round(subtotalCents * (moneySettings.paymentFeePercent / 100) + moneySettings.paymentFeeFixedCents);
}

function buildQuote(inputItems, studioPassId) {
  const items = inputItems.map((input) => {
    const product = products.find((candidate) => candidate.id === input.productId);
    if (!product) throw new Error(`Unknown product ${input.productId}`);
    const variant = product.variants.find((candidate) => candidate.id === input.variantId);
    if (!variant) throw new Error(`Unknown variant ${input.variantId}`);
    const placementCodes = Array.isArray(input.placementCodes) && input.placementCodes.length
      ? input.placementCodes
      : product.placements.filter((placement) => placement.isDefault).map((placement) => placement.code);
    const quantity = Math.max(1, Math.floor(Number(input.quantity) || 1));
    const unitRetailCents = variant.costCents + marginFor(variant.costCents) + moneySettings.aiDesignFeeCents;
    return {
      productId: product.id,
      variantId: variant.id,
      printfulVariantId: variant.printfulVariantId || null,
      title: product.title,
      variantName: variant.name,
      quantity,
      placementCodes,
      designAssetId: input.designAssetId,
      unitCostCents: variant.costCents,
      unitRetailCents,
    };
  });
  const productCostCents = items.reduce((total, item) => total + item.unitCostCents * item.quantity, 0);
  const itemRetailBeforeFees = items.reduce((total, item) => total + item.unitRetailCents * item.quantity, 0);
  const aiDesignFeeCents = items.reduce((total, item) => total + moneySettings.aiDesignFeeCents * item.quantity, 0);
  const targetMarginCents = items.reduce((total, item) => total + marginFor(item.unitCostCents) * item.quantity, 0);
  const shippingEstimateCents = estimateShippingCents(items.reduce((total, item) => total + item.quantity, 0));
  const paymentFeeCents = paymentFeeFor(itemRetailBeforeFees + shippingEstimateCents);
  const subtotalBeforeCreditsCents = itemRetailBeforeFees + shippingEstimateCents + paymentFeeCents;
  const studioPassCreditCents = studioPassId || inputItems.some((item) => item.studioPassId)
    ? Math.min(500, subtotalBeforeCreditsCents)
    : 0;
  const costLines = [
    { code: 'product-cost', label: 'Product and fulfillment base', amountCents: productCostCents, kind: 'cost' },
    { code: 'design-allocation', label: 'Design readiness allocation', amountCents: aiDesignFeeCents, kind: 'fee' },
    { code: 'margin', label: 'Studio margin', amountCents: targetMarginCents, kind: 'margin' },
    { code: 'shipping-estimate', label: 'Shipping estimate', amountCents: shippingEstimateCents, kind: 'estimate' },
    { code: 'payment-fee-estimate', label: 'Payment fee estimate', amountCents: paymentFeeCents, kind: 'estimate' },
  ];
  if (studioPassCreditCents) {
    costLines.push({
      code: 'studio-pass-credit',
      label: 'Studio Pass credit',
      amountCents: -studioPassCreditCents,
      kind: 'credit',
    });
  }
  return {
    id: `quote_${Date.now().toString(36)}`,
    currency: moneySettings.currency,
    productCostCents,
    shippingEstimateCents,
    taxEstimateCents: 0,
    aiDesignFeeCents,
    paymentFeeCents,
    targetMarginCents,
    studioPassCreditCents,
    subtotalBeforeCreditsCents,
    totalCents: subtotalBeforeCreditsCents - studioPassCreditCents,
    estimateFlags: { shipping: true, tax: true, paymentFee: true },
    costLines,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    items,
  };
}

function createDesignDraft(prompt) {
  const normalizedPrompt = String(prompt || '').trim() || 'A clean, print-ready merch graphic';
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
    id: `draft_${Date.now().toString(36)}`,
    sessionId: 'fixture-session',
    provider: 'mock',
    prompt: normalizedPrompt,
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    qualityTier: 'rough',
    allowance: {
      sessionId: 'fixture-session',
      studioPassStatus: 'not_required',
      freeDraftsRemaining: 1,
      roughDraftsRemaining: 0,
      editsRemaining: 0,
      finalsRemaining: 0,
      nextAction: 'continue_free',
      message: 'You can keep designing within the current allowance.',
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
        { label: 'Transparent-ready composition', result: 'Generated as a centered graphic intended for placement mockups.', severity: 'pass' },
        { label: 'Prompt specificity', result: normalizedPrompt.length < 12 ? 'Add more subject and style detail before production.' : 'Prompt has enough detail for a first-pass artwork draft.', severity: normalizedPrompt.length < 12 ? 'warning' : 'pass' },
        { label: 'Private data', result: 'No customer data is required for this draft endpoint.', severity: 'pass' },
      ],
    },
    createdAt: new Date().toISOString(),
  };
}

function createSession() {
  const now = new Date().toISOString();
  return {
    id: 'fixture-session',
    status: 'guest',
    freeDraftsUsed: 0,
    freeDraftLimit: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function createDesignIdea(prompt) {
  const originalPrompt = String(prompt || '').trim() || 'A clean, print-ready merch graphic';
  return {
    id: `idea_${Date.now().toString(36)}`,
    sessionId: 'fixture-session',
    placementCodes: [],
    originalPrompt,
    refinedPrompt: `${originalPrompt}. Use a centered, high-contrast, production-safe merch composition.`,
    styleTags: ['print-ready', 'high-contrast', 'fixture-mode'],
    warnings: originalPrompt.length < 18 ? ['Add more detail for stronger drafts.'] : [],
    createdAt: new Date().toISOString(),
  };
}

function createMockup(body = {}) {
  return {
    id: `mockup_${Date.now().toString(36)}`,
    status: 'complete',
    provider: 'fixture',
    productId: body.productId,
    variantId: body.variantId,
    placementCodes: Array.isArray(body.placementCodes) ? body.placementCodes : [],
    designAssetId: body.designAssetId,
    imageUrl: body.imageUrl || createDesignDraft('Mockup preview').imageUrl,
    createdAt: new Date().toISOString(),
  };
}

function createStudioPassCheckout() {
  if (process.env.ENABLE_LIVE_STRIPE === 'true') {
    return {
      id: `checkout_${Date.now().toString(36)}`,
      mode: 'stripe-ready',
      status: 'blocked',
      checkoutUrl: null,
      message:
        'This Vercel fixture API does not create live Stripe sessions. Use the backend checkout service with private OPS approval.',
    };
  }
  return {
    id: `checkout_${Date.now().toString(36)}`,
    mode: 'fixture',
    status: 'paid',
    checkoutUrl: '#studio-pass-ready',
    studioPassId: 'fixture-studio-pass',
    message: '$5 Studio Pass simulated and ready for this session.',
  };
}

function fixtureOrder(quote, email) {
  return {
    id: 'fixture-order',
    orderNumber: `OMS-${new Date().getFullYear()}-FIXTURE`,
    status: 'submitted',
    customerEmail: email,
    totalCents: quote?.totalCents || 0,
    currency: quote?.currency || 'USD',
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
}

function createCheckout(body = {}) {
  if (process.env.ENABLE_LIVE_STRIPE === 'true') {
    return {
      id: `checkout_${Date.now().toString(36)}`,
      mode: 'stripe-ready',
      status: 'blocked',
      checkoutUrl: null,
      quoteId: body.quoteId || body.quote?.id,
      studioPassId: body.studioPassId,
      message:
        'This Vercel fixture API does not create live Stripe sessions. Use the backend checkout service with private OPS approval.',
    };
  }
  const order = fixtureOrder(body.quote, body.email);
  return {
    id: `checkout_${Date.now().toString(36)}`,
    mode: 'fixture',
    status: 'paid',
    checkoutUrl: `/order/${order.id}`,
    quoteId: body.quoteId || body.quote?.id,
    studioPassId: body.studioPassId,
    orderId: order.id,
    order,
    message: 'Fixture checkout completed. No real charge was created.',
  };
}

const launchReadiness = {
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

function adminReport() {
  return {
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
    sessions: 1,
    studioPasses: 0,
    designDrafts: 0,
    orders: 0,
    estimatedAiSpendCents: 0,
    launchReadiness,
  };
}

function json(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  categories,
  products,
  listProducts,
  buildQuote,
  createDesignDraft,
  createSession,
  createDesignIdea,
  createMockup,
  createStudioPassCheckout,
  createCheckout,
  fixtureOrder,
  adminReport,
  launchReadiness,
  json,
  parseBody,
};
