# OMS-094: Paid Beta Launch Checklist

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-09: Deployment And Paid Beta Launch  
**Critical path:** Yes

## Goal
Create the final go/no-go checklist for enabling real customers, real payments, and real fulfillment.

## User Value
The launch happens only after the shop can responsibly accept money and fulfill products.

## Current State
Launch readiness is implied by the feature list but not yet captured as a single decision checklist.

## Requirements
- List required passing checks for UX, catalog, pricing, AI spend, checkout, fulfillment, support, monitoring, privacy, and deployment.
- Separate public repo readiness from private operator readiness.
- Require sign-off before enabling production checkout and live fulfillment.
- Include rollback and pause steps for paid beta.

## Implementation Notes
- Create a launch checklist markdown doc linked from ticket index and private ops index.
- Reference each critical-path ticket by ID.
- Keep sensitive account-specific details in private ops files only.

## Interfaces/Data Changes
- Docs only; may become a GitHub issue or project milestone before launch.

## Acceptance Criteria
- Every critical path ticket has an explicit go/no-go status.
- The checklist says what to do to pause checkout or fulfillment.
- Private readiness items are referenced without exposing details publicly.
- The final launch decision can be made from this checklist and the audit report.
- `CHECKOUT_ACCESS_MODE=closed` is verified after every normal production deploy; the legacy `ENABLE_PUBLIC_CHECKOUT` value is not used for authorization.
- The supervised smoke uses `allowlist` with one operator email and returns to `closed` immediately afterward.
- The order migration for `taxCents`, `stripePaymentIntentId`, and `paidAt` is applied before a live charge.
- The signed live webhook receives completed, expired, and refunded events; a duplicate replay produces no second Printful draft.
- Exactly one editable Printful draft matches the OMS order, recipient, variant, artwork, placement, and technique, and is not auto-confirmed.

## Test Plan
- Review checklist against critical path tickets.
- Run all release checks named in checklist.
- Dry-run rollback or pause instructions in staging.

## Dependencies/Blockers
- All critical path tickets and OPS private checklist.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not include live account values or private incident contacts in the public checklist.

## Launch Risk Notes
Launching without a single go/no-go document increases the chance of missing a money or fulfillment blocker.
