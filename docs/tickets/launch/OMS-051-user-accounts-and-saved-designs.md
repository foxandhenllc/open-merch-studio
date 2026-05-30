# OMS-051: User Accounts And Saved Designs

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-06: Commerce Accounts And Orders  
**Critical path:** No

## Goal
Support account-based saved designs and order history without making sign-up mandatory at first interaction.

## User Value
Returning customers can continue designs, reorder, and track purchases.

## Current State
Auth providers are named in product assumptions, but account flow is not yet implemented.

## Requirements
- Add account sign-in after guest value is demonstrated, not as a first-screen requirement.
- Store saved designs, selected products, quotes, orders, and Studio Pass status per user.
- Support account deletion or data removal workflow appropriate for paid beta.
- Keep fixture mode usable without an external auth provider.

## Implementation Notes
- Add an auth abstraction or provider integration with local mock mode.
- Add saved-design list and detail surfaces after core studio flow works.
- Connect guest claim flow to account ownership.

## Interfaces/Data Changes
- User identity links to sessions, designs, passes, carts, and orders.
- Frontend account area reads saved designs and orders.

## Acceptance Criteria
- A logged-in user can see saved designs and order history.
- Guest sessions can be claimed once and only by the intended user.
- Local development does not require live auth.
- Account data surfaces do not expose another user design or order.

## Test Plan
- Integration test account ownership.
- E2E test saved design list.
- Security test unauthorized design access.

## Dependencies/Blockers
- OMS-050
- OMS-052.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Limit account data shown in logs and admin surfaces.

## Launch Risk Notes
Account complexity can delay paid beta if it is allowed to block guest checkout unnecessarily.
