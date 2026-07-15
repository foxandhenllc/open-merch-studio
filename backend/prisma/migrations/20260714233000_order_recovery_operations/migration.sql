-- Preserve operator-visible order outcomes across server restarts and provide a
-- lightweight acknowledgement/resolution trail for paid-beta support.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "operatorReviewStatus" TEXT NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS "operatorReviewedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "orders_operatorReviewStatus_createdAt_idx"
  ON "orders"("operatorReviewStatus", "createdAt");

ALTER TABLE "payment_events"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
