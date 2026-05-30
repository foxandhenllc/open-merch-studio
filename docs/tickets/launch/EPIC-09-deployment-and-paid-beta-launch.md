# EPIC-09: Deployment And Paid Beta Launch

**Status:** Ready  
**Visibility:** Public  
**Critical path epic:** Yes

## Goal
Prepare production deployment, smoke tests, privacy review, and launch readiness gates.

## Current State
Open Merch Studio is a public-safe scaffold with fixture-backed catalog, quote, and mock design flows. This epic describes the work needed to turn that scaffold into a paid beta component.

## Tickets
- [OMS-090: Vercel Domain And Environment Readiness](./OMS-090-vercel-domain-and-environment-readiness.md) - critical path
- [OMS-091: Production Database And Migrations](./OMS-091-production-database-and-migrations.md) - critical path
- [OMS-092: End To End Launch Smoke Tests](./OMS-092-end-to-end-launch-smoke-tests.md) - critical path
- [OMS-093: Security Privacy And Credential Scan](./OMS-093-security-privacy-and-secret-scan.md) - critical path
- [OMS-094: Paid Beta Launch Checklist](./OMS-094-paid-beta-launch-checklist.md) - critical path

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
- OMS-090 must be complete or explicitly waived before paid beta launch.
- OMS-091 must be complete or explicitly waived before paid beta launch.
- OMS-092 must be complete or explicitly waived before paid beta launch.
- OMS-093 must be complete or explicitly waived before paid beta launch.
- OMS-094 must be complete or explicitly waived before paid beta launch.

## Launch Risk Notes
This epic has paid beta launch impact and should be reviewed before enabling real checkout or fulfillment.
