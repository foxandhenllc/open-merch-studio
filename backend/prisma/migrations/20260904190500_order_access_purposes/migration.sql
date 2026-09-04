-- Browser and email credentials rotate independently so returning from Stripe cannot invalidate
-- the durable order link already delivered to the customer.

BEGIN;

DROP INDEX "order_access_grants_orderId_revokedAt_idx";

ALTER TABLE "order_access_grants"
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'browser';

CREATE INDEX "order_access_grants_orderId_purpose_revokedAt_idx"
  ON "order_access_grants"("orderId", "purpose", "revokedAt");

COMMIT;
