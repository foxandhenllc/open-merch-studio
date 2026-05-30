# OMS-031: Curated Launch Catalog Admin

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-04: Catalog And Printful Fulfillment  
**Critical path:** Yes

## Goal
Let operators choose a focused launch catalog instead of exposing the full provider catalog.

## User Value
Customers get a manageable, high-confidence set of products that are ready for design and fulfillment.

## Current State
The product direction calls for curated catalog sync, but admin curation is not yet implemented.

## Requirements
- Add admin controls for sellable status, featured status, launch category, display order, and margin rule assignment.
- Support hiding products with incomplete variants, placements, or mockup support.
- Record last reviewed timestamp and reviewer note for curated products.
- Keep public catalog APIs filtered to curated sellable products by default.

## Implementation Notes
- Build a lightweight admin curation surface or CLI-backed admin endpoint for v1.
- Separate provider availability from business sellable status.
- Use fixtures to demonstrate curation without live provider data.

## Interfaces/Data Changes
- Admin curation endpoints or protected admin UI.
- GET /api/catalog/products filters to curated sellable products.

## Acceptance Criteria
- Operators can mark products as launch-ready or hidden.
- Hidden products do not appear in the public storefront.
- Featured products appear in the intended order.
- Products missing placement support cannot be marked launch-ready without an explicit override.

## Test Plan
- Unit test public filtering.
- Integration test curation update.
- UI or API test featured ordering.

## Dependencies/Blockers
- OMS-030
- OMS-070.

## Source Anchors
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Admin surfaces must not be accessible to public users.

## Launch Risk Notes
Uncurated catalog exposure creates quality, pricing, and support problems.
