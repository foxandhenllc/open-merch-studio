# OMS-071: Analytics Events And Cost Reporting

**Status:** MVP instrumentation implemented; reporting expansion deferred
**Visibility:** Public  
**Epic:** EPIC-07: Admin Observability And Ops  
**Critical path:** Yes

## Goal

Measure funnel health, conversion, and AI spend exposure without collecting unnecessary customer data.

## User Value

Operators can improve pricing and UX based on real behavior while respecting privacy.

## Current State

The frontend and webhook path emit bounded Vercel Analytics events without raw prompts or artwork,
and the backend persists AI spend events when PostgreSQL is configured. A typed shared schema,
complete funnel dashboard, retention review, and automated cost alerts remain deferred.

## Requirements

- Track events for category view, product view, studio start, idea assist, draft generation, pass purchase, quote, cart, checkout, order, and fulfillment milestones.
- Report AI spend estimates by day, session, provider mode, action type, and conversion outcome.
- Avoid storing raw prompts or private artwork in analytics events.
- Support local logging or fixture analytics for OSS development.

## Implementation Notes

- Define a typed event schema shared by frontend and backend where practical.
- Add server-side event recording for money and provider actions.
- Build a simple admin cost report for paid beta.

## Interfaces/Data Changes

- Analytics event writer service.
- Admin report endpoint for funnel and cost metrics.

## Acceptance Criteria

- Core funnel events are recorded in local or production storage.
- AI spend report can show free-start versus Studio Pass usage.
- Events omit raw private design content.
- Reports can be viewed by authorized admins only.

## Test Plan

- Unit test event schema validation.
- Integration test event recording during draft and checkout.
- Admin report test for spend aggregation.

## Dependencies/Blockers

- OMS-021
- OMS-052
- OMS-070.

## Source Anchors

- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes

Collect the minimum event payload needed for product and spend decisions.

## Launch Risk Notes

Without reporting, pricing and allowance choices become guesses.
