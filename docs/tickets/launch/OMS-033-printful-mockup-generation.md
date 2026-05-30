# OMS-033: Printful Mockup Generation

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-04: Catalog And Printful Fulfillment  
**Critical path:** Yes

## Goal
Generate product mockups from selected variants, placements, and artwork before checkout.

## User Value
Customers can see a credible preview of what they are buying.

## Current State
The project references Printful mockup generation, but production polling and UI states are not complete.

## Requirements
- Submit mockup tasks using synced product, variant, placement, and artwork data.
- Poll task status and store resulting mockup image references.
- Provide mock mockups in fixture mode.
- Show task progress and recoverable failures in the studio.

## Implementation Notes
- Add a mockup service with live and fixture providers.
- Store mockup request status, provider task ID when present, selected inputs, and result images.
- Separate rough AI preview from provider-backed product mockup.

## Interfaces/Data Changes
- May add POST /api/design/mockups and GET /api/design/mockups/:id.
- Order checkout reads selected mockup and artwork references.

## Acceptance Criteria
- A selected product and artwork can produce a mockup in fixture mode.
- Live provider requests are not attempted without configured credentials.
- Polling handles pending, complete, failed, and expired states.
- Checkout requires a current mockup or explicit operator-approved bypass.

## Test Plan
- Integration test fixture mockup flow.
- Unit test polling state transitions.
- E2E test studio to mockup to quote.

## Dependencies/Blockers
- OMS-032
- OMS-040
- OMS-044.

## Source Anchors
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Customer artwork should be stored and sent only for the requested fulfillment workflow.

## Launch Risk Notes
Mockup failures can block checkout if the fallback and retry path is not clear.
