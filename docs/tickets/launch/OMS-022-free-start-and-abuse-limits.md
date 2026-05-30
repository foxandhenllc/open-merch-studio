# OMS-022: Free Start And Abuse Limits

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-03: Pricing And Studio Pass Economics  
**Critical path:** Yes

## Goal
Let users experience the product before paying while limiting repeated unpaid generation.

## User Value
Customers can understand the design quality and flow before buying a Studio Pass or product.

## Current State
No formal free-start policy exists beyond mock draft behavior.

## Requirements
- Allow low-cost ideation and optionally one rough or watermarked preview before a Studio Pass is required.
- Rate-limit repeated unpaid sessions with customer-safe messaging.
- Use lower-cost model tiers or mock previews for free exploration.
- Escalate to Studio Pass for repeated drafts, edits, or final production artwork.

## Implementation Notes
- Add free allowance rules to the same policy service used by the internal ledger.
- Represent preview quality separately from final production readiness.
- Add UI copy that frames the Studio Pass as unlocking deeper design work, not punishing exploration.

## Interfaces/Data Changes
- Design endpoints return allowance state and next required action.
- Frontend studio reads allowance state to show pass prompts.

## Acceptance Criteria
- A new visitor can try the idea flow without payment.
- Repeated unpaid design requests are limited before provider calls happen.
- Studio Pass prompts appear only after the free allowance is actually exhausted.
- Fixture mode can simulate exhausted allowance.

## Test Plan
- Unit test free allowance transitions.
- E2E test new visitor free preview.
- E2E test exhausted free allowance prompt.

## Dependencies/Blockers
- OMS-020
- OMS-021.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)

## Public Safety/Privacy Notes
Avoid dark-pattern copy around limits; explain the pass plainly.

## Launch Risk Notes
Too much free generation risks cost exposure; too little makes the product hard to trust.
