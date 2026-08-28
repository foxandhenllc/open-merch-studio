import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { sampleCatalog } from './catalog-fixtures.js';
import type {
  CatalogCategoryDto,
  CatalogProductDto,
  CatalogVariantDto,
  PlacementOption,
  QuoteBreakdown,
  QuoteLineInput,
} from '../types/catalog.js';
import { buildQuoteBreakdown, estimateRetailTotalCents } from './pricing.service.js';
import { fetchPrintfulVariantPricing, type PrintfulVariantPricing } from './printful.service.js';
import {
  getDraft,
  getStudioPassById,
  getStudioPassForSession,
  saveQuote,
} from './runtime-store.js';

const launchCategorySlugs = new Set(sampleCatalog.categories.map((category) => category.slug));
const curatedPosterVariants: CatalogVariantDto[] = [
  {
    id: 'printful-variant-4464',
    printfulVariantId: 4464,
    name: '12 × 12 in',
    size: '12 × 12 in',
    color: null,
    colorCode: null,
    imageUrl: 'https://files.cdn.printful.com/products/1/4464_1527678770.jpg',
    isAvailable: true,
    costCents: 889,
  },
  {
    id: 'printful-variant-6242',
    printfulVariantId: 6242,
    name: '18 × 18 in',
    size: '18 × 18 in',
    color: null,
    colorCode: null,
    imageUrl: 'https://files.cdn.printful.com/products/1/6242_1527678943.jpg',
    isAvailable: true,
    costCents: 1239,
  },
  {
    id: 'printful-variant-48499',
    printfulVariantId: 48499,
    name: '24 × 24 in',
    size: '24 × 24 in',
    color: null,
    colorCode: null,
    imageUrl: 'https://files.cdn.printful.com/products/1/48499_1777277701.jpg',
    isAvailable: true,
    costCents: 1289,
  },
];

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const decimalToCents = (value: Prisma.Decimal | number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  return Math.round(Number(value) * 100);
};

const fixtureCategories = (): CatalogCategoryDto[] => sampleCatalog.categories;
const withRetailEstimates = (product: CatalogProductDto): CatalogProductDto => ({
  ...product,
  variants: product.variants.map((variant) => ({
    ...variant,
    retailEstimateCents: estimateRetailTotalCents(variant.costCents, product.type),
  })),
});

const fixtureProducts = (): CatalogProductDto[] => sampleCatalog.products.map(withRetailEstimates);

const placementPriceFallbackCents = (
  printfulId: number | null,
  code: string
): number | undefined => {
  if ([71, 367].includes(printfulId ?? -1) && ['front', 'back'].includes(code)) return 595;
  return undefined;
};

const mapCategory = (category: {
  id: string;
  printfulId: number | null;
  title: string;
  slug: string;
  imageUrl: string | null;
  isLaunchCategory: boolean;
}): CatalogCategoryDto => ({
  id: category.id,
  printfulId: category.printfulId,
  title: category.title,
  slug: category.slug,
  imageUrl: category.imageUrl,
  isLaunchCategory: category.isLaunchCategory,
});

type ProductWithCatalog = Prisma.CatalogProductGetPayload<{
  include: {
    category: true;
    variants: {
      include: {
        priceSnapshots: {
          orderBy: { capturedAt: 'desc' };
          take: 1;
        };
      };
    };
    placements: true;
  };
}>;

const mapProduct = (product: ProductWithCatalog): CatalogProductDto => {
  let variants: CatalogVariantDto[] = product.variants.map((variant) => ({
    id: variant.id,
    printfulVariantId: variant.printfulVariantId,
    name: variant.name,
    size: variant.size,
    color: variant.color,
    colorCode: variant.colorCode,
    imageUrl: variant.imageUrl,
    isAvailable: variant.isAvailable,
    costCents: decimalToCents(variant.priceSnapshots[0]?.amount),
  }));
  if (product.printfulId === 1) {
    const existing = new Set(variants.map((variant) => variant.printfulVariantId));
    variants = [
      ...variants,
      ...curatedPosterVariants.filter((variant) => !existing.has(variant.printfulVariantId)),
    ];
  }
  variants = variants.map((variant) => ({
    ...variant,
    retailEstimateCents: estimateRetailTotalCents(variant.costCents, product.type),
  }));

  const placements: PlacementOption[] = product.placements
    .map((placement) => ({
      code: placement.code,
      displayName: placement.displayName,
      technique: placement.technique,
      isDefault: placement.isDefault,
      width: placement.width === null ? undefined : Number(placement.width),
      height: placement.height === null ? undefined : Number(placement.height),
      additionalPriceCents: placementPriceFallbackCents(product.printfulId, placement.code),
    }))
    .sort(
      (left, right) =>
        Number(right.isDefault) - Number(left.isDefault) ||
        left.displayName.localeCompare(right.displayName)
    );

  return {
    id: product.id,
    printfulId: product.printfulId,
    title: product.title,
    slug: product.slug,
    type: product.type,
    brand: product.brand,
    description: product.description,
    thumbnailUrl: product.thumbnailUrl,
    categorySlug: product.category?.slug ?? null,
    categoryTitle: product.category?.title ?? null,
    isSellable: product.isSellable,
    curationStatus: product.curationStatus,
    variants,
    placements,
  };
};

