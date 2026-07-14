ALTER TABLE "orders"
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "taxCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "orders_stripePaymentIntentId_key"
  ON "orders"("stripePaymentIntentId");

CREATE INDEX "orders_stripeSessionId_idx"
  ON "orders"("stripeSessionId");
