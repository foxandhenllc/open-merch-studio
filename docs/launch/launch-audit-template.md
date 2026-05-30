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
