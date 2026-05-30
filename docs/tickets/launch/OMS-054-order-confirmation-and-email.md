# OMS-054: Order Confirmation And Email

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-06: Commerce Accounts And Orders  
**Critical path:** Yes

## Goal
Confirm orders clearly after payment and keep customers informed about next steps.

## User Value
Customers know what they bought, what design was submitted, and what happens next.

## Current State
No transactional confirmation flow exists yet.

## Requirements
- Show in-app confirmation with order number, item, design preview, price summary, and fulfillment status.
- Send confirmation email in live mode and log/simulate it in fixture mode.
- Include support contact path and cancellation/refund guidance appropriate to order state.
- Avoid exposing internal provider payload details in customer emails.

## Implementation Notes
- Add order confirmation page and email template.
- Use a provider abstraction for email so local development can print or store previews.
- Trigger confirmation only after payment state is confirmed.

## Interfaces/Data Changes
- Order record includes customer email, confirmation status, and email provider message reference if available.
- Frontend route for order confirmation.

## Acceptance Criteria
- Successful checkout lands on an order confirmation page.
- A confirmation email is sent or simulated exactly once.
- The confirmation shows selected product, variant, design, and final amount.
- Failure states do not send false confirmations.

## Test Plan
- Integration test confirmation send idempotency.
- E2E test checkout success route.
- Email template snapshot test.

## Dependencies/Blockers
- OMS-052
- OMS-060.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Keep customer emails free of provider internals and sensitive debug data.

## Launch Risk Notes
Missing confirmations make real purchases feel risky and increase support load.
