# OMS-090: Vercel Domain And Environment Readiness

**Status:** In progress; domain owned and attached, DNS and environment cutover pending
**Visibility:** Public  
**Epic:** EPIC-09: Deployment And Paid Beta Launch  
**Critical path:** Yes

## Goal

Prepare the Vercel project, staging domain, production domain, and environment configuration for paid beta.

## User Value

Customers reach a stable branded shop instead of a temporary deployment URL.

## Current State

The app is live on Vercel. The branded apex and `www` hostnames are attached to the production
project with a permanent `www` to apex redirect, while registrar DNS, canonical environment values,
and branded-origin verification remain transitional.

## Requirements

- Use `openmerchstudio.com` as the intended canonical domain after ownership and cutover verification.
- Separate preview, staging, and production environment values.
- Document required provider configuration names without values.
- Confirm production build command, output, and runtime expectations.

## Implementation Notes

- Audit Vercel project settings and deployment target names.
- Add deployment docs that describe environment groups and required checks.
- Keep live provider values in Vercel-managed configuration only.

## Interfaces/Data Changes

- Vercel project settings and environment variables.
- Public docs list variable names only.

## Acceptance Criteria

- A branded or approved staging URL serves the latest app.
- Preview deployments cannot accidentally use production provider settings.
- Required environment names are documented without values.
- Build and deployment steps are repeatable.

## Test Plan

- Run production build.
- Deploy preview and inspect environment mode.
- Open live URL and run smoke checks.

## Dependencies/Blockers

- OMS-080
- OPS-007.

## Source Anchors

- [Domain cutover checklist](../../launch/domain-cutover-openmerchstudio-com.md).
- Current Open Merch Studio deployment and environment contract.

## Public Safety/Privacy Notes

Do not commit or paste live environment values into docs or issues.

## Launch Risk Notes

Misconfigured environments can cause test traffic to spend real money or create real orders.
