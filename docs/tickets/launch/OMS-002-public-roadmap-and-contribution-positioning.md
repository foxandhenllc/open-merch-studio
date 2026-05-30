# OMS-002: Public Roadmap And Contribution Positioning

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-01: Product And Launch Definition  
**Critical path:** No

## Goal
Present Open Merch Studio as a serious OSS project with a clear roadmap and useful contribution entry points.

## User Value
Developers and grant reviewers can understand why the repo matters and where contributions help.

## Current State
The README explains the concept, but the public roadmap does not yet map the path to real sales.

## Requirements
- Create a public roadmap that separates paid beta, post-beta, and future platform ideas.
- Label beginner-friendly, integration-heavy, design, and test-focused work.
- Explain fixture mode and mock providers as first-class OSS features.
- Avoid claiming existing adoption or revenue that has not been provided.

## Implementation Notes
- Add roadmap language to the ticket README and cross-link to CONTRIBUTING.md when useful.
- Use GitHub issue labels that mirror the ticket groups.
- Keep roadmap wording friendly to outside contributors without exposing private launch operations.

## Interfaces/Data Changes
- Docs and GitHub project metadata only.

## Acceptance Criteria
- The roadmap names paid beta as the first milestone.
- At least five good-first-issue candidates are identifiable from the tickets.
- Contributor-facing work can be done with fixture or mock providers.
- No private launch operations are needed to contribute locally.

## Test Plan
- Click through roadmap links.
- Validate that each public issue candidate maps to a ticket.
- Check for unsupported claims.

## Dependencies/Blockers
- OMS-001.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Keep roadmap claims factual and repo-grounded.

## Launch Risk Notes
Overstated roadmap language could weaken credibility with OSS reviewers and customers.
