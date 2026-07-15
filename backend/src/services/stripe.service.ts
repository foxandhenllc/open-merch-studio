import Stripe from 'stripe';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import type { QuoteBreakdown } from '../types/catalog.js';

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
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: params.amountCents,
          product_data: {
            name: params.name,
            description: params.description,
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
  };
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

export async function createMerchCheckoutSession(params: {
  orderId: string;
  quote: QuoteBreakdown;
  customerEmail?: string;
}): Promise<Stripe.Checkout.Session> {
  return createStripeCheckoutSession({
    kind: 'merch_order',
    amountCents: params.quote.totalCents,
    currency: params.quote.currency,
    name: 'Open Merch Studio order',
    description: params.quote.items
      .map((item) => item.title)
      .join(', ')
      .slice(0, 250),
    customerEmail: params.customerEmail,
    collectShipping: true,
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
    name: 'Open Merch Studio Pass',
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
