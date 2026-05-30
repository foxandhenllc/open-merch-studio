# OMS-032: Placement And Mockup Normalization

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-04: Catalog And Printful Fulfillment  
**Critical path:** Yes

## Goal
Normalize product placements and mockup options so the studio can work across categories.

## User Value
Customers can design the right area of each product, not just a generic shirt front.

## Current State
The data model includes placements and mockup styles, but the frontend flow does not yet fully depend on them.

## Requirements
- Represent placement name, print area dimensions, technique, required file format, and availability per variant.
- Group mockup styles by product, placement, and variant compatibility.
- Expose placement support to storefront and studio flows.
- Handle products with multiple placements and products with only one supported placement.

## Implementation Notes
- Add normalization helpers that translate provider placement data into product-neutral local records.
- Update frontend selectors to consume local placement records.
- Keep unsupported placement states visible but disabled when helpful.

## Interfaces/Data Changes
- Catalog product detail API includes placements and compatible mockup styles.
- Quote and order payloads require selected placement IDs.

## Acceptance Criteria
- Placement options are product-specific and variant-aware.
- The studio cannot request a mockup for an unsupported placement.
- Order payload generation uses normalized placement IDs.
- Fixture products cover single-placement and multi-placement cases.

## Test Plan
- Unit test placement normalization.
- UI test placement selector states.
- Integration test quote requires placement.

## Dependencies/Blockers
- OMS-030.

## Source Anchors
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Do not assume apparel-only placements such as front and back.

## Launch Risk Notes
Placement mistakes can make generated artwork unusable for fulfillment.
