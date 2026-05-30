# Paid Beta Runbook

**Status:** Ready for fixture-mode operation  
**Visibility:** Public  
**Private ops companion:** `/Users/chrisfox/git/staging/private/open-merch-studio-launch/`

Open Merch Studio now has a fixture-mode paid beta path: curated catalog, idea refinement, draft generation, Studio Pass simulation, mockup generation, quote, checkout simulation, order confirmation, fixture fulfillment, admin reporting, and launch gates. The backend also has guarded provider adapters for OpenAI image generation, Stripe Checkout/webhooks, and Printful draft orders. It is suitable for OSS/product review and private provider testing, not unattended real-money launch.

## Provider Gates

Live provider behavior must stay behind explicit environment gates.

- `ENABLE_LIVE_OPENAI=false` keeps design generation in mock mode.
- `ENABLE_LIVE_STRIPE=false` keeps Studio Pass and merchandise checkout in fixture mode.
- `ENABLE_LIVE_PRINTFUL=false` keeps fulfillment in fixture mode.
- `ALLOW_LIVE_PAYMENTS=false` prevents accidental live Stripe charges if a live key is configured.
- `ALLOW_LIVE_FULFILLMENT=false` prevents accidental Printful order creation if a live store token is configured.
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false` keeps Printful orders as drafts unless explicitly approved.
- `FULFILLMENT_ENABLED=false` prevents real fulfillment activation.

Do not enable these gates until the matching private OPS tickets are reviewed, the database migration has been applied, Stripe webhooks are verified, and provider test runs are captured.

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
- `backend/prisma/migrations/20260529180000_paid_beta_foundation/migration.sql` has been applied to the intended database.
- Preview and production environments are separated.
- Stripe Checkout Sessions and webhooks are implemented in the backend and must be verified with Stripe test mode before live checkout. Refunds, tax/accounting handling, and support paths still require private operator sign-off.
- OpenAI provider calls are implemented behind a gate. Budget caps, spend alerts, and pause steps must be verified before live generation.
- Printful catalog sync and draft-order creation are implemented behind gates. Store setup, live price mapping, status sync, shipping, return, and support assumptions must be reviewed before real fulfillment.
- Tax, shipping, and Studio Pass accounting assumptions are reviewed before real-money launch.
- `OMS-094` is reviewed with the private OPS checklist before inviting paid beta customers.

## Pause Procedure

If launch needs to pause:

1. Set `CHECKOUT_ENABLED=false`.
2. Set `ENABLE_LIVE_OPENAI=false`.
3. Set `ENABLE_LIVE_PRINTFUL=false`.
4. Confirm admin launch readiness reports checkout, generation, and fulfillment as manual or blocked.
5. Keep public browsing and fixture-safe local development available.
