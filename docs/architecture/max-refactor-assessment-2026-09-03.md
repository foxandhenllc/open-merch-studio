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

| Current concentration                      | Size at audit | Extraction target                                                                                              |
| ------------------------------------------ | ------------: | -------------------------------------------------------------------------------------------------------------- |
| `backend/src/services/order.service.ts`    |   2,274 lines | quote validation, Checkout orchestration, Stripe reconciliation, refund handling, fulfillment review, recovery |
| `frontend/src/studio-view-model.ts`        |   1,696 lines | state/selectors, design commands, product commands, quote/checkout commands, restoration                       |
| `backend/src/services/printful.service.ts` |   1,273 lines | client transport, catalog sync, mockups, draft orders, status mapping                                          |
| `frontend/src/WorkbenchStudioApp.tsx`      |   1,075 lines | one component per product/configure/create/review/checkout/order mode                                          |
| `backend/src/services/runtime-store.ts`    |     963 lines | fixture store and durable repository adapters                                                                  |
| `frontend/src/styles.css`                  |   3,776 lines | tokens/base, workbench, components, policy pages, example collection, responsive rules                         |
| `frontend/scripts/responsive-smoke.mjs`    |   1,274 lines | shared harness plus independent customer journeys                                                              |

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

## Studio quote boundary checkpoint

Completed September 3, 2026:

- Added `studio-quote.ts` for deterministic quote request construction and customer announcement
  formatting.
- Kept cancellation, request ordering, automatic refresh timing, analytics, and React state in the
  view model.
- Added contract coverage proving quote requests carry the same distinct front/back artwork IDs as
  mockup requests, along with stable automatic/manual price announcement copy.

`studio-view-model.ts` moved from 1,454 to 1,445 lines; `studio-quote.ts` is 51 lines. The next safe
seam is checkout request/result interpretation. After that extraction, reassess the accumulated
typed boundaries and move cohesive request lifecycle into hooks only where ownership is clear.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, lint, typecheck, production build/static-route checks, and
the complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.

## Studio checkout boundary checkpoint

Completed September 3, 2026:

- Added `studio-checkout.ts` for typed checkout request construction, unavailable/not-ready error
  presentation, and deterministic provider-result classification.
- Made the four checkout outcomes explicit: secure redirect, inline confirmation, durable order
  lookup, and pending provider state. This keeps fixture and live responses on one documented
  interpretation path without moving browser redirects or payment state into a generic helper.
- Kept Stripe authorization, provider calls, analytics, redirect control, order lookup, and React
  state sequencing in `studio-view-model.ts`.
- Added contract coverage for policy/session/artwork request fields, Stripe redirect priority,
  inline confirmation, order lookup, closed-checkout presentation, and safe retry messaging that
  tells customers not to submit payment twice.

`studio-view-model.ts` moved from 1,445 to 1,428 lines; `studio-checkout.ts` is 88 lines. The next
decision is no longer another small pure-function extraction: reassess the accumulated boundaries
as a group and identify a cohesive request lifecycle hook whose ownership reduces the parent
without exporting a large callback surface.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, lint, typecheck, production build/static-route checks, and
the complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.

## Checkout mode component checkpoint

Completed September 3, 2026:

- Added `components/CheckoutPanel.tsx` with an adjacent public prop contract. The component owns
  only its form-local touched, submitted, and policy-assent state; quote, readiness, payment, and
  order state remain in the studio view model.
- Moved the reusable customer error presentation into `components/ErrorNote.tsx` so checkout and
  the remaining modes share one recovery treatment.
- Preserved the checkout DOM labels, readiness message IDs, legal links, policy version, retry
  guard, and button behavior exercised by the responsive browser suite.
- Repaired the production dependency override shape discovered by hosted CI: `qs` is now a global
  transitive override, which npm 10 recognizes as a valid package tree while retaining 6.16.0 and
  a zero-vulnerability production audit.

`WorkbenchStudioApp.tsx` moved from 1,094 to 974 lines, below the maintained-source target. The
checkout component is 130 lines, its prop contract is 25 lines, and the shared error note is 16
lines. Continue the UI-mode sequence one cohesive mode at a time; do not combine those extractions
with cart, quantity, or reorder product work.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, npm 10 production audit, lint, typecheck, production
build/static-route checks, and the complete 11-viewport browser suite across five products plus
upload/reference and recoverable checkout flows.