async function ensureCuratedQuoteVariants(
  products: CatalogProductDto[],
  inputItems: QuoteLineInput[]
): Promise<void> {
  if (!env.databaseUrl) return;
  for (const item of inputItems) {
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
    if (product?.printfulId !== 1 || !variant?.printfulVariantId) continue;
    if (!curatedPosterVariants.some((candidate) => candidate.id === variant.id)) continue;
    const stored = await prisma.catalogVariant.upsert({
      where: { printfulVariantId: variant.printfulVariantId },
      update: {
        productId: product.id,
        name: variant.name,
        size: variant.size,
        imageUrl: variant.imageUrl,
        isAvailable: true,
      },
      create: {
        id: variant.id,
        printfulVariantId: variant.printfulVariantId,
        productId: product.id,
        name: variant.name,
        size: variant.size,
        imageUrl: variant.imageUrl,
        availability: { sellingRegion: env.printfulSellingRegion },
        isAvailable: true,
      },
    });
    const price = await prisma.priceSnapshot.findFirst({
      where: { productId: product.id, variantId: stored.id, priceType: 'base' },
    });
    if (!price) {
      await prisma.priceSnapshot.create({
        data: {
          productId: product.id,
          variantId: stored.id,
          amount: variant.costCents / 100,
          currency: env.defaultCurrency,
          source: 'printful-curated',
          priceType: 'base',
        },
      });
    }
  }
}

async function readProductsFromDatabase(): Promise<CatalogProductDto[]> {
  if (!env.databaseUrl) return [];

  const products = await prisma.catalogProduct.findMany({
    where: {
      isActive: true,
      isSellable: true,
    },
    include: {
      category: true,
      variants: {
        where: { isAvailable: true },
        include: {
          priceSnapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1,
          },
        },
      },
      placements: true,
    },
    orderBy: [{ category: { title: 'asc' } }, { title: 'asc' }],
  });
  return products.map(mapProduct);
}

export async function listCategories(): Promise<CatalogCategoryDto[]> {
  if (!env.databaseUrl) return fixtureCategories();

  try {
    const categories = await prisma.catalogCategory.findMany({
      where: { isActive: true, isLaunchCategory: true },
      orderBy: { title: 'asc' },
    });
    return categories.length ? categories.map(mapCategory) : fixtureCategories();
  } catch {
    return fixtureCategories();
  }
}

export async function listProducts(
  filters: { category?: string; q?: string } = {}
): Promise<CatalogProductDto[]> {
  let products: CatalogProductDto[];
  try {
    products = await readProductsFromDatabase();
    if (!products.length) products = fixtureProducts();
  } catch {
    products = fixtureProducts();
  }

  return products.filter((product) => {
    const categoryMatches = !filters.category || product.categorySlug === filters.category;
    const q = filters.q?.trim().toLowerCase();
    const queryMatches =
      !q ||
      [product.title, product.description, product.type, product.brand]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    return categoryMatches && queryMatches;
  });
}

export async function getProductBySlug(slug: string): Promise<CatalogProductDto | null> {
  const products = await listProducts();
  return products.find((product) => product.slug === slug) ?? null;
}

export async function getProductsByIds(productIds: string[]): Promise<CatalogProductDto[]> {
  const products = await listProducts();
  const ids = new Set(productIds);
  return products.filter((product) => ids.has(product.id));
}

