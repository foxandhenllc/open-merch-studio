# OMS-055: Refunds Cancellations And Support

**Status:** Baseline policy and recovery implemented; business sign-off pending
**Visibility:** Public  
**Epic:** EPIC-06: Commerce Accounts And Orders  
**Critical path:** Yes

## Goal

Define and implement customer support paths for paid beta order changes and failures.

## User Value

Customers know how to get help if they made a mistake or fulfillment has a problem.

## Current State

Public support and returns routes describe the custom-item boundary, while signed Stripe refund
events and protected order recovery preserve operator truth. Branded inbound support routing, an
external reply round-trip, authenticated DKIM/DMARC delivery, and the branded outbound From identity
are verified. Automatic refund/cancellation actions and final business-policy sign-off remain
deferred.

## Requirements

- Define cancellation windows by order state before and after provider submission.
- Define refund handling for Studio Pass, merch order, failed fulfillment, and duplicate charge cases.
- Add support contact route or mailto surface in customer confirmations and footer.
- Log support-relevant order state changes for operators.

## Implementation Notes

- Add policy copy to public-facing support/legal pages.
- Add admin order actions for eligible cancellation and refund initiation.
- Keep manual operator review for ambiguous paid beta cases.

## Interfaces/Data Changes

- Admin order dashboard exposes cancellation/refund eligibility.
- Customer surfaces link to support path.

## Acceptance Criteria

- Customers can find support path from checkout and confirmation surfaces.
- Orders already submitted for fulfillment cannot be silently cancelled as if unsubmitted.
- Studio Pass refund policy is stated before purchase.
- Operators can identify order state and next support action.

## Test Plan

- Policy copy review.
- Admin state eligibility test.
- E2E test support link visible after purchase.

## Dependencies/Blockers

- OMS-054
- OMS-060
- OMS-062.

## Source Anchors

- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes

Do not publish private support inbox credentials or internal escalation notes in public docs.

## Launch Risk Notes

Unclear refund handling can turn a small beta issue into a trust problem.
