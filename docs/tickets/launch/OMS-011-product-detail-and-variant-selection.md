# OMS-011: Product Detail And Variant Selection

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-02: Storefront And Design Experience  
**Critical path:** Yes

## Goal
Create product detail pages that let customers select sellable variants before entering the studio.

## User Value
Customers understand sizes, colors, placements, and price implications before investing design effort.

## Current State
The app exposes product data but does not yet provide a robust product detail flow.

## Requirements
- Show product title, category, description, variant options, placement support, price range, and availability state.
- Support variant selection by size, color, material, or provider-specific option groups.
- Disable unavailable combinations with clear copy.
- Persist selected product and variant into the design studio and quote flow.

## Implementation Notes
- Add product-detail routing or stateful selection inside the catalog view.
- Normalize variant option display from catalog variant data instead of hardcoding apparel assumptions.
- Show placement support before users generate or upload artwork.

## Interfaces/Data Changes
- Consumes GET /api/catalog/products/:slug.
- Passes catalogProductId, catalogVariantId, and selected placement into quote and design flows.

## Acceptance Criteria
- A customer can choose a specific sellable variant before design generation.
- Unavailable variants cannot be added to a quote.
- Placement options reflect the selected product data.
- The selected product state survives moving into the studio.

## Test Plan
- Unit test variant option grouping.
- UI test unavailable variant disabling.
- E2E test product to studio handoff.

## Dependencies/Blockers
- OMS-032.

## Source Anchors
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Do not show provider data fields that are not useful to customers.

## Launch Risk Notes
Wrong variant selection can create fulfillment failures and customer disappointment.
