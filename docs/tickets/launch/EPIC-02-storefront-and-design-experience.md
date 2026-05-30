# EPIC-02: Storefront And Design Experience

**Status:** Ready  
**Visibility:** Public  
**Critical path epic:** Yes

## Goal
Turn the scaffold into a polished customer shop and guided design studio that can sell real products.

## Current State
Open Merch Studio is a public-safe scaffold with fixture-backed catalog, quote, and mock design flows. This epic describes the work needed to turn that scaffold into a paid beta component.

## Tickets
- [OMS-010: Shop Home And Category Experience](./OMS-010-shop-home-and-category-experience.md) - critical path
- [OMS-011: Product Detail And Variant Selection](./OMS-011-product-detail-and-variant-selection.md) - critical path
- [OMS-012: Design Studio Flow](./OMS-012-design-studio-flow.md) - critical path
- [OMS-013: Mobile Responsive Polish](./OMS-013-mobile-responsive-polish.md) - critical path
- [OMS-014: Loading Empty And Error States](./OMS-014-loading-empty-error-states.md) - critical path

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
- OMS-010 must be complete or explicitly waived before paid beta launch.
- OMS-011 must be complete or explicitly waived before paid beta launch.
- OMS-012 must be complete or explicitly waived before paid beta launch.
- OMS-013 must be complete or explicitly waived before paid beta launch.
- OMS-014 must be complete or explicitly waived before paid beta launch.

## Launch Risk Notes
This epic has paid beta launch impact and should be reviewed before enabling real checkout or fulfillment.
