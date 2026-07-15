# Launch Audit Template

**Status:** Template  
**Visibility:** Public-safe

Use this template before enabling production checkout, live OpenAI generation, or real Printful fulfillment.

## Build And Test Evidence

- `npm run type-check`:
- `npm test`:
- `npm run build`:
- Fixture smoke path:
- Staging smoke path:
- Recovery-state tests:
- Duplicate webhook/draft test:
- Partial/full refund distinction test:
- Refund-versus-fulfillment terminal-state guard:
- Protected admin authorization test:
- Production dependency audit:

## Credential And Privacy Scan

Command:

```bash
rg -n -i 'api[_-]?key|secret|token|password|invoice|billing|org-[A-Za-z0-9]' .
```

Expected result: no live credentials, private provider values, private customer data, billing artifacts, or organization IDs in public repo files.

## Provider Readiness

- OpenAI live generation: disabled until OPS-004 approval.
- Stripe live checkout: disabled until OPS-002 and OPS-008 approval.
- Printful live fulfillment: disabled until OPS-003 and OPS-006 approval.
- Vercel/domain production readiness: blocked until OPS-007 approval.

## Operations And Recovery

- `x-request-id` present on API responses:
- Structured `oms_operational` events visible without customer/artwork/provider payload data:
- Failed and needs-review order survives a cold reload:
- Paid order with failed fulfillment is visible through protected admin detail:
- Printful retry produces or attaches exactly one draft:
- Review acknowledgement/resolution audit entry captured:
- Stripe event rows are terminal (`processed`, `duplicate`, `expired`, `refunded`, or an explicit failure outcome):
- Supabase schema and `_prisma_migrations` checksums match every migration folder on `main`:
- Any open Stripe Checkout Sessions from the supervised window were explicitly expired:
- Emergency checkout/fulfillment gates verified closed after the smoke:

## Go/No-Go

- Public repo ready:
- Fixture path ready:
- Private ops reviewed:
- Checkout enabled:
- Live generation enabled:
- Real fulfillment enabled:
- Rollback/pause procedure tested:

Decision:

- Go:
- No-go:
- Reviewer:
- Date:
