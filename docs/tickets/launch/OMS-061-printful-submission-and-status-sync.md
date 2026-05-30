# OMS-061: Printful Submission And Status Sync

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-06: Commerce Accounts And Orders  
**Critical path:** Yes

## Goal
Submit paid, validated orders to Printful and keep fulfillment status synchronized.

## User Value
Customers can actually receive the products they buy and track order progress.

## Current State
Order payload helpers exist, but live submission and lifecycle sync are not complete.

## Requirements
- Submit orders only after payment confirmation, payload validation, readiness pass, and policy checks.
- Record provider order ID and submission result.
- Sync provider status updates through webhooks or scheduled polling as available.
- Handle provider failures with needs-review state and customer-safe messaging.

## Implementation Notes
- Add a fulfillment service with fixture and live Printful providers.
- Make submission idempotent by local order ID and provider reference.
- Map provider statuses into local order states.

## Interfaces/Data Changes
- Fulfillment service consumes paid local orders.
- Admin order dashboard shows provider status and last sync.

## Acceptance Criteria
- Fixture fulfillment simulates submission and status changes.
- Live submission is blocked without valid provider configuration.
- Duplicate submit attempts do not create duplicate provider orders.
- Provider failure moves the order to needs review with operator guidance.

## Test Plan
- Integration test fixture fulfillment.
- Idempotency test duplicate submission.
- Status mapping unit test.

## Dependencies/Blockers
- OMS-034
- OMS-060
- OMS-091.

## Source Anchors
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Do not write live provider account data into public logs or fixture files.

## Launch Risk Notes
Fulfillment mistakes are the highest-impact paid beta failure mode.
