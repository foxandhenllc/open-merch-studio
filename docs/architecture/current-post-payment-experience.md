# Current post-payment customer experience

Last verified from repository behavior and production configuration: September 4, 2026.

## What happens today

1. The customer enters an email and accepts the current store policies in Open Merch Studio.
2. Stripe Checkout collects payment and a US shipping address. The browser returns to the studio,
   but the signed Stripe webhook remains the authoritative payment event.
3. OMS records the paid order durably and displays an OMS order number, items, charged total, and a
   customer-safe timeline. It also sends an idempotent OMS order-received email from the branded
   `orders@openmerchstudio.com` sender with a private link for returning to the order or using
   **Buy again** from another device.
4. OMS validates the saved product, artwork, print areas, and shipping data, then creates an editable
   Printful draft.
5. The draft stays in manual review. It is not automatically confirmed for production.

Production configuration currently exposes Checkout publicly and enables the live Stripe and
Printful paths. `PRINTFUL_AUTO_CONFIRM_ORDERS` remains `false`, which is the intended review-first
launch contract.

## What the customer can rely on now

- An on-site payment confirmation after OMS reconciles the Checkout Session.
- An OMS order-received email after the signed Stripe completion event is reconciled.
- An OMS order number and safe status language such as Received or Under review.
- A support path that uses the order number rather than exposing provider identifiers.
- A manual artwork and fulfillment review before money is committed to Printful production.
- A private receipt link that restores the safe order view and current-price **Buy again** flow.

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

The production Printful v2 subscription is active for `shipment_sent` and
`shipment_delivered`. On September 3, 2026, a zero-dollar signed fixture verified both transitions,
customer-safe tracking output, queued-but-disabled notification records, and semantic deduplication
of a provider retry. The fixture and every associated database record were removed after the test.

Later on September 3, the Vercel-managed Resend resource was connected only to the production
project. DKIM and the isolated `send.openmerchstudio.com` SPF/MX records were verified without
changing Google Workspace's apex inbound mail. A no-order message from
`Open Merch Studio <orders@openmerchstudio.com>` to an owner-approved external inbox was accepted by
Resend and reported `Delivered`. The temporary token-guarded test route, token, and deployment were
then removed before `EMAIL_PROVIDER=resend` and `TRANSACTIONAL_EMAILS_ENABLED=true` were deployed.

## What is not yet guaranteed

- **A Stripe receipt email.** Stripe can send one when Successful payments is enabled in Stripe's
  Customer emails settings. The Checkout request supplies the customer email, but that Dashboard
  setting is outside the repository and must be verified separately.
- **Recovery from a missed Printful webhook.** Live signed shipment events now update the order
  automatically, but scheduled reconciliation is not yet present. An outage spanning all provider
  retries would still require operator recovery.
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

The durable `Shipment` record, signed webhook endpoint and subscription, reduced payload storage,
unique order/event email ledger, and signed production fixture are complete. Remaining release work
is:

1. Observe one supervised real order and shipment lifecycle, including each customer email.
2. Add scheduled reconciliation for missed events and shipment-item allocation.
3. **Completed September 4, 2026:** replace the public order lookup boundary with rotating,
   revocable, purpose-scoped opaque credentials; use them for a safe **Buy again** cart
   reconstruction; and place an independently revocable private revisit link in the order-received
   email. The browser removes that link's fragment before analytics mount.

Official references:

- Stripe receipts: https://docs.stripe.com/receipts
- Printful v2 signed shipment webhooks: https://developers.printful.com/docs/v2-beta/
