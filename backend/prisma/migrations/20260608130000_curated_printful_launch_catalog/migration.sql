WITH launch_categories(id, title, slug) AS (
  VALUES
    ('fixture-category-apparel', 'Apparel', 'apparel'),
    ('fixture-category-drinkware', 'Drinkware', 'drinkware'),
    ('fixture-category-wall-art', 'Wall art', 'wall-art'),
    ('fixture-category-bags', 'Bags', 'bags'),
    ('fixture-category-stickers', 'Stickers', 'stickers')
)
INSERT INTO "catalog_categories" (
  "id", "title", "slug", "isLaunchCategory", "isActive", "createdAt", "updatedAt"
)
SELECT id, title, slug, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM launch_categories
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "isLaunchCategory" = true,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "catalog_products"
SET
  "printfulId" = NULL,
  "isSellable" = false,
  "isActive" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "printfulId" IN (71, 19, 1, 367, 358)
  AND "slug" NOT IN (
    'heavyweight-cotton-shirt',
    'ceramic-mug',
    'matte-poster',
    'canvas-tote-bag',
    'kiss-cut-sticker'
  );

WITH launch_products(
  id,
  printful_id,
  title,
  slug,
  type,
  brand,
  description,
  thumbnail_url,
  category_slug,
  curation_note
) AS (
  VALUES
    (
      'fixture-product-heavyweight-shirt',
      71,
      'Bella + Canvas 3001 Tee',
      'heavyweight-cotton-shirt',
      'apparel',
      'Bella + Canvas',
      'Soft unisex jersey tee with a reliable Printful catalog variant matrix for paid-beta art drops.',
      'https://files.cdn.printful.com/products/71/4016_1752236278.jpg',
      'apparel',
      'Curated paid-beta tee: Bella + Canvas 3001, six core colors, S through 3XL.'
    ),
    (
      'fixture-product-ceramic-mug',
      19,
      'White Glossy Mug',
      'ceramic-mug',
      'drinkware',
      'Printful',
      'Glossy white ceramic mug with wraparound sublimation artwork support.',
      'https://files.cdn.printful.com/products/19/1320_1663762583.jpg',
      'drinkware',
      'Curated paid-beta mug: white glossy mug in 11 oz, 15 oz, and 20 oz.'
    ),
    (
      'fixture-product-matte-poster',
      1,
      'Enhanced Matte Paper Poster',
      'matte-poster',
      'wall-art',
      'Printful',
      'Matte paper poster for art prints, event graphics, and decor-oriented drops.',
      'https://files.cdn.printful.com/products/1/3876_1527678813.jpg',
      'wall-art',
      'Curated paid-beta poster: enhanced matte paper in four common sizes.'
    ),
    (
      'fixture-product-tote',
      367,
      'Organic Cotton Tote Bag',
      'canvas-tote-bag',
      'bag',
      'Econscious',
      'Organic cotton tote with a practical front print area for logos, mascots, and simple art.',
      'https://files.cdn.printful.com/products/367/10457_1582200790.jpg',
      'bags',
      'Curated paid-beta tote: Econscious EC8000 in black and oyster.'
    ),
    (
      'fixture-product-vinyl-sticker',
      358,
      'Kiss-Cut Sticker',
      'kiss-cut-sticker',
      'sticker',
      'Printful',
      'White kiss-cut sticker in small-format sizes for logos, mascots, and campaign marks.',
      'https://files.cdn.printful.com/products/358/10163_1553083889.jpg',
      'stickers',
      'Curated paid-beta sticker: kiss-cut stickers in 3 x 3, 4 x 4, and 5.5 x 5.5.'
    )
)
INSERT INTO "catalog_products" (
  "id",
  "printfulId",
  "title",
  "slug",
  "type",
  "brand",
  "description",
  "thumbnailUrl",
  "categoryId",
  "sellingRegion",
  "isSellable",
  "isActive",
  "curationStatus",
  "curatedAt",
  "curatedBy",
  "curationNotes",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  launch_products.id,
  launch_products.printful_id,
  launch_products.title,
  launch_products.slug,
  launch_products.type,
  launch_products.brand,
  launch_products.description,
  launch_products.thumbnail_url,
  categories."id",
  'north_america',
  true,
  true,
  'curated',
  CURRENT_TIMESTAMP,
  'codex-curated-printful-launch',
  launch_products.curation_note,
  jsonb_build_object(
    'source', 'curated-printful-launch-catalog',
    'selectedAt', '2026-06-08',
    'printfulProductId', launch_products.printful_id,
    'sellingRegion', 'north_america'
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM launch_products
JOIN "catalog_categories" categories
  ON categories."slug" = launch_products.category_slug
ON CONFLICT ("slug") DO UPDATE SET
  "printfulId" = EXCLUDED."printfulId",
  "title" = EXCLUDED."title",
  "type" = EXCLUDED."type",
  "brand" = EXCLUDED."brand",
  "description" = EXCLUDED."description",
  "thumbnailUrl" = EXCLUDED."thumbnailUrl",
  "categoryId" = EXCLUDED."categoryId",
  "sellingRegion" = EXCLUDED."sellingRegion",
  "isSellable" = true,
  "isActive" = true,
  "curationStatus" = 'curated',
  "curatedAt" = COALESCE("catalog_products"."curatedAt", CURRENT_TIMESTAMP),
  "curatedBy" = 'codex-curated-printful-launch',
  "curationNotes" = EXCLUDED."curationNotes",
  "metadata" = EXCLUDED."metadata",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH selected_variants(product_slug, printful_variant_id, name, size, color, color_code, image_url, amount) AS (
  VALUES
    ('heavyweight-cotton-shirt', 4016, 'Black / S', 'S', 'Black', '#0c0c0c', 'https://files.cdn.printful.com/products/71/4016_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4017, 'Black / M', 'M', 'Black', '#0c0c0c', 'https://files.cdn.printful.com/products/71/4016_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4018, 'Black / L', 'L', 'Black', '#0c0c0c', 'https://files.cdn.printful.com/products/71/4016_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4019, 'Black / XL', 'XL', 'Black', '#0c0c0c', 'https://files.cdn.printful.com/products/71/4016_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4020, 'Black / 2XL', '2XL', 'Black', '#0c0c0c', 'https://files.cdn.printful.com/products/71/4016_1752236278.jpg', 13.69),
    ('heavyweight-cotton-shirt', 5295, 'Black / 3XL', '3XL', 'Black', '#0c0c0c', 'https://files.cdn.printful.com/products/71/4016_1752236278.jpg', 15.69),
    ('heavyweight-cotton-shirt', 4011, 'White / S', 'S', 'White', '#ffffff', 'https://files.cdn.printful.com/products/71/4011_1752236284.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4012, 'White / M', 'M', 'White', '#ffffff', 'https://files.cdn.printful.com/products/71/4011_1752236284.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4013, 'White / L', 'L', 'White', '#ffffff', 'https://files.cdn.printful.com/products/71/4011_1752236284.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4014, 'White / XL', 'XL', 'White', '#ffffff', 'https://files.cdn.printful.com/products/71/4011_1752236284.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4015, 'White / 2XL', '2XL', 'White', '#ffffff', 'https://files.cdn.printful.com/products/71/4011_1752236284.jpg', 13.69),
    ('heavyweight-cotton-shirt', 5294, 'White / 3XL', '3XL', 'White', '#ffffff', 'https://files.cdn.printful.com/products/71/4011_1752236284.jpg', 15.69),
    ('heavyweight-cotton-shirt', 4111, 'Navy / S', 'S', 'Navy', '#212642', 'https://files.cdn.printful.com/products/71/4111_1752236282.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4112, 'Navy / M', 'M', 'Navy', '#212642', 'https://files.cdn.printful.com/products/71/4111_1752236282.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4113, 'Navy / L', 'L', 'Navy', '#212642', 'https://files.cdn.printful.com/products/71/4111_1752236282.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4114, 'Navy / XL', 'XL', 'Navy', '#212642', 'https://files.cdn.printful.com/products/71/4111_1752236282.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4115, 'Navy / 2XL', '2XL', 'Navy', '#212642', 'https://files.cdn.printful.com/products/71/4111_1752236282.jpg', 13.69),
    ('heavyweight-cotton-shirt', 12874, 'Navy / 3XL', '3XL', 'Navy', '#212642', 'https://files.cdn.printful.com/products/71/4111_1752236282.jpg', 15.69),
    ('heavyweight-cotton-shirt', 4031, 'Asphalt / S', 'S', 'Asphalt', '#52514f', 'https://files.cdn.printful.com/products/71/4031_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4032, 'Asphalt / M', 'M', 'Asphalt', '#52514f', 'https://files.cdn.printful.com/products/71/4031_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4033, 'Asphalt / L', 'L', 'Asphalt', '#52514f', 'https://files.cdn.printful.com/products/71/4031_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4034, 'Asphalt / XL', 'XL', 'Asphalt', '#52514f', 'https://files.cdn.printful.com/products/71/4031_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4035, 'Asphalt / 2XL', '2XL', 'Asphalt', '#52514f', 'https://files.cdn.printful.com/products/71/4031_1752236278.jpg', 13.69),
    ('heavyweight-cotton-shirt', 5297, 'Asphalt / 3XL', '3XL', 'Asphalt', '#52514f', 'https://files.cdn.printful.com/products/71/4031_1752236278.jpg', 15.69),
    ('heavyweight-cotton-shirt', 6948, 'Athletic Heather / S', 'S', 'Athletic Heather', '#cececc', 'https://files.cdn.printful.com/products/71/6948_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 6949, 'Athletic Heather / M', 'M', 'Athletic Heather', '#cececc', 'https://files.cdn.printful.com/products/71/6948_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 6950, 'Athletic Heather / L', 'L', 'Athletic Heather', '#cececc', 'https://files.cdn.printful.com/products/71/6948_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 6951, 'Athletic Heather / XL', 'XL', 'Athletic Heather', '#cececc', 'https://files.cdn.printful.com/products/71/6948_1752236278.jpg', 11.69),
    ('heavyweight-cotton-shirt', 6952, 'Athletic Heather / 2XL', '2XL', 'Athletic Heather', '#cececc', 'https://files.cdn.printful.com/products/71/6948_1752236278.jpg', 13.69),
    ('heavyweight-cotton-shirt', 6953, 'Athletic Heather / 3XL', '3XL', 'Athletic Heather', '#cececc', 'https://files.cdn.printful.com/products/71/6948_1752236278.jpg', 15.69),
    ('heavyweight-cotton-shirt', 4141, 'Red / S', 'S', 'Red', '#d0071e', 'https://files.cdn.printful.com/products/71/4141_1752236283.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4142, 'Red / M', 'M', 'Red', '#d0071e', 'https://files.cdn.printful.com/products/71/4141_1752236283.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4143, 'Red / L', 'L', 'Red', '#d0071e', 'https://files.cdn.printful.com/products/71/4141_1752236283.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4144, 'Red / XL', 'XL', 'Red', '#d0071e', 'https://files.cdn.printful.com/products/71/4141_1752236283.jpg', 11.69),
    ('heavyweight-cotton-shirt', 4145, 'Red / 2XL', '2XL', 'Red', '#d0071e', 'https://files.cdn.printful.com/products/71/4141_1752236283.jpg', 13.69),
    ('heavyweight-cotton-shirt', 5304, 'Red / 3XL', '3XL', 'Red', '#d0071e', 'https://files.cdn.printful.com/products/71/4141_1752236283.jpg', 15.69),
    ('ceramic-mug', 1320, 'White / 11 oz', '11 oz', 'White', '#ffffff', 'https://files.cdn.printful.com/products/19/1320_1663762583.jpg', 5.95),
    ('ceramic-mug', 4830, 'White / 15 oz', '15 oz', 'White', '#ffffff', 'https://files.cdn.printful.com/products/19/4830_1519394046.jpg', 7.95),
    ('ceramic-mug', 16586, 'White / 20 oz', '20 oz', 'White', '#ffffff', 'https://files.cdn.printful.com/products/19/16586_1680616351.jpg', 9.50),
    ('matte-poster', 3876, '12 x 18 in', '12 x 18 in', NULL, NULL, 'https://files.cdn.printful.com/products/1/3876_1527678813.jpg', 11.39),
    ('matte-poster', 3877, '16 x 20 in', '16 x 20 in', NULL, NULL, 'https://files.cdn.printful.com/products/1/3877_1527678896.jpg', 11.89),
    ('matte-poster', 1, '18 x 24 in', '18 x 24 in', NULL, NULL, 'https://files.cdn.printful.com/products/1/1_1527683474.jpg', 12.89),
    ('matte-poster', 2, '24 x 36 in', '24 x 36 in', NULL, NULL, 'https://files.cdn.printful.com/products/1/2_1527678974.jpg', 17.89),
    ('canvas-tote-bag', 10457, 'Black / One size', 'One size', 'Black', '#101010', 'https://files.cdn.printful.com/products/367/10457_1582200790.jpg', 15.56),
    ('canvas-tote-bag', 10458, 'Oyster / One size', 'One size', 'Oyster', '#edcea5', 'https://files.cdn.printful.com/products/367/10458_1642499411.jpg', 15.56),
    ('kiss-cut-sticker', 10163, '3 x 3 in', '3 x 3 in', 'White', '#ffffff', 'https://files.cdn.printful.com/products/358/10163_1553083889.jpg', 2.29),
    ('kiss-cut-sticker', 10164, '4 x 4 in', '4 x 4 in', 'White', '#ffffff', 'https://files.cdn.printful.com/products/358/10164_1553083894.jpg', 2.49),
    ('kiss-cut-sticker', 10165, '5.5 x 5.5 in', '5.5 x 5.5 in', 'White', '#ffffff', 'https://files.cdn.printful.com/products/358/10165_1553083897.jpg', 2.69)
),
curated_products AS (
  SELECT "id", "slug"
  FROM "catalog_products"
  WHERE "slug" IN (
    'heavyweight-cotton-shirt',
    'ceramic-mug',
    'matte-poster',
    'canvas-tote-bag',
    'kiss-cut-sticker'
  )
),
disabled AS (
  UPDATE "catalog_variants"
  SET
    "isAvailable" = false,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "productId" IN (SELECT "id" FROM curated_products)
    AND (
      "printfulVariantId" IS NULL
      OR "printfulVariantId" NOT IN (SELECT printful_variant_id FROM selected_variants)
    )
  RETURNING "id"
),
upserted AS (
  INSERT INTO "catalog_variants" (
    "id",
    "printfulVariantId",
    "productId",
    "name",
    "size",
    "color",
    "colorCode",
    "imageUrl",
    "availability",
    "isAvailable",
    "createdAt",
    "updatedAt"
  )
  SELECT
    'printful-variant-' || selected_variants.printful_variant_id::text,
    selected_variants.printful_variant_id,
    curated_products."id",
    selected_variants.name,
    selected_variants.size,
    selected_variants.color,
    selected_variants.color_code,
    selected_variants.image_url,
    jsonb_build_object(
      'sellingRegion', 'north_america',
      'source', 'curated-printful-launch-catalog'
    ),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM selected_variants
  JOIN curated_products
    ON curated_products."slug" = selected_variants.product_slug
  ON CONFLICT ("printfulVariantId") DO UPDATE SET
    "productId" = EXCLUDED."productId",
    "name" = EXCLUDED."name",
    "size" = EXCLUDED."size",
    "color" = EXCLUDED."color",
    "colorCode" = EXCLUDED."colorCode",
    "imageUrl" = EXCLUDED."imageUrl",
    "availability" = EXCLUDED."availability",
    "isAvailable" = true,
    "updatedAt" = CURRENT_TIMESTAMP
  RETURNING "id", "printfulVariantId", "productId"
)
INSERT INTO "price_snapshots" (
  "id", "productId", "variantId", "source", "currency", "amount", "priceType", "capturedAt"
)
SELECT
  'price-snapshot-curated-20260608-' || selected_variants.printful_variant_id::text,
  upserted."productId",
  upserted."id",
  'printful-variant-prices',
  'USD',
  selected_variants.amount,
  'base',
  CURRENT_TIMESTAMP
FROM selected_variants
JOIN upserted
  ON upserted."printfulVariantId" = selected_variants.printful_variant_id
ON CONFLICT ("id") DO NOTHING;

WITH selected_placements(product_slug, code, display_name, technique, width, height, is_default) AS (
  VALUES
    ('heavyweight-cotton-shirt', 'front', 'Front print', 'dtg', 12.00, 16.00, true),
    ('ceramic-mug', 'default', 'Wraparound print', 'sublimation', 9.00, 3.50, true),
    ('matte-poster', 'default', 'Print file', 'digital', 12.00, 18.00, true),
    ('canvas-tote-bag', 'front', 'Front print', 'dtg', 10.00, 10.00, true),
    ('kiss-cut-sticker', 'default', 'Print file', 'digital', 3.00, 3.00, true)
),
curated_products AS (
  SELECT "id", "slug"
  FROM "catalog_products"
  WHERE "slug" IN (
    'heavyweight-cotton-shirt',
    'ceramic-mug',
    'matte-poster',
    'canvas-tote-bag',
    'kiss-cut-sticker'
  )
),
deleted AS (
  DELETE FROM "print_placements"
  WHERE "productId" IN (SELECT "id" FROM curated_products)
    AND NOT EXISTS (
      SELECT 1
      FROM selected_placements
      JOIN curated_products product_lookup
        ON product_lookup."slug" = selected_placements.product_slug
      WHERE product_lookup."id" = "print_placements"."productId"
        AND selected_placements.code = "print_placements"."code"
        AND selected_placements.technique = "print_placements"."technique"
    )
  RETURNING "id"
)
INSERT INTO "print_placements" (
  "id",
  "productId",
  "code",
  "displayName",
  "technique",
  "width",
  "height",
  "orientation",
  "isDefault",
  "createdAt",
  "updatedAt"
)
SELECT
  'print-placement-' || selected_placements.product_slug || '-' || selected_placements.code || '-' || selected_placements.technique,
  curated_products."id",
  selected_placements.code,
  selected_placements.display_name,
  selected_placements.technique,
  selected_placements.width,
  selected_placements.height,
  NULL,
  selected_placements.is_default,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM selected_placements
JOIN curated_products
  ON curated_products."slug" = selected_placements.product_slug
ON CONFLICT ("productId", "code", "technique") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "width" = EXCLUDED."width",
  "height" = EXCLUDED."height",
  "orientation" = EXCLUDED."orientation",
  "isDefault" = EXCLUDED."isDefault",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "catalog_sync_runs" (
  "id",
  "status",
  "source",
  "startedAt",
  "finishedAt",
  "productsSeen",
  "variantsSeen",
  "categoriesSeen",
  "metadata"
)
VALUES (
  'catalog-sync-curated-printful-20260608',
  'completed',
  'curated-printful-launch-catalog',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  5,
  48,
  5,
  jsonb_build_object(
    'printfulProductIds', jsonb_build_array(71, 19, 1, 367, 358),
    'variantPolicy', 'tee S-3XL across six colors; mug, poster, tote, and sticker launch variants',
    'placementPolicy', 'single checkout-safe print placement per product until per-placement pricing ships'
  )
)
ON CONFLICT ("id") DO NOTHING;
