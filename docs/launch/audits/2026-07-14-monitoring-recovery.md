# Monitoring and Recovery Release Audit — 2026-07-14

**Status:** Pass for a locked production deployment

**Scope:** Durable payment/fulfillment recovery, protected operator actions, privacy-safe telemetry, database migration integrity, and closed-gate production verification

**Explicitly excluded:** A real Stripe charge, a signed live-event replay, and a Printful draft order

## Release

- Release commit: `1d8e3c2` (monitoring/recovery implementation begins at `ef23bf4`).
- Audited deployment URL at the time: `open-merch-studio-vercel-output.vercel.app`.
- Current canonical origin after the July 17 cutover: [openmerchstudio.com](https://openmerchstudio.com).
- Immutable deployment and provider-account inspection details are retained in private operations
  notes rather than this public audit.
- Runtime: Node.js 22.x.
- Vercel install and local full dependency audits: 0 vulnerabilities.

## Automated Verification

- Lint: pass.
- Type-check: pass.
- Production build: pass.
- Fixture/unit suite: 41 passed; the one PostgreSQL-only case was intentionally skipped in this mode.
- Fresh PostgreSQL recovery suite: 1 passed after all eight migrations were applied to an empty database.
- Fixture end-to-end smoke: pass.
- Recovery coverage includes refund-first reconciliation, monotonic partial/full refunds, both payment/expiry orderings, durable failure restoration, protected filtering/review audit, request-ID/error privacy, safe failure codes, and Printful external-ID duplicate recovery.

## Database Verification

- The two recovery migrations were applied to the dedicated Supabase production project.
- All eight local Prisma migration names and checksums match the durable `_prisma_migrations` ledger.
- Recovery tables remain protected by RLS from public clients; the application uses its private PostgreSQL connection.
- Post-migration Supabase security/performance advisors reported informational notices only, with no warning or error finding. The intentional no-public-policy notice is documented by Supabase's [RLS advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Production Controls

- `CHECKOUT_ACCESS_MODE=closed`
- `CHECKOUT_ENABLED=false`
- `ALLOW_LIVE_PAYMENTS=false`
- `VITE_ENABLE_PUBLIC_CHECKOUT=false`
- `FULFILLMENT_ENABLED=false`
- `ALLOW_LIVE_FULFILLMENT=false`
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false`
- Public capability reporting correctly shows Stripe and Printful as `available` because credentials are configured but authorization gates are closed.
- The protected admin API rejects an invalid credential and accepts the rotated deployment-only credential. No credential value was logged or committed.

## Reversible Production Recovery Drill

1. Inserted one synthetic paid-but-failed order directly into the production database.
2. Verified protected list/detail restoration showed `failed`, `unreviewed`, and no Printful order.
3. Requested a fulfillment retry and received `409 fulfillment_gate_closed`.
4. Verified no fulfillment attempt and no provider request were created.
5. Acknowledged and resolved the order; both review actions appeared in the durable audit trail.
6. Deleted the synthetic order and both synthetic audit rows; cleanup confirmed zero remaining attempts.

## Live Observations

- The audited deployment's `/api/health`: HTTP 200 with an `x-request-id`.
- Protected settings confirm checkout and fulfillment are disabled.
- The current immutable deployment has no error logs after health/admin verification.
- A safe negative admin request records its exact `order_not_found` recovery code without exposing request secrets.
- Checkout Session bearer IDs are fingerprinted in structured telemetry and redacted from request paths.

## Deferred Until the Supervised Purchase

- Signed live webhook delivery/replay evidence for a real Checkout Session.
- One real allowlisted payment and exactly one reviewable Printful draft.
- Stripe receipt/final tax and Printful recipient, variant, artwork, placement, technique, and price comparison.
- External paging/error-tracker integration and a visual operator dashboard. The protected API, structured logs, durable audit trail, and runbook are the MVP monitoring surface.

Public checkout remains closed. Opening the supervised smoke window is a separate explicit operator action.
