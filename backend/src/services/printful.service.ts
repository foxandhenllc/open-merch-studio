import axios, { type AxiosInstance } from 'axios';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { isLaunchCategoryTitle, slugify } from './catalog.service.js';
import { sampleCatalog } from './catalog-fixtures.js';
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
  price?: string | number | null;
  retail_price?: string | number | null;
  catalog_price?: string | number | null;
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

type PrintfulOrderResponse = {
  id?: number | string;
  order_id?: number | string;
  external_id?: string;
  status?: string;
  retail_costs?: {
    calculation_status?: string;
  };
};

type PrintfulPrintfile = {
  printfile_id: number;
  width: number;
  height: number;
};

type PrintfulPrintfilesResult = {
  available_placements?: Record<string, string>;
  printfiles?: PrintfulPrintfile[];
  variant_printfiles?: Array<{
    variant_id: number;
    placements: Record<string, number>;
  }>;
};

type PrintfulMockupTaskCreateResult = {
  task_key?: string;
  status?: string;
};

type PrintfulMockupTaskResult = {
  task_key?: string;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
  mockups?: unknown[];
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function unwrapPrintfulResponse<T>(data: unknown): T {
  const response = data as { result?: T; data?: T };
  return (response?.result ?? response?.data ?? data) as T;
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  USA: 'US',
  US: 'US',
  CANADA: 'CA',
  CA: 'CA',
  AUSTRALIA: 'AU',
  AU: 'AU',
  'UNITED KINGDOM': 'GB',
  UK: 'GB',
  GB: 'GB',
};

const STATE_CODE_MAP: Record<string, string> = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
};

export function normalizeCountryCode(country: string | null | undefined): string {
  if (!country) return '';
  const normalized = country.trim().toUpperCase();
  return (
    COUNTRY_CODE_MAP[normalized] || (normalized.length === 2 ? normalized : normalized.slice(0, 2))
  );
}

export function normalizeStateCode(state: string | null | undefined): string | undefined {
  if (!state) return undefined;
  const normalized = state.trim().toUpperCase();
  return STATE_CODE_MAP[normalized] || normalized;
}

const providerPriceToAmount = (variant: PrintfulVariant): number => {
  const value = variant.price ?? variant.catalog_price ?? variant.retail_price;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
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
      state_code: normalizeStateCode(params.recipient.stateCode),
      country_code: normalizeCountryCode(params.recipient.countryCode),
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

async function fetchPrintfulOrderByExternalId(
  client: AxiosInstance,
  externalId: string
): Promise<PrintfulOrderResponse | null> {
  try {
    const response = await client.get(`/v2/orders/@${encodeURIComponent(externalId)}`);
    return unwrapPrintfulResponse<PrintfulOrderResponse>(response.data);
  } catch {
    return null;
  }
}

async function waitForPrintfulOrderReady(
  client: AxiosInstance,
  providerOrderId: string,
  attempts = 6,
  delayMs = 3000
): Promise<PrintfulOrderResponse | null> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await client.get(`/v2/orders/${providerOrderId}`);
    const order = unwrapPrintfulResponse<PrintfulOrderResponse>(response.data);
    const calculationStatus = order?.retail_costs?.calculation_status;
    if (!calculationStatus || calculationStatus === 'done') {
      return order;
    }
    await sleep(delayMs);
  }
  return null;
}

async function confirmPrintfulOrder(
  client: AxiosInstance,
  providerOrderId: string
): Promise<PrintfulOrderResponse> {
  const response = await client.post(`/v2/orders/${providerOrderId}/confirmation`);
  return unwrapPrintfulResponse<PrintfulOrderResponse>(response.data);
}

