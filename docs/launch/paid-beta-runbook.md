# Paid Beta Runbook

**Status:** Public review-first commerce active; payment, fulfillment draft, and signed shipment paths verified
**Visibility:** Public  
**Private ops companion:** Maintained outside this public repository

Open Merch Studio has a fixture-mode development path covering curated catalog, idea refinement,
draft generation, mockups, quotes, checkout simulation, order confirmation, fulfillment, admin
reporting, and launch gates. The guarded production adapters support public Stripe Checkout,
review-first Printful draft creation, and signed shipment updates. It is not an unattended
auto-fulfillment system: an operator still reviews and confirms every Printful draft.

As of July 17, 2026, the branded Stripe webhook is active at
`https://openmerchstudio.com/api/stripe/webhook` for completed, expired, and refunded events; the
Printful store website uses the branded origin; and no-order live mockups passed for all five launch
products. The Google Workspace alias domain is verified and Gmail, MX, and SPF are active. The
`support@openmerchstudio.com` group routes to direct members Chris Fox and Chris Henrich, and an
external inbound-and-reply test passed. A branded outbound test from
`Open Merch Studio Support <support@openmerchstudio.com>` passed SPF, DKIM for
`openmerchstudio.com`, and DMARC. Public open-source indexing was approved on July 17, 2026; public
checkout, payment authorization, and fulfillment authorization were still closed at that point.
Both support members use `Each email`; Chris Fox's first external member-delivery probe was marked
`Not spam`, and Chris Henrich should do the same once if Gmail classifies his first group message as
Spam. Production application defaults, Vercel support variables, and Stripe's public support email now
use `support@openmerchstudio.com`.

The supervised allowlisted commerce smoke passed on July 17, 2026. One live Stripe payment reconciled
to OMS order `OMS-2026-655AFL` at a final total of $16.94, including $0.96 Pennsylvania tax. The
original webhook delivery and two deliberate duplicate replays each returned HTTP 200, while Printful
contained exactly one editable draft and it was never confirmed. The live webhook signing secret was
rotated and verified without recording it. Production was then returned to closed gates; public health
reports checkout and fulfillment as `available`, meaning configured but not authorized. Stripe-hosted
successful-payment and refund customer emails are enabled.

On September 3, 2026, the owner opened public checkout and the corresponding server-side payment
and fulfillment gates. Paid orders still create editable Printful drafts and are never automatically
confirmed. The production Printful v2 subscription now sends signed `shipment_sent` and
`shipment_delivered` events to OMS. A zero-dollar signed fixture verified shipped and delivered
transitions, customer-safe tracking output, disabled email queuing, and retry deduplication; all
fixture records were removed afterward. OMS transactional email remains disabled pending branded
sender verification and an inbox receipt test. This paragraph supersedes the historical closed-gate
state recorded above.

## Provider Gates

Live provider behavior must stay behind explicit environment gates. The values below are safe
defaults for a new install or pause procedure, not a statement of the current production values.

- `CHECKOUT_ACCESS_MODE=closed` blocks every Stripe Session until an explicit supervised window.
- `CHECKOUT_ALLOWED_EMAILS=` is read only in `allowlist` mode. Use normalized operator emails and remove them after the smoke.
- `VITE_PUBLIC_APP_MODE=production` should be set for the production frontend build.
- `VITE_ENABLE_PUBLIC_CHECKOUT=false` keeps checkout controls disabled for public visitors; it is not a payment authorization gate.
- `VITE_ENABLE_LOCAL_FALLBACKS=false` prevents browser-only fixture fallbacks from masking production API failures.
- `ENABLE_LIVE_OPENAI` controls provider-backed design generation independently of checkout.
- `ENABLE_LIVE_STRIPE` exposes configured Stripe capability and webhook/recovery access, but does not
  override checkout access or live-payment gates.
- `ENABLE_LIVE_PRINTFUL=true` may be used for live mockup previews while fulfillment remains blocked by
  `ALLOW_LIVE_FULFILLMENT=false` and `FULFILLMENT_ENABLED=false`.
