# OMS-063: Fulfillment Failure Recovery

**Status:** MVP implemented for supervised paid beta
**Visibility:** Public  
**Epic:** EPIC-07: Admin Observability And Ops  
**Critical path:** Yes

## Goal

Define and implement recovery paths for order, provider, payment, mockup, and readiness failures.

## User Value

Customers can be helped quickly when an order cannot proceed automatically.

## Current State

Payment truth and fulfillment outcome are now durable independently. Failed and needs-review
orders survive a cold process restore, every Printful call receives a leased fulfillment-attempt
record that becomes terminal on controlled completion, and stale/incomplete leases can be recovered.
Ambiguous Printful responses are resolved by the immutable OMS external order number, and protected
operators can retry a draft or acknowledge and resolve an issue without rewriting Stripe payment
truth.

## Requirements

- Classify failure types as customer action needed, operator review needed, retryable provider issue, payment issue, and unrecoverable order issue.
- Add retry and override actions only where safe.
- Notify customers when their action is needed.
- Keep an operator audit trail of recovery actions.

## Implementation Notes

- Extend order state machine with needs-review reason codes.
- Add admin actions for retry, cancel, refund referral, and customer contact.
- Use fixture failures to test recovery without live provider calls.

## Interfaces/Data Changes

- Order state reason codes.
- Admin failure recovery actions.
- Customer notifications for action-needed states.

## Acceptance Criteria

- Retryable failures can be retried exactly through approved paths.
- Unrecoverable failures move to clear support action states.
- Customers are not told an order is progressing when it is blocked.
- Operator recovery actions are visible in order history.

## Test Plan

- Unit test failure classification.
- Integration test retryable provider failure.
- E2E test order moves to customer action needed.

## Implemented MVP Boundaries

- Retry is allowed only for a durably paid Stripe Checkout Session with a retrievable recipient,
  quote, and artwork.
- Full and partial refunds are persisted separately; any refunded amount blocks resubmission.
- Completion/refund/retry writes use database compare-and-set guards so terminal payment truth wins
  if a refund arrives while a provider request is in flight.
- Existing Printful provider order IDs make retry a no-op; Printful is also queried by OMS external
  order number before any create call.
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false` remains mandatory. Recovery creates an editable draft only.
- Operator acknowledgement/resolution is an audit state; it never changes payment or fulfillment
  truth. A resolution note is required.
- Automatic refunds, physical-order confirmation, shipment sync, and customer-service automation
  remain outside this MVP slice.
- A process termination can leave an attempt in `processing`; the stale lease and immutable external
  order ID make the next supervised reconciliation safe.

## Dependencies/Blockers

- OMS-060
- OMS-061
- OMS-062.

## Source Anchors

- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes

Do not automate refunds or re-submissions without clear idempotency and operator review where needed.

## Launch Risk Notes

Failure recovery gaps can convert isolated provider issues into customer-facing chaos.
