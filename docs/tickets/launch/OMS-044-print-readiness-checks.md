# OMS-044: Print Readiness Checks

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-05: AI Design System  
**Critical path:** Yes

## Goal
Check artwork for basic production readiness before mockup and fulfillment submission.

## User Value
Customers and operators can catch obvious print problems before money and fulfillment are involved.

## Current State
The app does not yet enforce production readiness for generated or uploaded artwork.

## Requirements
- Check dimensions, aspect ratio, transparent background needs, file type, placement fit, and text legibility where feasible.
- Classify checks as pass, warning, or block.
- Show customer-safe guidance for warnings and blocks.
- Allow operator override only in admin workflows.

## Implementation Notes
- Create a print-readiness service that can run in fixture mode and live asset mode.
- Use placement metadata as the source of truth for size constraints.
- Store check results with the design asset and quote.

## Interfaces/Data Changes
- May add POST /api/design/readiness.
- Mockup and checkout flows require passing or overridden readiness state.

## Acceptance Criteria
- Artwork missing required dimensions cannot proceed to fulfillment without override.
- Warnings are visible before checkout.
- Readiness results are stored and shown in admin order detail.
- Fixture assets cover pass, warning, and blocked states.

## Test Plan
- Unit test readiness rules.
- Integration test blocked artwork prevents mockup.
- E2E test warning state shown before checkout.

## Dependencies/Blockers
- OMS-032
- OMS-042
- OMS-050.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)

## Public Safety/Privacy Notes
Do not promise perfect print quality; present checks as preflight guidance.

## Launch Risk Notes
Skipping readiness checks increases failed orders, refunds, and support burden.
