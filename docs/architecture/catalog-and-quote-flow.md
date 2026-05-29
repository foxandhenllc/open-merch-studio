# Catalog And Quote Flow

Open Merch Studio separates public catalog browsing from provider-specific fulfillment details.

1. Catalog sync imports Printful categories, products, variants, placements, mockup styles, availability, and price snapshots.
2. The curated allowlist marks launch-ready product families as sellable.
3. The frontend selects a product, variant, placement, and artwork draft.
4. The quote service calculates product cost, AI/design fee, target margin, shipping estimate, payment fee estimate, and customer total.
5. Fulfillment payload generation uses catalog variant and placement data instead of product-specific hardcoding.

The fixture catalog keeps local development and CI independent from provider credentials.
