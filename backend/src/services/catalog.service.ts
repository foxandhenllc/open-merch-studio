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
import { buildQuoteBreakdown } from './pricing.service.js';

const launchCategorySlugs = new Set(sampleCatalog.categories.map((category) => category.slug));

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
const fixtureProducts = (): CatalogProductDto[] => sampleCatalog.products;

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
  const variants: CatalogVariantDto[] = product.variants.map((variant) => ({
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

  const placements: PlacementOption[] = product.placements.map((placement) => ({
    code: placement.code,
    displayName: placement.displayName,
    technique: placement.technique,
    isDefault: placement.isDefault,
    width: placement.width === null ? undefined : Number(placement.width),
    height: placement.height === null ? undefined : Number(placement.height),
  }));

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
    variants,
    placements,
  };
};

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
  inputItems: QuoteLineInput[]
): Promise<QuoteBreakdown & { id: string | null }> {
  const products = await getProductsByIds(inputItems.map((item) => item.productId));
  const quote = buildQuoteBreakdown(products, inputItems);

  if (!env.databaseUrl) {
    return { ...quote, id: null };
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
        totalCents: quote.totalCents,
        expiresAt: new Date(quote.expiresAt),
        items: {
          create: quote.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            placementCodes: item.placementCodes,
            unitCostCents: item.unitCostCents,
            unitRetailCents: item.unitRetailCents,
          })),
        },
      },
    });
    return { ...quote, id: created.id };
  } catch {
    return { ...quote, id: null };
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
