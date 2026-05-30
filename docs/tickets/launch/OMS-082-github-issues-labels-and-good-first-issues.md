# OMS-082: GitHub Issues Labels And Good First Issues

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-08: Open Source Developer Experience  
**Critical path:** No

## Goal
Convert the launch tickets into a contributor-friendly GitHub project surface.

## User Value
Outside contributors can find approachable work and understand project priorities.

## Current State
The markdown tickets will exist in the repo, but GitHub issues and labels still need creation.

## Requirements
- Create labels for epic, good first issue, help wanted, fixture mode, frontend, backend, docs, tests, integration, and launch blocker.
- Open selected tickets as GitHub issues with links back to markdown source.
- Mark at least five safe beginner issues that do not require provider accounts.
- Keep private ops work out of public GitHub issues.

## Implementation Notes
- Use GitHub CLI or API after markdown ticket review.
- Start with docs, fixture mode, UI polish, tests, and API docs as first contributor issues.
- Use the markdown ticket IDs as stable references.

## Interfaces/Data Changes
- GitHub repository labels, issues, and project board.

## Acceptance Criteria
- Labels exist and match the ticket taxonomy.
- Selected public tickets have corresponding GitHub issues.
- Good-first issues can be completed without live provider accounts.
- No private ops notes are copied into public issues.

## Test Plan
- List repo labels.
- Spot-check issue links back to docs.
- Review public issue bodies for private data.

## Dependencies/Blockers
- Ticket set review and approval.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not publish provider setup details or private launch operations as public issues.

## Launch Risk Notes
A public repo without issue structure looks less ready for contributors.
