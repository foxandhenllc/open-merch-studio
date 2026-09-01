# Themed Products and Mini-Stores

**Status:** Next product phase; deliberately not included in the upload launch

**Examples:** FanHarmon/Harmontown collections, RCR collections, and creator- or client-specific storefronts

## Product Goal

Let an owner turn a successful Open Merch Studio design session into a reusable product library, group products by theme, and publish a small branded storefront or embed the collection into an existing site.

The important shift is from a temporary guest session to durable, owner-controlled inventory:

`artwork → reusable design → configured product → themed collection → published mini-store`

## First Useful Release

1. Owner authentication and organization/workspace membership.
2. **Save product** from the review screen, preserving artwork version, Printful product/variant, placement, mockup, pricing inputs, and rights/provenance.
3. A product library with draft, active, archived, and needs-review states.
4. Collections with title, slug, description, hero art, brand tokens, product ordering, and visibility.
5. A hosted route such as `/stores/fanharmon/harmontown` plus a safe embed/link option for `fanharmon.com` or an RCR property.
6. Printful synchronization that detects retired variants, price drift, mockup drift, and disconnected store products before publication.

## Data Boundaries

- `organizations`: FanHarmon, RCR, Fox & Hen, or another client/creator.
- `brand_profiles`: colors, typography, support/legal identity, and connected domains.
- `saved_designs` and immutable `design_versions`: reusable artwork with provenance and rights evidence.
- `saved_products`: product, variant, placement, retail settings, and latest verified Printful state.
- `collections` and `collection_products`: themed merchandising and order.
- `storefronts`: publication state, domain/embed settings, and checkout policy.

Artwork and products must belong to exactly one organization by default. Sharing or copying between organizations should be an explicit, audited action so FanHarmon assets cannot silently become RCR assets or vice versa.

## Recommended Sequence

1. Saved designs/products for one owner, with no public storefront.
2. Themed collections and internal preview URLs.
3. Hosted read-only mini-store previews, isolated from the existing public OMS checkout configuration.
4. Domain/embed support and per-store analytics.
5. Per-organization commerce, legal, tax, support, and Printful-store configuration only after each owner passes its own launch review. The existing Fox & Hen-operated checkout does not automatically authorize commerce for FanHarmon, RCR, or another client organization.

This sequence lets the library become useful immediately without coupling the feature to public payments or unattended fulfillment.