## Configuration mode component checkpoint

Completed September 3, 2026:

- Added `components/ConfigurationPanel.tsx` with an adjacent typed prop contract for variants,
  multi-print placement selection, mug positioning, wall-art orientation, and continuation.
- Kept all selection transitions, remembered configuration, quote invalidation, artwork assignment,
  analytics, and persistence in the studio view model.
- Centralized currency display in `utils/currency.ts`, removing duplicated presentation formatting
  while preserving the existing locale, currency, and cent conversion.
- Preserved the quoted additional-print price preference and its fallback estimate copy, with the
  same buttons and accessible pressed states exercised by the customer browser journeys.

`WorkbenchStudioApp.tsx` moved from 974 to 878 lines. The configuration component is 123 lines,
its prop contract is 22 lines, and the currency formatter is three lines. The next cohesive UI seam
is the artwork-source/description mode, whose file selection, preview URL, rights assent, and
reference inputs can move together without moving provider commands.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, lint, typecheck, production build/static-route checks, and
the complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.

## Artwork-source mode component checkpoint

Completed September 3, 2026:

- Added `components/ArtworkSourcePanel.tsx` with an adjacent typed prop contract for generated,
  uploaded, and reference-led artwork entry.
- Kept the selected upload, object-URL preview lifecycle, reproduction-rights assent, background
  option, and reference-rights assent in the mounted workbench so navigating between modes does
  not shorten their existing lifetime.
- Kept upload, reference, and generation provider commands in the studio view model; the component
  receives intent callbacks and owns no network or persistence behavior.
- Preserved prompt focus handoff, upload and reference input constraints, retry behavior, customer
  copy, and accessible pressed and disabled states.
- Repaired the generation-error modifier spacing while moving the panel, so the documented error
  treatment is now applied as a separate CSS class instead of being concatenated to `panel-stack`.

`WorkbenchStudioApp.tsx` moved from 878 to 714 lines. The artwork-source component is 210 lines and
its prop contract is 35 lines. Continue with the review mode only as a presentation extraction;
placement reuse, revision commands, mockup and quote sequencing, and design history remain view-model
responsibilities until a later controller-hook checkpoint has a smaller, cohesive ownership surface.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, lint, typecheck, production build/static-route checks, and the complete 11-viewport
browser suite across five products plus upload/reference and recoverable checkout flows.

## Print-area review component checkpoint

Completed September 3, 2026:

- Added `components/PrintAreaReview.tsx` with an adjacent typed prop contract for selected print
  areas, their artwork assignments, production-price details, and mug positioning.
- Moved presentation-only derivation of primary artwork, same-versus-different artwork labels, and
  the separate-artwork note out of the workbench shell.
- Kept placement selection, artwork reuse, customization, quote invalidation, persistence, and
  provider operations in the studio view model behind explicit intent callbacks.
- Preserved the exact `Use same as …` action exercised by the multi-placement browser journey, so
  its visible success state still comes from the updated placement-artwork assignment rather than
  component-local optimism.

`WorkbenchStudioApp.tsx` moved from 714 to 613 lines. The print-area review component is 124 lines
and its prop contract is 19 lines. The remaining review shell can now be assessed separately from
multi-placement assignment; prefer a compact review-summary component before considering a broad
controller hook.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, lint, typecheck, production build/static-route checks, and
the complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.

## Review mode component checkpoint

Completed September 3, 2026:

- Added `components/ReviewPanel.tsx` with grouped typed status, design-option, and action contracts
  instead of a flat callback list.
- Composed the isolated print-area review with readiness, price, checkout handoff, and artwork
  refinement presentation in one mode-level component.
- Kept review-settling derivation, quote and mockup lifecycle, checkout authorization, revision and
  history mutation, analytics, and mode transitions in the studio view model and workbench shell.
- Documented in code that the checkout button is a presentation guard only; server authorization
  and fresh-artwork validation remain the security boundary.

`WorkbenchStudioApp.tsx` moved from 613 to 538 lines. The review component is 140 lines and its
grouped prop contract is 55 lines. The main workbench is now a readable composition root for its
mode panels; further UI extraction should target only genuinely reusable shell elements, while the
next high-value reassessment returns to cohesive view-model lifecycle ownership.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, the explicit fixture smoke, lint, typecheck, production build/static-route checks, and
the complete 11-viewport browser suite across five products plus upload/reference and recoverable
checkout flows.

