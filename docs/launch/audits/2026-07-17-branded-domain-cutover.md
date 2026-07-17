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
- Search indexing remains blocked by the HTML robots directive, response header, and `robots.txt`.
- The new deployment reported zero dependency vulnerabilities and no error-level runtime logs during
  the cutover smoke.

## Still Gated

- Public checkout and live fulfillment authorization.
- Branded Stripe webhook delivery and duplicate-replay verification.
- Branded support mailbox verification and customer-facing support-address promotion.
- Printful store URL update and a no-order mockup retrieval matrix using branded artwork URLs.
- Legal seller identity, effective-date, and jurisdiction review.
- Search indexing, sitemap, canonical metadata, approved favicon/social image, and Search Console.
- Correct HTTP 404 status handling for unknown application routes before indexing is enabled.

Opening an allowlisted real-money smoke window remains a separate explicit operator action.
