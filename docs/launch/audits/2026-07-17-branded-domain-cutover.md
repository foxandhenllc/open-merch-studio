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
  `https://openmerchstudio.com/api/stripe/webhook` with completed, expired, and refunded event
  subscriptions. The signing secret was subsequently rotated and verified in deployment-managed
  configuration without recording its value.
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
- Published the 2048-bit Google DKIM TXT record. A subsequent external branded-sender test passed SPF,
  DKIM for `openmerchstudio.com`, and DMARC.

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
- Search mechanics passed during cutover. The owner subsequently approved public open-source
  indexing on July 17, 2026 while commerce remained closed.
- Printful retrieved branded artwork for all five launch products without creating an order.
- The Stripe endpoint configuration is active at the branded URL. One signed real delivery plus two
  duplicate replays returned HTTP 200 during the supervised purchase, while exactly one Printful draft
  was created and never confirmed.
- The new deployment reported zero dependency vulnerabilities and no error-level runtime logs during
  the cutover smoke.

## Still Gated

- Public checkout and live fulfillment authorization.
- Public authorization to accept payments or create Printful drafts; the supervised window passed and
  production returned to closed gates with both capabilities reporting `available`, not `live`.
- Pennsylvania fictitious-name registration confirmation for `Open Merch Studio` and final paid-launch
  approval of the deployed FoxAndHen LLC operator wording, email-only public contact, policy dates,
  purchaser eligibility, returns/claims/refunds, artwork rights, and data-retention language. The
  owner directed that the proposed Pennsylvania governing-law paragraph be omitted.
- Search indexing is approved for the public open-source studio; approved favicon/social image and
  Search Console remain follow-up improvements. The custom 404 remains non-indexable.
- Private operator sign-off for public paid beta.

The allowlisted real-money smoke is recorded separately in
[the supervised live-commerce audit](./2026-07-17-supervised-live-commerce-smoke.md). It did not
authorize public checkout or fulfillment. Indexing was authorized later as a separate open-source
launch decision.
