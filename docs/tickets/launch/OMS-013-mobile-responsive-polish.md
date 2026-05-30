# OMS-013: Mobile Responsive Polish

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-02: Storefront And Design Experience  
**Critical path:** Yes

## Goal
Make the shopping, design, cart, and checkout path feel intentional on phone-sized screens.

## User Value
Customers can design and purchase from mobile without layout breaks or hidden controls.

## Current State
The scaffold is responsive enough to render, but not yet tuned for a commerce-grade mobile journey.

## Requirements
- Define mobile layouts for catalog, product detail, studio steps, quote summary, cart, and order confirmation.
- Keep primary actions visible without overlapping content.
- Ensure design previews have stable aspect ratios and do not shift layout when loading.
- Use touch-friendly controls for variant and placement selection.

## Implementation Notes
- Audit current components at 390px, 430px, 768px, 1280px, and 1440px widths.
- Add responsive constraints for cards, previews, toolbars, and quote panels.
- Prefer stacked mobile flows over squeezing desktop panels into small screens.

## Interfaces/Data Changes
- No API changes. Frontend layout and component behavior only.

## Acceptance Criteria
- No text or controls overlap on target viewport widths.
- Primary checkout and design actions remain reachable on mobile.
- Product and design previews keep stable dimensions while data loads.
- Mobile screenshots show a shop-quality experience.

## Test Plan
- Run Playwright or equivalent screenshot checks.
- Check overflow with responsive QA tooling.
- Manually inspect main flows on mobile and desktop widths.

## Dependencies/Blockers
- OMS-010
- OMS-011
- OMS-012.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not hide material pricing or fulfillment information on smaller screens.

## Launch Risk Notes
Mobile issues directly reduce purchase conversion and trust.
