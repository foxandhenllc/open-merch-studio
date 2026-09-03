# Current post-payment customer experience

Last verified from repository behavior and production gate names: September 3, 2026.

## What happens today

1. The customer enters an email and accepts the current store policies in Open Merch Studio.
2. Stripe Checkout collects payment and a US shipping address. The browser returns to the studio,
   but the signed Stripe webhook remains the authoritative payment event.
3. OMS records the paid order durably and displays an OMS order number, items, charged total, and a
   customer-safe timeline.
4. OMS validates the saved product, artwork, print areas, and shipping data, then creates an editable
   Printful draft.
5. The draft stays in manual review. It is not automatically confirmed for production.

Production configuration currently exposes Checkout publicly and enables the live Stripe and
Printful paths. `PRINTFUL_AUTO_CONFIRM_ORDERS` remains `false`, which is the intended review-first
launch contract.

## What the customer can rely on now

- An on-site payment confirmation after OMS reconciles the Checkout Session.
- An OMS order number and safe status language such as Received or Under review.
- A support path that uses the order number rather than exposing provider identifiers.
- A manual artwork and fulfillment review before money is committed to Printful production.

## What is not yet guaranteed

- **An OMS confirmation email.** Branded templates exist, but no delivery service or exactly-once
  email record calls them. Production does not currently define the transactional-email enablement
  variables, so the default is disabled.
- **A Stripe receipt email.** Stripe can send one when Successful payments is enabled in Stripe's
  Customer emails settings. The Checkout request supplies the customer email, but that Dashboard
  setting is outside the repository and must be verified separately.
- **Automatic production or shipment updates.** OMS has safe customer status labels and a Printful
  status-fetch helper, but no Printful webhook receiver or scheduled reconciliation currently calls
  it.
- **A tracking number or carrier link in OMS.** The current customer order type and database schema
  do not retain or expose shipment records.

## Completion contract for the next release

The customer should receive and be able to revisit this sequence:

1. Payment receipt from Stripe and an OMS order-received email.
2. OMS confirmation when manual review releases the Printful draft to production.
3. A shipment email and order-page update containing carrier, tracking number, tracking URL, and the
   specific items in that shipment.
4. A delivered or exception update when provider evidence supports it.

Implement this with a durable `Shipment` record, an authenticated Printful webhook endpoint, a
reconciliation fallback, and an email-delivery table with a unique order/event key. Webhook payloads
must be reduced to approved fields before storage. Email retries must be idempotent, and the public
order page must use a revocable opaque access token rather than a guessable order number.

Official references:

- Stripe receipts: https://docs.stripe.com/receipts
- Printful webhooks and `package_shipped` tracking fields: https://developers.printful.com/docs/
