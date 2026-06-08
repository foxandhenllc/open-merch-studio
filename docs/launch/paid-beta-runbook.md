# Paid Beta Runbook

**Status:** Ready for fixture mode and private provider testing after credentials
**Visibility:** Public  
**Private ops companion:** `/Users/chrisfox/git/staging/private/open-merch-studio-launch/`
**Latest provider snapshot:** [`provider-status-2026-06-07.md`](./provider-status-2026-06-07.md)

Open Merch Studio now has a fixture-mode paid beta path: curated catalog, idea refinement, draft generation, Studio Pass simulation, mockup generation, quote, checkout simulation, order confirmation, fixture fulfillment, admin reporting, and launch gates. The backend also has guarded provider adapters for OpenAI image generation, Stripe Checkout/webhooks, Printful mockup tasks, and Printful draft orders. It is suitable for OSS/product review and private provider testing, not unattended real-money launch.

The first revenue catalog is intentionally limited to five product lanes: tee/apparel, mug/drinkware, poster/wall art, tote/bags, and sticker. Hats, embroidery, phone cases, stationery, bulk orders, and full Printful catalog exposure remain out of scope for the first paid beta.

## Provider Gates

Live provider behavior must stay behind explicit environment gates.

- `PUBLIC_APP_MODE=production` switches the public app into customer-facing mode and hides OSS/operator-only surfaces.
- `ENABLE_PUBLIC_CHECKOUT=false` blocks Studio Pass purchase and merchandise checkout until launch approval.
- `VITE_PUBLIC_APP_MODE=production` should be set for the production frontend build.
- `VITE_ENABLE_PUBLIC_CHECKOUT=false` keeps checkout controls disabled for public visitors.
- `VITE_ENABLE_LOCAL_FALLBACKS=false` prevents browser-only fixture fallbacks from masking production API failures.
- `ENABLE_LIVE_OPENAI=false` keeps design generation in mock mode.
- `ENABLE_LIVE_STRIPE=false` keeps Studio Pass and merchandise checkout in fixture mode.
- `ENABLE_LIVE_PRINTFUL=false` keeps fulfillment in fixture mode.
- `ALLOW_LIVE_PAYMENTS=false` prevents accidental live Stripe charges if a live key is configured.
- `ALLOW_LIVE_FULFILLMENT=false` prevents accidental Printful order creation if a live store token is configured.
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false` is required. Paid beta fulfillment is draft-order only; auto-confirm is blocked in code.
- `PRINTFUL_MOCKUP_TIMEOUT_MS=180000` caps live Printful mockup task polling.
- `FULFILLMENT_ENABLED=false` prevents real fulfillment activation.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` enable durable generated artwork storage for live mockup and fulfillment review. The service role value must stay backend-only.

Do not enable these gates until the matching private OPS tickets are reviewed, the database migration has been applied, Stripe webhooks are verified, and provider test runs are captured. Public production deployments can safely allow browsing, design exploration, mockup preview, and quoting while checkout remains closed.

## Fixture Smoke Test

```bash
npm test
npm run type-check
npm run build
```

The backend fixture smoke test verifies the safe end-to-end path without live credentials:

1. Create guest studio session.
2. Refine a merch idea.
3. Generate a rough draft.
4. Simulate a Studio Pass.
5. Create a fixture mockup.
6. Create a quote with Studio Pass credit.
7. Simulate checkout.
8. Submit fixture fulfillment.

## Launch Gate Checklist

- Public repo has no live credentials, private provider values, private customer data, or billing artifacts.
- Fixture mode works from a clean clone.
- `backend/prisma/migrations/20260529180000_paid_beta_foundation/migration.sql`, `backend/prisma/migrations/20260530122000_paid_beta_provider_hardening/migration.sql`, and `backend/prisma/migrations/20260607120000_paid_beta_operator_review/migration.sql` have been applied to the dedicated Open Merch Studio database.
- Preview and production environments are separated.
- Vercel uses the full-stack Express backend through `api/[...path].js`; production API testing must hit real `/api/*` routes, not the archived fixture handlers under `api-fixtures/`.
- Production has `PUBLIC_APP_MODE=production`, `VITE_PUBLIC_APP_MODE=production`, `ENABLE_PUBLIC_CHECKOUT=false`, `VITE_ENABLE_PUBLIC_CHECKOUT=false`, and `VITE_ENABLE_LOCAL_FALLBACKS=false` until checkout approval.
- Stripe Checkout Sessions and webhooks are implemented in the backend with idempotent session creation and event-ID persistence. They must be verified with Stripe test mode before live checkout. Refunds, tax/accounting handling, and support paths still require private operator sign-off.
- OpenAI provider calls are implemented behind a gate with prompt moderation, product-neutral print prompt shaping, Supabase-backed durable artwork storage when configured, durable spend events when `DATABASE_URL` is configured, and checkout blocks for failed, warning, or policy-review designs. Spend alerts and pause steps must still be verified before live generation.
- Printful catalog sync, curated product allowlisting, mockup task polling, duplicate draft-order recovery, payload validation, and draft-order creation are implemented behind gates. Store setup, live price mapping, status sync, shipping, return, and support assumptions must be reviewed before real fulfillment. First paid orders should remain in operator `needs_review` after Stripe payment until the artwork, mockup, recipient, and payload checks pass.
- Protected admin review queue is available at `GET /api/admin/review-queue` with `x-admin-access`. Use it to inspect paid orders waiting for manual review, including payment status, quote/design IDs, product line items, recipient data, artwork/mockup URLs, and payload readiness checks.
- Tax, shipping, and Studio Pass accounting assumptions are reviewed before real-money launch.
- `OMS-094` is reviewed with the private OPS checklist before inviting paid beta customers.

## Pause Procedure

If launch needs to pause:

1. Set `CHECKOUT_ENABLED=false`.
2. Set `ENABLE_LIVE_OPENAI=false`.
3. Set `ENABLE_LIVE_PRINTFUL=false`.
4. Confirm admin launch readiness reports checkout, generation, and fulfillment as manual or blocked.
5. Keep public browsing and fixture-safe local development available.
