import type { AxiosInstance } from 'axios';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { isLaunchCategoryTitle, slugify } from './catalog.service.js';
import { sampleCatalog } from './catalog-fixtures.js';
import { createPrintfulClient } from './printful-client.service.js';

export { describePrintfulError } from './printful-client.service.js';
export {
  buildPrintfulMockupPayload,
  buildPrintfulMockupTaskPayload,
  extractMockupViews,
  generatePrintfulMockupPreview,
  normalizePrintfulTechnique,
} from './printful-mockup.service.js';
export {
  buildPrintfulOrderPayload,
  classifyPrintfulFailure,
  fetchPrintfulOrderByExternalId,
  fetchPrintfulOrderStatus,
  mapPrintfulOrderStatus,
  normalizeCountryCode,
  normalizeStateCode,
  submitPrintfulDraftOrder,
  submitPrintfulDraftOrderWithClient,
  type SubmitPrintfulDraftOrderParams,
} from './printful-order.service.js';
export {
  fetchPrintfulVariantPricing,
  type PrintfulVariantPricing,
} from './printful-pricing.service.js';

type PrintfulCategory = {
  id: number;
  parent_id?: number | null;
  title: string;
  image_url?: string | null;
};

type PrintfulProduct = {
  id: number;
  name?: string;
  title?: string;
  type?: string;
  brand?: string;
  image?: string;
  thumbnail_url?: string;
};

type PrintfulVariant = {
  id: number;
  catalog_product_id: number;
  name: string;
  size?: string | null;
  color?: string | null;
  color_code?: string | null;
  image?: string | null;
  price?: string | number | null;
  retail_price?: string | number | null;
  catalog_price?: string | number | null;
  placement_dimensions?: Array<{
    placement: string;
    width?: number;
    height?: number;
    orientation?: string;
  }>;
  techniques?: Array<
    string | { key?: string; technique?: string; id?: string; is_default?: boolean }
  >;
};

type PrintfulListResponse<T> = {
  data?: T[];
  result?: T[];
  paging?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
};

