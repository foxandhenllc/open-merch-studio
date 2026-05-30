# OMS-042: Rough Draft Generation Pipeline

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-05: AI Design System  
**Critical path:** Yes

## Goal
Generate controlled rough design drafts that fit the selected product and Studio Pass allowance.

## User Value
Customers can explore visual options without immediately committing to final production assets.

## Current State
The mock draft endpoint demonstrates the idea but does not yet model draft quality, allowance, or asset storage deeply.

## Requirements
- Support rough draft generation tied to product, variant, placement, prompt, and allowance state.
- Mark rough drafts as non-final until print-readiness checks pass.
- Store draft metadata and preview references for later edits and mockups.
- Deduct allowance from free start or Studio Pass according to policy.

## Implementation Notes
- Add draft lifecycle states such as requested, generated, rejected, selected, and superseded.
- Use lower-cost model policy for rough drafts where configured.
- Allow multiple rough drafts in a single studio session without losing prior selections.

## Interfaces/Data Changes
- POST /api/design/drafts returns draft IDs, preview references, quality tier, allowance state, and next action.
- Database stores draft metadata.

## Acceptance Criteria
- A rough draft is tied to a specific product and placement.
- Allowance is decremented exactly once per successful generation.
- Failed provider requests do not consume paid allowance.
- Customers can choose one draft to continue editing or mockup.

## Test Plan
- Unit test draft state transitions.
- Integration test allowance consumed on success only.
- E2E test multiple rough drafts and selection.

## Dependencies/Blockers
- OMS-020
- OMS-021
- OMS-040
- OMS-041.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)

## Public Safety/Privacy Notes
Mark rough previews clearly so customers do not mistake them for final print assets.

## Launch Risk Notes
Unbounded rough draft generation creates cost and UX problems.
