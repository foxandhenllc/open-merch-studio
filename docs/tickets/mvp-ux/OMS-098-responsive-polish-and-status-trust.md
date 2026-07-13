# OMS-098: Responsive Polish And Provider-Status Trust

**Status:** MVP trust/accessibility subset implemented (2026-07-12)
**Priority:** P2, with trust/accessibility subset promoted to P1  
**MVP timing:** Trust/accessibility fixes in MVP; richer selectors after payment QA  
**Visibility:** Public  
**Critical path:** Partial

## Goal

Remove misleading system status, clipped mobile controls, and shopper-facing implementation details without expanding the five-product MVP scope.

## User Value

Customers can see every important control/status at narrow widths and can trust that live/fixture labels describe the actual configured path.

## Confirmed Current Failure

- Provider badges default to `FIXTURE` before the first provider response, even with live integrations configured.
- A blocked edit switches all badges to Fixture because the placeholder becomes the current design.
- At 320px the Fulfillment badge is clipped in a horizontally scrolling row.
- Mobile progress labels disappear, leaving circles named only `1`–`4` in the accessibility tree.
- Category chips clip inside the narrow catalog drawer.
- Catalog rows expose `1 placement`, which is internal print vocabulary rather than shopper guidance.
- The empty-state arrow points toward no actionable control.
- Short mobile viewports place entry CTAs on/below the fold.
- Tee variants are represented by one 36-option combined dropdown.

## Requirements

### Trust and accessibility — MVP

- Derive provider status from server capability/configuration plus active operation state, not only the latest draft/mockup response.
- Use `Available`, `Working`, `Live`, `Demo`, and `Offline` consistently; never mark a configured provider Fixture before use.
- Wrap or collapse provider status on mobile without horizontal clipping.
- Keep progress labels visible or provide explicit `aria-label` values such as `Step 1: Product` at narrow widths.
- Make category chips horizontally scrollable with visible affordance, or wrap them without clipping.
- Remove raw session IDs and internal placement counts from default shopper copy.
- Replace the empty arrow hint with a direct control relationship or remove it.
- Respect `prefers-reduced-motion` and avoid competing smooth-scroll/focus actions.

### Variant selection — after payment QA

- Separate color and size selection for apparel.
- Use accessible color swatches backed by text labels and selected state.
- Show unavailable sizes without removing them from context.
- Preserve native-select fallback for keyboard/screen-reader robustness if the custom control is not fully equivalent.

## Acceptance Criteria

- At 320px no provider/category control is clipped and no page-level horizontal overflow exists.
- Every progress control has a descriptive accessible name at every breakpoint.
- Before first generation, provider statuses reflect configured availability rather than Fixture.
- Blocked revisions cannot change provider status.
- Entry CTA remains visible at 320 × 568 or a sticky primary action is available.
- Shopper copy does not expose session IDs or `1 placement` terminology.
- Apparel color and size can eventually be chosen independently without losing price/preview synchronization.

## Test Plan

- Responsive screenshots at 320 × 568, 375 × 667, 390 × 844, and 768 × 1024.
- Accessibility-tree assertion for progress labels and provider status.
- Keyboard test for category overflow/wrap and variant selection.
- State test for configured, working, live, fixture, fallback, and offline provider labels.
- Verify selected tee color remains synchronized with preview and cached mockup.

## Source Anchors

- `frontend/src/App.tsx`
- `frontend/src/components/ProviderChip.tsx`
- `frontend/src/components/StepRail.tsx`
- `frontend/src/components/CatalogPanel.tsx`
- `frontend/src/components/GenerationStage.tsx`
- `frontend/src/styles.css`
- [Audit evidence](../../audits/2026-07-12-designer-claims/README.md)

## Dependencies And Risks

- Provider capability reporting should not expose credentials or operational secrets.
- Custom swatches must not replace a more accessible native control until keyboard and screen-reader parity is verified.

## Implementation Notes

- Provider chips now use server-reported capability plus active-operation state and consistently present `Available`, `Working`, `Live`, `Demo`, or `Offline` without exposing credentials.
- Provider chips, category controls, progress labels, and entry actions remain visible without page-level clipping at the specified narrow viewports.
- Shopper surfaces no longer expose placement counts or the raw session ID, and the empty-stage arrow was removed.
- Separate apparel color/size controls and custom swatches remain intentionally deferred until after payment QA; the synchronized native variant selector remains the accessible MVP control.
