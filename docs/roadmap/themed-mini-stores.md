# Themed Products and Mini-Stores

**Status:** Durable foundation and read-only preview completed September 3, 2026; owner UI and
per-store commerce remain gated

**Examples:** FanHarmon/Harmontown collections, RCR collections, and creator- or client-specific storefronts

## Product Goal

Let an owner turn a successful Open Merch Studio design session into a reusable product library, group products by theme, and publish a small branded storefront or embed the collection into an existing site.

The important shift is from a temporary guest session to durable, owner-controlled inventory:

`artwork → reusable design → configured product → themed collection → published mini-store`

## First Useful Release

1. Organization/workspace membership schema is complete. Interactive owner authentication is not;
   protected writes currently use the existing operator-admin boundary.
2. **Save product** from a durable quote through the protected API, preserving Printful
   product/variant, placements, mockup, pricing configuration, artwork provenance, and readiness.
3. Product draft/active state and collection ordering are complete at the data/service layer. The
   owner library UI remains.
4. Collections, brand profiles, publication state, and storefront slugs are complete at the
   data/service layer.
5. Hosted read-only routes are complete, with `/stores/fox-and-hen/one-clear-system` as the owned
   fixture/reference implementation. Dynamic stores require records in PostgreSQL.
6. Printful synchronization and drift detection remain before a saved product can promise
   unattended commerce.

## Data Boundaries

- `organizations`: FanHarmon, RCR, Fox & Hen, or another client/creator.
- `brand_profiles`: colors, typography, support/legal identity, and connected domains.
- `saved_designs` and immutable `design_versions`: reusable artwork with provenance and rights evidence.
- `saved_products`: product, variant, placement, retail settings, and latest verified Printful state.
- `collections` and `collection_products`: themed merchandising and order.
- `storefronts`: publication state, domain/embed settings, and checkout policy.

Artwork and products must belong to exactly one organization by default. Sharing or copying between organizations should be an explicit, audited action so FanHarmon assets cannot silently become RCR assets or vice versa.

## Recommended Sequence

1. Saved products for one operator-managed owner, with no public storefront. **Service complete.**
2. Themed collections and internal preview URLs. **Service complete.**
3. Hosted read-only mini-store previews, isolated from the existing public OMS checkout
   configuration. **Complete for the Fox & Hen reference store.**
4. Domain/embed support and per-store analytics.
5. Per-organization commerce, legal, tax, support, and Printful-store configuration only after each owner passes its own launch review. The existing Fox & Hen-operated checkout does not automatically authorize commerce for FanHarmon, RCR, or another client organization.

This sequence lets the library become useful immediately without coupling the feature to public payments or unattended fulfillment.
