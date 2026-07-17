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
- Branded origin remains `noindex` until legal/support/final-design approval:
- Branded-domain cutover checklist:

## Credential And Privacy Scan

Command:

```bash
rg -n -i 'api[_-]?key|secret|token|password|invoice|billing|org-[A-Za-z0-9]' .
```

Expected result: no live credentials, private provider values, private customer data, billing artifacts, or organization IDs in public repo files.

## Provider Readiness

- OpenAI generation: verify provider policy, moderation, spend controls, and pause behavior independently
  of the closed commerce gates.
- Stripe live endpoint: branded URL active for completed, expired, and refunded events; checkout stays
  closed until the allowlisted smoke and signed delivery/duplicate-replay evidence.
- Printful preview: branded store URL and five-product no-order live mockup matrix verified; fulfillment
  stays closed until the one-draft supervised smoke.
- Vercel/domain production readiness: branded apex and `www` cutover complete; retain the Vercel alias
  only as a rollback surface.
- Support mail: Workspace alias, Gmail, MX, and SPF active; branded group routes to Chris Fox and
  Chris Henrich; external inbound-and-reply test passed. DKIM is still authenticating, and the tested
  group reply used the primary-domain From identity rather than the branded alias.
- App-owned transactional email: disabled until sender-domain and exactly-once delivery approval.

## Legal And Customer-Policy Readiness

- Contracting entity and approved DBA/trade-name wording:
- Public mailing address and approved policy contact:
- Effective/last-updated dates:
- Purchaser eligibility/minimum age:
- Governing law, venue, and dispute approach:
- Return/claim windows, evidence, refund timing, and lost/delayed shipment rules:
- AI-output/customer-artwork rights and data retention/deletion language:
- Search indexing remains disabled until the approved text is deployed:

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
- Support mailbox and Stripe-hosted receipt/refund messages verified without enabling duplicate
  app-owned email:

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
