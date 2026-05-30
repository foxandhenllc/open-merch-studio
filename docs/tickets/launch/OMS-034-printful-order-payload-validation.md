# OMS-034: Printful Order Payload Validation

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-04: Catalog And Printful Fulfillment  
**Critical path:** Yes

## Goal
Generate and validate Printful order payloads from synced catalog data instead of category-specific conditionals.

## User Value
Orders are less likely to fail after payment because fulfillment data is checked before submission.

## Current State
The backend has a Printful order-payload helper, but it needs broader validation for paid beta.

## Requirements
- Build payloads from catalogProductId, catalogVariantId, placement IDs, artwork asset IDs, options, and recipient data.
- Validate that selected variant, placement, print technique, and artwork are compatible.
- Block order creation if price snapshot or availability is stale beyond configured tolerance.
- Keep provider payload details auditable for operators without exposing them to customers.

## Implementation Notes
- Add a validation layer before checkout confirmation and before fulfillment submission.
- Use normalized catalog data as the source of truth.
- Store validation results with the order record for support and debugging.

## Interfaces/Data Changes
- Order creation service consumes quoteId and validated fulfillment inputs.
- Admin order details can show validation state.

## Acceptance Criteria
- Invalid variant-placement combinations cannot create fulfillment payloads.
- Stale price or availability prompts re-quote before payment.
- A valid fixture order produces deterministic payload JSON.
- Validation errors are customer-safe and actionable.

## Test Plan
- Unit test payload builder by product category.
- Integration test invalid placement rejection.
- Snapshot test fixture payload output.

## Dependencies/Blockers
- OMS-030
- OMS-032
- OMS-052.

## Source Anchors
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Do not store full customer recipient details in public fixtures or docs.

## Launch Risk Notes
Payload errors after payment create refunds, support load, and trust damage.
