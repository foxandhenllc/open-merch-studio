# EPIC-05: AI Design System

**Status:** Ready  
**Visibility:** Public  
**Critical path epic:** Yes

## Goal
Build optional OpenAI-powered design flows with mock/local fallbacks and production-ready controls.

## Current State
Open Merch Studio is a public-safe scaffold with fixture-backed catalog, quote, and mock design flows. This epic describes the work needed to turn that scaffold into a paid beta component.

## Tickets
- [OMS-040: OpenAI Provider Abstraction](./OMS-040-openai-provider-abstraction.md) - critical path
- [OMS-041: Prompt And Idea Assistant](./OMS-041-prompt-and-idea-assistant.md) - critical path
- [OMS-042: Rough Draft Generation Pipeline](./OMS-042-rough-draft-generation-pipeline.md) - critical path
- [OMS-043: Edit And Revision Pipeline](./OMS-043-edit-and-revision-pipeline.md) - critical path
- [OMS-044: Print Readiness Checks](./OMS-044-print-readiness-checks.md) - critical path
- [OMS-045: Content Safety And IP Guardrails](./OMS-045-content-safety-and-ip-guardrails.md) - critical path

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
- OMS-040 must be complete or explicitly waived before paid beta launch.
- OMS-041 must be complete or explicitly waived before paid beta launch.
- OMS-042 must be complete or explicitly waived before paid beta launch.
- OMS-043 must be complete or explicitly waived before paid beta launch.
- OMS-044 must be complete or explicitly waived before paid beta launch.
- OMS-045 must be complete or explicitly waived before paid beta launch.

## Launch Risk Notes
This epic has paid beta launch impact and should be reviewed before enabling real checkout or fulfillment.
