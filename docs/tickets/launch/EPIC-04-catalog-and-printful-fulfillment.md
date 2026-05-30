# EPIC-04: Catalog And Printful Fulfillment

**Status:** Ready  
**Visibility:** Public  
**Critical path epic:** Yes

## Goal
Move from fixture products to a curated Printful-backed catalog with reliable mockup and order data.

## Current State
Open Merch Studio is a public-safe scaffold with fixture-backed catalog, quote, and mock design flows. This epic describes the work needed to turn that scaffold into a paid beta component.

## Tickets
- [OMS-030: Printful Catalog Sync Hardening](./OMS-030-printful-catalog-sync-hardening.md) - critical path
- [OMS-031: Curated Launch Catalog Admin](./OMS-031-curated-launch-catalog-admin.md) - critical path
- [OMS-032: Placement And Mockup Normalization](./OMS-032-placement-and-mockup-normalization.md) - critical path
- [OMS-033: Printful Mockup Generation](./OMS-033-printful-mockup-generation.md) - critical path
- [OMS-034: Printful Order Payload Validation](./OMS-034-printful-order-payload-validation.md) - critical path

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
- OMS-030 must be complete or explicitly waived before paid beta launch.
- OMS-031 must be complete or explicitly waived before paid beta launch.
- OMS-032 must be complete or explicitly waived before paid beta launch.
- OMS-033 must be complete or explicitly waived before paid beta launch.
- OMS-034 must be complete or explicitly waived before paid beta launch.

## Launch Risk Notes
This epic has paid beta launch impact and should be reviewed before enabling real checkout or fulfillment.
