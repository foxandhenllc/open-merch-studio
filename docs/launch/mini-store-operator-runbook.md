# Mini-store operator runbook

This is an operator-only workflow until authenticated owner administration is implemented. Send the
admin access code only in the `x-admin-access` header and never place it in a URL, repository file,
browser screenshot, or support message.

The [owner administration architecture](../architecture/mini-store-owner-administration.md) defines
the next implementation checkpoints. Do not expose these operator endpoints to signed-in owners:
organization-scoped authorization, database constraints, private revisions, explicit unpublish,
and actor-bound audit records must exist first. The current built-in Fox & Hen fallback must also
yield to durable unpublication before an owner unpublish control is offered.

## 1. Apply and verify the schema

Apply `20260904003000_themed_mini_stores` through the deployment's normal Prisma migration process.
Confirm that all nine new tables have RLS enabled and no anon/authenticated policies.

## 2. Bootstrap an organization and draft storefront

`POST /api/admin/storefronts/bootstrap` with organization name/slug, display name, optional brand
description/support/website fields, collection title/slug, and storefront title/slug. Slugs accept
only lowercase letters, numbers, and single hyphens. Repeating the request updates the same records.

## 3. Save a quoted product

`POST /api/admin/saved-products` with the organization and collection slugs, durable quote ID,
product ID, variant ID, design asset ID, customer-facing product title/slug, and an optional public
mockup URL. The quote line and design are resolved again on the server. Artwork must be policy-passed
and print-ready.

## 4. Publish

`POST /api/admin/storefronts/publish` with organization and storefront slugs. Publication fails if
the collection is empty or any product, variant, or artwork is unavailable or blocked. Inspect the
public response at `/api/storefronts/{organizationSlug}/{storefrontSlug}` before promoting the hosted
route `/stores/{organizationSlug}/{storefrontSlug}`.

Publishing a mini-store does not enable its checkout. Keep it read-only until merchant ownership,
tax, Stripe, Printful, support, and fulfillment review have each been approved for that organization.
