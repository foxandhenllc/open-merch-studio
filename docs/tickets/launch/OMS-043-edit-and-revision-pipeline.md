# OMS-043: Edit And Revision Pipeline

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-05: AI Design System  
**Critical path:** Yes

## Goal
Allow customers to revise selected drafts within a clear allowance before final production.

## User Value
Customers can improve a design without starting over or worrying about surprise charges.

## Current State
No structured edit or revision flow exists beyond generating a fresh draft.

## Requirements
- Support edit requests against a selected draft with change instructions.
- Track revision lineage from original draft to current selected version.
- Consume Studio Pass allowance according to the accepted pass rules.
- Show remaining included edits or the next paid action.

## Implementation Notes
- Add revision entities or metadata linked to design drafts.
- Distinguish minor prompt edits, image edits, and final preparation actions.
- Keep mock revision responses deterministic for local development.

## Interfaces/Data Changes
- May add POST /api/design/drafts/:id/revisions.
- Frontend studio displays revision history and remaining allowance.

## Acceptance Criteria
- A selected draft can receive an edit request.
- Revision history is visible enough for customers to compare versions.
- Allowance is counted consistently with Studio Pass rules.
- A failed edit does not overwrite the last good draft.

## Test Plan
- Unit test revision lineage.
- Integration test edit allowance counting.
- E2E test edit selected draft and keep prior version.

## Dependencies/Blockers
- OMS-042.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)

## Public Safety/Privacy Notes
Do not use prior customer drafts as examples for other users.

## Launch Risk Notes
Revision confusion can make the product feel like a random generator rather than a studio.
