# OMS-053: Studio Pass Purchase And Credit Application

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-06: Commerce Accounts And Orders  
**Critical path:** Yes

## Goal
Sell the $5 Studio Pass and apply it cleanly to eligible merchandise purchases.

## User Value
Customers can unlock better design work while knowing that the pass value is not wasted if they buy.

## Current State
Studio Pass exists as a product decision but not as a commerce flow.

## Requirements
- Allow Studio Pass purchase before final merch checkout.
- Record purchase state, allowance, expiration if any, and applied-to-order state.
- Apply the pass credit once to an eligible order from the same customer/session.
- Show pass purchase, use, and credit application in customer confirmations.

## Implementation Notes
- Represent Studio Pass as a separate purchasable item or checkout mode in Stripe.
- Link pass purchase to guest session or user account.
- Ensure pass credit cannot be duplicated across orders.

## Interfaces/Data Changes
- May add POST /api/studio-passes/checkout.
- Quote and checkout services read pass state.

## Acceptance Criteria
- A customer can buy a pass independently of a merch item.
- Pass allowance unlocks the intended draft/edit/final actions.
- The $5 credit appears on eligible final order quote and checkout.
- The same pass cannot be applied twice.

## Test Plan
- Unit test pass redemption idempotency.
- Integration test pass purchase webhook.
- E2E test pass purchase then merch checkout.

## Dependencies/Blockers
- OMS-020
- OMS-021
- OMS-052.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Explain pass behavior before purchase and in confirmation email.

## Launch Risk Notes
Incorrect pass accounting can create customer complaints or margin loss.
