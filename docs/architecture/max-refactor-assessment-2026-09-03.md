# Max Refactor assessment — September 3, 2026

## Decision

A staged refactor is warranted, but it should begin after the current mobile, multi-placement,
metadata, and dependency repair is released. No broad structural change belongs in that repair.

The repository has strong behavioral coverage and clear provider boundaries, so this is a good
candidate for behavior-preserving extraction rather than a rewrite.

## Research gate

- Runtime: npm workspaces, TypeScript, React/Vite, Express, Prisma/PostgreSQL, Vercel.
- Baseline gates: lint, type-check, backend tests, production build/static-route verification, and an
  11-viewport Playwright smoke suite.
- Architecture: one Vercel deployment serves static frontend documents and a catch-all Express API.
- State: guest browser persistence plus durable server catalog, artwork, quotes, orders, payment
  events, fulfillment attempts, settings, and audit logs.
- Provider posture: fixture-first local development; live OpenAI, Stripe, and Printful adapters are
  separately gated.
- Working tree at assessment time contained unrelated untracked design, ticket, capture, and audit
  material. It must not be deleted, reset, or absorbed casually.

## Highest-leverage seams

| Current concentration | Size at audit | Extraction target |
| --- | ---: | --- |
| `backend/src/services/order.service.ts` | 2,274 lines | quote validation, Checkout orchestration, Stripe reconciliation, refund handling, fulfillment review, recovery |
| `frontend/src/studio-view-model.ts` | 1,696 lines | state/selectors, design commands, product commands, quote/checkout commands, restoration |
| `backend/src/services/printful.service.ts` | 1,273 lines | client transport, catalog sync, mockups, draft orders, status mapping |
| `frontend/src/WorkbenchStudioApp.tsx` | 1,075 lines | one component per product/configure/create/review/checkout/order mode |
| `backend/src/services/runtime-store.ts` | 963 lines | fixture store and durable repository adapters |
| `frontend/src/styles.css` | 3,776 lines | tokens/base, workbench, components, policy pages, example collection, responsive rules |
| `frontend/scripts/responsive-smoke.mjs` | 1,274 lines | shared harness plus independent customer journeys |

## Staged sequence

1. **Characterization first.** Freeze quote totals, placement payloads, webhook idempotency, order
   recovery, persistence, and mobile journeys with current tests. Add no new behavior.
2. **Order domain.** Extract pure validation and transition functions, then repositories, then
   Stripe and Printful orchestration. Keep routes and response shapes unchanged.
3. **Studio domain.** Extract typed commands and selectors from the React hook. Preserve its public
   return contract until every mode is migrated.
4. **UI modes.** Move one workbench mode at a time into a component. Verify desktop, phone, focus,
   restore, and request payloads after every extraction.
5. **Provider services.** Separate transport from transformation so Printful payload and recovery
   tests can run without network calls.
6. **CSS and smoke harness.** Split only after component ownership is explicit. Preserve cascade
   order while moving blocks, then remove proven duplication.

Run lint, type-check, tests, build, and the complete browser suite after every stage. If any stage
requires simultaneously changing behavior and module boundaries, stop and split it into two commits.

## Not a refactor target yet

Cart, reorder, customer accounts, tracking, transactional email, merchant configuration, and a
ChatGPT plugin are product capabilities. Specify them against the cleaner seams, but do not label
their implementation as cleanup.

## First implementation checkpoint

Completed September 3, 2026:

1. Extracted the pure order-state boundary into `order-state.service.ts`: persisted/runtime status
   mapping, Stripe event and refund decisions, Printful retry eligibility, operator-review
   normalization, and admin attention filters.
2. Extracted the checkout-validation boundary into `checkout-validation.service.ts`: artwork
   readiness checks, distinct placement artwork collection, and catalog/provider quote validation.
3. Preserved the former `order.service.ts` exports so controllers and existing consumers did not
   change.
4. Added characterization coverage for unknown persisted values failing closed, artwork validation,
   and distinct multi-placement design IDs.

`order.service.ts` moved from 2,287 to 2,084 lines. It remains above the 1,000-line target because the
database persistence, Stripe reconciliation, Printful submission/recovery, and admin mutation paths
still share transaction and failure-handling context. The next extraction target is a typed order
repository that owns Prisma includes, persisted/runtime mapping, and order reads/writes without
changing route or service contracts. Provider orchestration should move only after that boundary is
green.

Checkpoint verification passed lint, 84 backend tests (81 passed and three database-only skips),
typecheck, production build/static-route checks, the local multi-placement fixture contract, and the
complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.
