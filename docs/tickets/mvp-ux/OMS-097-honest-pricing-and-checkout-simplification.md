# OMS-097: Honest Pricing And Checkout Simplification

**Status:** Implemented for MVP (2026-07-12)
**Priority:** P1  
**MVP timing:** Minimum pricing changes before external paid beta; auto-quote in the same MVP milestone  
**Visibility:** Public  
**Critical path:** Yes  
**Extends:** OMS-024, OMS-052, OMS-053, OMS-054

## Goal

Set an honest price expectation early, remove avoidable quoting friction, and show one authoritative checkout state.

## User Value

Customers understand the likely all-in price before investing in generation, see a plain-English breakdown, and never receive contradictory readiness and checkout signals.

## Confirmed Current Failure

- Catalog and variant controls anchor the tee at $11.69, but the first full total is $25.65.
- The customer must manually calculate a deterministic quote.
- Ledger labels expose internal accounting language.
- A blocked placeholder can display a valid-looking quote, email field, and checkout section even though backend checkout will reject it.
- Studio Pass order-credit value appears only after the allowance wall.

## Requirements

### Early retail estimate

- Show a customer-facing `from` retail estimate in catalog rows, product selection, and variant controls.
- Keep provider base cost out of the primary anchor; expose it only inside the optional transparency breakdown.
- Recalculate the displayed estimate when variant, orientation, or placement changes.
- Label shipping, tax, and payment values as estimates where they can change.

### Automatic quote

- Create/update a quote after a valid product, variant, placement, and ready artwork are present.
- Debounce variant/placement changes and cancel stale quote requests.
- Remove `Calculate price` as a required customer action.
- Keep an explicit `Refresh estimate` only for failure/expiry recovery.

### Customer-language ledger

- Rename visible lines:
  - `Product and fulfillment base` → `Product & printing`
  - `Design readiness allocation` → `Design work`
  - `Studio margin` → `Open Merch Studio margin`
  - `Shipping estimate` → `Estimated shipping`
  - `Payment fee estimate` → `Card processing estimate`
- Add one sentence explaining the cost-plus promise and why estimates can change.
- Keep internal line codes unchanged for accounting and analytics.

### Unified checkout gate

- Derive one checkout-readiness object covering artwork validity, quote freshness, email validity, payment availability, and fulfillment review state.
- Show one blocker message adjacent to the primary checkout CTA.
- Hide/disable email and payment actions when artwork is invalid.
- Keep server-side validation authoritative.

### Studio Pass value

- Explain before the wall that the $5 pass includes a $5 eligible order credit.
- Show the credit in the running total once applied.
- Avoid implying every pass purchase is refundable or universally applicable; preserve eligibility language.

## Acceptance Criteria

- A customer sees a realistic estimated total before generating artwork.
- Changing an eligible variant updates the estimate without a manual quote button.
- Price breakdown uses plain-language labels while preserving exact cents and estimate flags.
- Invalid artwork cannot show an actionable checkout form.
- Quote-stale, quote-expired, payment-unavailable, and artwork-blocked states use one consistent message/CTA location.
- Studio Pass credit is understandable before purchase and visibly applied afterward.

## Test Plan

- Unit test retail estimate and cost-line label mapping.
- Frontend test debounced auto-quote and stale-response cancellation.
- E2E test catalog estimate → variant estimate → final checkout total.
- E2E test invalid design never exposes an actionable Stripe redirect.
- Copy review for shipping/tax/card-fee estimates and Studio Pass eligibility.

## Source Anchors

- `backend/src/services/pricing.service.ts`
- `backend/src/services/catalog.service.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/QuoteLedger.tsx`
- `frontend/src/components/CatalogPanel.tsx`
- [Audit evidence](../../audits/2026-07-12-designer-claims/README.md)

## Dependencies And Risks

- Do not make the early estimate look guaranteed; shipping/tax remain provider/address dependent.
- Automatic quote creation must not bypass artwork/readiness validation or increase provider calls unnecessarily.

## Implementation Notes

- Catalog rows and selected variants show a realistic estimated retail total before generation while retaining estimate language.
- Ready artwork triggers a debounced, cancellable automatic quote; variant changes invalidate stale requests without requiring a manual calculate action.
- The visible ledger uses customer-language labels and explains the cost-plus estimate while preserving internal accounting codes.
- Checkout derives one readiness gate from artwork, quote, email, payment availability, and manual fulfillment review, with one adjacent blocker.
- The former Price step and ledger drawer are collapsed into one responsive checkout section containing the automatic estimate, breakdown, email, and Stripe action.
- Studio Pass is hidden from the MVP customer journey while its backend support remains dormant. Beta guests receive three drafts within the existing per-session and daily AI spend caps.
