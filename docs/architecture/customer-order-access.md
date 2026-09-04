# Customer order access

Open Merch Studio uses an opaque bearer credential for customer order reads. An order identifier is
not authorization.

## Lifecycle

1. Live checkout opens without an order-access credential.
2. Stripe redirects the browser back with its Checkout Session ID. OMS reconciles that session
   against the durable order and signed webhook state.
3. After confirmation is no longer processing, OMS rotates and returns a 256-bit order-access
   credential. Fixture checkout may issue the same credential immediately because no real payment
   exists and its checkout result is already final.
4. The browser stores the credential locally and sends it only as an `Authorization: Bearer` header
   to the customer order and reorder-draft routes. It is not placed in a query string or
   application log.
5. OMS stores only the SHA-256 digest. Issuing a replacement revokes the prior grant, and an operator
   can revoke the current grant through the protected admin API.

Missing orders, malformed credentials, mismatched credentials, rotated credentials, and revoked
credentials all receive the same `404` response. This prevents the public route from becoming an
order-identifier oracle.

## Boundaries

- A Stripe Checkout Session ID remains a short-lived reconciliation credential, not a durable order
  page credential.
- The bearer value must never be logged, persisted in Prisma, included in analytics, or sent to a
  provider.
- The order response remains the reduced customer-safe DTO. Authorization does not expose internal
  order IDs, provider references, addresses, email addresses, or raw payloads.
- Database RLS is enabled for `order_access_grants`, with no browser-role grants or policies.
- “Buy again” uses this boundary to load immutable prior choices through
  `POST /api/orders/:orderId/reorder-draft`. The server validates the current catalog and retained
  print-ready artwork before the browser creates a new editable cart and requests a new quote. It
  never returns the prior price, recipient, payment, policy acceptance, or fulfillment state and
  never initiates checkout automatically.

## Operator recovery

`POST /api/admin/orders/:orderId/customer-access/revoke` revokes every active credential for the
order. The route uses the existing operator-admin authorization boundary. Revocation does not alter
payment, fulfillment, shipment, or refund state.
