# OMS-054: Order Confirmation And Email

**Status:** In-app reconciliation implemented; app-owned email deferred
**Visibility:** Public  
**Epic:** EPIC-06: Commerce Accounts And Orders  
**Critical path:** Yes

## Goal

Confirm orders clearly after payment and keep customers informed about next steps.

## User Value

Customers know what they bought, what design was submitted, and what happens next.

## Current State

The checkout return polls durable payment reconciliation and shows the OMS order number, final total,
tax, and current state without asking the customer to pay twice. Stripe-hosted payment receipts and
refund messages are the intended MVP email surface. Customer-safe HTML and text templates are
prepared for later provider integration, but Open Merch Studio does not yet send its own
transactional email. No sender credential or unverified domain should be added before that path has
durable exactly-once delivery state.

## Requirements

- Show in-app confirmation with order number, item, design preview, price summary, and fulfillment status.
- Keep Stripe-hosted receipt/refund messages enabled for the supervised MVP purchase.
- Before adding app-owned email, create a provider abstraction, fixture preview, durable delivery
  record, and exactly-once retry behavior.
- Include support contact path and cancellation/refund guidance appropriate to order state.
- Avoid exposing internal provider payload details in customer emails.

## Implementation Notes

- Expand the payment-return state into a complete order-confirmation view with item, variant, design,
  price, support, and next-step context.
- Prepare app-owned email templates only after deciding which messages Stripe and Printful already
  send, so customers do not receive duplicate or contradictory notices.
- Trigger any future confirmation email only after payment state is confirmed.

## Interfaces/Data Changes

- A future notification/outbox record must include idempotency state and the provider message
  reference; do not overload payment-event state.
- Checkout-return confirmation uses the durable order lookup.

## Acceptance Criteria

- Successful checkout resolves to a durable order-confirmation state.
- Stripe-hosted payment email is verified during the supervised purchase.
- Any future app-owned confirmation email is sent or simulated exactly once.
- The confirmation shows selected product, variant, design, and final amount.
- Failure states do not send false confirmations.

## Test Plan

- Integration test checkout-return reconciliation and any future confirmation-send idempotency.
- E2E test checkout success route.
- Future email template snapshot test.

## Dependencies/Blockers

- OMS-052
- OMS-060.

## Source Anchors

- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes

Keep customer emails free of provider internals and sensitive debug data.

## Launch Risk Notes

Missing confirmations make real purchases feel risky and increase support load.
