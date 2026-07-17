# Paid Beta Runbook

**Status:** Ready for fixture mode and private provider testing after credentials
**Visibility:** Public  
**Private ops companion:** Maintained outside this public repository

Open Merch Studio now has a fixture-mode paid beta path: curated catalog, idea refinement, draft generation, mockup generation, quote, checkout simulation, order confirmation, fixture fulfillment, admin reporting, and launch gates. The backend also has guarded provider adapters for OpenAI image generation, Stripe Checkout/webhooks, Printful mockup tasks, and Printful draft orders. It is suitable for OSS/product review and private provider testing, not unattended real-money launch.

## Provider Gates

Live provider behavior must stay behind explicit environment gates.

- `CHECKOUT_ACCESS_MODE=closed` blocks every Stripe Session until an explicit supervised window.
- `CHECKOUT_ALLOWED_EMAILS=` is read only in `allowlist` mode. Use normalized operator emails and remove them after the smoke.
- `VITE_PUBLIC_APP_MODE=production` should be set for the production frontend build.
- `VITE_ENABLE_PUBLIC_CHECKOUT=false` keeps checkout controls disabled for public visitors; it is not a payment authorization gate.
- `VITE_ENABLE_LOCAL_FALLBACKS=false` prevents browser-only fixture fallbacks from masking production API failures.
- `ENABLE_LIVE_OPENAI=false` keeps design generation in mock mode.
- `ENABLE_LIVE_STRIPE=false` keeps Studio Pass and merchandise checkout in fixture mode.
- `ENABLE_LIVE_PRINTFUL=false` keeps fulfillment in fixture mode.
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
- OpenAI provider calls are implemented behind a gate with prompt moderation, product-neutral print prompt shaping, durable spend events when `DATABASE_URL` is configured, and checkout blocks for failed, warning, or policy-review designs. Spend alerts and pause steps must still be verified before live generation.
- Printful catalog sync, curated product allowlisting, mockup task polling, duplicate draft-order recovery, technique-preserving payload validation, and draft-order creation are implemented behind gates. Drafts are never auto-confirmed. Store setup, live price mapping, status sync, shipping, return, and support assumptions must be reviewed before real fulfillment.
- Tax, shipping, and Studio Pass accounting assumptions are reviewed before real-money launch.
- `OMS-094` is reviewed with the private OPS checklist before inviting paid beta customers.

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

Keep the branded production deployment non-indexable until legal/support content, branded provider
callbacks, production artwork retrieval, and the final visual review pass. Follow the portable
[openmerchstudio.com domain cutover checklist](./domain-cutover-openmerchstudio-com.md) without
placing DNS credentials, provider keys, database values, or signing secrets in this repository.
