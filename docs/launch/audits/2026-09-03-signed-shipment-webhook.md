# Signed shipment webhook production audit — September 3, 2026

## Scope

Verify the live Printful v2 shipment receiver without charging a card, submitting a fulfillment
order, or sending customer email.

## Preconditions

- Production checkout and review-first fulfillment were already active.
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false` remained unchanged.
- The Printful webhook configuration used the branded `/api/printful/webhook` endpoint.
- Only `shipment_sent` and `shipment_delivered` were subscribed.
- The webhook key pair was stored as sensitive production environment values and was not printed or
  written to the repository.
- OMS transactional email remained disabled.

## Fixture procedure

1. Insert one uniquely named zero-dollar order with no Stripe session, payment intent, line item, or
   Printful order identifier.
2. Send a correctly signed `shipment_sent` body to the branded production endpoint.
3. Verify the durable order, shipment, webhook-event, email-delivery, and customer-safe response.
4. Send a correctly signed `shipment_delivered` body for the same shipment.
5. Replay that semantic event with a changed provider retry count.
6. Delete the exact fixture order and its associated records, then verify every fixture count is
   zero.

## Results

- The shipped event returned HTTP 200 with `processed`.
- The order advanced from Submitted to Shipped.
- The public order response exposed only the approved tracking number, validated HTTPS tracking
  URL, shipment state, and timestamps.
- One shipment email delivery record was created with `queued`; no email was sent.
- The delivered event returned HTTP 200 with `processed` and advanced the order to Delivered.
- One delivered-email record was created with `queued`; no email was sent.
- The retry returned HTTP 200 with `duplicate` and did not create another event transition or email.
- Cleanup left zero fixture orders, shipments, email deliveries, and webhook events.
- A final `/api/health` request returned HTTP 200 from the branded production origin.

## Remaining boundary

This proves the signed receiver and customer-facing state path. It does not prove a real carrier
shipment or inbox delivery. Keep OMS transactional email disabled until a branded sender and an
actual inbox receipt are verified, and retain operator review before confirming Printful production.
