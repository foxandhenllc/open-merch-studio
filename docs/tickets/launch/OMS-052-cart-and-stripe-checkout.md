# OMS-052: Cart And Stripe Checkout

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-06: Commerce Accounts And Orders  
**Critical path:** Yes

## Goal
Enable customers to pay for merch orders through Stripe after quote and readiness checks pass.

## User Value
Customers can complete a real purchase with clear item, design, and price details.

## Current State
The scaffold has quote behavior but no full cart and checkout implementation.

## Requirements
- Create cart items from selected product, variant, placement, artwork, mockup, and quote ID.
- Use Stripe Checkout or Payment Element based on the simplest safe paid beta path.
- Validate quote freshness, pass credit, readiness, and order payload before payment.
- Handle checkout success, cancellation, and payment failure states.

## Implementation Notes
- Start with Stripe Checkout for paid beta unless deeper in-app payment customization is required.
- Store checkout session references and map them to local orders.
- Use idempotency for checkout and order creation paths.

## Interfaces/Data Changes
- May add POST /api/checkout/sessions.
- Stripe webhook updates payment and order states.
- Cart reads quote and design records.

## Acceptance Criteria
- A valid cart can create a Stripe checkout session in test mode.
- Stale or invalid quotes cannot enter checkout.
- Checkout success creates or updates a local order exactly once.
- Checkout cancellation returns the customer to the cart without losing design state.

## Test Plan
- Integration test checkout session creation with Stripe test doubles.
- Webhook idempotency test.
- E2E test cart to checkout in test mode.

## Dependencies/Blockers
- OMS-023
- OMS-034
- OMS-044
- OMS-050.

## Source Anchors
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Do not store payment card data in the application database.

## Launch Risk Notes
Checkout bugs have direct money and fulfillment consequences.
