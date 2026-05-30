# EPIC-07: Admin Observability And Ops

**Status:** Ready  
**Visibility:** Public  
**Critical path epic:** Yes

## Goal
Give operators the controls and reporting needed to run paid beta without manual database edits.

## Current State
Open Merch Studio is a public-safe scaffold with fixture-backed catalog, quote, and mock design flows. This epic describes the work needed to turn that scaffold into a paid beta component.

## Tickets
- [OMS-062: Admin Order Dashboard](./OMS-062-admin-order-dashboard.md) - critical path
- [OMS-063: Fulfillment Failure Recovery](./OMS-063-fulfillment-failure-recovery.md) - critical path
- [OMS-070: Admin Controls For Catalog Pricing And AI Spend](./OMS-070-admin-controls-for-catalog-pricing-and-ai-spend.md) - critical path
- [OMS-071: Analytics Events And Cost Reporting](./OMS-071-analytics-events-and-cost-reporting.md) - critical path
- [OMS-072: Error Monitoring And Launch Audit](./OMS-072-error-monitoring-and-launch-audit.md) - critical path

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
- OMS-062 must be complete or explicitly waived before paid beta launch.
- OMS-063 must be complete or explicitly waived before paid beta launch.
- OMS-070 must be complete or explicitly waived before paid beta launch.
- OMS-071 must be complete or explicitly waived before paid beta launch.
- OMS-072 must be complete or explicitly waived before paid beta launch.

## Launch Risk Notes
This epic has paid beta launch impact and should be reviewed before enabling real checkout or fulfillment.
