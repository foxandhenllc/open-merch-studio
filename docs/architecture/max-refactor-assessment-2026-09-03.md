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

## Order repository checkpoint

Completed September 3, 2026:

- Added `order-repository.service.ts` as the typed fixture/PostgreSQL boundary for quote and order
  reads, persisted-to-runtime mapping, order upserts, checkout-session and payment-intent recovery,
  admin read projections, and fulfillment-retry loading.
- Kept raw Prisma payloads inside the repository. The retry workflow receives a narrow typed record
  containing only eligibility fields and its mapped runtime order.
- Preserved every public `order.service.ts` export used by controllers and tests.

`order.service.ts` moved from 2,084 to 1,716 lines; the new repository is 423 lines. The orchestrator
remains above 1,000 lines because signed Stripe reconciliation, payment/refund event mutation,
Printful fulfillment-attempt mutation, and provider recovery still share one module. The next safe
bundle is Stripe event persistence and reconciliation support; after that, extract Printful attempt
state and draft submission. Do not combine either extraction with cart or quantity behavior.

This checkpoint passed lint, 84 backend tests (81 passed and three database-only skips), the explicit
fixture smoke, typecheck, production build/static-route checks, the local multi-placement contract,
and the complete 11-viewport browser suite.

## Stripe persistence checkpoint

Completed September 3, 2026:

- Added `stripe-order-repository.service.ts` as the durable Stripe reconciliation boundary for
  event leases and duplicate detection, Studio Pass purchase persistence, payment completion,
  checkout expiry, orphan audit records, monotonic refund writes, and Stripe recipient mapping.
- Kept signed webhook orchestration, Stripe retrieval calls, fulfillment gating, Printful draft
  creation, operational logging, and customer-email decisions in their existing services.
- Preserved the public `order.service.ts` exports consumed by controllers and tests, including the
  event-tracking and recipient helpers.
- Preserved terminal-refund precedence, stale-event recovery, paid-after-expiry reconciliation,
  fulfillment-attempt updates, and fixture fallback behavior.

`order.service.ts` moved from 1,716 to 1,337 lines; the new Stripe persistence module is 421 lines.
The orchestrator remains above 1,000 lines because Printful fulfillment-attempt acquisition, draft
submission/recovery, and operator retry mutations still share provider-specific state. The next safe
bundle is that Printful attempt and draft-submission boundary. Cart, quantity, reorder, and merchant
store capabilities remain product work outside the refactor.

This checkpoint passed lint, 84 backend tests (81 passed and three database-only skips), the explicit
fixture smoke, typecheck, production build/static-route checks, the local multi-placement contract,
and the complete 11-viewport browser suite across five products.

## Printful recovery checkpoint

Completed September 3, 2026:

- Added `printful-order-recovery.service.ts` as the cohesive boundary for artwork resolution,
  fulfillment eligibility, two-minute attempt leases, stale-attempt supersession, provider draft
  retry, retry result persistence, and recovery audit records.
- Moved `OrderRecoveryError` to its own stable module and re-exported it from `order.service.ts`, so
  controller error handling and existing imports retain the same runtime class identity.
- Moved Stripe session refund lookup into the Stripe adapter and reused it from both paid-checkout
  reconciliation and Printful recovery.
- Added characterization coverage proving active fulfillment attempts remain blocked while stale
  attempts are eligible for supersession.

`order.service.ts` moved from 1,337 to 958 lines, below the maintained-source target. The new
Printful recovery module is 406 lines, the recovery error module is 11 lines, and `stripe.service.ts`
is 234 lines. The order-domain extraction is now at a stable stopping point: checkout and webhook
orchestration remain together, while persistence and provider recovery have typed boundaries.

This checkpoint passed lint, 85 backend tests (82 passed and three database-only skips), the explicit
fixture smoke, typecheck, production build/static-route checks, the local multi-placement contract,
and the complete 11-viewport browser suite across five products. The next staged target is
`frontend/src/studio-view-model.ts` (1,696 lines), beginning with pure selectors and typed commands;
the 1,273-line Printful provider service remains a later transport/transformation split.

## Studio selector checkpoint

Completed September 3, 2026:

- Added `studio-view-model.selectors.ts` for product defaults, orientation, mockup cache identity,
  artwork assignment/readiness, checkout readiness, design allowance, placement payloads, and step
  state derivation.
