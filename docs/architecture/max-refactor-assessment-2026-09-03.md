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
