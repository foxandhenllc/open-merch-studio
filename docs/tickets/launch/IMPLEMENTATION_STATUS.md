# Launch Ticket Implementation Status

**Status:** Branded closed-gate production active; supervised commerce smoke pending
**Visibility:** Public

This file records what has been completed in the repo and what remains blocked by private provider credentials or manual business review.

## Completed In Fixture Mode

- `OMS-001`, `OMS-002`: Paid beta scope, public roadmap, and contribution positioning are documented.
- `OMS-010` through `OMS-014`: Storefront, category browsing, product selection, studio flow, responsive layout, and customer-safe states are implemented in the React app.
- `OMS-020` through `OMS-024`: The pass-free beta allowance, internal AI spend ledger, durable spend events when `DATABASE_URL` is configured, category-aware quote math, and transparent quote lines are implemented. Studio Pass UI is hidden and its checkout API is server-disabled unless the dedicated feature flag is explicitly enabled.
- `OMS-030` through `OMS-034`: Fixture catalog sync, catalog persistence shape, curated launch catalog allowlisting, placement normalization, fixture mockups, guarded Printful mockup polling, Printful order payload validation, duplicate draft-order recovery, and guarded Printful draft-order submission are implemented. Printful auto-confirm is blocked for paid beta. Live status sync remains blocked.
- `OMS-040` through `OMS-045`: Provider abstraction, idea assistant, rough drafts, revisions, OpenAI image-generation adapter, prompt moderation, print-ready prompt shaping, print-readiness checks, persisted failed-generation state, and content/IP guardrails are implemented with live OpenAI behind explicit environment gates.
- `OMS-050` and `OMS-051`: Guest session and account-ready ownership shapes are implemented in fixture mode. Full third-party auth remains optional and gated.
- `OMS-052` through `OMS-055`: Fixture checkout, checkout artwork/readiness gates, idempotent Stripe Checkout Session creation, signed Stripe webhook handling with recoverable event leases, durable payment/tax/refund references, full-versus-partial refund reconciliation, customer-safe checkout-return confirmation state, baseline support-policy pages, and unsent HTML/text email templates are implemented. App-owned transactional delivery is disabled; Stripe-hosted receipts/refund messages are the planned MVP payment-email surface until a branded sender domain and exactly-once notification record exist. Automatic refunds/cancellations remain deliberately blocked.
- `OMS-060` through `OMS-063`: Exact durable order/review/failure states, fulfillment attempts, guarded Printful draft-order submission, external-ID duplicate recovery, database-authoritative protected order list/detail/filter APIs, idempotent draft retry, and operator review audit actions are implemented. Real provider status sync and a visual operator dashboard remain deferred.
- `OMS-070` through `OMS-072`: Admin settings guard, fixture AI spend reporting, launch readiness gates, request IDs, privacy-safe structured operational events, protected operator recovery APIs, and launch audit template are implemented. Automated external paging remains a pre-unattended-beta task.
- `OMS-080` through `OMS-082`: Fixture-mode clean setup, API/architecture docs, and GitHub issue taxonomy are documented.
- `OMS-090` through `OMS-094`: Deployment gates, production migrations, fixture smoke test, credential/privacy scan path, and paid beta go/no-go checklist are implemented as docs, scripts, and runtime readiness checks. Supabase schema and Prisma migration-history checksums were reconciled and verified on 2026-07-14; paid-order behavior still requires the supervised live smoke.

## Current Branded Production State

- `https://openmerchstudio.com` is the canonical production origin; `www` redirects to the apex and
  the Vercel alias is rollback-only.
- Live OpenAI generation is active for the design flow; policy, moderation, spend alerts, and pause
  behavior remain operational review items independent of payment/fulfillment authorization.
- The branded Stripe webhook is active for completed, expired, and refunded events. Checkout and
  payment authorization remain closed; signed real delivery and duplicate replay await the supervised
  smoke.
- The Printful store website is branded and the tee, tote, mug, sticker, and poster live mockup matrix
  passed without creating an order. Fulfillment authorization remains closed and auto-confirm remains
  disabled.
- The Google Workspace alias domain is verified with Gmail, MX, and SPF active. The Open Merch Studio
  Support group routes branded inbound mail to direct members Chris Fox and Chris Henrich, and its
  external inbound-and-reply test passed. The published DKIM record is still authenticating, and the
  tested group reply displayed the primary-domain address because the branded domain is an alias.
- Search indexing remains disabled until legal/support content and the final design review are approved.

## Blocked Until Private Inputs

- Live Stripe checkout: remains closed except for an explicit allowlisted smoke window. Signed completed/expired/refunded webhooks, Tax configuration, and durable reconciliation are implemented; `ALLOW_LIVE_PAYMENTS=true` is still an explicit real-charge decision.
- Real Printful fulfillment: live draft creation remains closed except for the supervised smoke. Live price/shipping review, status sync, returns/support approval, and manual draft inspection remain before external beta. Auto-confirm stays disabled.
- App-owned transactional email: deferred until the branded sender domain, delivery provider,
  notification idempotency, and template review are complete. Do not add a frontend or repository
  email credential.
- Tax, shipping, accounting, refund, and support policy sign-off: requires private operator review
  before real-money launch. Customer policies still need approved seller/DBA identity, public mailing
  address, dates, purchaser eligibility, jurisdiction/dispute terms, return/claim/refund rules,
  artwork rights, and data-retention language.

## Verification

Last local verification run:

```bash
npm run lint
npm run type-check
npm test
npm run build
npm run smoke:fixture
npm run test:browser
npm audit --audit-level=high
```

Expected result: all pass.

## Launch Rule

The repo is now ready for public OSS review, fixture-mode product review, and a supervised allowlisted provider smoke. It is not ready for public customer payments or unattended fulfillment until the private OPS checklist, one real Stripe webhook reconciliation, and one manually inspected Printful draft are complete.

The intended domain promotion sequence is captured in the
[openmerchstudio.com cutover checklist](../../launch/domain-cutover-openmerchstudio-com.md).
