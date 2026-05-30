# OMS-062: Admin Order Dashboard

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-07: Admin Observability And Ops  
**Critical path:** Yes

## Goal
Give operators a secure dashboard for monitoring and resolving paid beta orders.

## User Value
Customers get faster support because operators can see order state, payment state, design readiness, and fulfillment status.

## Current State
No admin order dashboard exists yet.

## Requirements
- Show orders by status, date, risk state, customer contact, product, design preview, payment state, and fulfillment state.
- Expose actions for review, retry sync, resend confirmation, cancel eligible order, and mark support note.
- Require admin authorization for all dashboard access.
- Avoid showing more customer data than needed for operations.

## Implementation Notes
- Build a minimal protected admin order list and detail view.
- Read from order, quote, design, payment, and fulfillment records.
- Use server-side authorization checks for every admin endpoint.

## Interfaces/Data Changes
- Admin APIs for order list, order detail, support note, retry sync, and eligible actions.
- Frontend admin route protected by auth.

## Acceptance Criteria
- Unauthorized users cannot access admin order data.
- Operators can find orders needing review.
- Order detail shows enough context to resolve fulfillment issues.
- Admin actions call state transition services rather than direct record mutation.

## Test Plan
- Authorization test for admin endpoints.
- UI test needs-review filter.
- Integration test retry sync action.

## Dependencies/Blockers
- OMS-060
- OMS-061
- OMS-070.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Minimize customer data exposure and avoid exporting private order data from admin screens.

## Launch Risk Notes
Without admin tooling, paid beta will depend on manual database inspection.
