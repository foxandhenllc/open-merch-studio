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
- Supports bounded item quantities and a reload-safe guest cart with multiple configured products,
  then itemizes those products in hosted Stripe Checkout.
- Sends paid customers a private, revocable receipt link for revisiting the safe order timeline or
  building a fresh, current-price cart with **Buy again** from any device.
- Creates fixture design drafts by default, with a guarded OpenAI image-generation adapter, prompt moderation, and print-ready prompt shaping available only when live generation is explicitly enabled.
- Runs basic print-readiness checks before quoting.
- Produces transparent cost-plus quotes with product cost, design allocation, margin, shipping estimate, payment fee estimate, and total.
- Keeps the experimental Studio Pass flow server-disabled by default while the MVP focuses on a direct design-to-checkout journey.
- Uses guarded, idempotent Stripe Checkout and webhooks for live payment. Paid orders enter a durable review queue and create draft-only Printful orders with duplicate-recovery safeguards; production confirmation remains a manual operator decision.
- Stores a normalized catalog and launch data model for categories, products, variants, placements, mockups, sessions, Studio Passes, AI spend events, quotes, orders, payment events, fulfillment attempts, settings, and audit logs.
- Supports fixture-backed local development when Printful, Stripe, and OpenAI credentials are not configured.
- Provides an operator-protected saved-product and themed-collection foundation plus read-only hosted
  mini-stores; owner sign-in and per-organization commerce remain future gates.

## Launch Catalog

The live curated catalog currently contains five focused products: a Bella + Canvas tee, organic cotton tote, glossy mug, kiss-cut sticker, and matte poster. Availability, supported print areas, and provider pricing come from the synchronized Printful catalog. New physical product categories are added deliberately rather than exposed as an unfiltered provider catalog.

## Example Collection