export async function submitPrintfulDraftOrder(params: {
  quote: QuoteBreakdown;
  orderNumber: string;
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
}): Promise<{ providerOrderId: string; status: string; confirmed: boolean }> {
  if (!env.printfulApiKey || !env.enableLivePrintful || !env.allowLiveFulfillment) {
    throw new Error(
      'Printful live fulfillment requires PRINTFUL_API_KEY, ENABLE_LIVE_PRINTFUL, and ALLOW_LIVE_FULFILLMENT.'
    );
  }

  const client = createPrintfulClient();
  const payload = buildPrintfulOrderPayload({
    quote: params.quote,
    recipient: params.recipient,
    artworkUrl: params.artworkUrl,
  });
  let order: PrintfulOrderResponse;
  try {
    const response = await client.post('/v2/orders', {
      external_id: params.orderNumber,
      shipping: 'STANDARD',
      ...payload,
    });
    order = unwrapPrintfulResponse<PrintfulOrderResponse>(response.data);
  } catch (error) {
    const message =
      axios.isAxiosError(error) && typeof error.response?.data === 'object'
        ? JSON.stringify(error.response.data)
        : error instanceof Error
          ? error.message
          : 'Printful order creation failed.';
    if (message.includes('External ID') || message.includes('external_id')) {
      const existing = await fetchPrintfulOrderByExternalId(client, params.orderNumber);
      if (existing?.id ?? existing?.order_id) {
        order = existing;
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }
  const providerOrderId = String(order?.id ?? order?.order_id ?? '');
  if (!providerOrderId) {
    throw new Error('Printful order creation did not return an order ID.');
  }

  let status = String(order?.status ?? 'draft');
  let confirmed = false;
  if (env.printfulAutoConfirmOrders) {
    await waitForPrintfulOrderReady(client, providerOrderId);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      try {
        const confirmedOrder = await confirmPrintfulOrder(client, providerOrderId);
        status = String(confirmedOrder?.status ?? 'pending');
        confirmed = true;
        break;
      } catch (error) {
        lastError = error;
        const message =
          axios.isAxiosError(error) && typeof error.response?.data === 'object'
            ? JSON.stringify(error.response.data)
            : error instanceof Error
              ? error.message
              : 'Printful confirmation failed.';
        if (
          !message.includes('calculations still running') &&
          !message.includes('design is still processing')
        ) {
          throw error;
        }
        await waitForPrintfulOrderReady(client, providerOrderId, 3, 5000);
        await sleep(Math.min(15000, 3000 * attempt));
      }
    }
    if (!confirmed) {
      throw lastError instanceof Error
        ? lastError
        : new Error('Failed to confirm Printful order after retries.');
    }
  }

  return { providerOrderId, status, confirmed };
}

export async function fetchPrintfulOrderStatus(
  providerOrderId: string
): Promise<{ providerOrderId: string; status: string }> {
  const client = createPrintfulClient();
  const response = await client.get(`/v2/orders/${providerOrderId}`);
  const order = response.data?.data ?? response.data?.result ?? response.data;
  return {
    providerOrderId,
    status: String(order?.status ?? 'unknown'),
  };
}

export function mapPrintfulOrderStatus(status?: string): {
  orderStatus: 'submitted' | 'shipped' | 'delivered' | 'failed' | 'needs_review';
  fulfillmentStatus: 'submitted' | 'failed' | 'needs_review';
} {
  switch (status) {
    case 'draft':
    case 'pending':
    case 'being_fulfilled':
    case 'inprocess':
      return { orderStatus: 'submitted', fulfillmentStatus: 'submitted' };
    case 'partial':
    case 'fulfilled':
    case 'shipped':
      return { orderStatus: 'shipped', fulfillmentStatus: 'submitted' };
    case 'delivered':
      return { orderStatus: 'delivered', fulfillmentStatus: 'submitted' };
    case 'failed':
    case 'canceled':
    case 'cancelled':
      return { orderStatus: 'failed', fulfillmentStatus: 'failed' };
    default:
      return { orderStatus: 'needs_review', fulfillmentStatus: 'needs_review' };
  }
}

function computeCenteredSquarePosition(printfile: PrintfulPrintfile) {
  const areaWidth = printfile.width;
  const areaHeight = printfile.height;
  const size = Math.min(areaWidth, areaHeight);

  return {
    area_width: areaWidth,
    area_height: areaHeight,
    width: size,
    height: size,
    top: Math.max(0, Math.round((areaHeight - size) / 2)),
    left: Math.max(0, Math.round((areaWidth - size) / 2)),
  };
}

async function fetchPrintfileForVariant(params: {
  client: AxiosInstance;
  printfulProductId: string;
  printfulVariantId: number;
  placement: string;
  technique?: string;
}): Promise<PrintfulPrintfile> {
  const response = await params.client.get(
    `/mockup-generator/printfiles/${params.printfulProductId}`,
    {
      params: params.technique ? { technique: params.technique } : undefined,
    }
  );
  const result = unwrapPrintfulResponse<PrintfulPrintfilesResult>(response.data);
  const mapping = result.variant_printfiles?.find(
    (variant) => variant.variant_id === params.printfulVariantId
  );
  const printfileId = mapping?.placements?.[params.placement];
  if (!printfileId) {
    throw new Error(
      `Printful printfile mapping not found for variant ${params.printfulVariantId} placement ${params.placement}.`
    );
  }
  const printfile = result.printfiles?.find((candidate) => candidate.printfile_id === printfileId);
  if (!printfile) {
    throw new Error(`Printful printfile ${printfileId} was not found.`);
  }
  return printfile;
}

async function createPrintfulMockupTask(params: {
  client: AxiosInstance;
  printfulProductId: string;
  printfulVariantId: number;
  placement: string;
  designImageUrl: string;
  technique?: string;
}): Promise<string> {
  const printfile = await fetchPrintfileForVariant(params);
  const response = await params.client.post(
    `/mockup-generator/create-task/${params.printfulProductId}`,
    {
      variant_ids: [params.printfulVariantId],
      format: 'png',
      width: 0,
      files: [
        {
          placement: params.placement,
          image_url: params.designImageUrl,
          position: computeCenteredSquarePosition(printfile),
        },
      ],
    }
  );
  const result = unwrapPrintfulResponse<PrintfulMockupTaskCreateResult>(response.data);
  if (!result.task_key) {
    throw new Error('Printful mockup task did not return a task key.');
  }
  return result.task_key;
}

async function pollPrintfulMockupTask(
  client: AxiosInstance,
  taskKey: string
): Promise<PrintfulMockupTaskResult> {
  const timeoutMs = Math.max(30000, env.printfulMockupTimeoutMs);
  const start = Date.now();
  await sleep(10000);
  while (Date.now() - start < timeoutMs) {
    const response = await client.get('/mockup-generator/task', {
      params: { task_key: taskKey },
    });
    const result = unwrapPrintfulResponse<PrintfulMockupTaskResult>(response.data);
    if (result.status === 'completed') return result;
    if (result.status === 'failed') {
      throw new Error(result.error || 'Printful mockup generation failed.');
    }
    await sleep(5000);
  }
  throw new Error('Timed out waiting for Printful mockup generation.');
}

function extractMockupUrl(taskResult: PrintfulMockupTaskResult, placement: string): string {
  const mockups = Array.isArray(taskResult.mockups) ? taskResult.mockups : [];
  const candidates = mockups as Array<Record<string, unknown>>;
  const match =
    candidates.find((candidate) => String(candidate.placement ?? '') === placement) ??
    candidates[0];
  const directUrl = match?.mockup_url ?? match?.mockupUrl ?? match?.url;
  if (typeof directUrl === 'string' && directUrl) return directUrl;
  const extra = Array.isArray(match?.extra) ? (match.extra as Array<Record<string, unknown>>) : [];
  const extraUrl = extra.find((entry) => typeof entry.url === 'string')?.url;
  if (typeof extraUrl === 'string' && extraUrl) return extraUrl;
  throw new Error('Unable to extract Printful mockup URL.');
}

export async function generatePrintfulMockupPreview(params: {
  printfulProductId: string;
  printfulVariantId: number;
  placement: string;
  designImageUrl: string;
  technique?: string;
}): Promise<{ taskKey: string; imageUrl: string }> {
  if (!env.printfulApiKey || !env.enableLivePrintful) {
    throw new Error('Printful live mockups require PRINTFUL_API_KEY and ENABLE_LIVE_PRINTFUL.');
  }
  if (!/^https?:\/\//.test(params.designImageUrl)) {
    throw new Error('Printful live mockups require a public HTTP artwork URL.');
  }

  const client = createPrintfulClient();
  const taskKey = await createPrintfulMockupTask({ client, ...params });
  const taskResult = await pollPrintfulMockupTask(client, taskKey);
  return {
    taskKey,
    imageUrl: extractMockupUrl(taskResult, params.placement),
  };
}
