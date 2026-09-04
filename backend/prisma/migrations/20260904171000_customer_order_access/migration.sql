-- Revocable customer order access. Only a SHA-256 digest is retained; the bearer value is returned
-- once to the customer browser after confirmed fixture or Stripe-backed payment reconciliation.

BEGIN;

CREATE TABLE "order_access_grants" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_access_grants_tokenHash_key"
  ON "order_access_grants"("tokenHash");
CREATE INDEX "order_access_grants_orderId_revokedAt_idx"
  ON "order_access_grants"("orderId", "revokedAt");

ALTER TABLE "order_access_grants"
  ADD CONSTRAINT "order_access_grants_orderId_fkey" FOREIGN KEY ("orderId")
  REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.order_access_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_access_grants FROM anon, authenticated;

COMMIT;
