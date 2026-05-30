# Open Merch Studio

Open Merch Studio is an open-source, AI-first custom merch studio for curated Printful catalog fulfillment. It is product-neutral and designed for more than apparel.

The current working title is temporary. The code, docs, and environment templates avoid private customer data, production credentials, payment artifacts, and organization-specific claims.

## What It Does

- Browses a curated multi-category Printful launch catalog.
- Creates fixture design drafts by default, with a guarded OpenAI image-generation adapter, prompt moderation, and print-ready prompt shaping available only when live generation is explicitly enabled.
- Runs basic print-readiness checks before quoting.
- Produces transparent cost-plus quotes with product cost, design allocation, margin, shipping estimate, payment fee estimate, Studio Pass credit, and total.
- Simulates a `$5` Studio Pass that unlocks deeper design work and applies to an eligible purchase.
- Simulates checkout, order confirmation, and fixture fulfillment without creating live charges or provider orders. The backend also includes guarded Stripe Checkout/webhook, idempotent checkout creation, Printful mockup polling, duplicate draft-order recovery, and Printful draft-order adapters for private test activation.
- Stores a normalized catalog and launch data model for categories, products, variants, placements, mockups, sessions, Studio Passes, AI spend events, quotes, orders, payment events, fulfillment attempts, settings, and audit logs.
- Supports fixture-backed local development when Printful, Stripe, and OpenAI credentials are not configured.

## Launch Catalog

The v1 curated catalog targets broad basics across apparel, hats, drinkware, wall art, bags, stickers, phone cases, and stationery. Live product availability, placement support, and pricing should come from Printful catalog sync before production use.

## Stack

- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL
- Frontend: React, Vite, TypeScript
- Integrations: Printful catalog/order payloads and draft-order adapter, OpenAI image-generation adapter, Stripe Checkout/webhook adapter, and fixture providers for public-safe development. Live provider activation requires private credentials, database setup, explicit safety gates, and OPS review.

## Local Setup

```bash
nvm use
npm install
cp .env.example backend/.env
cp .env.example frontend/.env
npm run db:generate
npm run dev
```

The app works in fixture mode without provider credentials. Add local credentials only to ignored `.env` files or deployment-managed values.

## Useful Commands

```bash
npm run type-check
npm test
npm run build
npm run dev:backend
npm run dev:frontend
```

## API Surface

- `GET /api/catalog/categories`
- `GET /api/catalog/products`
- `GET /api/catalog/products/:slug`
- `POST /api/catalog/quotes`
- `POST /api/design/sessions`
- `POST /api/design/ideas`
- `POST /api/design/drafts`
- `POST /api/design/drafts/:id/revisions`
- `GET /api/design/assets/:assetId.png`
- `POST /api/design/readiness`
- `POST /api/design/mockups`
- `POST /api/studio-passes/checkout`
- `POST /api/checkout/sessions`
- `POST /api/stripe/webhook`
- `GET /api/orders/:orderId`
- `POST /api/admin/catalog/sync`
- `GET /api/admin/settings`
- `GET /api/admin/orders`
- `GET /api/admin/report`
- `GET /api/admin/launch-readiness`

## Paid Beta Runbook

- Public launch tickets: [docs/tickets/launch/README.md](./docs/tickets/launch/README.md)
- Paid beta flow: [docs/architecture/paid-beta-flow.md](./docs/architecture/paid-beta-flow.md)
- Runbook: [docs/launch/paid-beta-runbook.md](./docs/launch/paid-beta-runbook.md)
- Audit template: [docs/launch/launch-audit-template.md](./docs/launch/launch-audit-template.md)

## Printful References

- Catalog products, variants, categories: https://developers.printful.com/docs/v2-beta/
- Mockup generator v2: https://developers.printful.com/docs/v2-beta/
- Orders from catalog variants: https://developers.printful.com/docs/

## Security

Do not commit credentials, private customer data, provider dashboards, payment exports, payment screenshots, or private account identifiers. See [SECURITY.md](./SECURITY.md).
