# Launch Ticket Implementation Status

**Status:** Fixture mode complete; live OpenAI and Printful mockup preview active behind production gates
**Visibility:** Public

This file records what has been completed in the repo and what remains blocked by private provider credentials or manual business review. The latest provider/account snapshot is recorded in [`docs/launch/provider-status-2026-06-07.md`](../../launch/provider-status-2026-06-07.md).

## Completed In Fixture Mode

- `OMS-001`, `OMS-002`: Paid beta scope, public roadmap, and contribution positioning are documented.
- `OMS-010` through `OMS-014`: Storefront, category browsing, product selection, studio flow, responsive layout, and customer-safe states are implemented in the React app.
- `OMS-020` through `OMS-024`: `$5` Studio Pass, free-start policy, internal AI spend ledger, durable spend events when `DATABASE_URL` is configured, category-aware quote math, Studio Pass credit, and transparent quote lines are implemented. Production allowance accounting still needs live database verification and ops review.
- `OMS-030` through `OMS-034`: Fixture catalog sync, five-lane launch catalog scope, catalog persistence shape, curated launch catalog allowlisting, placement normalization, fixture mockups, guarded Printful mockup polling, Printful order payload validation, duplicate draft-order recovery, and guarded Printful draft-order submission are implemented. Printful auto-confirm is blocked for paid beta. Live status sync remains blocked.
- `OMS-040` through `OMS-045`: Provider abstraction, idea assistant, rough drafts, revisions, OpenAI image-generation adapter, Supabase Storage artwork persistence when configured, prompt moderation, print-ready prompt shaping, print-readiness checks, persisted failed-generation state, and content/IP guardrails are implemented with live OpenAI behind explicit environment gates.
- `OMS-050` and `OMS-051`: Guest session and account-ready ownership shapes are implemented in fixture mode. Full third-party auth remains optional and gated.
- `OMS-052` through `OMS-055`: Fixture checkout, checkout artwork/readiness gates, Studio Pass simulation, idempotent Stripe Checkout Session creation, Stripe webhook handling with event-ID persistence, order confirmation state, and support-policy documentation are implemented. Refunds, cancellation workflows, and transactional email remain blocked.
- `OMS-060` through `OMS-063`: Order transitions, fixture fulfillment submission, paid-order manual review state, operator review checks, guarded Printful draft-order submission, database-backed admin order fallback, guarded admin order/report surfaces, and recovery documentation are implemented. Real provider status sync and operational recovery automation remain blocked.
- `OMS-070` through `OMS-072`: Admin settings guard, fixture AI spend reporting, launch readiness gates, and launch audit template are implemented.
- `OMS-080` through `OMS-082`: Fixture-mode clean setup, API/architecture docs, and GitHub issue taxonomy are documented.
- `OMS-090` through `OMS-094`: Deployment gates, generated production migrations, fixture smoke test, credential/privacy scan path, and paid beta go/no-go checklist are implemented as docs, scripts, and runtime readiness checks. Production migration application, Supabase bucket setup, and seed guards have been verified for the private paid-beta environment.

## Current Private-Provider Progress

- Production Supabase database and Storage are configured and verified.
- Live OpenAI rough generation is enabled with spend caps and durable
  Supabase-hosted artwork.
- Printful launch catalog curation is applied to production:
  - tee, mug, poster, tote, and sticker
  - 48 available variants total
  - one checkout-safe print placement per product
- Live Printful mockup preview is enabled and verified for all five product
  lanes. Real Printful draft-order submission remains gated.

## Blocked Until Private Inputs

- Live OpenAI generation: enabled for private paid-beta testing with spend caps; still needs ongoing budget/alert monitoring before public traffic.
- Live Stripe checkout: requires private Stripe test setup, webhook verification, tax/accounting review, `DATABASE_URL`, `ENABLE_LIVE_STRIPE=true`, and `ALLOW_LIVE_PAYMENTS=true` only when live charges are approved.
- Real Printful fulfillment: mockups and curated SKUs are live; draft-order creation remains gated until shipping/returns/support approval, status sync review, `ALLOW_LIVE_FULFILLMENT=true`, `PRINTFUL_AUTO_CONFIRM_ORDERS=false`, and `FULFILLMENT_ENABLED=true`.
- Production domain and Vercel environment promotion: requires private domain/team review and deployment settings.
- Tax, shipping, accounting, refund, and support policy sign-off: requires private operator review before real-money launch.

## Verification

Last local verification run:

```bash
npm run lint
npm run type-check
npm test
npm run build
npm run smoke:fixture
```

Expected result: all pass.

Latest verification also includes:

```bash
npm test
npm run build
```

Expected result: all pass, plus production smoke for catalog, quote, admin
settings, and live Printful mockup preview.

## Launch Rule

The repo is now ready for public OSS review, fixture-mode product review, and private provider testing with test credentials. It is not ready for real customer payments or unattended fulfillment until the private OPS checklist, Stripe test webhook pass, and Printful draft-order review are complete.
