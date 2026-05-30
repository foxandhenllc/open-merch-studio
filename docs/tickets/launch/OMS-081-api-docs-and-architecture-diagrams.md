# OMS-081: API Docs And Architecture Diagrams

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-08: Open Source Developer Experience  
**Critical path:** No

## Goal
Document the system clearly enough for contributors and reviewers to understand how commerce, AI, and fulfillment fit together.

## User Value
Developers can safely contribute without reverse-engineering every flow.

## Current State
The repo has an architecture doc for catalog and quote flow, but launch architecture needs expansion.

## Requirements
- Document catalog, design, Studio Pass, quote, checkout, order, fulfillment, and admin flows.
- Document live versus fixture provider boundaries.
- Add API examples for public and admin endpoints without private values.
- Add diagrams for customer flow and backend service flow.

## Implementation Notes
- Extend docs/architecture with launch-oriented diagrams and endpoint summaries.
- Keep source anchors for OpenAI and Printful docs where provider behavior is described.
- Update docs alongside implementation tickets rather than at the end only.

## Interfaces/Data Changes
- Documentation only unless OpenAPI or typed route generation is later introduced.

## Acceptance Criteria
- Architecture docs explain the paid beta path end to end.
- Public examples use fixture IDs and synthetic data.
- Provider docs are linked for implementation context.
- Docs match actual route names and response shapes.

## Test Plan
- Review route names against source.
- Check markdown links.
- Run docs scan for private values.

## Dependencies/Blockers
- OMS-023
- OMS-040
- OMS-052
- OMS-061.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not include live environment values or private provider account screenshots in docs.

## Launch Risk Notes
Outdated docs mislead contributors and make grant review weaker.
