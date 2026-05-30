# EPIC-06: Commerce Accounts And Orders

**Status:** Ready  
**Visibility:** Public  
**Critical path epic:** Yes

## Goal
Support Studio Passes, carts, checkout, accounts, order confirmation, and customer service states.

## Current State
Open Merch Studio is a public-safe scaffold with fixture-backed catalog, quote, and mock design flows. This epic describes the work needed to turn that scaffold into a paid beta component.

## Tickets
- [OMS-050: Guest Session And Design Claim Flow](./OMS-050-guest-session-and-design-claim-flow.md) - critical path
- [OMS-051: User Accounts And Saved Designs](./OMS-051-user-accounts-and-saved-designs.md)
- [OMS-052: Cart And Stripe Checkout](./OMS-052-cart-and-stripe-checkout.md) - critical path
- [OMS-053: Studio Pass Purchase And Credit Application](./OMS-053-studio-pass-purchase-and-credit-application.md) - critical path
- [OMS-054: Order Confirmation And Email](./OMS-054-order-confirmation-and-email.md) - critical path
- [OMS-055: Refunds Cancellations And Support](./OMS-055-refunds-cancellations-and-support.md) - critical path
- [OMS-060: Order State Machine](./OMS-060-order-state-machine.md) - critical path
- [OMS-061: Printful Submission And Status Sync](./OMS-061-printful-submission-and-status-sync.md) - critical path

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
- OMS-050 must be complete or explicitly waived before paid beta launch.
- OMS-052 must be complete or explicitly waived before paid beta launch.
- OMS-053 must be complete or explicitly waived before paid beta launch.
- OMS-054 must be complete or explicitly waived before paid beta launch.
- OMS-055 must be complete or explicitly waived before paid beta launch.
- OMS-060 must be complete or explicitly waived before paid beta launch.
- OMS-061 must be complete or explicitly waived before paid beta launch.

## Launch Risk Notes
This epic has paid beta launch impact and should be reviewed before enabling real checkout or fulfillment.
