WITH added_placements(product_slug, code, display_name, technique, width, height, is_default) AS (
  VALUES
    ('heavyweight-cotton-shirt', 'back', 'Back print', 'dtg', 12.00, 16.00, false),
    ('canvas-tote-bag', 'back', 'Back print', 'dtg', 10.00, 10.00, false)
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
  'print-placement-' || added_placements.product_slug || '-' || added_placements.code || '-' || added_placements.technique,
  products."id",
  added_placements.code,
  added_placements.display_name,
  added_placements.technique,
  added_placements.width,
  added_placements.height,
  NULL,
  added_placements.is_default,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM added_placements
JOIN "catalog_products" products ON products."slug" = added_placements.product_slug
ON CONFLICT ("productId", "code", "technique") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "width" = EXCLUDED."width",
  "height" = EXCLUDED."height",
  "isDefault" = EXCLUDED."isDefault",
  "updatedAt" = CURRENT_TIMESTAMP;
