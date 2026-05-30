# OMS-012: Design Studio Flow

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-02: Storefront And Design Experience  
**Critical path:** Yes

## Goal
Build a guided studio flow that starts from product, placement, and design intent before generation or upload.

## User Value
Customers know what to do next and can get from idea to purchasable mockup without expert print knowledge.

## Current State
The current studio is a simple demo form that can request a mock design draft.

## Requirements
- Order the flow as product selection, placement selection, idea/upload, rough preview, quote, finalization, checkout.
- Support both generated artwork and uploaded artwork paths.
- Show design readiness checks before customers pay for final production.
- Keep copy concise and avoid technical model language in the customer flow.

## Implementation Notes
- Refactor studio state into explicit steps with resumable state.
- Keep mock/local provider behavior available when OpenAI credentials are absent.
- Record design draft references for later quote and checkout use.

## Interfaces/Data Changes
- Uses POST /api/design/drafts.
- Uses POST /api/catalog/quotes.
- May introduce client-side studio session state.

## Acceptance Criteria
- A user can complete a design path without reading setup docs.
- Generated and uploaded paths both reach quote creation.
- The UI explains when a design is rough versus print-ready.
- The studio blocks checkout when required product, variant, placement, or artwork data is missing.

## Test Plan
- E2E test generated design flow.
- E2E test upload flow with fixture image.
- Accessibility check for step controls and form labels.

## Dependencies/Blockers
- OMS-011
- OMS-040
- OMS-044.

## Source Anchors
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Do not send customer uploads to live providers unless the customer explicitly starts a provider-backed action.

## Launch Risk Notes
If the studio feels confusing, the pricing model will not matter because customers will abandon before checkout.
