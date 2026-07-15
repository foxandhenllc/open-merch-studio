# Paid Beta Flow

**Status:** Implemented in fixture mode; private provider testing requires credentials
**Visibility:** Public

Open Merch Studio uses a mock-first architecture so contributors can run the full customer journey without private provider accounts.

## Customer Flow

1. Browse curated launch products from `/api/catalog/products`.
2. Select product, variant, and placement.
3. Describe an original design.
4. Generate a rough draft through `/api/design/drafts`.
5. Generate a fixture or guarded provider mockup through `/api/design/mockups`.
6. Create a quote through `/api/catalog/quotes`.
7. Simulate or open guarded checkout through `/api/checkout/sessions`.
8. Reconcile payment and view order confirmation through the checkout-return endpoint and `/api/orders/:orderId`.

## Runtime Safety

- Live OpenAI, Stripe, and Printful behavior requires credentials, explicit enable flags, private OPS approval, and implementation verification. Current fixture mode does not create live provider calls.
- AI spend is tracked in the runtime ledger and persisted to `AiSpendEvent` when `DATABASE_URL` is configured. Provider-call verification and spend alerts still need private test runs before live launch.
- Studio Pass remains hidden and server-disabled for the MVP; its historical data shape is not part of the customer flow.
- Checkout refuses unknown or expired quotes, missing artwork, failed generation, policy-review artwork, and print-readiness warnings. Checkout and fulfillment can be paused independently.

## Admin Flow

- `/api/admin/settings` exposes current safe runtime settings only when `ADMIN_ACCESS_CODE` is configured and supplied via `x-admin-access`.
- `/api/admin/orders` lists database-authoritative order summaries when PostgreSQL is configured.
- `/api/admin/report` returns sessions, passes, drafts, orders, estimated AI spend, and launch gates.
- `/api/admin/launch-readiness` returns the current paid-beta gate state.

## Persistence Path

Fixture mode uses an in-memory runtime store. When `DATABASE_URL` is configured, the Prisma path persists sessions, AI spend events, design assets, mockup task outcomes, quotes, orders, transitions, payment events, fulfillment attempts, admin settings, and audit logs. Production migration names and checksums were reconciled against the dedicated database on 2026-07-14; every later migration still requires the same deploy-and-verify procedure.
