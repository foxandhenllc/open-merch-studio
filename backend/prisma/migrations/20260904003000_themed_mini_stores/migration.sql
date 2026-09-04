-- Durable owner-product and themed storefront foundation.
-- Public reads continue through the application API; no Supabase Data API policies are granted.

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_status_createdAt_idx" ON "organizations"("status", "createdAt");

CREATE TABLE "organization_members" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'editor',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_members_organizationId_subject_key" ON "organization_members"("organizationId", "subject");
CREATE INDEX "organization_members_subject_idx" ON "organization_members"("subject");

CREATE TABLE "brand_profiles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "shortDescription" TEXT,
  "logoUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#111111',
  "accentColor" TEXT NOT NULL DEFAULT '#d76732',
  "supportEmail" TEXT,
  "websiteUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "brand_profiles_organizationId_key" ON "brand_profiles"("organizationId");

CREATE TABLE "saved_designs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_designs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saved_designs_organizationId_slug_key" ON "saved_designs"("organizationId", "slug");
CREATE INDEX "saved_designs_organizationId_status_createdAt_idx" ON "saved_designs"("organizationId", "status", "createdAt");

CREATE TABLE "design_versions" (
  "id" TEXT NOT NULL,
  "savedDesignId" TEXT NOT NULL,
  "designAssetId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "provenance" JSONB NOT NULL,
  "rightsConfirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "design_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "design_versions_savedDesignId_versionNumber_key" ON "design_versions"("savedDesignId", "versionNumber");
CREATE INDEX "design_versions_designAssetId_idx" ON "design_versions"("designAssetId");

CREATE TABLE "saved_products" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "designVersionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "defaultQuantity" INTEGER NOT NULL DEFAULT 1,
  "placementCodes" TEXT[],
  "configuration" JSONB NOT NULL,
  "mockupUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saved_products_organizationId_slug_key" ON "saved_products"("organizationId", "slug");
CREATE INDEX "saved_products_organizationId_status_createdAt_idx" ON "saved_products"("organizationId", "status", "createdAt");

CREATE TABLE "merch_collections" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "heroImageUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "merch_collections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "merch_collections_organizationId_slug_key" ON "merch_collections"("organizationId", "slug");
CREATE INDEX "merch_collections_organizationId_status_createdAt_idx" ON "merch_collections"("organizationId", "status", "createdAt");

CREATE TABLE "collection_products" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "savedProductId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "collection_products_collectionId_savedProductId_key" ON "collection_products"("collectionId", "savedProductId");
CREATE UNIQUE INDEX "collection_products_collectionId_position_key" ON "collection_products"("collectionId", "position");
CREATE INDEX "collection_products_savedProductId_idx" ON "collection_products"("savedProductId");

CREATE TABLE "storefronts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "storefronts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "storefronts_organizationId_slug_key" ON "storefronts"("organizationId", "slug");
CREATE INDEX "storefronts_status_publishedAt_idx" ON "storefronts"("status", "publishedAt");

ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_designs" ADD CONSTRAINT "saved_designs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_savedDesignId_fkey" FOREIGN KEY ("savedDesignId") REFERENCES "saved_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_designAssetId_fkey" FOREIGN KEY ("designAssetId") REFERENCES "design_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saved_products" ADD CONSTRAINT "saved_products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_products" ADD CONSTRAINT "saved_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saved_products" ADD CONSTRAINT "saved_products_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saved_products" ADD CONSTRAINT "saved_products_designVersionId_fkey" FOREIGN KEY ("designVersionId") REFERENCES "design_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "merch_collections" ADD CONSTRAINT "merch_collections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "merch_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_savedProductId_fkey" FOREIGN KEY ("savedProductId") REFERENCES "saved_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "merch_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
