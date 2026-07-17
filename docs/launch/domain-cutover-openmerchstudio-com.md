# openmerchstudio.com Domain Cutover Checklist

**Status:** Branded origin active; provider, support, and indexing follow-ups remain
**Visibility:** Public-safe  
**Intended canonical origin:** `https://openmerchstudio.com`

Use this checklist after the domain is registered. Domain ownership does not authorize payments or
fulfillment: checkout and provider gates remain closed until the separate supervised-purchase review.
Never place DNS credentials, provider keys, database values, or webhook signing secrets in this file.

## 1. Register And Protect The Domain

- Register `openmerchstudio.com` with domain privacy, automatic renewal, account MFA, and a durable
  recovery method.
- Keep registrar and Vercel access limited to the minimum operator group.
- Record the registrar, renewal owner, and recovery procedure in private operations notes.

## 2. Attach The Domain In Vercel

- Add both `openmerchstudio.com` and `www.openmerchstudio.com` to the production project.
- Make the apex origin canonical and configure a permanent `www` to apex redirect.
- Apply the DNS records Vercel provides and wait for certificate issuance.
- Verify HTTPS at the apex and `www`, including `/api/health`, `/privacy`, `/terms`, `/returns`, and
  `/support`.
- Keep the existing Vercel URL available for rollback, but stop presenting it as canonical after the
  branded origin passes verification.

As of July 17, 2026, both hostnames are attached to the RatBenetar production project, registrar DNS
uses Vercel's project-specific records, and HTTPS is active. Vercel redirects `www` to the apex with
HTTP 308 while preserving paths and queries. Resolver caches may briefly retain the former registrar
parking response until their pre-cutover TTL expires.

## 3. Promote The URL Contract With Gates Closed

Set deployment-managed Production values, without copying their values into repository files:

```dotenv
FRONTEND_URL=https://openmerchstudio.com
BACKEND_URL=https://openmerchstudio.com
VITE_API_URL=
VITE_SUPPORT_EMAIL=support@openmerchstudio.com
VITE_ENABLE_LOCAL_FALLBACKS=false
SUPPORT_EMAIL=support@openmerchstudio.com
TRANSACTIONAL_EMAILS_ENABLED=false
EMAIL_PROVIDER=fixture
EMAIL_FROM=
EMAIL_REPLY_TO=support@openmerchstudio.com
VITE_PUBLIC_APP_MODE=production
CHECKOUT_ACCESS_MODE=closed
CHECKOUT_ENABLED=false
ALLOW_LIVE_PAYMENTS=false
VITE_ENABLE_PUBLIC_CHECKOUT=false
FULFILLMENT_ENABLED=false
ALLOW_LIVE_FULFILLMENT=false
PRINTFUL_AUTO_CONFIRM_ORDERS=false
```

`FRONTEND_URL` controls Stripe success/cancel returns and the allowed browser origin. `BACKEND_URL`
controls the public artwork URLs that Printful retrieves. An empty `VITE_API_URL` preserves same-origin
`/api/*` requests.

- Redeploy after changing environment values; an environment edit does not alter an existing build.
- Confirm public capability reporting remains configured/available rather than live.
- Confirm a checkout-session request remains blocked before continuing.

The Production `FRONTEND_URL` and `BACKEND_URL` values were promoted to the branded apex and deployed
on July 17, 2026. Checkout and fulfillment authorization remained closed; support-address promotion
remains deferred until the branded mailbox passes external send-and-receive testing.

## 4. Move The Stripe Webhook Safely

- Create a live Stripe webhook endpoint at
  `https://openmerchstudio.com/api/stripe/webhook` for:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `charge.refunded`
- Store that endpoint's new signing secret as the deployment-managed `STRIPE_WEBHOOK_SECRET`. Signing
  secrets belong to one endpoint and must not be assumed to match the temporary-host endpoint.
- Redeploy with checkout still closed, send a signed test event, and verify one terminal payment-event
  row plus privacy-safe operational logging.
- Keep the old endpoint active until the branded endpoint has passed delivery and duplicate-replay
  checks. Disable the old endpoint afterward so events are not delivered twice indefinitely.
- Update the Stripe public business URL, branding, receipt/refund email settings, and support contact.

## 5. Verify Printful And Artwork Retrieval

- Update the Printful store name and website to the branded origin.
- Verify `ENABLE_LIVE_PRINTFUL=true` for this mockup-only check. That provider-preview flag is
  separate from `ALLOW_LIVE_FULFILLMENT` and `FULFILLMENT_ENABLED`, which must both remain false so
  no Printful order can be created.
- Generate a synthetic test design while fulfillment remains disabled.
- Open its `https://openmerchstudio.com/api/design/assets/...png` URL without an authenticated browser
  session and verify the correct PNG content type and artwork.
- Build mockups for the tee, tote, mug, sticker, and poster; confirm Printful can retrieve the branded
  asset URL and no preview references the temporary host.
- Do not create or confirm a physical order during this domain-only verification.

## 6. Prepare Branded Support And Sending

- Create and test `support@openmerchstudio.com`, including inbound delivery and replies.
- Complete legal review of the seller/operator identity and add the approved entity, effective date,
  and jurisdiction-specific terms to customer-facing policy pages before public payment access.
- If Open Merch Studio later sends transactional email directly, configure a dedicated sender or
  subdomain with SPF, DKIM, and DMARC before enabling it.
- Keep app-owned customer email sending disabled until the sender is verified and exactly-once email
  tests pass. Stripe-hosted receipts/refund messages remain the MVP payment-email surface.
- Update the production `VITE_SUPPORT_EMAIL` only after the mailbox works from an external address.

## 7. Make The Branded Origin Discoverable

Only after apex HTTPS, redirects, legal/support routes, and production content pass review:

- Change the HTML robots directive from `noindex,nofollow,noarchive` to `index,follow`.
- Remove the temporary `X-Robots-Tag` noindex header from `vercel.json`.
- Replace the blocking `frontend/public/robots.txt` with an allow policy and a canonical sitemap URL.
- Add a sitemap covering the studio and public policy/support routes.
- Add `https://openmerchstudio.com/` as the HTML canonical and Open Graph URL; add an absolute branded
  social-preview image.
- Add an approved brand favicon/social asset, then verify it and the web manifest from the apex
  origin. Do not substitute a handcrafted placeholder.
- Add and verify the domain in Google Search Console, submit the sitemap, and request indexing only
  after the final visual/content audit.
- Confirm random unknown routes show the in-app not-found page and are not included in the sitemap.

## 8. Final Verification And Rollback

- Run lint, type-check, unit/integration tests, fixture smoke, production build, dependency audit, and
  the responsive first-visitor matrix.
- Verify apex and `www` redirects, API request IDs, CORS, Stripe return URLs, webhook signatures,
  artwork downloads, support links, and privacy/terms/returns copy.
- Review production logs after the cutover without logging private provider or customer data.
- If domain behavior is wrong, close checkout/fulfillment gates, restore the last known-good URL
  values, redeploy, and keep the branded origin non-indexable until corrected.

Passing this checklist establishes the branded origin. Opening an allowlisted real-money smoke window
remains a separate, explicit operator decision under the paid-beta runbook.
