# EPIC-08: Open Source Developer Experience

**Status:** Ready  
**Visibility:** Public  
**Critical path epic:** No

## Goal
Keep the repo easy to run, inspect, contribute to, and evaluate without private provider access.

## Current State
Open Merch Studio is a public-safe scaffold with fixture-backed catalog, quote, and mock design flows. This epic describes the work needed to turn that scaffold into a paid beta component.

## Tickets
- [OMS-080: Clean Local Setup And Fixture Mode](./OMS-080-clean-local-setup-and-fixture-mode.md)
- [OMS-081: API Docs And Architecture Diagrams](./OMS-081-api-docs-and-architecture-diagrams.md)
- [OMS-082: GitHub Issues Labels And Good First Issues](./OMS-082-github-issues-labels-and-good-first-issues.md)

## Epic Requirements
- Deliver the ticket outcomes in a sequence that preserves fixture-mode local development.
- Keep public documentation suitable for a GitHub repository.
- Avoid adding private provider account data, private customer data, or unsupported traction claims.
- Update the launch index when a ticket is added, removed, or split.

## Acceptance Criteria
- Every ticket in this epic has concrete acceptance criteria and a test plan.
- Critical path tickets are identifiable from this epic file.
- Dependencies are clear enough for another engineer to pick up implementation work.
- Public docs remain usable without private provider access.

## Test Plan
- Review each linked ticket for required sections.
- Check all relative links from this epic file.
- Confirm critical path tickets match the paid beta launch checklist.

## Dependencies/Blockers
- No paid-beta blocking tickets in this epic.

## Launch Risk Notes
This epic improves OSS quality and contributor readiness, but it should not block the smallest safe paid beta unless a ticket is promoted.
