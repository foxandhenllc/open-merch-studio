# OMS-070: Admin Controls For Catalog Pricing And AI Spend

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-07: Admin Observability And Ops  
**Critical path:** Yes

## Goal
Provide operator controls for the settings that determine what can be sold and what design actions are allowed.

## User Value
The shop can adapt during paid beta without code deployments for every catalog or spend adjustment.

## Current State
Admin-only catalog sync exists as an endpoint concept, but broader admin controls do not yet exist.

## Requirements
- Expose controls for curated catalog status, featured products, category margin rules, Studio Pass allowance, and AI spend caps.
- Record who changed settings and when.
- Require admin authorization for all changes.
- Provide fixture/admin seed data for OSS demos.

## Implementation Notes
- Build admin settings endpoints first, then a minimal UI once data flow is proven.
- Validate configuration ranges server-side.
- Use audit logs for setting changes affecting money or provider spend.

## Interfaces/Data Changes
- Admin settings APIs.
- Quote, catalog, and design policy services read active settings.

## Acceptance Criteria
- Operators can update curated status and margin rules.
- Operators can update design allowance and daily cap settings.
- Invalid setting values are rejected.
- Each change creates an audit entry.

## Test Plan
- Authorization tests for settings endpoints.
- Unit test settings validation.
- Integration test quote changes after margin update.

## Dependencies/Blockers
- OMS-021
- OMS-023
- OMS-031.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not expose admin settings mutations to public users.

## Launch Risk Notes
Hardcoded launch settings slow iteration and make cost control brittle.
