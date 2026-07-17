# Supervised Live Commerce Smoke Audit — 2026-07-17

**Status:** Pass for one allowlisted purchase; production returned to closed gates

**Visibility:** Public-safe, sanitized evidence

## Scope

Validate the live Stripe-to-OMS-to-Printful path once under direct operator supervision without
opening public checkout or confirming a physical Printful order.

## Verified

- Checkout was opened only in allowlist mode for the supervised purchase.
- OMS order `OMS-2026-655AFL` completed as one live Stripe payment for $16.94, including $0.96
  Pennsylvania tax.
- The signed original webhook delivery returned HTTP 200 and durable checkout reconciliation completed.
- Two deliberate replays of that same webhook event also returned HTTP 200.
- Durable PostgreSQL state contains one terminal `processed` Stripe payment event and one successful
  fulfillment attempt for the order. Both the order and fulfillment attempt reference the same single
  Printful draft; no second attempt or provider order was recorded.
- Printful contained exactly one editable draft for the OMS order after the original delivery and both
  replays. The draft was never confirmed, and no duplicate fulfillment side effect occurred.
- The live webhook signing secret was rotated, updated only in deployment-managed Production
  configuration, and verified with a signed delivery. No secret value was written to repository files
  or launch evidence.
- Stripe-hosted successful-payment and refund customer emails are enabled.
- The successful-payment receipt reached the purchasing inbox with the Open Merch Studio sender name.
- An external message sent with the branded `Open Merch Studio Support
  <support@openmerchstudio.com>` identity passed SPF, DKIM for `openmerchstudio.com`, and DMARC.

## Closeout

- Checkout access returned to `closed`; the temporary allowlist was removed.
- Live payment, checkout presentation, live fulfillment, and fulfillment submission authorization
  returned to disabled.
- Printful auto-confirm remained disabled throughout the smoke.
- Production was redeployed after closeout.
- Production health reports checkout and fulfillment as `available`, not `live`. In this state the
  providers remain configured but are not authorized to accept a new payment or create a draft order.
- A post-closeout checkout probe used the still-valid durable quote and artwork and returned `blocked`
  with no Checkout URL because the emergency payment kill switch was disabled.

## Remaining Public-Launch Gates

- Approve and deploy the legal seller identity, mailing/contact details, policy dates, eligibility,
  jurisdiction, return/refund rules, artwork-rights language, and data-retention language.
- Document the tax-filing and remittance operating path for applicable registrations.
- Complete the final content/visual review and private operator go/no-go.
- Make a separate explicit decision to remove the HTML and response-header `noindex` controls. This
  audit does not authorize that change.

No customer email, shipping address, card details, payment identifier, provider account identifier,
or secret is included in this audit.
