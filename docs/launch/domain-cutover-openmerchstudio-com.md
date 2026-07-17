# openmerchstudio.com Domain Cutover Checklist

**Status:** Branded origin, provider URLs, and support routing active; DKIM authentication and indexing remain
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

Use this target Production contract without copying secret values into repository files. The external
mailbox round-trip in Step 6 has passed, so the branded support-address lines are ready to promote:

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
on July 17, 2026. Checkout and fulfillment authorization remained closed. The branded mailbox passed
external inbound-and-reply testing. Repository defaults and the Production `VITE_SUPPORT_EMAIL` and
`SUPPORT_EMAIL` values now use the branded support address; the release containing those defaults must
still be redeployed and verified after each environment promotion.

## 4. Move The Stripe Webhook Safely

- The existing live endpoint was updated in place on July 17, 2026 to
  `https://openmerchstudio.com/api/stripe/webhook` for:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `charge.refunded`
- Because the endpoint was edited rather than replaced, its signing secret remained unchanged and no
  secret rotation or environment update was required. If the endpoint is replaced later, treat the
  new signing secret as distinct and update deployment-managed configuration without recording it here.
- Checkout remains closed. Verify signed real delivery, terminal payment-event persistence, and
  duplicate replay during the supervised purchase; those checks cannot be proven by URL configuration
  alone.
- Stripe's public support email now uses `support@openmerchstudio.com`. Continue to review the public
  business URL, branding, and receipt/refund email settings during the supervised commerce smoke.

## 5. Verify Printful And Artwork Retrieval

- The Printful store name and website use Open Merch Studio and `https://openmerchstudio.com/`.
- Verify `ENABLE_LIVE_PRINTFUL=true` for this mockup-only check. That provider-preview flag is
  separate from `ALLOW_LIVE_FULFILLMENT` and `FULFILLMENT_ENABLED`, which must both remain false so
  no Printful order can be created.
- Generate a synthetic test design while fulfillment remains disabled.
- Open its `https://openmerchstudio.com/api/design/assets/...png` URL without an authenticated browser
  session and verify the correct PNG content type and artwork.
- A no-order live matrix passed for the tee, tote, mug, sticker, and poster on July 17, 2026. Printful
  retrieved the branded asset URL for every product without creating a provider order.
- Do not create or confirm a physical order during this domain-only verification.

## 6. Prepare Branded Support And Sending

- The `openmerchstudio.com` Google Workspace alias domain is verified; Gmail, MX, and SPF are active.
- A 2048-bit DKIM TXT record is published under selector `google`. Google Admin currently reports
  `Authenticating email with DKIM`; do not record DKIM as fully active or passing until that status
  completes and a received-message authentication check confirms it.
- `support@openmerchstudio.com` routes to the Open Merch Studio Support group. Chris Fox and Chris
  Henrich are direct members with `Each email` subscriptions, and an external inbound message plus the
  group reply both completed. Chris's first member-delivery probe was delivered to Spam and then marked
  safe; Chris Henrich should mark his first support message `Not spam` if Gmail classifies it similarly.
- Because `openmerchstudio.com` is configured as a Google Workspace alias domain, the tested outgoing
  group reply displayed `support@foxandhenllc.com`. Treat branded inbound support as verified, but do
  not claim a branded From identity until the Workspace domain/sender configuration is changed and
  retested.
- Complete legal review of the seller/operator identity and add the approved entity, effective date,
  and jurisdiction-specific terms to customer-facing policy pages before public payment access.
- If Open Merch Studio later sends transactional email directly, configure a dedicated sender or
  subdomain with SPF, DKIM, and DMARC before enabling it.
- Keep app-owned customer email sending disabled until the sender is verified and exactly-once email
  tests pass. Stripe-hosted receipts/refund messages remain the MVP payment-email surface.
- Production `VITE_SUPPORT_EMAIL` and `SUPPORT_EMAIL` have been promoted after the successful external
  round-trip. Keep app-owned transactional sending disabled until its separate sender is verified.

## 7. Make The Branded Origin Discoverable

The branded origin remains intentionally `noindex`. Prepare crawl mechanics without opening that gate:

- Retain the HTML robots directive and `X-Robots-Tag` noindex response header.
- Let `robots.txt` expose the canonical sitemap so crawlers can observe page-level noindex directives.
- Limit the sitemap to the studio and approved policy/support routes.
- Use absolute `https://openmerchstudio.com/` canonical and Open Graph URLs.
- Confirm random unknown routes return a real HTTP 404 and are not included in the sitemap.

Only after apex HTTPS, redirects, legal/support routes, and production content pass review:

- Change the HTML robots directive from `noindex,nofollow,noarchive` to `index,follow`.
- Remove the temporary `X-Robots-Tag` noindex header from `vercel.json`.
- Add an approved brand favicon/social asset, then verify it and the web manifest from the apex
  origin. Do not substitute a handcrafted placeholder.
- Add and verify the domain in Google Search Console, submit the sitemap, and request indexing only
  after the final visual/content audit.

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
