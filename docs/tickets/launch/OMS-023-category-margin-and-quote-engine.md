# OMS-023: Category Margin And Quote Engine

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-03: Pricing And Studio Pass Economics  
**Critical path:** Yes

## Goal
Expand quote math from a single target margin into category-aware pricing that can support real sales.

## User Value
Customers see fair prices while the business keeps enough margin to cover fulfillment and design operations.

## Current State
The backend pricing service uses a target margin percent, minimum margin, AI design fee, and payment fee estimate.

## Requirements
- Support category-specific margin rules and minimum margin by product class.
- Include product cost, shipping estimate where available, tax estimate where available, payment fee estimate, design allocation, and final price.
- Apply Studio Pass credit only when eligible.
- Keep all calculations auditable in quote breakdowns.

## Implementation Notes
- Refactor quote math into composable cost lines and pricing rules.
- Store price snapshots so fulfilled orders can be traced back to the quoted inputs.
- Keep deterministic tests for rounding and margin floors.

## Interfaces/Data Changes
- POST /api/catalog/quotes response should include structured cost lines, margin line, pass credit line, and final price.
- Orders should store quoteId.

## Acceptance Criteria
- Quotes differ correctly by product category and variant cost.
- Minimum margin protects low-cost items.
- Studio Pass credit reduces eligible final order price once.
- Rounding is stable and tested at cent precision.

## Test Plan
- Unit test category margin rules.
- Unit test pass credit application.
- Snapshot test quote breakdown shape.

## Dependencies/Blockers
- OMS-020
- OMS-030
- OMS-033.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Do not present estimates as final tax or shipping amounts unless the provider confirms them.

## Launch Risk Notes
Bad quote math can create underpriced orders or customer-facing price surprises.
