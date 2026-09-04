import axios, { type AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import type { QuoteBreakdown } from '../types/catalog.js';
import {
  createPrintfulClient,
  isPublicHttpUrl,
  unwrapPrintfulResponse,
} from './printful-client.service.js';

type PrintfulOrderResponse = {
  id?: number | string;
  order_id?: number | string;
  external_id?: string;
  status?: string;
  retail_costs?: {
    calculation_status?: string;
  };
};

type PrintfulRecipient = {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  stateCode?: string;
  countryCode: string;
  zip: string;
  email?: string;
};

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

/**
 * Converts the server-authoritative quote into a draft-only Printful order payload. Every quoted
 * placement must resolve to an independently public artwork URL before any provider write occurs.
 */
export function buildPrintfulOrderPayload(params: {
  quote: QuoteBreakdown;
  recipient: PrintfulRecipient;
  artworkUrl?: string;
  artworkUrlsByAssetId?: Record<string, string>;
}): Record<string, unknown> {
  const fallbackArtworkUrl = params.artworkUrl;
  if (fallbackArtworkUrl && !isPublicHttpUrl(fallbackArtworkUrl))
    throw new Error('Printful orders require public HTTP(S) artwork URLs.');
  if (!params.recipient.name || !params.recipient.address1 || !params.recipient.city) {
    throw new Error('Printful orders require recipient name, address, and city.');
  }
  if (!normalizeCountryCode(params.recipient.countryCode) || !params.recipient.zip) {
    throw new Error('Printful orders require recipient country and postal code.');
  }
  for (const item of params.quote.items) {
    if (!item.printfulVariantId) {
      throw new Error(`Printful catalog variant ID is missing for ${item.title}.`);
    }
    if (!item.placementCodes.length) {
      throw new Error(`Printful placement is missing for ${item.title}.`);
    }
    for (const placementCode of item.placementCodes) {
      if (!item.placementTechniques[placementCode]) {
        throw new Error(`Printful technique is missing for ${item.title} ${placementCode}.`);
      }
    }
    for (const placement of item.placements) {
      const artworkUrl =
        (placement.designAssetId
          ? params.artworkUrlsByAssetId?.[placement.designAssetId]
          : undefined) ?? fallbackArtworkUrl;
      if (!artworkUrl || !isPublicHttpUrl(artworkUrl)) {
        throw new Error(`Printful artwork is missing for ${item.title} ${placement.code}.`);
      }
    }
    if (item.quantity <= 0 || item.unitRetailCents <= 0) {
      throw new Error(`Printful order item ${item.title} has invalid quantity or price.`);
    }
  }

  return {
    recipient: {
      name: params.recipient.name,
      address1: params.recipient.address1,
      address2: params.recipient.address2,
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
      placements: item.placements.map((placement) => ({
        placement: placement.code,
        technique: placement.technique,
        layers: [
          {
            type: 'file',
            url:
              (placement.designAssetId
                ? params.artworkUrlsByAssetId?.[placement.designAssetId]
                : undefined) ?? fallbackArtworkUrl,
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

export async function fetchPrintfulOrderByExternalId(
  client: AxiosInstance,
  externalId: string
): Promise<PrintfulOrderResponse | null> {
  try {
    const response = await client.get(`/v2/orders/@${encodeURIComponent(externalId)}`);
    return unwrapPrintfulResponse<PrintfulOrderResponse>(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export type SubmitPrintfulDraftOrderParams = {
  quote: QuoteBreakdown;
  orderNumber: string;
  recipient: PrintfulRecipient;
  artworkUrl?: string;
  artworkUrlsByAssetId?: Record<string, string>;
};

/**
 * Idempotently creates an editable provider draft using the OMS order number as its external ID.
 * A lookup after an ambiguous POST failure prevents a retry from creating a duplicate draft.
 */
export async function submitPrintfulDraftOrderWithClient(
  client: AxiosInstance,
  params: SubmitPrintfulDraftOrderParams
): Promise<{ providerOrderId: string; status: string; confirmed: boolean }> {
  const payload = buildPrintfulOrderPayload({
    quote: params.quote,
    recipient: params.recipient,
    artworkUrl: params.artworkUrl,
    artworkUrlsByAssetId: params.artworkUrlsByAssetId,
  });

  let order = await fetchPrintfulOrderByExternalId(client, params.orderNumber);
  if (!order) {
    try {
      const response = await client.post('/v2/orders', {
        external_id: params.orderNumber,
        shipping: 'STANDARD',
        ...payload,
      });
      order = unwrapPrintfulResponse<PrintfulOrderResponse>(response.data);
    } catch (error) {
      order = await fetchPrintfulOrderByExternalId(client, params.orderNumber);
      if (!order) throw error;
    }
  }
  const providerOrderId = String(order?.id ?? order?.order_id ?? '');
  if (!providerOrderId) {
    throw new Error('Printful order creation did not return an order ID.');
  }

  return { providerOrderId, status: String(order?.status ?? 'draft'), confirmed: false };
}

/** Enforces the review-first launch posture before acquiring an authenticated provider client. */
export async function submitPrintfulDraftOrder(
  params: SubmitPrintfulDraftOrderParams
): Promise<{ providerOrderId: string; status: string; confirmed: boolean }> {
  if (!env.printfulApiKey || !env.enableLivePrintful || !env.allowLiveFulfillment) {
    throw new Error(
      'Printful live fulfillment requires PRINTFUL_API_KEY, ENABLE_LIVE_PRINTFUL, and ALLOW_LIVE_FULFILLMENT.'
    );
  }
  if (env.printfulAutoConfirmOrders) {
    throw new Error(
      'Printful auto-confirm is disabled. Keep PRINTFUL_AUTO_CONFIRM_ORDERS=false and review draft orders manually.'
    );
  }
  return submitPrintfulDraftOrderWithClient(createPrintfulClient(), params);
}

/** Classifies provider failures without copying potentially sensitive response bodies. */
export function classifyPrintfulFailure(error: unknown): {
  code: string;
  message: string;
  statusCode?: number;
} {
  const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
  const networkCode = axios.isAxiosError(error) ? error.code : undefined;
  if (statusCode === 401 || statusCode === 403) {
    return {
      code: 'printful_authentication',
      message: 'Printful rejected the configured store credentials.',
      statusCode,
    };
  }
  if (statusCode === 429) {
    return {
      code: 'printful_rate_limited',
      message: 'Printful temporarily rate-limited the draft request.',
      statusCode,
    };
  }
  if (statusCode === 400 || statusCode === 409 || statusCode === 422) {
    return {
      code: 'printful_validation',
      message: `Printful rejected the draft payload (HTTP ${statusCode}).`,
      statusCode,
    };
  }
  if (statusCode && statusCode >= 500) {
    return {
      code: 'printful_unavailable',
      message: `Printful was unavailable while creating the draft (HTTP ${statusCode}).`,
      statusCode,
    };
  }
  if (networkCode === 'ECONNABORTED' || networkCode === 'ETIMEDOUT') {
    return {
      code: 'printful_timeout',
      message: 'Printful did not confirm the draft request before the timeout.',
    };
  }
  return {
    code: 'printful_unknown',
    message: 'Printful could not create the draft order.',
    statusCode,
  };
}

export async function fetchPrintfulOrderStatus(
  providerOrderId: string
): Promise<{ providerOrderId: string; status: string }> {
  const response = await createPrintfulClient().get(`/v2/orders/${providerOrderId}`);
  const order = unwrapPrintfulResponse<PrintfulOrderResponse>(response.data);
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
