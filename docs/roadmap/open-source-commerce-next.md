# Open-source commerce next

This roadmap covers carts, repeat ordering, reusable distribution, a ChatGPT plugin, and the Fox &
Hen implementation offer. It follows the current single-item, guest-first, review-before-production
store without expanding the physical catalog.

## 0. Customer communication and shipment state

Completed September 3, 2026:

- durable, idempotent customer-email delivery records;
- signed Printful v2 shipment and delivery webhook handling;
- private RLS-protected shipment/event tables;
- multiple-package tracking in the customer-safe order response and responsive UI;
- order-received, refund, shipment, and delivery email templates.

The Printful subscription and signed production fixtures are complete. The branded Resend sender,
external inbox delivery, production-only Vercel resource connection, and app-owned delivery gate were
verified and enabled on September 3, 2026. Add scheduled reconciliation and observe a real order and
shipment lifecycle before describing shipment communication as guaranteed.

## 1. Quantity, cart, and buy again

Build in this order:

1. Add quantity to the current product review and re-quote every change server-side.
2. Add a guest cart that can hold multiple configured products. The backend quote and order models
   already support multiple items and quantities; the frontend currently submits one item, and
   Stripe currently receives one aggregate line item.
3. Send itemized Stripe line items while preserving the server-authoritative quote total and current
   webhook idempotency.
4. Add **Buy again** to the protected order page. It should create a new editable cart from immutable
   prior order items, verify retained artwork access, revalidate current catalog availability, and
   generate a new quote. It must never replay an expired quote or charge automatically.
5. Add optional customer accounts and order history only after the opaque guest-order access link is
   proven. Do not make account creation a checkout requirement.

## 2. Safe public-source release

The project remains suitable for public source when these boundaries hold:

- provider keys and production URLs remain deployment-managed;
- fixture records contain no customer or payment artifacts;
- admin routes remain authenticated, rate-limited, and excluded from search;
- private artwork uses signed or server-mediated access;
- logs and public responses remove bearer identifiers and raw provider payloads;
- automated secret, dependency, license, and generated-artifact scans run in CI;
- example collections use owned or explicitly licensed brand assets.

The root `AGENTS.md` gives coding agents the same safety and verification boundaries as human
contributors. Add focused architecture decision records as the cart and notification domains land.

## 3. A near-environment-only installation

This is realistic, with one important distinction: **secrets belong in `.env`; merchant identity
does not.** A reusable store should require:

- a typed, committed `merchant.config.ts` (name, domains, support contacts, currency, regions,
  catalog allowlist, policy URLs, brand colors, and asset paths);
- deployment-managed environment values for database and provider credentials;
- `npm run setup` to validate prerequisites, generate Prisma, apply or print migrations, and seed the
  curated catalog;
- `npm run doctor` to report missing configuration without printing secrets;
- one documented Vercel template path and equivalent platform-neutral deployment contract;
- fixture mode that works from a clean clone before any provider is enabled.

Brand copy, policy text, logos, and product selection should not become dozens of opaque environment
variables. The goal is “one public config file plus secret env values,” with no source-code surgery.

## 4. ChatGPT and Codex plugin feasibility

This is feasible and unusually well matched to the product. The current OpenAI distribution model
is a **plugin containing an MCP server and optional UI**, rather than a separate legacy App Store
wrapper.

Start with a universal, production HTTPS `/mcp` endpoint and a narrow tool set:

- `list_products` and `get_product_options` — read only;
- `prepare_merch_brief` — converts a conversation into a structured, editable design brief;
- `create_design_draft` — writes a bounded OMS draft and reports the spend before execution;
- `preview_product` and `quote_cart` — create previews and server-authoritative estimates;
- `get_order_status` — reads customer-safe order and shipment details after authentication.

Keep payment in OMS's merchant-hosted Stripe Checkout initially. OpenAI currently recommends
external checkout for physical goods; embedded payment-sheet support is not generally available to
all plugin developers. Submission requires a verified publisher, public policy/support URLs, domain
verification, accurate tool safety annotations, five positive and three negative tests, and a
production MCP endpoint.

Do not submit until OMS has authenticated order lookup, shipment tracking, durable customer
notifications, explicit AI-spend confirmation, and a privacy review of every MCP response.

Official references:

- Plugin quickstart: https://developers.openai.com/apps-sdk/quickstart
- Submission requirements: https://developers.openai.com/plugins/deploy/submission
- Physical-goods checkout: https://developers.openai.com/plugins/build/monetization

## 5. Fox & Hen offer

Lead with the delivered business outcome rather than the component list:

> **Your merch store, built around your people—not a template marketplace.** Fox & Hen turns an
> existing brand, community, or campaign into a focused custom-merch shop, then connects creation,
> payment, printing, shipping, and the website your customers actually visit.

The service page should show four concrete deliverables:

- **Brand and collection direction:** owned assets, product choices, color system, print areas, and a
  coordinated launch collection.
- **Store build:** a branded version of OMS, responsive storefront, saved products, policies, and
  analytics.
- **Commerce setup:** client-owned Vercel, database, Stripe, Printful, and optional OpenAI accounts,
  configured without Fox & Hen owning the client's keys or sales data.
- **Supervised launch:** test orders, webhook and fulfillment proof, accessibility/mobile QA,
  operator training, and a handoff runbook.

Use the live Fox & Hen collection as proof, describe the repository as evidence of portability and
technical ownership, and offer “we build and launch it with you” as the service. Keep custom scope and
ongoing operations separate, and do not advertise a one-click promise until the setup and doctor
commands pass from a clean clone.
