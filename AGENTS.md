# Open Merch Studio agent guide

This repository is a public, open-source custom-merch workbench. Treat customer artwork, shipping
details, payment facts, provider credentials, and operator tools as sensitive even when working in a
local checkout.

## Start here

1. Read `README.md`, `SECURITY.md`, and `DEPLOYMENT.md`.
2. Use Node from `.nvmrc` and install with the root package manager.
3. Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build` before browser work.
4. Run `npm run test:browser` for any customer-facing or state-flow change.

The application is useful in fixture mode without provider credentials. Do not use a live provider
to prove behavior that a fixture or test can prove.

## System map

- `frontend/src/studio-view-model.ts`: customer workflow state and provider requests.
- `frontend/src/WorkbenchStudioApp.tsx`: mode-driven studio UI.
- `frontend/src/services/local-fixtures.ts`: no-charge local behavior; it must remain truthful.
- `backend/src/services/order.service.ts`: quote, Checkout, webhook, order, and fulfillment workflow.
- `backend/src/services/printful.service.ts`: Printful catalog, mockup, and draft-order adapter.
- `backend/src/services/stripe.service.ts`: Stripe Checkout construction and retrieval.
- `backend/prisma/schema.prisma`: durable catalog, artwork, quote, order, and audit records.
- `docs/architecture/`: current contracts and technical decisions.
- `docs/launch/`: production gates and operator runbooks.

## Non-negotiable boundaries

- `CHECKOUT_ACCESS_MODE` is the server authorization gate. A frontend flag cannot open Checkout.
- A paid order creates an editable Printful draft. Keep `PRINTFUL_AUTO_CONFIRM_ORDERS=false` unless
  a separately approved production design replaces manual review.
- Stripe webhook work must remain idempotent. Never fulfill from the browser redirect alone.
- Never log or return Stripe session bearer IDs, provider tokens, addresses, private artwork URLs, or
  raw provider payloads.
- Keep uploads private and provider access signed or server-mediated.
- Do not claim that OMS sends customer email or tracking updates until those paths have durable,
  exactly-once delivery and live evidence.
- Production configuration belongs in deployment-managed secrets. Commit only empty examples,
  public merchant configuration, and fixture data.

## Change discipline

- Preserve unrelated working-tree changes and generated audit material.
- Prefer narrow service seams and explicit typed inputs over adding more responsibilities to the
  large order service, studio view model, workbench component, or global stylesheet.
- A successful build is not sufficient for UI work. Verify mobile and desktop behavior, persistence,
  the actual request payload, and the customer-visible result.
- A live commerce smoke requires separate authorization because it can charge money and create a
  fulfillment draft. The normal automated suite must never do either.

See `docs/architecture/max-refactor-assessment-2026-09-03.md` before starting a broad refactor.
