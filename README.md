# Open Merch Studio

Open Merch Studio is an open-source custom merch workbench for curated Printful catalog fulfillment. It supports supplied artwork, reference-led creation, print-file improvement, and optional AI generation across products beyond apparel.

**Live studio:** [openmerchstudio.com](https://openmerchstudio.com)

**Created by:** Fox & Hen

**License:** [MIT](./LICENSE)

The public studio supports product exploration, direct customer-artwork uploads, reference-led and AI-assisted design generation, print preparation, multi-placement previews, live Stripe Checkout, and review-first Printful fulfillment. Paid orders create editable Printful drafts for manual production review; they are not automatically confirmed for production.

Open Merch Studio is the public project name. The code, docs, and environment templates avoid private customer data, production credentials, payment artifacts, and organization-specific claims.

## What It Does

- Browses a curated multi-category Printful launch catalog.
- Accepts PNG, JPEG, and WebP artwork for direct non-generative use, keeps originals private, prepares normalized print PNG derivatives, and records dimensions, provenance, rights confirmation, and retention metadata.
- Accepts up to five private reference images for new bespoke artwork, and supports true image-based revisions while retaining the prior draft.
- Lets customers assign different artwork to supported print areas, including separate front and back files on the launch tee and tote, with placement cost shown in the quote.
- Creates fixture design drafts by default, with a guarded OpenAI image-generation adapter, prompt moderation, and print-ready prompt shaping available only when live generation is explicitly enabled.
- Runs basic print-readiness checks before quoting.
- Produces transparent cost-plus quotes with product cost, design allocation, margin, shipping estimate, payment fee estimate, and total.
- Keeps the experimental Studio Pass flow server-disabled by default while the MVP focuses on a direct design-to-checkout journey.
- Uses guarded, idempotent Stripe Checkout and webhooks for live payment. Paid orders enter a durable review queue and create draft-only Printful orders with duplicate-recovery safeguards; production confirmation remains a manual operator decision.
- Stores a normalized catalog and launch data model for categories, products, variants, placements, mockups, sessions, Studio Passes, AI spend events, quotes, orders, payment events, fulfillment attempts, settings, and audit logs.
- Supports fixture-backed local development when Printful, Stripe, and OpenAI credentials are not configured.

## Launch Catalog

The live curated catalog currently contains five focused products: a Bella + Canvas tee, organic cotton tote, glossy mug, kiss-cut sticker, and matte poster. Availability, supported print areas, and provider pricing come from the synchronized Printful catalog. New physical product categories are added deliberately rather than exposed as an unfiltered provider catalog.

## Example Collection

The [Fox & Hen “One Clear System” collection](https://openmerchstudio.com/examples/fox-and-hen) demonstrates the current product surface with five coordinated pieces. It uses the approved horizontal, stacked, ampersand, and circular Fox & Hen marks from the live business site, plus production-sized print files, a mug wrap, and separate front/back artwork for the tee and tote. Suggested retail on that page is planning guidance until the companion storefront is published.

## Stack

- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, full-stack Vercel `/api/*` routing
- Frontend: React, Vite, TypeScript
- Integrations: Printful catalog, mockup, and draft-order adapters; OpenAI image generation and editing; Stripe Checkout and webhooks; optional print-preparation tooling; and fixture providers for public-safe development. Production credentials stay deployment-managed and provider actions remain behind explicit safety gates.

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

The example environment keeps live payment and fulfillment gates disabled and permits simulated
local checkout. Production activation requires deployment-managed credentials and the supervised
commerce runbook; never copy production secrets into a local or committed environment file.

Local development uses the API on `127.0.0.1:5001` because macOS commonly reserves port 5000.
Leave `VITE_API_URL` empty locally so Vite proxies `/api/*` to that backend.

## Useful Commands

```bash
npm audit --audit-level=high
npm run lint
npm run type-check
npm test
npm run smoke:fixture
npm run smoke:live-upload -- http://127.0.0.1:5001
npm run smoke:deployed-upload -- https://your-deployment.example
npm run build
npm run test:browser
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
- `POST /api/design/drafts/from-references`
- `POST /api/design/drafts/:id/revisions`
- `POST /api/design/uploads/authorize`
- `POST /api/design/uploads/:assetId/complete`
- `DELETE /api/design/uploads/:assetId`
- `DELETE /api/design/sessions/:sessionId/uploads`
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
- `GET /api/admin/orders/:orderId`
- `POST /api/admin/orders/:orderId/fulfillment/retry`
- `POST /api/admin/orders/:orderId/review`
- `GET /api/admin/report`
- `GET /api/admin/launch-readiness`

## Commerce Runbook

- Public launch tickets: [docs/tickets/launch/README.md](./docs/tickets/launch/README.md)
- Checkout and order flow: [docs/architecture/paid-beta-flow.md](./docs/architecture/paid-beta-flow.md)
- Operations runbook: [docs/launch/paid-beta-runbook.md](./docs/launch/paid-beta-runbook.md)
- Audit template: [docs/launch/launch-audit-template.md](./docs/launch/launch-audit-template.md)
- Domain cutover: [docs/launch/domain-cutover-openmerchstudio-com.md](./docs/launch/domain-cutover-openmerchstudio-com.md)
- Supervised live-commerce evidence: [docs/launch/audits/2026-07-17-supervised-live-commerce-smoke.md](./docs/launch/audits/2026-07-17-supervised-live-commerce-smoke.md)
- Policy copy and owner decisions; closed-preview implementation with fictitious-name confirmation pending: [docs/launch/legal-policy-copy-proposal-2026-07-17.md](./docs/launch/legal-policy-copy-proposal-2026-07-17.md)

## Product Roadmap

- Uploaded/reference artwork architecture: [docs/architecture/uploaded-artwork-flow.md](./docs/architecture/uploaded-artwork-flow.md)
- Themed saved products and embeddable mini-stores: [docs/roadmap/themed-mini-stores.md](./docs/roadmap/themed-mini-stores.md)

## Printful References

- Catalog products, variants, categories: https://developers.printful.com/docs/v2-beta/
- Mockup generator v2: https://developers.printful.com/docs/v2-beta/
- Orders from catalog variants: https://developers.printful.com/docs/

## Security

Do not commit credentials, private customer data, provider dashboards, payment exports, payment screenshots, or private account identifiers. See [SECURITY.md](./SECURITY.md).