The [Fox & Hen “One Clear System” collection](https://openmerchstudio.com/examples/fox-and-hen) demonstrates the current product surface with five coordinated pieces. Its companion [read-only mini-store](https://openmerchstudio.com/stores/fox-and-hen/one-clear-system) demonstrates the themed storefront presentation without inheriting commerce settings. Both use approved Fox & Hen marks, production-sized print files, and separate front/back artwork for the tee and tote.

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
npm run doctor
npm run config:validate
npm run db:generate
npm run dev
```

The app works in fixture mode without provider credentials. Add local credentials only to ignored `.env` files or deployment-managed values.

`npm run doctor` reports fixture, provider, and commerce readiness without printing configured
values. A clean clone should report `fixture-ready`; provider presence is not the same as live
payment or fulfillment authorization.

Public merchant identity lives in [`config/merchant.config.json`](./config/merchant.config.json).
After changing it, run `npm run config:generate`, then validate it and the synthetic second profile
with `npm run config:validate`. Type-checking and builds reject stale generated modules. Secrets and
live commerce authorization remain environment-managed and are never part of that manifest. See
the [merchant configuration RFC](./docs/architecture/merchant-configuration-rfc.md).

Production builds derive canonical URLs, search/social metadata, installed-app identity, `robots.txt`,
and the sitemap from the manifest. Explicitly reviewed prose lives in `config/policies/`; the manifest
pins its identity, version, date, and content digest. Changing identity or text cannot silently reuse
another operator's approval. See [the policy contract](./docs/architecture/operator-policy-content.md).

Run `npm run config:rehearse` to install Git-indexed source in a temporary directory and verify the
synthetic Community Gear Lab profile in fixture mode. It copies no local secrets or untracked files,
disables all live provider gates, and checks server behavior and phone/desktop browser journeys.
Community Gear Lab's notices are demonstration content, not approved legal terms; ordinary and
Vercel builds reject them. A real merchant must supply its own reviewed policy document.

The example environment keeps live payment and fulfillment gates disabled and permits simulated
local checkout. Production activation requires deployment-managed credentials and the supervised
commerce runbook; never copy production secrets into a local or committed environment file.

Local development uses the API on `127.0.0.1:5001` because macOS commonly reserves port 5000.
Leave `VITE_API_URL` empty locally so Vite proxies `/api/*` to that backend.

## Useful Commands

```bash
npm run audit:production
npm run lint
npm run type-check
npm test
npm run smoke:fixture
npm run smoke:live-upload -- http://127.0.0.1:5001
npm run smoke:deployed-upload -- https://your-deployment.example
npm run build
npm run test:browser
npm run test:owner-db # Requires an isolated OMS_OWNER_TEST_DATABASE_URL; see the database contract.
npm run dev:backend
npm run dev:frontend
```

## API Surface

Owner membership isolation and its PostgreSQL test setup are documented in the
[owner database contract](./docs/architecture/owner-membership-database.md). Owner access remains
closed in runtime composition; the migration does not provision a login or real memberships.

- `GET /api/catalog/categories`
- `GET /api/catalog/products`
- `GET /api/catalog/products/:slug`
- `POST /api/catalog/quotes`
- `GET /api/storefronts/:organizationSlug/:storefrontSlug`
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
- `POST /api/printful/webhook`
- `GET /api/orders/:orderId` (customer order-access bearer required)
- `POST /api/orders/:orderId/reorder-draft` (customer order-access bearer required)
- `POST /api/admin/catalog/sync`
- `GET /api/admin/settings`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:orderId`
- `POST /api/admin/orders/:orderId/fulfillment/retry`
- `POST /api/admin/orders/:orderId/review`
- `POST /api/admin/orders/:orderId/customer-access/revoke`
- `GET /api/admin/report`
- `GET /api/admin/launch-readiness`
- `POST /api/admin/storefronts/bootstrap`
- `POST /api/admin/saved-products`
- `POST /api/admin/storefronts/publish`

## Commerce Runbook

- Public launch tickets: [docs/tickets/launch/README.md](./docs/tickets/launch/README.md)
- Checkout and order flow: [docs/architecture/paid-beta-flow.md](./docs/architecture/paid-beta-flow.md)
- Operations runbook: [docs/launch/paid-beta-runbook.md](./docs/launch/paid-beta-runbook.md)
- Mini-store operator runbook: [docs/launch/mini-store-operator-runbook.md](./docs/launch/mini-store-operator-runbook.md)
- Audit template: [docs/launch/launch-audit-template.md](./docs/launch/launch-audit-template.md)
- Domain cutover: [docs/launch/domain-cutover-openmerchstudio-com.md](./docs/launch/domain-cutover-openmerchstudio-com.md)
- Supervised live-commerce evidence: [docs/launch/audits/2026-07-17-supervised-live-commerce-smoke.md](./docs/launch/audits/2026-07-17-supervised-live-commerce-smoke.md)
- Policy copy and owner decisions; closed-preview implementation with fictitious-name confirmation pending: [docs/launch/legal-policy-copy-proposal-2026-07-17.md](./docs/launch/legal-policy-copy-proposal-2026-07-17.md)

## Product Roadmap

- Uploaded/reference artwork architecture: [docs/architecture/uploaded-artwork-flow.md](./docs/architecture/uploaded-artwork-flow.md)
- Current post-payment customer experience: [docs/architecture/current-post-payment-experience.md](./docs/architecture/current-post-payment-experience.md)
- Revocable customer order-access boundary: [docs/architecture/customer-order-access.md](./docs/architecture/customer-order-access.md)
- Staged Max Refactor assessment: [docs/architecture/max-refactor-assessment-2026-09-03.md](./docs/architecture/max-refactor-assessment-2026-09-03.md)
- Cart, reorder, reusable distribution, plugin, and service roadmap: [docs/roadmap/open-source-commerce-next.md](./docs/roadmap/open-source-commerce-next.md)
- Themed saved products and embeddable mini-stores: [docs/roadmap/themed-mini-stores.md](./docs/roadmap/themed-mini-stores.md)
- Themed storefront ownership and publication boundary: [docs/architecture/themed-storefront-boundary.md](./docs/architecture/themed-storefront-boundary.md)

## Printful References

- Catalog products, variants, categories: https://developers.printful.com/docs/v2-beta/
- Mockup generator v2: https://developers.printful.com/docs/v2-beta/
- Orders from catalog variants: https://developers.printful.com/docs/

## Security

Do not commit credentials, private customer data, provider dashboards, payment exports, payment screenshots, or private account identifiers. See [SECURITY.md](./SECURITY.md).