## Production dependency audit checkpoint

Completed September 3, 2026:

- Added `scripts/audit-production-lock.mjs` and the documented `npm run audit:production` command.
  It inventories non-development package versions directly from the committed lockfile and queries
  OSV's batch API, avoiding npm's retiring quick-audit endpoint and its intermittent invalid-tree
  responses for this otherwise reproducible workspace install.
- The script validates complete result coverage, rejects unexpected pagination, retries bounded
  transport failures, fetches each applicable vulnerability record, and fails closed for high,
  critical, or unclassified advisories.
- Updated CI, README, contribution guidance, deployment steps, and the paid-launch runbook to use
  the same developer-visible command. Vercel continues to install exclusively with `npm ci`.

The replacement audit inspected 150 production package versions and found no applicable OSV
advisories. This gate supplements the clean install and application test matrix; it does not make
dependency installation permissive or convert advisory-service failure into success.

## Checkout-return controller checkpoint

Completed September 3, 2026:

- Added `hooks/useCheckoutReturn.ts` to own Stripe return URL cleanup, pending-session recovery,
  bounded order reconciliation polling, retry/dismiss state, and checkout-return analytics.
- Added `checkout-return.ts` as the pure parsing boundary and characterized successful, cancelled,
  resumed, and unrelated-query-parameter behavior.
- Kept the signed Stripe webhook authoritative: the hook only asks the existing customer-safe order
  endpoint for reconciled state and never fulfills from the browser redirect.
- Preserved the exact no-double-payment timeout message and session-storage fallback behavior.

`WorkbenchStudioApp.tsx` moved from 538 to 426 lines. The checkout-return hook is 123 lines and the
pure URL boundary is 33 lines. This completes the high-value workbench lifecycle extraction before
quantity work; quantity must land as a separate feature because it changes quote and checkout data.

This checkpoint passed 85 backend tests (82 passed and three database-only skips), both frontend
contracts, lint, typecheck, production build/static-route checks, and the complete 11-viewport
browser suite across five products plus upload/reference and recoverable checkout flows.

## Quantity product checkpoint

Completed September 3, 2026 as product work after the behavior-preserving refactor checkpoints:

- Added a 1–25 quantity control to product review and made every change invalidate checkout and
  request a fresh server-authoritative quote.
- Persisted quantity in guest recovery state and rejected restored quotes whose line quantity does
  not match the recovered selection.
- Added the same integer boundary to the quote service and API controller, so direct requests cannot
  bypass the customer control or create unexpectedly large charges.
- Kept the completed product review visible during quantity-only repricing, while hiding the stale
  total and disabling checkout until the replacement quote arrives.
- Added pure request/normalization coverage, server validation coverage, and a browser assertion
  that verifies the actual quote payload and visibly updated total on a phone viewport.

The backend quote, order, Printful payload, fixture fulfillment, and customer-email models already
carry line quantities. The next product checkpoint is a guest cart that submits multiple configured
quote items without weakening artwork ownership or quote freshness checks. Itemized Stripe display
should follow that cart boundary rather than be folded into it.

This checkpoint passed lint, typecheck, 86 backend tests (83 passed and three database-only skips),
both frontend contracts, the explicit fixture smoke, production build/static-route verification,
the production dependency audit, and the complete 11-viewport browser suite.

## Guest cart product checkpoint

Completed September 3, 2026:

- Added an isolated guest-cart hook and pure cart module instead of expanding the active-design
  state machine with a second set of quote lifecycle rules.
- Captured each configured product as an immutable quote input, including exact per-placement
  artwork IDs, variant, orientation, layout, and quantity.
- Added session-bound browser persistence, per-line quantity updates/removal, a combined fresh quote,
  a responsive cart panel, and a compact always-visible cart count.
- Added matching browser and server limits of ten configured lines and retained the existing 1–25
  quantity boundary for every line.
- Kept fixture checkout available for no-charge testing while preserving the existing server-side
  production checkout authorization boundary.
- Proved two different products and quantities through combined request payload, reload recovery,
  customer checkout, fixture fulfillment, order-summary quantities, and post-confirmation clearing.

The guest cart is intentionally not an account or durable product library. Its saved inputs belong
to one design session and remain in that browser. Durable owner products and mini-store collections
require organization ownership, access control, and immutable design versions rather than reusing
this local-storage boundary.

