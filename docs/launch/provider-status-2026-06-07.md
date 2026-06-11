# Provider Status - 2026-06-07

This snapshot records the provider/account work completed during the paid-beta
revenue-path pass. It intentionally excludes secret values.

## Completed

- Created the dedicated Supabase project `open-merch-studio`:
  - project ref: `evhhtsrfmjixlobajlib`
  - region: `us-east-1`
- Applied all checked-in Prisma migrations to the dedicated Supabase database:
  - `20260529180000_paid_beta_foundation`
  - `20260530122000_paid_beta_provider_hardening`
  - `20260607120000_paid_beta_operator_review`
- Seeded the five-product paid-beta catalog: tee, mug, sticker, poster, tote.
- Created the public Supabase Storage bucket `open-merch-artwork`.
- Revoked public-table grants from Supabase `anon` and `authenticated` roles.
- Configured Vercel Production and local `.env.local` with:
  - final `DATABASE_URL` through Supabase session pooler
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_STORAGE_BUCKET`
  - `SUPABASE_PUBLIC_ASSET_BASE_URL`
  - `SITE_ACCESS_CODE`
  - reused 2026GPTees `OPENAI_API_KEY`
  - reused 2026GPTees `PRINTFUL_API_KEY` and `PRINTFUL_STORE_ID`
  - reused 2026GPTees Stripe test secret as `STRIPE_SECRET_KEY`
- Password-protected the public page at
  `https://open-merch-studio-vercel-output.vercel.app`.
- Verified password flow:
  - unauthenticated `/` redirects to `/access`
  - invalid access code shows an error
  - valid access code sets an HttpOnly cookie and loads the app
  - forged `oms_site_access=1` cookie is rejected
- Enabled live OpenAI generation with spend caps:
  - `ENABLE_LIVE_OPENAI=true`
  - `DAILY_AI_BUDGET_CENTS=1200`
  - `PER_SESSION_AI_BUDGET_CENTS=300`
- Verified live OpenAI rough generation in production:
  - provider: `openai`
  - policy: `pass`
  - readiness: `pass`
  - durable artwork URL stored in Supabase Storage
  - `design_assets` row persisted in the dedicated Supabase database
- Verified production `/api/catalog/products` returns exactly five paid-beta
  products.
- Verified admin report with `x-admin-access` confirms:
  - live OpenAI enabled
  - checkout disabled
  - Stripe disabled
  - Printful disabled
  - one smoke-test design draft recorded

## 2026-06-08 Update

- Applied the curated Printful launch-catalog migration:
  - `20260608130000_curated_printful_launch_catalog`
- Curated the production catalog to the five paid-beta demo product lanes:
  - tee: Printful product `71`, Bella + Canvas 3001, 36 variants
    across Black, White, Navy, Asphalt, Athletic Heather, and Red in
    S, M, L, XL, 2XL, and 3XL
  - mug: Printful product `19`, White Glossy Mug, 11 oz, 15 oz, and 20 oz
  - poster: Printful product `1`, Enhanced Matte Paper Poster,
    12 x 18, 16 x 20, 18 x 24, and 24 x 36
  - tote: Printful product `367`, Econscious EC8000 Organic Cotton Tote Bag,
    Black and Oyster
  - sticker: Printful product `358`, Kiss-Cut Stickers, 3 x 3, 4 x 4,
    and 5.5 x 5.5
- Added production curation env guards:
  - `PRINTFUL_CURATED_PRODUCT_IDS=71,19,1,367,358`
  - `PRINTFUL_MAX_LAUNCH_PRODUCTS=5`
- Enabled live Printful mockups in production with fulfillment still gated.
- Verified one live Printful mockup task per launch product type:
  - tee: `dtg`
  - mug: `sublimation`
  - poster: `digital`
  - tote: `dtg`
  - sticker: `digital`
- Verified production `/api/design/mockups` returns a completed
  `printful` provider mockup for the curated tee using Supabase-hosted artwork.
- Fixed Printful mockup and order payload generation to use catalog placement
  techniques instead of assuming every non-embroidery placement is `dtg`.
- Verified `gpt-image-2` is available to the configured OpenAI project and
  updated the app default from `gpt-image-1` to `gpt-image-2`.
- `gpt-image-2` rejects `background=transparent`; the provider omits the
  transparent-background request for that model while still requesting PNG
  output.

## Current Production Gates

- `ENABLE_PUBLIC_CHECKOUT=false`
- `VITE_ENABLE_PUBLIC_CHECKOUT=false`
- `VITE_ENABLE_LOCAL_FALLBACKS=false`
- `ENABLE_LIVE_OPENAI=true`
- `OPENAI_DESIGN_MODEL=gpt-image-2`
- `ENABLE_LIVE_STRIPE=false`
- `ENABLE_LIVE_PRINTFUL=true`
- `ALLOW_LIVE_PAYMENTS=false`
- `ALLOW_LIVE_FULFILLMENT=false`
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false`
- `CHECKOUT_ENABLED=false`
- `FULFILLMENT_ENABLED=false`

## Remaining Blockers

- Stripe Checkout remains gated. A new Stripe webhook endpoint/secret must be
  created for this Vercel app before webhook validation can be considered ready.
- Printful mockup preview is live and verified. Printful draft-order creation
  remains gated because `ALLOW_LIVE_FULFILLMENT=false`,
  `FULFILLMENT_ENABLED=false`, and `PRINTFUL_AUTO_CONFIRM_ORDERS=false`.
- Supabase RLS is not enabled on app tables. Public `anon` and `authenticated`
  table grants have been revoked, but proper RLS policies should be designed
  before exposing any direct Supabase client access.
- The production page is password-protected and public checkout remains off
  until Stripe, Printful, support/returns, tax/shipping, and operator review
  smoke tests pass.
