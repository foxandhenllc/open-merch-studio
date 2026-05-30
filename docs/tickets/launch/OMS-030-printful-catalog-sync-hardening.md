# OMS-030: Printful Catalog Sync Hardening

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-04: Catalog And Printful Fulfillment  
**Critical path:** Yes

## Goal
Make the catalog sync reliable enough to maintain a curated paid beta product set.

## User Value
Customers see current product, variant, price, placement, and availability data.

## Current State
The backend has schema and helper structure for catalog entities and a mock sync path.

## Requirements
- Sync categories, catalog products, variants, prices, availability, placements, and mockup styles from Printful where available.
- Record sync runs with status, counts, errors, and timestamps.
- Support fixture sync for OSS development without Printful credentials.
- Never expose every provider product by default; sync data and curation are separate.

## Implementation Notes
- Harden the admin sync endpoint with provider abstraction, pagination handling, and structured errors.
- Map provider identifiers to stable local records.
- Store raw provider excerpts only when needed for debugging and safe to retain.

## Interfaces/Data Changes
- POST /api/admin/catalog/sync.
- Database catalog tables for categories, products, variants, placements, mockup styles, and sync runs.

## Acceptance Criteria
- Fixture sync works from a clean clone.
- Live sync can update existing records without duplicating products.
- Sync failures are recorded and surfaced to admin users.
- Curated sellable status is not overwritten accidentally by provider sync.

## Test Plan
- Integration test fixture sync.
- Unit test provider-to-local normalization.
- Regression test repeated sync idempotency.

## Dependencies/Blockers
- OMS-091 for production database before live use.

## Source Anchors
- [Printful v2 catalog and mockup docs](https://developers.printful.com/docs/v2-beta/)
- [Printful order and catalog flow docs](https://developers.printful.com/docs/)

## Public Safety/Privacy Notes
Do not commit live provider responses containing account-specific data.

## Launch Risk Notes
Catalog drift can lead to unavailable products or incorrect order payloads.
