# Open Merch Studio

Open Merch Studio is an open-source, AI-first custom merch studio for curated Printful catalog fulfillment. It is product-neutral and designed for more than apparel.

The current working title is temporary. The code, docs, and environment templates avoid private customer data, production credentials, payment artifacts, and organization-specific claims.

## What It Does

- Browses a curated multi-category Printful launch catalog.
- Creates mock or provider-backed design drafts.
- Runs basic print-readiness checks before quoting.
- Produces transparent cost-plus quotes with product cost, AI/design fee, margin, shipping estimate, payment fee estimate, and total.
- Stores a normalized catalog data model for categories, products, variants, placements, mockup styles, price snapshots, sync runs, quotes, and order items.
- Supports fixture-backed local development when Printful, Stripe, and OpenAI credentials are not configured.

## Launch Catalog

The v1 curated catalog targets broad basics across apparel, hats, drinkware, wall art, bags, stickers, phone cases, and stationery. Live product availability, placement support, and pricing should come from Printful catalog sync before production use.

## Stack

- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL
- Frontend: React, Vite, TypeScript
- Integrations: Printful catalog/order payloads, optional OpenAI design provider, optional Stripe checkout

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
- `POST /api/design/drafts`
- `POST /api/admin/catalog/sync`

## Printful References

- Catalog products, variants, categories: https://developers.printful.com/docs/v2-beta/
- Mockup generator v2: https://developers.printful.com/docs/v2-beta/
- Orders from catalog variants: https://developers.printful.com/docs/

## Security

Do not commit credentials, private customer data, provider dashboards, payment exports, payment screenshots, or private account identifiers. See [SECURITY.md](./SECURITY.md).
