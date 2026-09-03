# Current post-payment customer experience

Last verified from repository behavior and production configuration: September 3, 2026.

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

## Notification and tracking foundation

The September 3 roadmap slice adds the server-side foundation without silently changing the
customer promise:

- Stripe payment and refund events create a durable, event-keyed customer-email delivery record.
- A raw-body, HMAC-SHA256-verified Printful v2 webhook receiver accepts `shipment_sent` and
  `shipment_delivered` events.
- Shipment transitions are deduplicated across Printful retries, reduced to approved fields, and
  stored without the raw provider payload.
- The customer-safe order response and responsive order view support multiple shipments, tracking
  numbers, validated HTTP(S) tracking links, replacements, and delivery status.
- Email provider uncertainty is recorded as `ambiguous` and is not automatically retried.

The three new tables have RLS enabled and no `anon` or `authenticated` grants. They are accessed
only by the server-side database role.

## What is not yet guaranteed

- **An OMS confirmation email.** The durable delivery service and templates now exist, but
  `TRANSACTIONAL_EMAILS_ENABLED` remains disabled until the sender domain, From address, Reply-To,
  and delivery behavior are verified together.
- **A Stripe receipt email.** Stripe can send one when Successful payments is enabled in Stripe's
  Customer emails settings. The Checkout request supplies the customer email, but that Dashboard
  setting is outside the repository and must be verified separately.
- **Automatic production or shipment updates.** The receiver exists, but Printful is not subscribed
  until its one-time public/secret key pair is stored in deployment secrets and a signed fixture is
  verified against production.
- **Shipment item allocation and reconciliation.** Printful's shipment webhook carries tracking and
  order data but not the full shipment-item list. A scheduled status/shipments reconciliation is
  still required for item allocation and missed-event recovery.

## Completion contract for the next release

The customer should receive and be able to revisit this sequence:

1. Payment receipt from Stripe and an OMS order-received email.
2. OMS confirmation when manual review releases the Printful draft to production.
3. A shipment email and order-page update containing carrier, tracking number, tracking URL, and the
   specific items in that shipment.
4. A delivered or exception update when provider evidence supports it.

The durable `Shipment` record, signed webhook endpoint, reduced payload storage, and unique
order/event email ledger are complete. Remaining release work is:

1. Verify a branded Resend sender and enable delivery during a supervised test.
2. Register the production Printful v2 webhook and store its keys without logging them.
3. Run a signed webhook fixture, then one supervised real shipment lifecycle.
4. Add scheduled reconciliation for missed events and shipment-item allocation.
5. Replace the public order lookup boundary with a revocable opaque access token.

Official references:

- Stripe receipts: https://docs.stripe.com/receipts
- Printful v2 signed shipment webhooks: https://developers.printful.com/docs/v2-beta/
