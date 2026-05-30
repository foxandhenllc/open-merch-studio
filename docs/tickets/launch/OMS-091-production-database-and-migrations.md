# OMS-091: Production Database And Migrations

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-09: Deployment And Paid Beta Launch  
**Critical path:** Yes

## Goal
Set up database persistence and migrations suitable for paid beta order and design data.

## User Value
Customer designs, quotes, passes, and orders persist reliably across deployment cycles.

## Current State
The schema exists, but production migration and environment setup need launch hardening.

## Requirements
- Confirm database provider, migration process, seed strategy, and backup expectations.
- Separate fixture seed data from production catalog data.
- Add migration runbook for deploys and rollback decisions.
- Protect production data from accidental local fixture resets.

## Implementation Notes
- Use Prisma migrations or the repo-supported migration path consistently.
- Add scripts for fixture seed and production-safe setup as separate commands.
- Document migration verification before deploy promotion.

## Interfaces/Data Changes
- Database schema, migration scripts, seed scripts, and deployment runbooks.

## Acceptance Criteria
- Production database can be migrated from a clean state.
- Fixture seed cannot be run against production without an explicit guard.
- Order and design records survive redeploys.
- Migration status is part of launch audit.

## Test Plan
- Run migrations locally from clean database.
- Test fixture seed guard.
- Run backend type-check and migration validation.

## Dependencies/Blockers
- OMS-030
- OMS-050
- OMS-052
- OMS-060.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not use private customer data in seeds, tests, or public fixtures.

## Launch Risk Notes
Data setup mistakes can block checkout or lose paid beta records.
