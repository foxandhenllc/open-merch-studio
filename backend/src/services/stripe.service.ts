import Stripe from 'stripe';
import { merchantConfig } from '../generated/merchant-config.js';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import type { QuoteBreakdown } from '../types/catalog.js';
import { stripeChargeRefundState } from './order-state.service.js';
import type { StripeRefundState } from './order-state.service.js';

export type StripeCheckoutKind = 'studio_pass' | 'merch_order';

type CreateStripeCheckoutParams = {
  kind: StripeCheckoutKind;
  amountCents: number;
  currency: string;
  name: string;
  description?: string;
  customerEmail?: string;
  metadata: Record<string, string | undefined>;
  collectShipping?: boolean;
  lineItems?: Array<{ name: string; description?: string; amountCents: number }>;
};

export function checkoutAccessBlocker(customerEmail?: string): string | null {
  if (env.checkoutAccessMode === 'closed') return 'Checkout is currently closed.';
  if (env.checkoutAccessMode === 'allowlist') {
    const email = customerEmail?.trim().toLowerCase();
    if (!email || !env.checkoutAllowedEmails.includes(email)) {
      return 'Checkout is limited to the supervised purchase allowlist.';
    }
  }
  return null;
}

export function canCreateStripeCheckout(customerEmail?: string): boolean {
  return liveStripeBlocker(customerEmail) === null;
}

export function liveStripeBlocker(customerEmail?: string): string | null {
  if (!env.stripeSecretKey || !env.enableLiveStripe) return 'Stripe is not configured or enabled.';
  if (!env.checkoutEnabled) return 'Checkout is disabled by the emergency kill switch.';
  if (!env.databaseUrl) return 'DATABASE_URL is required before enabling live Stripe checkout.';
  if (env.stripeSecretKey.startsWith('sk_live_') && !env.allowLivePayments) {
    return 'A live Stripe key is configured, but ALLOW_LIVE_PAYMENTS is false.';
  }
  return checkoutAccessBlocker(customerEmail);
}

function getStripe(): Stripe {
  if (!env.stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return new Stripe(env.stripeSecretKey);
}

function buildCheckoutIdempotencyKey(params: CreateStripeCheckoutParams): string {
  const stablePayload = {
    kind: params.kind,
    amountCents: params.amountCents,
    currency: params.currency,
    customerEmail: params.customerEmail,
    metadata: params.metadata,
    lineItems: params.lineItems,
  };
  return crypto.createHash('sha256').update(JSON.stringify(stablePayload)).digest('hex');
}

export function buildStripeCheckoutParams(
  params: CreateStripeCheckoutParams
): Stripe.Checkout.SessionCreateParams {
  const successUrl = `${env.frontendUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${env.frontendUrl}?checkout=cancelled`;
  const metadataSource: Record<string, string | undefined> = {
    ...params.metadata,
    kind: params.kind,
  };
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadataSource)) {
    if (value) metadata[key] = value;
  }
  return {
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: params.customerEmail,
    client_reference_id: metadata.orderId ?? metadata.sessionId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    billing_address_collection: 'required',
    automatic_tax: { enabled: true },
    shipping_address_collection: params.collectShipping ? { allowed_countries: ['US'] } : undefined,
    line_items: (params.lineItems?.length
      ? params.lineItems
      : [{ name: params.name, description: params.description, amountCents: params.amountCents }]
    ).map((item) => ({
      quantity: 1,
      price_data: {
        currency: params.currency.toLowerCase(),
        unit_amount: item.amountCents,
        product_data: {
          name: item.name,
          description: item.description,
        },
      },
    })),
    metadata,
    payment_intent_data: { metadata },
  };
}

/**
 * Presents configured products separately in hosted Checkout while preserving the exact,
 * server-authoritative pre-tax quote total. Each configured line is extended to quantity one so
 * order-level shipping, processing estimates, and Studio Pass credits can reconcile to the cent.
 */
