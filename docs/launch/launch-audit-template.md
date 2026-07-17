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
- Stripe live endpoint: branded URL active for completed, expired, and refunded events; the one-time
  allowlisted smoke plus signed delivery and duplicate-replay evidence passed on July 17, 2026. Keep
  checkout closed until a separate public-launch decision.
- Printful preview: branded store URL and five-product no-order live mockup matrix verified; the
  one-draft supervised smoke passed without confirmation or a duplicate side effect. Keep fulfillment
  closed until a separate public-launch decision.
- Vercel/domain production readiness: branded apex and `www` cutover complete; retain the Vercel alias
  only as a rollback surface.
- Support mail: Workspace alias, Gmail, MX, and SPF active; branded group routes to Chris Fox and
  Chris Henrich; external inbound-and-reply test passed. A branded outbound From test also passed SPF,
  DKIM for `openmerchstudio.com`, and DMARC.
- App-owned transactional email: disabled until sender-domain and exactly-once delivery approval.

## Legal And Customer-Policy Readiness

- Seller wording approved or replaced (`Christopher Fox d/b/a Open Merch Studio` proposed):
- Email-only public contact or explicitly approved business mailing address:
- Pennsylvania governing-law paragraph approved, revised, or omitted:
- Tax registration, filing, and remittance owner plus operating path documented:
- Complete policy proposal approved and deployed with effective/last-updated dates:
- Checkout policy links and assent reviewed:
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
