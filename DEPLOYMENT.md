# Deployment

Open Merch Studio can be deployed as a split frontend/backend app or as separate services.

## Required Production Inputs

- PostgreSQL database URL
- Public frontend URL
- Backend API URL

## Optional Provider Inputs

- Printful bearer value and store ID for live catalog sync, draft-order creation, and fulfillment review
- OpenAI key for guarded provider-backed design generation
- Stripe key and webhook signing value for Checkout Sessions and webhook reconciliation

Store all provider values in deployment-managed storage. Do not commit provider values or screenshots of provider dashboards.

## Live Provider Gates

Keep live behavior disabled until the private OPS checklist is complete.

- `ENABLE_LIVE_OPENAI=false`
- `ENABLE_LIVE_STRIPE=false`
- `ENABLE_LIVE_PRINTFUL=false`
- `ALLOW_LIVE_PAYMENTS=false`
- `ALLOW_LIVE_FULFILLMENT=false`
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false`
- `CHECKOUT_ENABLED=true`
- `FULFILLMENT_ENABLED=false`

Preview deployments should not use production provider settings. Production checkout, live generation, and real fulfillment must remain separate switches. The backend contains guarded live adapters, but the Vercel fixture API remains public-safe and does not create live provider sessions.

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
npm run type-check
npm test
npm run build
```

Run a manual catalog quote smoke test with fixture mode, then again with provider sandbox credentials if production integrations are enabled.

See [docs/launch/paid-beta-runbook.md](./docs/launch/paid-beta-runbook.md) for the full paid beta gate sequence.