This checkpoint passed lint, typecheck, 87 backend tests (84 passed and three database-only skips),
both frontend contracts, production build/static-route verification, and the complete 11-viewport
browser suite plus the two-product cart and no-charge checkout journey.

## Itemized Stripe checkout checkpoint

Completed September 3, 2026:

- Replaced the one-line aggregate Stripe presentation for merchandise with one extended line per
  configured cart product, including the selected quantity, variant, and print-area codes.
- Kept the saved OMS quote authoritative by reconciling estimated shipping and checkout services as
  a separate positive line and allocating Studio Pass credits across merchandise lines.
- Kept Stripe metadata, order identity, success/cancel returns, automatic tax, US shipping-address
  collection, card-only payment, and idempotent session creation unchanged.
- Added an exact-cent contract for multi-product carts and credited orders; Stripe never receives a
  negative line item.

This checkpoint passed lint, typecheck, 88 backend tests (85 passed and three database-only skips),
both frontend contracts, production build/static-route verification, and the complete browser suite.

## Themed mini-store foundation checkpoint

Completed September 3, 2026:

- Added organization and future verified-member ownership, brand profiles, reusable saved designs,
  immutable design versions, saved product configurations, ordered collections, and storefront
  publication state to Prisma with a committed migration.
- Enabled RLS without public Data API policies for all nine new tables. Protected mutations remain
  behind the existing admin boundary until verified owner authentication is implemented.
- Added protected bootstrap, quote-to-product, and publication operations. Saving resolves the
  durable quote and artwork again, creates an immutable provenance version, and requires policy-pass,
  print-ready artwork. Publishing fails closed on catalog, variant, product, or artwork drift.
- Added a customer-safe public DTO that omits private artwork IDs, quote IDs, storage paths, and
  provider payloads, plus a read-only responsive hosted route.
- Published the owned Fox & Hen fixture/reference route at
  `/stores/fox-and-hen/one-clear-system`, using five existing verified mockup assets and the required
  “Web + Workflow Studio” descriptor.
- Added canonical/social metadata, sitemap coverage, dynamic-store routing, slug/path contracts, and
  phone/desktop browser assertions for product count, image loading, and horizontal overflow.

This is a read-only mini-store milestone, not per-organization commerce. Database migration,
operator-created production records, authenticated owner administration, Printful drift
reconciliation, and an organization-specific launch review remain explicit gates.

This checkpoint passed lint, typecheck, 90 backend tests (87 passed and three database-only skips),
both frontend contracts, production build/static-route verification for eight canonical routes, and
the complete browser suite including phone and desktop mini-store QA.

## Printful transport and mockup checkpoint

Completed September 4, 2026:

- Added `printful-client.service.ts` as the shared authenticated transport boundary for provider
  credentials, store scoping, response-envelope normalization, public artwork URL validation, and
  operator-safe error descriptions.
- Added `printful-mockup.service.ts` for printfile lookup, placement-aware file positioning, mockup
  task creation and bounded polling, provider view normalization, and mug front-view preference.
- Kept `printful.service.ts` as the stable public facade so existing controllers, services, and
  tests retain their import paths while catalog sync, pricing, and draft-order responsibilities
  remain unchanged.
- Documented only the non-obvious invariants: one transport configuration across provider domains,
  no loopback artwork URLs, uncropped square placement fitting, bounded polling, and customer-safe
  view ranking.

`printful.service.ts` moved from 1,273 to 943 lines. The new transport module is 59 lines and the
mockup module is 315 lines. The next behavior-preserving Printful seam is the order payload and
draft-submission domain; after that, catalog pricing and sync can leave the facade. The studio view
model remains a separate high-priority target at 1,570 lines and should receive a cohesive lifecycle
hook rather than another series of tiny pure helpers.

This checkpoint passed lint, typecheck, all 90 backend tests (87 passed and three database-only
skips), both frontend contracts, the explicit fixture smoke, the production dependency audit,
production build/static-route verification, and the complete 11-viewport browser suite.

## Printful order domain checkpoint

Completed September 4, 2026:

- Added `printful-order.service.ts` for recipient normalization, strict quote-to-provider payload
  validation, multi-placement artwork mapping, draft creation, external-ID recovery, provider status
  mapping, and response-body-free failure classification.