const providerPriceToAmount = (variant: PrintfulVariant): number => {
  const value = variant.price ?? variant.catalog_price ?? variant.retail_price;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const curatedPrintfulProductIds = () =>
  new Set(env.printfulCuratedProductIds.slice(0, env.printfulMaxLaunchProducts).map(String));

async function fetchAll<T>(client: AxiosInstance, path: string): Promise<T[]> {
  const limit = 100;
  let offset = 0;
  const items: T[] = [];

  let hasMore = true;
  while (hasMore) {
    const response = await client.get<PrintfulListResponse<T>>(path, {
      params: { limit, offset },
    });
    const page = response.data.data ?? response.data.result ?? [];
    items.push(...page);

    const total = response.data.paging?.total ?? items.length;
    offset += limit;
    hasMore = items.length < total && page.length > 0;
  }

  return items;
}

export async function syncPrintfulCatalog(): Promise<{
  status: string;
  productsSeen: number;
  variantsSeen: number;
  categoriesSeen: number;
  runId?: string;
}> {
  const run = await prisma.catalogSyncRun.create({
    data: { status: 'running', source: 'printful' },
  });

  try {
    const client = createPrintfulClient();
    const categories = await fetchAll<PrintfulCategory>(client, '/v2/catalog-categories');
    const categoryByPrintfulId = new Map<number, string>();

    for (const category of categories) {
      const isLaunchCategory = isLaunchCategoryTitle(category.title);
      const created = await prisma.catalogCategory.upsert({
        where: { printfulId: category.id },
        update: {
          parentPrintfulId: category.parent_id ?? null,
          title: category.title,
          slug: slugify(category.title),
          imageUrl: category.image_url ?? null,
          isLaunchCategory,
          isActive: true,
        },
        create: {
          printfulId: category.id,
          parentPrintfulId: category.parent_id ?? null,
          title: category.title,
          slug: slugify(category.title),
          imageUrl: category.image_url ?? null,
          isLaunchCategory,
          isActive: true,
        },
      });
      categoryByPrintfulId.set(category.id, created.id);
    }

    const products = await fetchAll<PrintfulProduct>(client, '/v2/catalog-products');
    let variantsSeen = 0;

    for (const product of products) {
      const title = product.title ?? product.name ?? `Printful product ${product.id}`;
      const explicitCuratedIds = curatedPrintfulProductIds();
      const isExplicitlyCurated = explicitCuratedIds.has(String(product.id));
      const existingProduct = await prisma.catalogProduct.findUnique({
        where: { printfulId: product.id },
        select: {
          isSellable: true,
          curationStatus: true,
          curatedAt: true,
          curatedBy: true,
          curationNotes: true,
        },
      });
      const productCategories = await fetchAll<PrintfulCategory>(
        client,
        `/v2/catalog-products/${product.id}/catalog-categories`
      ).catch(() => []);
      const launchCategory = productCategories.find((category) =>
        isLaunchCategoryTitle(category.title)
      );
      const categoryId =
        (launchCategory ? categoryByPrintfulId.get(launchCategory.id) : undefined) ??
        (productCategories[0] ? categoryByPrintfulId.get(productCategories[0].id) : undefined);
      const hasExplicitCurationList = env.printfulCuratedProductIds.length > 0;
      const isSellable = hasExplicitCurationList
        ? isExplicitlyCurated
        : (existingProduct?.isSellable ?? false);
      const curationStatus = isSellable
        ? 'curated'
        : (existingProduct?.curationStatus ?? 'unreviewed');
      const curatedAt = isExplicitlyCurated
        ? (existingProduct?.curatedAt ?? new Date())
        : existingProduct?.curatedAt;
      const curatedBy = isExplicitlyCurated
        ? (existingProduct?.curatedBy ?? 'PRINTFUL_CURATED_PRODUCT_IDS')
        : existingProduct?.curatedBy;
      const curationNotes = isExplicitlyCurated
        ? (existingProduct?.curationNotes ?? 'Selected for the curated launch catalog.')
        : existingProduct?.curationNotes;
      const metadata = {
        printfulCategories: productCategories.map((category) => category.title),
        launchCategoryMatched: Boolean(launchCategory),
        explicitCurationListConfigured: hasExplicitCurationList,
      };

      const createdProduct = await prisma.catalogProduct.upsert({
        where: { printfulId: product.id },
        update: {
          title,
          slug: `${slugify(title)}-${product.id}`,
          type: product.type ?? null,
          brand: product.brand ?? null,
          thumbnailUrl: product.thumbnail_url ?? product.image ?? null,
          categoryId,
          sellingRegion: env.printfulSellingRegion,
          isSellable,
          curationStatus,
          curatedAt,
          curatedBy,
          curationNotes,
          isActive: true,
          metadata,
        },
        create: {
          printfulId: product.id,
          title,
          slug: `${slugify(title)}-${product.id}`,
          type: product.type ?? null,
          brand: product.brand ?? null,
          thumbnailUrl: product.thumbnail_url ?? product.image ?? null,
          categoryId,
          sellingRegion: env.printfulSellingRegion,
          isSellable,
          curationStatus,
          curatedAt,
          curatedBy,
          curationNotes,
          isActive: true,
          metadata,
        },
      });

      const variants = await fetchAll<PrintfulVariant>(
        client,
        `/v2/catalog-products/${product.id}/catalog-variants`
      ).catch(() => []);
      variantsSeen += variants.length;

      for (const variant of variants) {
        const createdVariant = await prisma.catalogVariant.upsert({
          where: { printfulVariantId: variant.id },
          update: {
            productId: createdProduct.id,
            name: variant.name,
            size: variant.size ?? null,
            color: variant.color ?? null,
            colorCode: variant.color_code ?? null,
            imageUrl: variant.image ?? null,
            isAvailable: true,
            availability: { sellingRegion: env.printfulSellingRegion },
          },
          create: {
            printfulVariantId: variant.id,
            productId: createdProduct.id,
            name: variant.name,
            size: variant.size ?? null,
            color: variant.color ?? null,
            colorCode: variant.color_code ?? null,
            imageUrl: variant.image ?? null,
            isAvailable: true,
            availability: { sellingRegion: env.printfulSellingRegion },
          },
        });

        const placementDimensions = variant.placement_dimensions ?? [];
        const techniqueEntry =
          variant.techniques?.find((entry) => typeof entry === 'object' && entry.is_default) ??
          variant.techniques?.[0];
        const technique =
          typeof techniqueEntry === 'string'
            ? techniqueEntry
            : (techniqueEntry?.key ?? techniqueEntry?.technique ?? techniqueEntry?.id);
        for (const dimension of placementDimensions) {
          if (!technique) continue;
          await prisma.printPlacement.upsert({
            where: {
              productId_code_technique: {
                productId: createdProduct.id,
                code: dimension.placement,
                technique,
              },
            },
            update: {
              displayName: dimension.placement.replace(/_/g, ' '),
              width: dimension.width,
              height: dimension.height,
              orientation: dimension.orientation,
              isDefault: dimension.placement === 'default' || dimension.placement === 'front',
            },
            create: {
              productId: createdProduct.id,
              code: dimension.placement,
              displayName: dimension.placement.replace(/_/g, ' '),
              technique,
              width: dimension.width,
              height: dimension.height,
              orientation: dimension.orientation,
              isDefault: dimension.placement === 'default' || dimension.placement === 'front',
            },
          });
        }

        await prisma.priceSnapshot.create({
          data: {
            productId: createdProduct.id,
            variantId: createdVariant.id,
            amount: providerPriceToAmount(variant),
            currency: env.defaultCurrency,
            source: providerPriceToAmount(variant) > 0 ? 'printful' : 'printful-sync-unpriced',
            priceType: 'base',
          },
        });
      }
    }

    await prisma.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        productsSeen: products.length,
        variantsSeen,
        categoriesSeen: categories.length,
      },
    });

    return {
      status: 'completed',
      runId: run.id,
      productsSeen: products.length,
      variantsSeen,
      categoriesSeen: categories.length,
    };
  } catch (error) {
    await prisma.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown Printful sync error',
      },
    });
    throw error;
  }
}

