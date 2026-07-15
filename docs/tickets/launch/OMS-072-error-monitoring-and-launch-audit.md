# OMS-072: Error Monitoring And Launch Audit

**Status:** MVP implemented
**Visibility:** Public  
**Epic:** EPIC-07: Admin Observability And Ops  
**Critical path:** Yes

## Goal

Add practical monitoring and audit evidence before inviting paid beta users.

## User Value

Customers benefit from faster detection of broken checkout, generation, and fulfillment paths.

## Current State

The backend emits privacy-safe JSON operational events for checkout, signed Stripe webhooks,
Printful draft creation/retry, refunds, and unhandled requests. Every request receives an
`x-request-id`, unexpected production errors return a generic response, `/api/health` remains the
public liveness check, and the launch audit template plus paid-beta runbook define verification and
rollback evidence.

## Requirements

- Capture application errors for catalog, design, checkout, webhook, and fulfillment paths.
- Add health checks or smoke checks for critical services.
- Create a launch audit report template for build status, tests, scans, known issues, and production configuration status.
- Keep monitoring configuration values outside the repo.

## Implementation Notes

- Use lightweight logging and error reporting appropriate to the current stack.
- Add scripted smoke checks where possible.
- Generate a launch audit markdown report before paid beta activation.

## Interfaces/Data Changes

- Health check endpoint or smoke command.
- Admin-only error summaries if implemented in app.

## Acceptance Criteria

- Critical path errors are observable by operators.
- A smoke check can verify catalog, quote, checkout test mode, and fixture fulfillment.
- Launch audit report can be produced without private values.
- Known issues are documented before paid beta traffic.

## Test Plan

- Run smoke command locally.
- Simulate checkout failure and verify logged error.
- Review launch audit output for private data.

## Implemented MVP Evidence

- `backend/src/utils/operational-logger.ts` accepts only operational identifiers and classifications;
  email, shipping address, prompt, artwork URL/content, credentials, and provider payloads are not
  log fields.
- `backend/src/middleware.ts` assigns request IDs and redacts unexpected production `500` messages.
- Automated tests verify log-field allowlisting, request IDs, redacted `500` responses, protected
  admin access, retry idempotency helpers, and recovery-state restoration.
- Vercel log watching is sufficient for the supervised smoke. Automated paging/error-tracker
  integration remains a go/no-go item before unattended public traffic.

## Dependencies/Blockers

- OMS-052
- OMS-061
- OMS-092
- OMS-093.

## Source Anchors

- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes

Do not send private artwork, customer messages, or provider credentials to logs.

## Launch Risk Notes

Launch without monitoring makes payment and fulfillment issues hard to catch quickly.
