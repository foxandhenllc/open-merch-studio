# Launch Ticket Implementation Status

**Status:** Public review-first commerce active; checkout, draft fulfillment, shipment updates, and transactional email enabled
**Visibility:** Public

This file records what has been completed in the repo and what remains blocked by private provider credentials or manual business review.

## Completed In Fixture Mode

- `OMS-001`, `OMS-002`: Paid beta scope, public roadmap, and contribution positioning are documented.
- `OMS-010` through `OMS-014`: Storefront, category browsing, product selection, studio flow, responsive layout, and customer-safe states are implemented in the React app.
- `OMS-020` through `OMS-024`: The pass-free beta allowance, internal AI spend ledger, durable spend events when `DATABASE_URL` is configured, category-aware quote math, and transparent quote lines are implemented. Studio Pass UI is hidden and its checkout API is server-disabled unless the dedicated feature flag is explicitly enabled.
- `OMS-030` through `OMS-034`: Fixture catalog sync, catalog persistence shape, curated launch catalog allowlisting, placement normalization, fixture mockups, guarded Printful mockup polling, Printful order payload validation, duplicate draft-order recovery, and guarded Printful draft-order submission are implemented. Printful auto-confirm is blocked for paid beta. Live status sync remains blocked.
- `OMS-040` through `OMS-045`: Provider abstraction, idea assistant, rough drafts, revisions, OpenAI image-generation adapter, prompt moderation, print-ready prompt shaping, print-readiness checks, persisted failed-generation state, and content/IP guardrails are implemented with live OpenAI behind explicit environment gates.
- `OMS-050` and `OMS-051`: Guest session and account-ready ownership shapes are implemented in fixture mode. Full third-party auth remains optional and gated.
- `OMS-052` through `OMS-055`: Fixture checkout, checkout artwork/readiness gates, idempotent Stripe Checkout Session creation, signed Stripe webhook handling with recoverable event leases, durable payment/tax/refund references, full-versus-partial refund reconciliation, customer-safe checkout-return confirmation state, baseline support-policy pages, and HTML/text email templates are implemented. Branded app-owned transactional delivery is enabled through Resend with durable event-keyed delivery records. Automatic refunds/cancellations remain deliberately blocked.
- `OMS-060` through `OMS-063`: Exact durable order/review/failure states, fulfillment attempts, guarded Printful draft-order submission, external-ID duplicate recovery, database-authoritative protected order list/detail/filter APIs, idempotent draft retry, and operator review audit actions are implemented. Real provider status sync and a visual operator dashboard remain deferred.
- `OMS-070` through `OMS-072`: Admin settings guard, fixture AI spend reporting, launch readiness gates, request IDs, privacy-safe structured operational events, protected operator recovery APIs, and launch audit template are implemented. Automated external paging remains a pre-unattended-beta task.
- `OMS-080` through `OMS-082`: Fixture-mode clean setup, API/architecture docs, and GitHub issue taxonomy are documented.
- `OMS-090` through `OMS-094`: Deployment gates, production migrations, fixture smoke test, credential/privacy scan path, and paid beta go/no-go checklist are implemented as docs, scripts, and runtime readiness checks. Supabase schema and Prisma migration-history checksums were reconciled and verified on 2026-07-14; the supervised live payment and draft-order smoke passed on 2026-07-17.
- Customer-provided artwork is live: direct non-generative upload, private multi-image references, true image editing, print normalization, source-aware pricing, cleanup/retention, and live Printful mockup verification passed on August 26, 2026.

## Current Branded Production State

- `https://openmerchstudio.com` is the canonical production origin; `www` redirects to the apex and
  the Vercel alias is rollback-only.
- Live OpenAI generation is active for the design flow; policy, moderation, spend alerts, and pause
  behavior remain operational review items independent of payment/fulfillment authorization.
- The branded Stripe webhook is active for completed, expired, and refunded events. Its signing secret
  was rotated in deployment-managed configuration and verified without recording the value. One real
  completed delivery plus two duplicate replays returned HTTP 200, with no duplicate fulfillment side
  effect. Checkout and payment authorization are now public and live.
- The Printful store website is branded and the tee, tote, mug, sticker, and poster live mockup matrix
  passed. The supervised commerce smoke created exactly one editable Printful draft and never confirmed
  it. Live fulfillment creates reviewable Printful drafts; auto-confirm remains disabled.
- The Google Workspace alias domain is verified with Gmail, MX, and SPF active. The Open Merch Studio
  Support group routes branded inbound mail to direct members Chris Fox and Chris Henrich, and its
  external inbound-and-reply test passed. A branded outbound From test also passed SPF, DKIM for
  `openmerchstudio.com`, and DMARC. Stripe-hosted successful-payment and refund emails are enabled.
  The production Resend resource is connected, the branded `orders@openmerchstudio.com` sender
  passed an external `Delivered` test, and OMS order/refund/shipment emails are enabled.
- The one supervised payment reconciled to OMS order `OMS-2026-655AFL` for $16.94 total, including
  $0.96 Pennsylvania tax. Production health now reports checkout and fulfillment as `live`.
- Public open-source indexing was approved on July 17, 2026 after legal/support content and the
  supervised commerce path were verified; checkout and review-first fulfillment are now open.
- On August 26, 2026, the canonical production UI passed a signed Supabase upload of a temporary
  1600×1400 PNG, Sharp print preparation, a decoded Printful mockup, responsive review, and cleanup.
  Both apex and `www` are public and indexable. This was a pre-opening checkpoint; the production
  commerce gates were subsequently opened.

## Remaining Supervised Work

- Live Stripe checkout is open. Continue reconciling signed completed, expired, and refunded events
  and review Stripe Tax reporting on the normal operating cadence.
- Live Printful fulfillment creates editable drafts. Manual draft inspection remains required and
  auto-confirm stays disabled.
- App-owned transactional email is active. Observe the next real paid-order and shipment sequence,
  and reconcile any `failed` or `ambiguous` delivery records before retrying them.
- Tax, shipping, accounting, refund, and support policy sign-off: owner decisions now use
  `Open Merch Studio` as the public brand, identify FoxAndHen LLC as the operator, use
  `support@openmerchstudio.com` as the email-only public contact, omit the proposed Pennsylvania
  governing-law paragraph, and assign applicable tax registration, filing, and remittance to
  FoxAndHen LLC using Stripe Tax reports with self- or accountant-managed filing. TaxJar is not a
  dependency. The coordinated policy set and versioned Checkout assent are implemented, and the
  nullable policy-audit migration was applied and checksum verified on July 17, 2026. Public
  open-source indexing was approved separately, and the fictitious-name registration and paid-launch
  prerequisites were completed before public commerce was opened.

## Verification

Last local and deployed verification run: September 3, 2026, with production commerce gates open.

```bash
npm run lint
npm run type-check
npm test
npm run build
npm run smoke:fixture
npm run test:browser
npm audit --audit-level=high
```

Result: all passed. The backend suite reported 67 passes and three intentional database-only skips;
the responsive browser smoke passed across 11 viewports, all five fixture products, and the direct
upload plus multi-reference paths. Production additionally passed real Supabase and Printful upload
smokes with cleanup.

## Launch Rule

The repo and storefront are open for public OSS review and public customer payments. Fulfillment is
intentionally review-first rather than unattended: every Printful draft still requires operator
inspection and confirmation. Continue the private tax-filing/remittance cadence and supervised
provider monitoring described by the OPS checklist.

The intended domain promotion sequence is captured in the
[openmerchstudio.com cutover checklist](../../launch/domain-cutover-openmerchstudio-com.md).
