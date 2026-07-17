# Branded Domain Cutover Audit — 2026-07-17

**Status:** Pass for the closed-gate branded origin

**Canonical origin:** `https://openmerchstudio.com`

## Completed

- Attached the apex and `www` hostnames to the RatBenetar Vercel production project.
- Configured registrar DNS with Vercel's project-specific apex and `www` records while retaining the
  registrar nameservers.
- Configured a path-preserving HTTP 308 redirect from `www` to the apex.
- Promoted Production `FRONTEND_URL` and `BACKEND_URL` to the branded apex and redeployed commit
  `6b0d2d9` as deployment `dpl_6uRkGSQord9UTdqDY82C6Ryyyqrj`.
- Retained the Vercel project alias as a rollback path.
- Updated the existing live Stripe webhook in place to
  `https://openmerchstudio.com/api/stripe/webhook` while preserving its signing secret and completed,
  expired, and refunded event subscriptions.
- Updated the Printful store website to the branded origin and completed a no-order live mockup matrix
  for the tee, tote, mug, sticker, and poster.
- Verified the Google Workspace alias domain and activated Gmail, MX, and SPF for the branded domain.
- Created the Open Merch Studio Support group with Chris Fox and Chris Henrich as direct members,
  verified external inbound delivery to `support@openmerchstudio.com`, and verified the reply reached
  the external sender.
- Set both members to `Each email`, promoted the branded support address in the Vercel Production
  environment and application defaults, and updated Stripe's public support email to the branded
  address. Chris's first member-delivery probe landed in Spam; it was marked safe, and Gmail confirmed
  future messages from that sender will go to Inbox. Chris Henrich should perform the same one-time
  action if his first support message is classified as Spam.
- Published the 2048-bit Google DKIM TXT record; Google Admin currently reports `Authenticating email
  with DKIM`, so full DKIM activation is not yet recorded as passing.

## Verified

- Authoritative registrar DNS returns the project-specific records; public resolver propagation is
  underway and may temporarily vary according to pre-cutover cache TTLs.
- The apex serves HTTPS with a valid certificate and the latest production application.
- `www` preserves the requested path while redirecting permanently to the apex.
- `/api/health` returns HTTP 200 with an `x-request-id`; AI is live while checkout and fulfillment
  remain configured but gated.
- The branded origin is accepted by CORS.
- Privacy, terms, returns, content-policy, and support routes return HTTP 200.
- The Product → Configure → Describe journey works on the branded origin, with one primary Generate
  action after a valid prompt.
- Desktop viewports at 1440×900 and 1280×720 retain the fixed workbench without document overflow.
- Mobile viewports at 390×844 and 320×568 retain one progress rail, one internal task-panel scroller,
  no horizontal overflow, and no duplicated idle progress UI.
- A durable existing design asset is retrievable unauthenticated from the branded `/api/design/assets`
  route as a valid RGBA PNG.
- Search indexing remains blocked by the HTML robots directive and response header.
- Printful retrieved branded artwork for all five launch products without creating an order.
- The Stripe endpoint configuration is active at the branded URL; signed real delivery and duplicate
  replay remain part of the supervised-purchase evidence.
- The new deployment reported zero dependency vulnerabilities and no error-level runtime logs during
  the cutover smoke.

## Still Gated

- Public checkout and live fulfillment authorization.
- Signed Stripe delivery, durable reconciliation, and duplicate-replay verification for the supervised
  real-money smoke.
- Final DKIM activation and received-message authentication evidence. Because the branded domain is a
  Workspace alias domain, the tested group reply displayed `support@foxandhenllc.com`; a branded
  outbound From identity remains a separate configuration and approval item.
- Legal seller/DBA identity, public mailing address, policy dates, purchaser eligibility, governing
  law/dispute approach, returns/claims/refunds, artwork rights, and data-retention review.
- Search indexing remains intentionally disabled; approved favicon/social image and Search Console
  are still pending, and crawl metadata/404 behavior must pass final verification before indexing.
- One allowlisted payment and exactly one manually reviewed, never auto-confirmed Printful draft.

Opening an allowlisted real-money smoke window remains a separate explicit operator action.
