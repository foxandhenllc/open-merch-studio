# OMS-092: End To End Launch Smoke Tests

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-09: Deployment And Paid Beta Launch  
**Critical path:** Yes

## Goal
Create repeatable smoke tests for the complete paid beta path before public launch.

## User Value
Customers encounter fewer broken flows because the critical journey is tested before deploys.

## Current State
No full launch E2E smoke suite exists yet.

## Requirements
- Test shop browse, product select, design idea, rough draft, Studio Pass simulation, quote, cart, checkout test mode, order confirmation, and fixture fulfillment.
- Run against local fixture mode and staging where possible.
- Avoid real charges, real provider orders, or live provider generation in default smoke tests.
- Capture screenshots or traces for launch audit evidence.

## Implementation Notes
- Use Playwright or the repo-supported browser test runner.
- Add deterministic fixture data for the smoke path.
- Make live-provider smoke checks opt-in and clearly named.

## Interfaces/Data Changes
- E2E test suite and launch audit artifacts.

## Acceptance Criteria
- The default smoke suite completes without live provider credentials.
- Staging smoke tests verify the deployed app path.
- Failure output points to the broken step.
- Smoke evidence can be attached to launch review.

## Test Plan
- Run local smoke suite.
- Run staging smoke suite after deploy.
- Review screenshots for visible layout issues.

## Dependencies/Blockers
- OMS-010 through OMS-061.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Default tests must not create real charges, live generated images, or provider orders.

## Launch Risk Notes
Without E2E smoke tests, regressions in the sales path are likely.
