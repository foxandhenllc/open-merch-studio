# Open Merch Studio Paid Beta Launch Tickets

**Status:** Ready for implementation planning and issue creation  
**Visibility:** Public  
**Launch bar:** Paid beta  
**Repo:** FoxAndHenLLC/open-merch-studio

This folder is the public implementation ticket set for turning Open Merch Studio from its current scaffold into a real paid beta storefront. The target is a polished customer shop with a curated Printful-backed catalog, controlled OpenAI-assisted design workflow, transparent Studio Pass pricing, Stripe checkout, fulfillment operations, and OSS-friendly fixture mode.

Private provider setup, account operations, and business review notes are tracked outside the public repo in "/Users/chrisfox/git/staging/private/open-merch-studio-launch/".

## Current Implementation Status
- Fixture-mode implementation ledger: [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- Paid beta runbook: [../../launch/paid-beta-runbook.md](../../launch/paid-beta-runbook.md)
- Launch audit template: [../../launch/launch-audit-template.md](../../launch/launch-audit-template.md)

## Pricing Direction
- Consumer-facing model: $5 Studio Pass, applied to the eligible merchandise purchase.
- Free start: low-cost ideation and optionally one rough or watermarked preview.
- Studio Pass allowance: 8 rough drafts, or 4 rough drafts plus 2 edits, or 1 high-quality print-ready final.
- Internal accounting: model usage is tracked in an operator-only ledger with session and daily caps.
- Product quote model: Printful product cost, shipping/tax estimate where available, payment fee estimate, design allocation, category margin, Studio Pass credit where eligible, and final customer price.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Critical Path To Paid Beta
- [OMS-001: Paid Beta Launch Scope](./OMS-001-paid-beta-launch-scope.md)
- [OMS-010: Shop Home And Category Experience](./OMS-010-shop-home-and-category-experience.md)
- [OMS-011: Product Detail And Variant Selection](./OMS-011-product-detail-and-variant-selection.md)
- [OMS-012: Design Studio Flow](./OMS-012-design-studio-flow.md)
- [OMS-013: Mobile Responsive Polish](./OMS-013-mobile-responsive-polish.md)
- [OMS-014: Loading Empty And Error States](./OMS-014-loading-empty-error-states.md)
- [OMS-020: Studio Pass Pricing Model](./OMS-020-studio-pass-pricing-model.md)
- [OMS-021: AI Credit Ledger And Spend Caps](./OMS-021-ai-credit-ledger-and-spend-caps.md)
- [OMS-022: Free Start And Abuse Limits](./OMS-022-free-start-and-abuse-limits.md)
- [OMS-023: Category Margin And Quote Engine](./OMS-023-category-margin-and-quote-engine.md)
- [OMS-024: Customer Facing Price Transparency](./OMS-024-customer-facing-price-transparency.md)
- [OMS-030: Printful Catalog Sync Hardening](./OMS-030-printful-catalog-sync-hardening.md)
- [OMS-031: Curated Launch Catalog Admin](./OMS-031-curated-launch-catalog-admin.md)
- [OMS-032: Placement And Mockup Normalization](./OMS-032-placement-and-mockup-normalization.md)
- [OMS-033: Printful Mockup Generation](./OMS-033-printful-mockup-generation.md)
- [OMS-034: Printful Order Payload Validation](./OMS-034-printful-order-payload-validation.md)
- [OMS-040: OpenAI Provider Abstraction](./OMS-040-openai-provider-abstraction.md)
- [OMS-041: Prompt And Idea Assistant](./OMS-041-prompt-and-idea-assistant.md)
- [OMS-042: Rough Draft Generation Pipeline](./OMS-042-rough-draft-generation-pipeline.md)
- [OMS-043: Edit And Revision Pipeline](./OMS-043-edit-and-revision-pipeline.md)
- [OMS-044: Print Readiness Checks](./OMS-044-print-readiness-checks.md)
- [OMS-045: Content Safety And IP Guardrails](./OMS-045-content-safety-and-ip-guardrails.md)
- [OMS-050: Guest Session And Design Claim Flow](./OMS-050-guest-session-and-design-claim-flow.md)
- [OMS-052: Cart And Stripe Checkout](./OMS-052-cart-and-stripe-checkout.md)
- [OMS-053: Studio Pass Purchase And Credit Application](./OMS-053-studio-pass-purchase-and-credit-application.md)
- [OMS-054: Order Confirmation And Email](./OMS-054-order-confirmation-and-email.md)
- [OMS-055: Refunds Cancellations And Support](./OMS-055-refunds-cancellations-and-support.md)
- [OMS-060: Order State Machine](./OMS-060-order-state-machine.md)
- [OMS-061: Printful Submission And Status Sync](./OMS-061-printful-submission-and-status-sync.md)
- [OMS-062: Admin Order Dashboard](./OMS-062-admin-order-dashboard.md)
- [OMS-063: Fulfillment Failure Recovery](./OMS-063-fulfillment-failure-recovery.md)
- [OMS-070: Admin Controls For Catalog Pricing And AI Spend](./OMS-070-admin-controls-for-catalog-pricing-and-ai-spend.md)
- [OMS-071: Analytics Events And Cost Reporting](./OMS-071-analytics-events-and-cost-reporting.md)
- [OMS-072: Error Monitoring And Launch Audit](./OMS-072-error-monitoring-and-launch-audit.md)
- [OMS-090: Vercel Domain And Environment Readiness](./OMS-090-vercel-domain-and-environment-readiness.md)
- [OMS-091: Production Database And Migrations](./OMS-091-production-database-and-migrations.md)
- [OMS-092: End To End Launch Smoke Tests](./OMS-092-end-to-end-launch-smoke-tests.md)
- [OMS-093: Security Privacy And Credential Scan](./OMS-093-security-privacy-and-secret-scan.md)
- [OMS-094: Paid Beta Launch Checklist](./OMS-094-paid-beta-launch-checklist.md)

## All Tickets By Epic
- [EPIC-01: Product And Launch Definition](./EPIC-01-product-and-launch-definition.md) - critical path epic
  - [OMS-001: Paid Beta Launch Scope](./OMS-001-paid-beta-launch-scope.md) - critical path
  - [OMS-002: Public Roadmap And Contribution Positioning](./OMS-002-public-roadmap-and-contribution-positioning.md)
- [EPIC-02: Storefront And Design Experience](./EPIC-02-storefront-and-design-experience.md) - critical path epic
  - [OMS-010: Shop Home And Category Experience](./OMS-010-shop-home-and-category-experience.md) - critical path
  - [OMS-011: Product Detail And Variant Selection](./OMS-011-product-detail-and-variant-selection.md) - critical path
  - [OMS-012: Design Studio Flow](./OMS-012-design-studio-flow.md) - critical path
  - [OMS-013: Mobile Responsive Polish](./OMS-013-mobile-responsive-polish.md) - critical path
  - [OMS-014: Loading Empty And Error States](./OMS-014-loading-empty-error-states.md) - critical path
- [EPIC-03: Pricing And Studio Pass Economics](./EPIC-03-pricing-and-studio-pass-economics.md) - critical path epic
  - [OMS-020: Studio Pass Pricing Model](./OMS-020-studio-pass-pricing-model.md) - critical path
  - [OMS-021: AI Credit Ledger And Spend Caps](./OMS-021-ai-credit-ledger-and-spend-caps.md) - critical path
  - [OMS-022: Free Start And Abuse Limits](./OMS-022-free-start-and-abuse-limits.md) - critical path
  - [OMS-023: Category Margin And Quote Engine](./OMS-023-category-margin-and-quote-engine.md) - critical path
  - [OMS-024: Customer Facing Price Transparency](./OMS-024-customer-facing-price-transparency.md) - critical path
- [EPIC-04: Catalog And Printful Fulfillment](./EPIC-04-catalog-and-printful-fulfillment.md) - critical path epic
  - [OMS-030: Printful Catalog Sync Hardening](./OMS-030-printful-catalog-sync-hardening.md) - critical path
  - [OMS-031: Curated Launch Catalog Admin](./OMS-031-curated-launch-catalog-admin.md) - critical path
  - [OMS-032: Placement And Mockup Normalization](./OMS-032-placement-and-mockup-normalization.md) - critical path
  - [OMS-033: Printful Mockup Generation](./OMS-033-printful-mockup-generation.md) - critical path
  - [OMS-034: Printful Order Payload Validation](./OMS-034-printful-order-payload-validation.md) - critical path
- [EPIC-05: AI Design System](./EPIC-05-ai-design-system.md) - critical path epic
  - [OMS-040: OpenAI Provider Abstraction](./OMS-040-openai-provider-abstraction.md) - critical path
  - [OMS-041: Prompt And Idea Assistant](./OMS-041-prompt-and-idea-assistant.md) - critical path
  - [OMS-042: Rough Draft Generation Pipeline](./OMS-042-rough-draft-generation-pipeline.md) - critical path
  - [OMS-043: Edit And Revision Pipeline](./OMS-043-edit-and-revision-pipeline.md) - critical path
  - [OMS-044: Print Readiness Checks](./OMS-044-print-readiness-checks.md) - critical path
  - [OMS-045: Content Safety And IP Guardrails](./OMS-045-content-safety-and-ip-guardrails.md) - critical path
- [EPIC-06: Commerce Accounts And Orders](./EPIC-06-commerce-accounts-and-orders.md) - critical path epic
  - [OMS-050: Guest Session And Design Claim Flow](./OMS-050-guest-session-and-design-claim-flow.md) - critical path
  - [OMS-051: User Accounts And Saved Designs](./OMS-051-user-accounts-and-saved-designs.md)
  - [OMS-052: Cart And Stripe Checkout](./OMS-052-cart-and-stripe-checkout.md) - critical path
  - [OMS-053: Studio Pass Purchase And Credit Application](./OMS-053-studio-pass-purchase-and-credit-application.md) - critical path
  - [OMS-054: Order Confirmation And Email](./OMS-054-order-confirmation-and-email.md) - critical path
  - [OMS-055: Refunds Cancellations And Support](./OMS-055-refunds-cancellations-and-support.md) - critical path
  - [OMS-060: Order State Machine](./OMS-060-order-state-machine.md) - critical path
  - [OMS-061: Printful Submission And Status Sync](./OMS-061-printful-submission-and-status-sync.md) - critical path
- [EPIC-07: Admin Observability And Ops](./EPIC-07-admin-observability-and-ops.md) - critical path epic
  - [OMS-062: Admin Order Dashboard](./OMS-062-admin-order-dashboard.md) - critical path
  - [OMS-063: Fulfillment Failure Recovery](./OMS-063-fulfillment-failure-recovery.md) - critical path
  - [OMS-070: Admin Controls For Catalog Pricing And AI Spend](./OMS-070-admin-controls-for-catalog-pricing-and-ai-spend.md) - critical path
  - [OMS-071: Analytics Events And Cost Reporting](./OMS-071-analytics-events-and-cost-reporting.md) - critical path
  - [OMS-072: Error Monitoring And Launch Audit](./OMS-072-error-monitoring-and-launch-audit.md) - critical path
- [EPIC-08: Open Source Developer Experience](./EPIC-08-open-source-developer-experience.md)
  - [OMS-080: Clean Local Setup And Fixture Mode](./OMS-080-clean-local-setup-and-fixture-mode.md)
  - [OMS-081: API Docs And Architecture Diagrams](./OMS-081-api-docs-and-architecture-diagrams.md)
  - [OMS-082: GitHub Issues Labels And Good First Issues](./OMS-082-github-issues-labels-and-good-first-issues.md)
- [EPIC-09: Deployment And Paid Beta Launch](./EPIC-09-deployment-and-paid-beta-launch.md) - critical path epic
  - [OMS-090: Vercel Domain And Environment Readiness](./OMS-090-vercel-domain-and-environment-readiness.md) - critical path
  - [OMS-091: Production Database And Migrations](./OMS-091-production-database-and-migrations.md) - critical path
  - [OMS-092: End To End Launch Smoke Tests](./OMS-092-end-to-end-launch-smoke-tests.md) - critical path
  - [OMS-093: Security Privacy And Credential Scan](./OMS-093-security-privacy-and-secret-scan.md) - critical path
  - [OMS-094: Paid Beta Launch Checklist](./OMS-094-paid-beta-launch-checklist.md) - critical path

## Public Safety Rules
- Use synthetic or public-safe fixtures only.
- Keep provider account values and customer private data out of public docs, issues, fixtures, screenshots, and test artifacts.
- Do not claim adoption, revenue, active users, or customer traction unless there is public evidence approved for release.
- Default local development must work with mock or fixture providers.

## Done Criteria For This Ticket Set
- Every ticket has concrete requirements, acceptance criteria, dependencies, and a test plan.
- The critical path covers storefront, pricing, catalog, AI design, checkout, fulfillment, admin, deployment, and launch review.
- Private operator work is referenced but not copied into public GitHub docs.
