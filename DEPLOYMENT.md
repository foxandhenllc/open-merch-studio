# Deployment

Open Merch Studio can be deployed as a split frontend/backend app or as separate services.

## Required Production Inputs

- PostgreSQL database URL
- Public frontend URL
- Backend API URL

## Optional Provider Inputs

- Printful bearer value and store ID for live catalog sync, draft-order creation, and fulfillment review
- OpenAI key for guarded provider-backed design generation
- remove.bg key for converting `gpt-image-2` output into transparent print-ready PNGs
- Stripe key and webhook signing value for Checkout Sessions and webhook reconciliation

Store all provider values in deployment-managed storage. Do not commit provider values or screenshots of provider dashboards.

## Live Provider Gates

Keep live behavior disabled until the private OPS checklist is complete.

- `CHECKOUT_ACCESS_MODE=closed`
- `CHECKOUT_ALLOWED_EMAILS=`
- `VITE_PUBLIC_APP_MODE=production`
- `VITE_ENABLE_PUBLIC_CHECKOUT=false`
- `VITE_ENABLE_LOCAL_FALLBACKS=false`
- `ENABLE_LIVE_OPENAI=false`
- `ENABLE_LIVE_STRIPE=false`
- `ENABLE_LIVE_PRINTFUL=false`
- `ALLOW_LIVE_PAYMENTS=false`
- `ALLOW_LIVE_FULFILLMENT=false`
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false`
- `CHECKOUT_ENABLED=false`
- `FULFILLMENT_ENABLED=false`

Preview deployments should not use production provider settings. Production checkout, live generation, and real fulfillment must remain separate switches. The backend contains guarded live adapters; fixture behavior is for local/test use and must not be mistaken for the production API.

The current Vercel deployment serves the static frontend and routes `/api/*` through the full Express backend in `api/[...path].js`. `CHECKOUT_ACCESS_MODE` is the authoritative server gate: `closed` blocks all Stripe Session creation, `allowlist` accepts only normalized emails in `CHECKOUT_ALLOWED_EMAILS`, and `public` opens the server path. The old `ENABLE_PUBLIC_CHECKOUT` value is ignored. `VITE_ENABLE_PUBLIC_CHECKOUT` controls presentation only and never authorizes payment.

Provider Checkout requires the quote, artwork, selected variants, and order to be retrievable from PostgreSQL. Stripe Checkout is card-only, US-only, and uses automatic tax. Subscribe the signed webhook endpoint to `checkout.session.completed`, `checkout.session.expired`, and `charge.refunded`.

Printful mockup generation uses `PRINTFUL_MOCKUP_TIMEOUT_MS` to cap provider polling. Paid orders create an editable draft with the OMS order number as the external ID; `PRINTFUL_AUTO_CONFIRM_ORDERS` must remain false for the supervised launch.

`gpt-image-2` is the default design model. Because that model does not emit transparent backgrounds, set `REMOVE_BG_API_KEY` to enable the automatic post-generation background-removal stage. Without it, generation and mockups still work, but print readiness shows a warning until a transparent file is prepared.

## Database Migration

Apply migrations only against the intended database environment:

```bash
cd backend
npx prisma migrate deploy
```

The first generated migration is `backend/prisma/migrations/20260529180000_paid_beta_foundation/migration.sql`.

## Release Gate

Before public deployment:

```bash
npm audit --audit-level=high
npm run lint
npm run type-check
npm test
npm run smoke:fixture
npm run build
npm run test:browser
```

Run a manual catalog quote smoke test with fixture mode, then again with provider sandbox credentials if production integrations are enabled.

See [docs/launch/paid-beta-runbook.md](./docs/launch/paid-beta-runbook.md) for the full paid beta gate sequence.

The intended branded-domain promotion is documented separately in
[docs/launch/domain-cutover-openmerchstudio-com.md](./docs/launch/domain-cutover-openmerchstudio-com.md).
