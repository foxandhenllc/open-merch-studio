# Resend transactional email activation

**Date:** September 3, 2026  
**Scope:** Production sender verification and activation without an order, payment, or fulfillment

## Controls

- Used the existing Vercel Marketplace Resend resource; no duplicate resource or API key was created.
- Connected it only to the Open Merch Studio production project and kept the injected API key
  sensitive.
- Kept `TRANSACTIONAL_EMAILS_ENABLED=false` and `EMAIL_PROVIDER=fixture` during initial deployment.
- Used a random, token-guarded smoke route for one test, then removed the route, token, and entire
  temporary deployment before enabling customer mail.
- Sent no order data, payment data, customer data, or provider credentials in the test message.

## Evidence

- Resend domain status: verified.
- DKIM: verified.
- Sending SPF/MX: isolated under `send.openmerchstudio.com`; apex inbound MX continued to point to
  Google Workspace.
- From: `Open Merch Studio <orders@openmerchstudio.com>`.
- Reply-To: `support@openmerchstudio.com`.
- Recipient: an owner-approved external test inbox.
- Provider result: accepted with a message ID and subsequently reported `Delivered` in Resend.
- Final public smoke-route result: HTTP 404.
- Final production health: HTTP 200; AI, checkout, and fulfillment all reported `live`.

## Final production state

- `EMAIL_PROVIDER=resend`
- `TRANSACTIONAL_EMAILS_ENABLED=true`
- `EMAIL_FROM=Open Merch Studio <orders@openmerchstudio.com>`
- `EMAIL_REPLY_TO=support@openmerchstudio.com`
- Resend credentials remain Vercel-managed and are not recorded in the repository.

This proves sender authentication and provider delivery. It does not replace the next supervised
real-order check of each event-specific template and the full shipment lifecycle.
