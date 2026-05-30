# OMS-014: Loading Empty And Error States

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-02: Storefront And Design Experience  
**Critical path:** Yes

## Goal
Make every customer-facing data state understandable and recoverable.

## User Value
Customers can continue shopping when catalog, design, quote, or checkout actions are slow or fail.

## Current State
The app has basic fetch behavior but does not yet have polished state handling across all flows.

## Requirements
- Add loading states for category, product, design draft, quote, cart, and checkout actions.
- Add empty states for no curated products, no variants, no placements, no saved designs, and empty cart.
- Add recoverable error states with retry actions where retry is valid.
- Avoid leaking provider error details to customers.

## Implementation Notes
- Create reusable state components or local patterns matching the current frontend style.
- Map API failures to customer-safe messages and console/debug details for developers.
- Keep fixture fallback messaging clear in local development.

## Interfaces/Data Changes
- May standardize frontend API error objects.
- No backend contract change unless current responses lack status codes.

## Acceptance Criteria
- Each main flow has visible loading, empty, and error states.
- Retry actions re-run the correct request without duplicating orders or charges.
- Customer-facing errors do not expose provider internals.
- Local fixture mode still communicates what is mocked.

## Test Plan
- Unit test API error normalization.
- UI test empty catalog and unavailable variant states.
- E2E test quote failure retry.

## Dependencies/Blockers
- OMS-010 through OMS-012.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Provider response details should be logged server-side or in dev-only surfaces, not shown to customers.

## Launch Risk Notes
Poor failure states make paid beta look unreliable even when failures are recoverable.
