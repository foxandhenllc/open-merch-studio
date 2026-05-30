# OMS-010: Shop Home And Category Experience

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-02: Storefront And Design Experience  
**Critical path:** Yes

## Goal
Replace the thin scaffold landing surface with a real shop entry point for curated merch categories.

## User Value
Customers can immediately browse what can be made, compare categories, and start designing without reading docs.

## Current State
The frontend renders a simple catalog and quote flow with static fallback data.

## Requirements
- Build a first-screen shop experience with category navigation, featured products, and design-start calls to action.
- Show launch categories: apparel, hats, drinkware, wall art, bags, stickers, phone cases, and stationery where supported.
- Use real product imagery or mockup placeholders that make product type obvious.
- Keep the interface product-neutral and avoid GPTees or shirt-only language.

## Implementation Notes
- Refactor the current home screen into shop, category, and studio entry sections.
- Use existing catalog API responses as the data source and static fallback only for unavailable backend states.
- Make category cards compact, scannable, and mobile-friendly.

## Interfaces/Data Changes
- Consumes GET /api/catalog/categories and GET /api/catalog/products.
- May add category hero metadata to fixture data.

## Acceptance Criteria
- The first viewport looks like a functioning merch shop, not a developer demo.
- Every launch category can be reached from the main shop flow.
- Category cards show product count, starting price when available, and design capability.
- The page remains usable with fixture data and with live API data.

## Test Plan
- Run frontend type-check.
- Run responsive UI checks at mobile and desktop widths.
- Verify categories load from API and fallback data.

## Dependencies/Blockers
- OMS-030 for live catalog depth; can start with fixtures.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not use private customer artwork or provider account screenshots as visual assets.

## Launch Risk Notes
A visually weak storefront will make the product feel like a toy even if the backend works.
