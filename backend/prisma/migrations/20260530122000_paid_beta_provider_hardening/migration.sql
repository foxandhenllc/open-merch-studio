-- AlterTable
ALTER TABLE "catalog_products"
  ADD COLUMN "curationStatus" TEXT NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN "curatedAt" TIMESTAMP(3),
  ADD COLUMN "curatedBy" TEXT,
  ADD COLUMN "curationNotes" TEXT;

-- AlterTable
ALTER TABLE "design_assets"
  ADD COLUMN "generationStatus" TEXT NOT NULL DEFAULT 'complete',
  ADD COLUMN "policyStatus" TEXT NOT NULL DEFAULT 'pass',
  ADD COLUMN "policyReport" JSONB,
  ADD COLUMN "failureReason" TEXT;

-- AlterTable
ALTER TABLE "mockup_tasks"
  ADD COLUMN "errorMessage" TEXT;

-- AddForeignKey
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_quoteId_fkey"
  FOREIGN KEY ("quoteId")
  REFERENCES "quotes"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