export async function syncFixtureCatalog(): Promise<{
  status: string;
  productsSeen: number;
  variantsSeen: number;
  categoriesSeen: number;
  runId?: string;
}> {
  if (!env.databaseUrl) {
    return {
      status: 'fixture-completed',
      productsSeen: sampleCatalog.products.length,
      variantsSeen: sampleCatalog.products.reduce(
        (total, product) => total + product.variants.length,
        0
      ),
      categoriesSeen: sampleCatalog.categories.length,
    };
  }

  const run = await prisma.catalogSyncRun.create({
    data: { status: 'running', source: 'fixture' },
  });

  try {
    const categoryIds = new Map<string, string>();
    for (const category of sampleCatalog.categories) {
      const createdCategory = await prisma.catalogCategory.upsert({
        where: { slug: category.slug },
        update: {
          title: category.title,
          imageUrl: category.imageUrl,
          isLaunchCategory: category.isLaunchCategory,
          isActive: true,
        },
        create: {
          id: category.id,
          title: category.title,
          slug: category.slug,
          imageUrl: category.imageUrl,
          isLaunchCategory: category.isLaunchCategory,
          isActive: true,
        },
      });
      categoryIds.set(category.slug, createdCategory.id);
    }

    let variantsSeen = 0;
    for (const product of sampleCatalog.products) {
      const createdProduct = await prisma.catalogProduct.upsert({
        where: { slug: product.slug },
        update: {
          title: product.title,
          type: product.type,
          brand: product.brand,
          description: product.description,
          thumbnailUrl: product.thumbnailUrl,
          categoryId: product.categorySlug ? categoryIds.get(product.categorySlug) : undefined,
          isSellable: product.isSellable,
          curationStatus: product.isSellable ? 'fixture-curated' : 'fixture-hidden',
          isActive: true,
          metadata: { source: 'fixture' },
        },
        create: {
          id: product.id,
          title: product.title,
          slug: product.slug,
          type: product.type,
          brand: product.brand,
          description: product.description,
          thumbnailUrl: product.thumbnailUrl,
          categoryId: product.categorySlug ? categoryIds.get(product.categorySlug) : undefined,
          isSellable: product.isSellable,
          curationStatus: product.isSellable ? 'fixture-curated' : 'fixture-hidden',
          isActive: true,
          metadata: { source: 'fixture' },
        },
      });

      for (const variant of product.variants) {
        variantsSeen += 1;
        const createdVariant = await prisma.catalogVariant.upsert({
          where: { id: variant.id },
          update: {
            productId: createdProduct.id,
            name: variant.name,
            size: variant.size,
            color: variant.color,
            colorCode: variant.colorCode,
            imageUrl: variant.imageUrl,
            isAvailable: variant.isAvailable,
          },
          create: {
            id: variant.id,
            productId: createdProduct.id,
            name: variant.name,
            size: variant.size,
            color: variant.color,
            colorCode: variant.colorCode,
            imageUrl: variant.imageUrl,
            isAvailable: variant.isAvailable,
          },
        });

        await prisma.priceSnapshot.create({
          data: {
            productId: createdProduct.id,
            variantId: createdVariant.id,
            amount: variant.costCents / 100,
            currency: env.defaultCurrency,
            source: 'fixture',
            priceType: 'base',
          },
        });
      }

      for (const placement of product.placements) {
        await prisma.printPlacement.upsert({
          where: {
            productId_code_technique: {
              productId: createdProduct.id,
              code: placement.code,
              technique: placement.technique,
            },
          },
          update: {
            displayName: placement.displayName,
            width: placement.width,
            height: placement.height,
            isDefault: placement.isDefault,
          },
          create: {
            productId: createdProduct.id,
            code: placement.code,
            displayName: placement.displayName,
            technique: placement.technique,
            width: placement.width,
            height: placement.height,
            isDefault: placement.isDefault,
          },
        });
      }
    }

    await prisma.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        productsSeen: sampleCatalog.products.length,
        variantsSeen,
        categoriesSeen: sampleCatalog.categories.length,
      },
    });

    return {
      status: 'completed',
      runId: run.id,
      productsSeen: sampleCatalog.products.length,
      variantsSeen,
      categoriesSeen: sampleCatalog.categories.length,
    };
  } catch (error) {
    await prisma.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown fixture sync error',
      },
    });
    throw error;
  }
}