- `ALLOW_LIVE_PAYMENTS=false` prevents accidental live Stripe charges if a live key is configured.
- `ALLOW_LIVE_FULFILLMENT=false` prevents accidental Printful order creation if a live store token is configured.
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false` is required. Paid beta fulfillment is draft-order only; auto-confirm is blocked in code.
- `PRINTFUL_MOCKUP_TIMEOUT_MS=180000` caps live Printful mockup task polling.
- `FULFILLMENT_ENABLED=false` prevents real fulfillment activation.

Do not enable these gates until the matching private OPS tickets are reviewed, the checkout reconciliation migration has been applied, Stripe webhooks are verified, and provider test runs are captured. Public production deployments can safely allow browsing, design exploration, mockup preview, and quoting while checkout remains closed. Ignore any legacy `ENABLE_PUBLIC_CHECKOUT` value; it no longer authorizes the server.

## Fixture Smoke Test

```bash
npm audit --audit-level=high
npm run lint
npm test
npm run type-check
npm run smoke:fixture
npm run build
npm run test:browser
```

The backend fixture smoke test verifies the safe end-to-end path without live credentials:

1. Create guest studio session.
2. Refine a merch idea.
3. Generate a rough draft.
4. Create a fixture mockup.
5. Create a pass-free quote.
6. Simulate checkout.
7. Submit fixture fulfillment.

## Launch Gate Checklist

- Public repo has no live credentials, private provider values, private customer data, or billing artifacts.
- Fixture mode works from a clean clone.
- All committed Prisma migrations have been applied to the dedicated Open Merch Studio database,
  including `20260714233000_order_recovery_operations` before the supervised payment.
- Preview and production environments are separated.
- Vercel uses the full-stack Express backend through `api/[...path].js`; production API testing must hit real `/api/*` routes, not the archived fixture handlers under `api-fixtures/`.
- Production has `VITE_PUBLIC_APP_MODE=production`, `CHECKOUT_ACCESS_MODE=closed`, `CHECKOUT_ENABLED=false`, `VITE_ENABLE_PUBLIC_CHECKOUT=false`, and `VITE_ENABLE_LOCAL_FALLBACKS=false` until checkout approval.
- Stripe Checkout Sessions are card-only and US-only with Stripe Tax enabled. Webhook reconciliation stores final total, tax, payment intent, and paid timestamp; signed subscriptions must include completed, expired, and refunded events. Tax registrations and accounting remain operator responsibilities.
- OpenAI provider calls are implemented behind a gate with prompt moderation, product-neutral print prompt shaping, durable spend events when `DATABASE_URL` is configured, and checkout blocks for failed, warning, or policy-review designs. Spend alerts and pause steps must be verified continuously while live generation remains enabled.
- Printful catalog sync, curated product allowlisting, mockup task polling, duplicate draft-order recovery, technique-preserving payload validation, and draft-order creation are implemented behind gates. Drafts are never auto-confirmed. Store identity and branded mockup retrieval are verified; live price mapping, status sync, shipping, return, and support assumptions must still be reviewed before real fulfillment.
- Tax, shipping, and Studio Pass accounting assumptions are reviewed before real-money launch.
- `OMS-094` is reviewed with the private OPS checklist before inviting paid beta customers.

## Remaining Business And Legal Inputs

Public open-source browsing and indexing are approved independently of paid commerce. Do not open
public checkout until the deployed policy set receives the separate paid-launch approval. The owner
decisions use `Open Merch Studio` as the public brand, identify FoxAndHen LLC
as the operator, publish `support@openmerchstudio.com` as the email-only contact, omit the proposed
Pennsylvania governing-law paragraph, and assign applicable tax registration, filing, and remittance
to FoxAndHen LLC using Stripe Tax reports with self- or accountant-managed filing. TaxJar is not a
launch dependency.

Before public paid commerce, independently confirm that `Open Merch Studio` is registered to
FoxAndHen LLC as a Pennsylvania fictitious name, then record final paid-launch approval of the
deployed policy set in
[the launch policy copy proposal](./legal-policy-copy-proposal-2026-07-17.md). Do not claim that the
fictitious name is registered until confirmed, and do not infer or publish a street address, phone,
tax ID, bank information, or other private detail from provider or business-account records.

## Protected Order Operations

Set a long random `ADMIN_ACCESS_CODE` only in the deployment secret store. Never place it in a
frontend variable, command history, ticket, screenshot, or repository file. All endpoints below
require the exact value in `x-admin-access`.

```bash
curl -sS "$APP_URL/api/admin/orders?attention=failed" \
  -H "x-admin-access: $ADMIN_ACCESS_CODE"

curl -sS "$APP_URL/api/admin/orders/$ORDER_ID" \
  -H "x-admin-access: $ADMIN_ACCESS_CODE"
```

Admin detail includes the durable order, payment-event summaries, fulfillment-attempt summaries,
and an operator audit trail. It deliberately excludes raw Stripe/Printful payloads.

### Paid Order With No Printful Draft

1. Confirm the order is paid in Stripe and the OMS admin detail retains `paidAt`, final total, tax,
   and payment-intent reference.
2. Confirm no Printful order exists for the OMS order number. Printful retry also checks that
   immutable external ID before attempting a create.
3. Temporarily verify `ENABLE_LIVE_PRINTFUL=true`, `ALLOW_LIVE_FULFILLMENT=true`,
   `FULFILLMENT_ENABLED=true`, and `PRINTFUL_AUTO_CONFIRM_ORDERS=false` for the supervised action.
4. Retry once:

   ```bash
   curl -sS -X POST "$APP_URL/api/admin/orders/$ORDER_ID/fulfillment/retry" \
     -H "x-admin-access: $ADMIN_ACCESS_CODE"
   ```

5. Inspect the returned attempt and the editable Printful draft. Never confirm it automatically.
6. Acknowledge the issue while it is under review, or resolve it with a required note after the
   provider result is verified:

   ```bash
   curl -sS -X POST "$APP_URL/api/admin/orders/$ORDER_ID/review" \
     -H "content-type: application/json" \
     -H "x-admin-access: $ADMIN_ACCESS_CODE" \
     --data '{"status":"acknowledged"}'
   ```

### Refund Or Cancellation

- Initiate refunds deliberately in Stripe. The signed `charge.refunded` webhook updates the local
  order and distinguishes cumulative partial refunds from a full refund; do not add an automatic
  refund action to the retry API.
- Do not retry Printful for an order with any refunded amount or a cancelled order.
- If a Printful draft exists, cancel/remove it manually in Printful and record the operator outcome.
- A refund webhook that cannot find its durable OMS order emits `stripe_refund_orphaned` and returns
  an error so provider retry plus operator review remain possible.

### Log Review

Search Vercel Functions logs for JSON records with `"kind":"oms_operational"`. High-value events
include `stripe_payment_orphaned`, `stripe_refund_orphaned`, `printful_draft_failed`,
`printful_draft_retry_failed`, and `request_failed`. Logs contain operational identifiers and safe
failure classifications only; they must not contain email, address, prompt, artwork URL/content,
credentials, webhook bodies, provider response bodies, or raw Stripe Checkout Session IDs. Session
IDs appear only as stable one-way fingerprints for correlation.

## Pause Procedure

If launch needs to pause:

1. Set `CHECKOUT_ACCESS_MODE=closed` and clear `CHECKOUT_ALLOWED_EMAILS`.
2. Set `CHECKOUT_ENABLED=false`, `ALLOW_LIVE_PAYMENTS=false`, and
   `VITE_ENABLE_PUBLIC_CHECKOUT=false`.
3. Set `FULFILLMENT_ENABLED=false` and `ALLOW_LIVE_FULFILLMENT=false`; retain
   `PRINTFUL_AUTO_CONFIRM_ORDERS=false`.
4. In Stripe, locate every still-open Checkout Session created during the supervised window and
   expire it. Closing OMS gates prevents new sessions but cannot revoke an already-issued Stripe URL.
5. Redeploy so server and frontend gates agree.
6. Confirm `/api/health` reports checkout and fulfillment as configured/available rather than live,
   and verify a checkout request is blocked.
7. Review `oms_operational` errors, Stripe webhook delivery, protected order detail, and Printful
   drafts before reopening any gate.
8. Keep public browsing, design preview, and fixture-safe local development available.

## Branded Domain

Keep the branded production deployment non-indexable until legal/support content and the final visual
review pass. Branded support inbound routing, its external reply round-trip, and authenticated branded
outbound sending are verified. The branded provider callback/store URL, five-product artwork
retrieval/mockup checks, and one supervised live-commerce smoke are complete. Follow the portable
[openmerchstudio.com domain cutover checklist](./domain-cutover-openmerchstudio-com.md) without
placing DNS credentials, provider keys, database values, or signing secrets in this repository.
