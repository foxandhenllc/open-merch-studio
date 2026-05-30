# EPIC-03: Pricing And Studio Pass Economics

**Status:** Ready  
**Visibility:** Public  
**Critical path epic:** Yes

## Goal
Implement understandable customer pricing while protecting OpenAI image and workflow spend.

## Current State
Open Merch Studio is a public-safe scaffold with fixture-backed catalog, quote, and mock design flows. This epic describes the work needed to turn that scaffold into a paid beta component.

## Tickets
- [OMS-020: Studio Pass Pricing Model](./OMS-020-studio-pass-pricing-model.md) - critical path
- [OMS-021: AI Credit Ledger And Spend Caps](./OMS-021-ai-credit-ledger-and-spend-caps.md) - critical path
- [OMS-022: Free Start And Abuse Limits](./OMS-022-free-start-and-abuse-limits.md) - critical path
- [OMS-023: Category Margin And Quote Engine](./OMS-023-category-margin-and-quote-engine.md) - critical path
- [OMS-024: Customer Facing Price Transparency](./OMS-024-customer-facing-price-transparency.md) - critical path

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
- OMS-020 must be complete or explicitly waived before paid beta launch.
- OMS-021 must be complete or explicitly waived before paid beta launch.
- OMS-022 must be complete or explicitly waived before paid beta launch.
- OMS-023 must be complete or explicitly waived before paid beta launch.
- OMS-024 must be complete or explicitly waived before paid beta launch.

## Launch Risk Notes
This epic has paid beta launch impact and should be reviewed before enabling real checkout or fulfillment.
