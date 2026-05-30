# OMS-041: Prompt And Idea Assistant

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-05: AI Design System  
**Critical path:** Yes

## Goal
Help customers turn rough ideas into merch-ready design directions before expensive image generation.

## User Value
Customers get better results with fewer attempts and less cost.

## Current State
The studio accepts a prompt-like design request but does not yet guide customers through idea refinement.

## Requirements
- Collect product category, audience, tone, text, visual style, colors, and must-avoid constraints.
- Suggest prompt refinements before generation.
- Warn when customer requests may be hard to print, unsafe, or too detailed for the selected product area.
- Support mock suggestions in fixture mode.

## Implementation Notes
- Add a lightweight idea form and assistant response surface.
- Use product placement data to guide prompt constraints.
- Keep generated suggestions editable before any image generation request.

## Interfaces/Data Changes
- May add POST /api/design/ideas.
- Design draft request includes structured idea fields.

## Acceptance Criteria
- Customers can refine an idea without paying or generating images.
- The assistant uses selected product and placement context.
- Suggested prompts are editable.
- Mock provider returns deterministic suggestions for tests.

## Test Plan
- Unit test idea field serialization.
- E2E test idea assistant before draft generation.
- Fixture test deterministic suggestion output.

## Dependencies/Blockers
- OMS-012
- OMS-032
- OMS-040.

## Source Anchors
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image model docs](https://developers.openai.com/api/docs/models/gpt-image-1-mini)

## Public Safety/Privacy Notes
Reject or redirect requests that appear unsafe, infringing, or unsuitable for print.

## Launch Risk Notes
Unstructured prompts increase failed generations and customer frustration.