export function stripeLineItemsForQuote(
  quote: QuoteBreakdown
): Array<{ name: string; description: string; amountCents: number }> {
  const itemLines = quote.items.map((item) => ({
    name: `${item.quantity} × ${item.title}`,
    description: `${item.variantName} · ${item.placementCodes.join(' + ')}`.slice(0, 250),
    amountCents: item.unitRetailCents * item.quantity,
  }));
  const merchandiseTotal = itemLines.reduce((total, item) => total + item.amountCents, 0);
  let adjustment = quote.totalCents - merchandiseTotal;
  if (adjustment >= 0) {
    return adjustment
      ? [
          ...itemLines,
          {
            name: 'Estimated shipping & checkout services',
            description: 'Final tax is calculated from the shipping address.',
            amountCents: adjustment,
          },
        ]
      : itemLines;
  }

  // Stripe Checkout does not accept negative line items. Apply an order-level credit across the
  // itemized merchandise lines while retaining at least one cent on every displayed product.
  const creditedLines = itemLines.map((item) => {
    if (adjustment >= 0) return item;
    const reduction = Math.min(item.amountCents - 1, Math.abs(adjustment));
    adjustment += reduction;
    return { ...item, amountCents: item.amountCents - reduction };
  });
  if (adjustment < 0) {
    throw new Error('The quoted credit exceeds the amount Stripe can allocate across line items.');
  }
  return creditedLines;
}

export async function createStripeCheckoutSession(
  params: CreateStripeCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const blocker = liveStripeBlocker(params.customerEmail);
  if (blocker) throw new Error(blocker);

  const stripe = getStripe();
  return stripe.checkout.sessions.create(buildStripeCheckoutParams(params), {
    idempotencyKey: buildCheckoutIdempotencyKey(params),
  });
}

export async function fetchStripeCheckoutSession(sessionId: string): Promise<{
  id: string;
  url: string | null;
  status: Stripe.Checkout.Session.Status | null;
  paymentStatus: Stripe.Checkout.Session.PaymentStatus | null;
} | null> {
  if (!sessionId || !env.stripeSecretKey || !env.enableLiveStripe) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    return {
      id: session.id,
      url: session.url ?? null,
      status: session.status ?? null,
      paymentStatus: session.payment_status ?? null,
    };
  } catch {
    return null;
  }
}

export async function retrieveStripeCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session | null> {
  if (!sessionId || !env.stripeSecretKey || !env.enableLiveStripe) return null;
  try {
    return await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    });
  } catch {
    return null;
  }
}

export async function retrieveStripePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent | null> {
  if (!paymentIntentId || !env.stripeSecretKey || !env.enableLiveStripe) return null;
  try {
    return await getStripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
  } catch {
    return null;
  }
}

export async function retrieveStripeCharge(chargeId: string): Promise<Stripe.Charge | null> {
  if (!chargeId || !env.stripeSecretKey || !env.enableLiveStripe) return null;
  try {
    return await getStripe().charges.retrieve(chargeId);
  } catch {
    return null;
  }
}

export async function retrieveStripeSessionRefundState(
  session: Stripe.Checkout.Session
): Promise<StripeRefundState> {
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  const paymentIntent = paymentIntentId ? await retrieveStripePaymentIntent(paymentIntentId) : null;
  const latestCharge = paymentIntent?.latest_charge;
  const charge =
    typeof latestCharge === 'string' ? await retrieveStripeCharge(latestCharge) : latestCharge;
  return charge ? stripeChargeRefundState(charge) : { state: 'unavailable', refundedCents: 0 };
}

export async function createMerchCheckoutSession(params: {
  orderId: string;
  quote: QuoteBreakdown;
  customerEmail?: string;
}): Promise<Stripe.Checkout.Session> {
  return createStripeCheckoutSession({
    kind: 'merch_order',
    amountCents: params.quote.totalCents,
    currency: params.quote.currency,
    name: `${merchantConfig.brand.displayName} order`,
    description: params.quote.items
      .map((item) => item.title)
      .join(', ')
      .slice(0, 250),
    customerEmail: params.customerEmail,
    collectShipping: true,
    lineItems: stripeLineItemsForQuote(params.quote),
    metadata: {
      orderId: params.orderId,
      quoteId: params.quote.id ?? undefined,
    },
  });
}

export async function createStudioPassStripeSession(params: {
  sessionId: string;
  amountCents: number;
  customerEmail?: string;
}): Promise<Stripe.Checkout.Session> {
  return createStripeCheckoutSession({
    kind: 'studio_pass',
    amountCents: params.amountCents,
    currency: env.defaultCurrency,
    name: `${merchantConfig.brand.displayName} Pass`,
    description: 'Unlocks additional design drafts and applies as credit to an eligible purchase.',
    customerEmail: params.customerEmail,
    collectShipping: false,
    metadata: {
      sessionId: params.sessionId,
    },
  });
}

export function constructStripeWebhookEvent(body: Buffer, signature?: string): Stripe.Event {
  if (!env.stripeWebhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }
  if (!signature) {
    throw new Error('Stripe signature header is missing.');
  }
  return getStripe().webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
}
