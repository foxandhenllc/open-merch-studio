# OMS-001: Paid Beta Launch Scope

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-01: Product And Launch Definition  
**Critical path:** Yes

## Goal
Define the smallest real-money launch that can sell products responsibly without pretending the app is finished.

## User Value
Customers get a clear shop, realistic prices, and a reliable path from design idea to fulfilled merch.

## Current State
The repo is a public-safe scaffold with fixture catalog data, sample quote math, and a simple studio surface.

## Requirements
- Document the paid beta promise as curated products, guided design, checkout, fulfillment, support, and transparent pricing.
- Set launch exclusions for full Printful catalog exposure, marketplace seller tools, bulk orders, and advanced brand accounts.
- Identify the minimum user paths that must work before enabling paid checkout.
- Tie every launch blocker to an atomic ticket in this launch ticket set.

## Implementation Notes
- Add a launch-scope section to public docs and link it from the main ticket index.
- Use the phrase paid beta consistently instead of production-complete launch.
- Keep scope language product-neutral so the project is not limited to shirts.

## Interfaces/Data Changes
- Public roadmap docs only; no runtime interface changes are required.

## Acceptance Criteria
- A reader can identify exactly what will be sellable on day one.
- The document names the user flows that gate checkout activation.
- Out-of-scope items are explicit and do not block paid beta.
- Every named blocker links to a ticket in this set.

## Test Plan
- Review internal links in the ticket index.
- Run markdown lint if available.
- Confirm no private account details are present.

## Dependencies/Blockers
- None. This is the planning anchor for all implementation work.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not include private vendor account data, customer examples, or unverifiable traction claims.

## Launch Risk Notes
Loose scope will cause the project to drift back into a demo instead of becoming a focused paid beta.