- Preserved the review-first production boundary: the public submit function still requires all
  live fulfillment gates and refuses to run when `PRINTFUL_AUTO_CONFIRM_ORDERS=true`.
- Preserved the duplicate-prevention invariant after ambiguous provider failures by looking up the
  immutable OMS order number again before any retry can create another Printful draft.
- Re-exported the full existing order API from `printful.service.ts`, so no controller, service, or
  test import changed during this structural pass.

`printful.service.ts` moved from 943 to 605 lines. The new order domain is 356 lines. Catalog pricing
and synchronization are now the only substantial responsibilities left in the facade; they should
move together only after their database/provider boundary is characterized. The remaining larger
customer-facing target is still `studio-view-model.ts` at 1,570 lines.

This checkpoint passed lint, typecheck, all 90 backend tests (87 passed and three database-only
skips), both frontend contracts, the explicit fixture smoke, production build/static-route
verification, and the complete 11-viewport browser suite.

## Printful pricing checkpoint

Completed September 4, 2026:

- Added `printful-pricing.service.ts` for live variant/technique pricing, placement-cost mapping,
  cents normalization, and the bounded in-process provider cache.
- Changed the catalog and quote services to import the pricing boundary directly, eliminating their
  dependency on the mixed Printful facade while retaining the facade re-export for compatibility.
- Documented why the cache is deliberately short-lived: it prevents duplicate provider calls during
  one quote lifecycle without turning a current-price estimate into a durable catalog fact.

The pricing module is 88 lines and `printful.service.ts` moved from 605 to 525 lines. The remaining
facade implementation is catalog synchronization; extracting it will leave `printful.service.ts` as
a compatibility index over the client, pricing, catalog, mockup, and order domains.

This checkpoint passed lint, typecheck, all 90 backend tests (87 passed and three database-only
skips), both frontend contracts, the explicit fixture smoke, production build/static-route
verification, and the complete 11-viewport browser suite.

## Printful catalog synchronization checkpoint

Completed September 4, 2026:

- Added `printful-catalog-sync.service.ts` for paginated provider catalog reads, deliberate launch
  curation, product/variant/placement persistence, price snapshots, fixture seeding, and sync-run
  success/failure bookkeeping.
- Reduced `printful.service.ts` to a documented compatibility facade. Existing consumers keep the
  historical import path, while new domain code can import a focused Printful service directly.
- Preserved the important curation boundary: a provider sync cannot silently make the full Printful
  catalog sellable, and fixture sync remains explicit rather than masquerading as a live provider.

The catalog synchronization module is 500 lines and the stable facade is 31 lines. No maintained
Printful source file exceeds 500 lines after this stage. The provider split is complete enough to
stop; further fragmentation would separate tightly coupled database mutations without reducing a
real responsibility. The next high-leverage target returns to the 1,570-line studio view model.

This checkpoint passed lint, typecheck, all 90 backend tests (87 passed and three database-only
skips), both frontend contracts, the explicit fixture smoke, the production dependency audit,
production build/static-route verification, and the complete 11-viewport browser suite.

## Studio mockup lifecycle checkpoint

Completed September 4, 2026:

- Added `useStudioMockup.ts` as the owner of provider preview state, request sequencing, cache
  identity, stale-preview presentation, surface errors, progress state, and active provider view.
- Kept product configuration and quote/checkout transitions in the parent studio model. The hook
  receives those decisions as explicit callbacks instead of acquiring unrelated workflow state.
- Preserved the multi-print invariant by continuing to derive both the provider payload and the
  cache key from normalized per-placement artwork assignments.
- Preserved stale-response protection: a slow preview can no longer become current after a newer
  placement request, while the last successful preview remains visible and marked stale.
- Exposed a narrow cache insertion seam so guest-session restoration can reuse a validated saved
  mockup without reaching into hook internals.

`studio-view-model.ts` moved from 1,570 to 1,510 lines. The new 149-line hook is a cohesive lifecycle
boundary rather than a generic state abstraction. Quote request cancellation and quote freshness
are the next comparable frontend lifecycle seam; artwork generation should remain separate because
its polling, allowance, and revision rules have a different failure model.

This checkpoint passed lint, typecheck, all 90 backend tests (87 passed and three database-only
skips), both frontend contracts, production build/static-route verification, and the complete
11-viewport browser suite across five products, uploads, reference artwork, persisted failures, and
the recoverable fixture checkout flow.
