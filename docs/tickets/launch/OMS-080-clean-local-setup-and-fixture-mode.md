# OMS-080: Clean Local Setup And Fixture Mode

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-08: Open Source Developer Experience  
**Critical path:** No

## Goal
Make the project easy for outside contributors to run without live provider accounts.

## User Value
OSS contributors can evaluate and improve the app with realistic local behavior.

## Current State
The repo already supports fixture concepts, but launch features must preserve that standard.

## Requirements
- Document one-command or short-command local setup for backend, frontend, database, and fixture data.
- Ensure catalog, design, quote, mockup, checkout simulation, and fulfillment simulation work without live providers.
- Keep .env.example public-safe and complete for optional integrations.
- Add troubleshooting notes for common setup failures.

## Implementation Notes
- Update README and docs as features land.
- Add seed or fixture scripts that do not depend on private data.
- Keep tests and CI using mock providers by default.

## Interfaces/Data Changes
- Developer scripts and fixture data.
- Optional provider env vars documented without real values.

## Acceptance Criteria
- A clean clone can run fixture mode and browse products.
- A clean clone can complete simulated design, quote, and order flow.
- Optional live integrations are clearly separated from required setup.
- No private data is needed for local tests.

## Test Plan
- Run clean install and setup commands.
- Run fixture E2E smoke flow.
- Run public data scan over fixture files.

## Dependencies/Blockers
- All feature epics must maintain fixture mode.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Fixture data must be synthetic or public-safe.

## Launch Risk Notes
If local setup breaks, OSS value and external contribution quality drop sharply.
