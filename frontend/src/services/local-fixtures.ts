import type { CatalogCategory, CatalogProduct, DesignDraft, QuoteBreakdown } from '@app-types/catalog';

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
    title: 'Heavyweight cotton shirt',
    slug: 'heavyweight-cotton-shirt',
    type: 'apparel',
    brand: 'Fixture',
    description: 'A durable everyday garment for artwork, logos, and campaign drops.',
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
    title: 'Structured embroidered cap',
    slug: 'structured-embroidered-cap',
    type: 'hat',
    brand: 'Fixture',
    description: 'A front-panel cap for compact marks, badges, and short text.',
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
    title: 'Ceramic mug',
    slug: 'ceramic-mug',
    type: 'drinkware',
    brand: 'Fixture',
    description: 'A wrap-ready mug for gifts, desk drops, and small batch launches.',
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
    title: 'Matte poster',
    slug: 'matte-poster',
    type: 'wall-art',
    brand: 'Fixture',
    description: 'A lightweight wall art option for posters, prints, and event graphics.',
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
    title: 'Canvas tote bag',
    slug: 'canvas-tote-bag',
    type: 'bag',
    brand: 'Fixture',
    description: 'A useful merch staple with a large single-sided print area.',
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
    title: 'Kiss-cut sticker',
    slug: 'kiss-cut-sticker',
    type: 'sticker',
    brand: 'Fixture',
    description: 'A compact add-on product for logos, mascots, and campaign art.',
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
    title: 'Slim phone case',
    slug: 'slim-phone-case',
    type: 'phone-case',
    brand: 'Fixture',
    description: 'A protective case format for device-specific artwork.',
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
    title: 'Spiral notebook',
    slug: 'spiral-notebook',
    type: 'stationery',
    brand: 'Fixture',
    description: 'A notebook surface for cover art, office gifts, and creator bundles.',
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

const marginFor = (costCents: number) => Math.max(500, Math.round(costCents * 0.3));
const shippingFor = (quantity: number) => (quantity <= 0 ? 0 : 495 + Math.max(0, quantity - 1) * 175);
const paymentFeeFor = (subtotalCents: number) => Math.round(subtotalCents * 0.029 + 30);

export function localProductsForCategory(category?: string): CatalogProduct[] {
  return category ? localProducts.filter((product) => product.categorySlug === category) : localProducts;
}

export function createLocalQuote(items: Array<{ productId: string; variantId: string; quantity: number; placementCodes: string[] }>): QuoteBreakdown {
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
      unitCostCents: variant.costCents,
      unitRetailCents: variant.costCents + marginFor(variant.costCents) + 300,
    };
  });
  const productCostCents = quoteItems.reduce((total, item) => total + item.unitCostCents * item.quantity, 0);
  const retailBeforeFees = quoteItems.reduce((total, item) => total + item.unitRetailCents * item.quantity, 0);
  const quantity = quoteItems.reduce((total, item) => total + item.quantity, 0);
  const shippingEstimateCents = shippingFor(quantity);
  const paymentFeeCents = paymentFeeFor(retailBeforeFees + shippingEstimateCents);

  return {
    id: null,
    currency: 'USD',
    productCostCents,
    shippingEstimateCents,
    taxEstimateCents: 0,
    aiDesignFeeCents: quantity * 300,
    paymentFeeCents,
    targetMarginCents: quoteItems.reduce((total, item) => total + marginFor(item.unitCostCents) * item.quantity, 0),
    totalCents: retailBeforeFees + shippingEstimateCents + paymentFeeCents,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    items: quoteItems,
  };
}

export function createLocalDesignDraft(prompt: string): DesignDraft {
  const normalizedPrompt = prompt.trim() || 'A clean, print-ready merch graphic';
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
    id: null,
    provider: 'mock',
    prompt: normalizedPrompt,
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    readiness: {
      status: normalizedPrompt.length < 12 ? 'needs_review' : 'pass',
      checks: [
        { label: 'Transparent-ready composition', result: 'Generated as a centered graphic intended for placement mockups.' },
        {
          label: 'Prompt specificity',
          result:
            normalizedPrompt.length < 12
              ? 'Add more subject and style detail before production.'
              : 'Prompt has enough detail for a first-pass artwork draft.',
        },
        { label: 'Private data', result: 'No customer data is required for this draft endpoint.' },
      ],
    },
  };
}