- Added `studio-view-model.types.ts` and preserved the former type exports from
  `studio-view-model.ts`, so the workbench consumer contract did not change.
- Moved `ApiError` to a dependency-light module and re-exported it from the API service, preserving
  runtime class identity while allowing selector tests to run without booting browser configuration.
- Added a runnable selector contract covering same-as-front placement payloads, targeted placement
  customization, warning artwork, stale quote and email blockers, stable mockup cache keys, and
  provider-capacity error messaging.

`studio-view-model.ts` moved from 1,696 to 1,506 lines. It remains above the 1,000-line target because
React state/effect ownership and the product, artwork, mockup, quote, and checkout command clusters
are still colocated. The next safe bundle is the product/configuration command cluster (currently
beginning around line 571), expressed as pure state transitions or narrowly typed commands while the
hook retains React setters, request controllers, unsaved input, and persistence effects.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, lint, typecheck, production build/static-route checks, and
the complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.

## Studio configuration transition checkpoint

Completed September 3, 2026:

- Added `studio-configuration.transitions.ts` as the pure product/configuration boundary for
  remembered product options, available-variant fallback, wall-art orientation, placement toggles,
  last-placement protection, inherited artwork assignment, and same-as-front reuse.
- Kept React state ownership, analytics, request cancellation, quote invalidation, persistence, and
  mockup provider calls in `studio-view-model.ts`.
- Added characterization coverage for restored two-placement selections, unavailable remembered
  variants, portrait wall art, add/remove placement behavior, last-placement protection, and
  explicit front-to-back artwork reuse.

`studio-view-model.ts` moved from 1,506 to 1,489 lines; the transition module is 112 lines. The
parent remains above 1,000 lines because mockup orchestration, artwork upload/generation/revision,
quote creation, and checkout still share React-owned lifecycle state. The next safe extraction is
the artwork command cluster beginning with upload/reference handling. Mockup request lifecycle and
cache ownership should remain in the parent until that command boundary is stable; avoid replacing
it with a callback-heavy generic controller.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, lint, typecheck, production build/static-route checks, and
the complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.

## Studio artwork transition checkpoint

Completed September 3, 2026:

- Added `studio-artwork.transitions.ts` for the pure state rules shared by direct uploads,
  reference-led generation, new drafts, revisions, and undo.
- Centralized the five-reference cap, reference ID filtering, history deduplication, targeted
  placement assignment, revision replacement, undo restoration, and generated-draft acceptance.
- Documented the key multi-placement invariant next to the implementation: revising one artwork
  asset replaces only placements using that asset, so independent front/back artwork survives.
- Preserved functional React history updates after async requests; provider calls, progress phases,
  cancellation, analytics, error presentation, and mockup refreshes remain in the view model.

`studio-view-model.ts` moved from 1,489 to 1,473 lines; the new transition module is 97 lines. It
remains above 1,000 lines because the provider command lifecycles still coordinate multiple pieces
of React-owned state. The next safe studio extraction is typed mockup request preparation and
result interpretation, followed by a cohesive artwork command hook only if that boundary avoids a
large callback surface. After the studio hook is below 1,000 lines, move one workbench mode at a
time out of `WorkbenchStudioApp.tsx`.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, lint, typecheck, production build/static-route checks, and
the complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.

## Studio mockup boundary checkpoint

Completed September 3, 2026:

- Added `studio-mockup.ts` as the deterministic boundary for mockup request preparation, cache
  identity, and provider-result classification.
- Built the provider payload and cache key from the same normalized placement assignments. This
  prevents a cached preview from being reused after front/back artwork, mug layout, variant, or
  orientation changes.
- Kept request sequencing, stale-response suppression, cache storage, React state, error surfaces,
  and provider calls in `studio-view-model.ts`.
- Added contract coverage for distinct front/back IDs, session forwarding, blocked-artwork refusal,
  cache identity, fixture success classification, and live-provider failure messages.

`studio-view-model.ts` moved from 1,473 to 1,454 lines; `studio-mockup.ts` is 106 lines. The next
safe seam is quote request preparation and quote-result formatting. After the deterministic command
boundaries are extracted, reassess whether a cohesive controller hook can own request lifecycle
without requiring a large callback interface.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, lint, typecheck, production build/static-route checks, and
the complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.