export async function createQuote(
  inputItems: QuoteLineInput[],
  options: { sessionId?: string; studioPassId?: string } = {}
): Promise<QuoteBreakdown & { id: string | null }> {
  const products = await getProductsByIds(inputItems.map((item) => item.productId));
  try {
    await ensureCuratedQuoteVariants(products, inputItems);
  } catch {
    // Runtime quotes remain available if catalog persistence is temporarily unavailable.
  }
  const pass =
    options.sessionId || options.studioPassId
      ? (getStudioPassForSession(options.sessionId ?? '') ??
        getStudioPassById(options.studioPassId))
      : undefined;
  const designAssetIds = Array.from(
    new Set(
      inputItems
        .flatMap((item) => [
          item.designAssetId,
          ...(item.placements ?? []).map((placement) => placement.designAssetId),
        ])
        .filter(Boolean) as string[]
    )
  );
  const designFeeCentsByAssetId: Record<string, number> = {};
  if (designAssetIds.length) {
    for (const assetId of designAssetIds) {
      if (getDraft(assetId)?.sourceType === 'uploaded') designFeeCentsByAssetId[assetId] = 0;
    }
    if (env.databaseUrl) {
      try {
        const assets = await prisma.designAsset.findMany({
          where: { id: { in: designAssetIds } },
          select: { id: true, sourceType: true },
        });
        for (const asset of assets) {
          designFeeCentsByAssetId[asset.id] =
            asset.sourceType === 'uploaded' ? 0 : env.aiDesignFeeCents;
        }
      } catch {
        // Fall back to the configured design fee if source metadata is unavailable.
      }
    }
  }
  const providerPricingByVariantId: Record<string, PrintfulVariantPricing> = {};
  await Promise.all(
    inputItems.map(async (input) => {
      const product = products.find((candidate) => candidate.id === input.productId);
      const variant = product?.variants.find((candidate) => candidate.id === input.variantId);
      const firstCode = input.placements?.[0]?.code ?? input.placementCodes[0];
      const technique = product?.placements.find(
        (placement) => placement.code === firstCode
      )?.technique;
      if (!variant?.printfulVariantId || !technique) return;
      try {
        providerPricingByVariantId[variant.id] = await fetchPrintfulVariantPricing({
          printfulVariantId: variant.printfulVariantId,
          technique,
        });
      } catch {
        // A recent catalog snapshot and explicit placement fallbacks keep quotes available.
      }
    })
  );
  const quote = buildQuoteBreakdown(products, inputItems, undefined, {
    studioPassCreditCents: pass && pass.status !== 'applied' ? pass.creditCents : 0,
    designFeeCentsByAssetId,
    providerPricingByVariantId,
  });
  const runtimeQuote = saveQuote(quote);

  if (!env.databaseUrl) {
    return { ...runtimeQuote, id: runtimeQuote.id ?? null };
  }

  try {
    const created = await prisma.quote.create({
      data: {
        currency: quote.currency,
        productCostCents: quote.productCostCents,
        shippingEstimateCents: quote.shippingEstimateCents,
        taxEstimateCents: quote.taxEstimateCents,
        aiDesignFeeCents: quote.aiDesignFeeCents,
        paymentFeeCents: quote.paymentFeeCents,
        targetMarginCents: quote.targetMarginCents,
        studioPassCreditCents: quote.studioPassCreditCents,
        subtotalBeforeCreditsCents: quote.subtotalBeforeCreditsCents,
        costLines: quote.costLines,
        estimateFlags: quote.estimateFlags,
        totalCents: runtimeQuote.totalCents,
        expiresAt: new Date(quote.expiresAt),
        items: {
          create: quote.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            designAssetId: item.designAssetId,
            quantity: item.quantity,
            placementCodes: item.placementCodes,
            options: {
              orientation: item.orientation,
              placementTechniques: item.placementTechniques,
              placements: item.placements,
              designFeeCents: item.designFeeCents,
              placementCostCents: item.placementCostCents,
              pricingSource: item.pricingSource,
            },
            unitCostCents: item.unitCostCents,
            unitRetailCents: item.unitRetailCents,
          })),
        },
      },
    });
    const saved = saveQuote({ ...runtimeQuote, id: created.id });
    return { ...saved, id: created.id };
  } catch {
    return { ...runtimeQuote, id: runtimeQuote.id ?? null };
  }
}

export function isLaunchCategoryTitle(title: string): boolean {
  const slug = slugify(title);
  return (
    launchCategorySlugs.has(slug) ||
    Array.from(launchCategorySlugs).some((category) => slug.includes(category))
  );
}

export const catalogRuntime = {
  source: env.printfulApiKey ? 'printful-or-database' : 'fixture-or-database',
  curatedCategorySlugs: Array.from(launchCategorySlugs),
};
