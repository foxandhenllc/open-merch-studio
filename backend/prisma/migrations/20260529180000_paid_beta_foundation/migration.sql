-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'QUOTED', 'PENDING_PAYMENT', 'PAID', 'SUBMITTED', 'SHIPPED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "catalog_categories" (
    "id" TEXT NOT NULL,
    "printfulId" INTEGER,
    "parentPrintfulId" INTEGER,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isLaunchCategory" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_products" (
    "id" TEXT NOT NULL,
    "printfulId" INTEGER,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT,
    "brand" TEXT,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "categoryId" TEXT,
    "sellingRegion" TEXT NOT NULL DEFAULT 'north_america',
    "isSellable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_variants" (
    "id" TEXT NOT NULL,
    "printfulVariantId" INTEGER,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "size" TEXT,
    "color" TEXT,
    "colorCode" TEXT,
    "imageUrl" TEXT,
    "availability" JSONB,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_placements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "technique" TEXT NOT NULL DEFAULT 'dtg',
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "orientation" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mockup_styles" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "printfulStyleId" INTEGER,
    "styleName" TEXT NOT NULL,
    "viewName" TEXT NOT NULL,
    "placement" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mockup_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'printful',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(10,2) NOT NULL,
    "priceType" TEXT NOT NULL DEFAULT 'base',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_sync_runs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'printful',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "productsSeen" INTEGER NOT NULL DEFAULT 0,
    "variantsSeen" INTEGER NOT NULL DEFAULT 0,
    "categoriesSeen" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "catalog_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_assets" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "imageUrl" TEXT,
    "transparentUrl" TEXT,
    "readinessStatus" TEXT NOT NULL DEFAULT 'pending',
    "readinessReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_sessions" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'guest',
    "freeDraftsUsed" INTEGER NOT NULL DEFAULT 0,
    "freeDraftLimit" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_passes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'simulated',
    "priceCents" INTEGER NOT NULL DEFAULT 500,
    "creditCents" INTEGER NOT NULL DEFAULT 500,
    "includedRoughDrafts" INTEGER NOT NULL DEFAULT 8,
    "includedEdits" INTEGER NOT NULL DEFAULT 2,
    "includedFinals" INTEGER NOT NULL DEFAULT 1,
    "roughDraftsUsed" INTEGER NOT NULL DEFAULT 0,
    "editsUsed" INTEGER NOT NULL DEFAULT 0,
    "finalsUsed" INTEGER NOT NULL DEFAULT 0,
    "appliedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "studio_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_spend_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "designAssetId" TEXT,
    "action" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_spend_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mockup_tasks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "designAssetId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'fixture',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "placementCodes" TEXT[],
    "imageUrl" TEXT,
    "providerTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mockup_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "productCostCents" INTEGER NOT NULL,
    "shippingEstimateCents" INTEGER NOT NULL,
    "taxEstimateCents" INTEGER NOT NULL DEFAULT 0,
    "aiDesignFeeCents" INTEGER NOT NULL,
    "paymentFeeCents" INTEGER NOT NULL,
    "targetMarginCents" INTEGER NOT NULL,
    "studioPassCreditCents" INTEGER NOT NULL DEFAULT 0,
    "subtotalBeforeCreditsCents" INTEGER NOT NULL DEFAULT 0,
    "costLines" JSONB,
    "estimateFlags" JSONB,
    "totalCents" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "designAssetId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "placementCodes" TEXT[],
    "unitCostCents" INTEGER NOT NULL,
    "unitRetailCents" INTEGER NOT NULL,
    "options" JSONB,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "quoteId" TEXT,
    "email" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "stripeSessionId" TEXT,
    "printfulOrderId" TEXT,
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'not_submitted',
    "failureReason" TEXT,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_transitions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_attempts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'printful',
    "providerOrderId" TEXT,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "designAssetId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "placementCodes" TEXT[],
    "unitRetailCents" INTEGER NOT NULL,
    "printfulPayload" JSONB,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_categories_printfulId_key" ON "catalog_categories"("printfulId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_categories_slug_key" ON "catalog_categories"("slug");

-- CreateIndex
CREATE INDEX "catalog_categories_isLaunchCategory_isActive_idx" ON "catalog_categories"("isLaunchCategory", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_printfulId_key" ON "catalog_products"("printfulId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_slug_key" ON "catalog_products"("slug");

-- CreateIndex
CREATE INDEX "catalog_products_isSellable_isActive_idx" ON "catalog_products"("isSellable", "isActive");

-- CreateIndex
CREATE INDEX "catalog_products_categoryId_idx" ON "catalog_products"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_variants_printfulVariantId_key" ON "catalog_variants"("printfulVariantId");

-- CreateIndex
CREATE INDEX "catalog_variants_productId_isAvailable_idx" ON "catalog_variants"("productId", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "print_placements_productId_code_technique_key" ON "print_placements"("productId", "code", "technique");

-- CreateIndex
CREATE INDEX "mockup_styles_productId_isActive_idx" ON "mockup_styles"("productId", "isActive");

-- CreateIndex
CREATE INDEX "price_snapshots_productId_variantId_priceType_capturedAt_idx" ON "price_snapshots"("productId", "variantId", "priceType", "capturedAt");

-- CreateIndex
CREATE INDEX "catalog_sync_runs_status_startedAt_idx" ON "catalog_sync_runs"("status", "startedAt");

-- CreateIndex
CREATE INDEX "studio_sessions_status_createdAt_idx" ON "studio_sessions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "studio_passes_sessionId_status_idx" ON "studio_passes"("sessionId", "status");

-- CreateIndex
CREATE INDEX "ai_spend_events_sessionId_createdAt_idx" ON "ai_spend_events"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_spend_events_action_provider_createdAt_idx" ON "ai_spend_events"("action", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "mockup_tasks_status_createdAt_idx" ON "mockup_tasks"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_settings_key_key" ON "admin_settings"("key");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "quotes_expiresAt_idx" ON "quotes"("expiresAt");

-- CreateIndex
CREATE INDEX "quote_items_quoteId_idx" ON "quote_items"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "order_transitions_orderId_createdAt_idx" ON "order_transitions"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_events_orderId_createdAt_idx" ON "payment_events"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_providerEventId_key" ON "payment_events"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "fulfillment_attempts_orderId_createdAt_idx" ON "fulfillment_attempts"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_variants" ADD CONSTRAINT "catalog_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_placements" ADD CONSTRAINT "print_placements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mockup_styles" ADD CONSTRAINT "mockup_styles_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_passes" ADD CONSTRAINT "studio_passes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "studio_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_spend_events" ADD CONSTRAINT "ai_spend_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "studio_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_spend_events" ADD CONSTRAINT "ai_spend_events_designAssetId_fkey" FOREIGN KEY ("designAssetId") REFERENCES "design_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_designAssetId_fkey" FOREIGN KEY ("designAssetId") REFERENCES "design_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_transitions" ADD CONSTRAINT "order_transitions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_attempts" ADD CONSTRAINT "fulfillment_attempts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_designAssetId_fkey" FOREIGN KEY ("designAssetId") REFERENCES "design_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

