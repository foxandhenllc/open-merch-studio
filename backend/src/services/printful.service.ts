import axios, { type AxiosInstance } from 'axios';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { isLaunchCategoryTitle, slugify } from './catalog.service.js';
import type { QuoteBreakdown } from '../types/catalog.js';

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
  placement_dimensions?: Array<{
    placement: string;
    width?: number;
    height?: number;
    orientation?: string;
  }>;
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

const createPrintfulClient = (): AxiosInstance => {
  if (!env.printfulApiKey) {
    throw new Error('PRINTFUL_API_KEY is not configured.');
  }

  return axios.create({
    baseURL: 'https://api.printful.com',
    headers: {
      Authorization: `Bearer ${env.printfulApiKey}`,
      'Content-Type': 'application/json',
      ...(env.printfulStoreId ? { 'X-PF-Store-Id': env.printfulStoreId } : {}),
    },
    timeout: 30000,
  });
};

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
          isSellable: Boolean(launchCategory),
          isActive: true,
          metadata: { printfulCategories: productCategories.map((category) => category.title) },
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
          isSellable: Boolean(launchCategory),
          isActive: true,
          metadata: { printfulCategories: productCategories.map((category) => category.title) },
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
        for (const dimension of placementDimensions) {
          await prisma.printPlacement.upsert({
            where: {
              productId_code_technique: {
                productId: createdProduct.id,
                code: dimension.placement,
                technique: 'dtg',
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
              technique: 'dtg',
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
            amount: 0,
            currency: env.defaultCurrency,
            source: 'printful-sync-placeholder',
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

export function buildPrintfulOrderPayload(params: {
  quote: QuoteBreakdown;
  recipient: {
    name: string;
    address1: string;
    city: string;
    stateCode?: string;
    countryCode: string;
    zip: string;
    email?: string;
  };
  artworkUrl: string;
}): Record<string, unknown> {
  return {
    recipient: {
      name: params.recipient.name,
      address1: params.recipient.address1,
      city: params.recipient.city,
      state_code: params.recipient.stateCode,
      country_code: params.recipient.countryCode,
      zip: params.recipient.zip,
      email: params.recipient.email,
    },
    order_items: params.quote.items.map((item) => ({
      source: 'catalog',
      catalog_variant_id: item.printfulVariantId,
      quantity: item.quantity,
      name: `${item.title} - ${item.variantName}`,
      retail_price: (item.unitRetailCents / 100).toFixed(2),
      placements: item.placementCodes.map((placementCode) => ({
        placement: placementCode,
        technique: placementCode.includes('embroidery') ? 'embroidery' : 'dtg',
        layers: [
          {
            type: 'file',
            url: params.artworkUrl,
          },
        ],
      })),
    })),
    retail_costs: {
      currency: params.quote.currency,
      subtotal: ((params.quote.totalCents - params.quote.shippingEstimateCents) / 100).toFixed(2),
      shipping: (params.quote.shippingEstimateCents / 100).toFixed(2),
      tax: (params.quote.taxEstimateCents / 100).toFixed(2),
      total: (params.quote.totalCents / 100).toFixed(2),
    },
  };
}
