# OMS-096: Guided Workbench Layout And Navigation

**Status:** Implemented for MVP (2026-07-12)
**Priority:** P1  
**MVP timing:** Same milestone as paid-beta polish  
**Visibility:** Public  
**Critical path:** Yes

## Goal

Keep the current product-preview-first visual language while making the next action visible, singular, and reachable on common laptop viewports.

## User Value

Customers can understand where they are, what changed, and what to do next without scanning a long page or fighting decorative navigation.

## Confirmed Current Failure

- At 1024–1439px the workbench reserves a 320px right column before a ledger exists.
- The stock preview consumes the first laptop viewport; prompt and actions begin below it.
- Product and Price step anchors point to hidden/off-canvas elements on desktop.
- Desktop keeps regeneration primary after a draft while pricing—the actual next action—is secondary.
- Automatic heading focus changes scroll position after generation/mockup transitions.
- Post-draft readiness, allowance, revision, quote, and session metadata have nearly equal weight.

## Requirements

### Responsive layout

- Without a ledger, use one workspace column from 1024–1439px; add the 320px ledger only when `has-ledger` is present.
- At laptop widths, place a compact composer beside or over the lower portion of the preview, or reduce the preview so the primary action is visible without scrolling.
- Preserve the full contained mockup image and multi-view rail.

### Real progress navigation

- Product step opens the catalog drawer when the catalog is off-canvas.
- Make step focuses the composer without unexpected motion.
- Price step opens/focuses the ledger on desktop and the summary sheet on mobile.
- Order step focuses checkout only when quote/artwork prerequisites are valid.
- Keep descriptive labels available visually and to assistive technology at every breakpoint.

### One next action

- Derive one primary CTA from state: select product → generate → review/price → checkout.
- Move regeneration/refinement/revision into secondary actions after a draft exists.
- Add the same guided CTA logic to desktop that currently exists in the mobile action bar.
- Do not silently spend a draft from a persistent primary action.

### Hierarchy

- Remove the raw session ID from the customer surface; expose it only through support details or a copyable help disclosure.
- Collapse passing readiness details by default and keep blockers expanded.
- Group allowance and revision into one secondary `Refine` area.
- Keep quote/checkout visually separate as the conversion step.

## Acceptance Criteria

- At 1365 × 768 with no quote, no empty right rail is visible and the current primary CTA appears in the first viewport.
- Every enabled progress step produces an observable navigation/open action.
- After a draft, `Review price` or `Continue` is primary; `Generate another` is secondary and allowance-aware.
- Focus changes do not override a user's manual scroll position.
- Passing checks can be reviewed without dominating the page.
- Session IDs do not appear in the default customer view.

## Test Plan

- Screenshot regression at 1024, 1280, 1365, 1440, and 1600px.
- E2E step navigation at pre-product, drafted, quoted, and stale-quote states.
- Keyboard test through progress rail and primary CTA.
- Reduced-motion test for step navigation and focus behavior.

## Source Anchors

- `frontend/src/App.tsx`
- `frontend/src/studio-view-model.ts`
- `frontend/src/components/StepRail.tsx`
- `frontend/src/styles.css`
- [Audit evidence](../../audits/2026-07-12-designer-claims/README.md)

## Dependencies And Risks

- Coordinate with OMS-097 if Price is collapsed into checkout.
- Preserve the product-selection and mockup caches added for provider latency.

## Implementation Notes

- The laptop workbench no longer reserves an empty ledger rail; the compact composer and contained preview share the available canvas until pricing is opened.
- Progress controls now open or focus their real destination, retain visible accessible labels, and avoid automatic smooth-scroll focus changes.
- Primary actions advance with the journey—generate, review price, then checkout—while regeneration and revision remain allowance-aware secondary actions.
- Passing readiness checks, refinement controls, and the support session reference use progressive disclosure.
