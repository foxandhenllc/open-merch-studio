-- Legacy orders remain nullable. Every checkout created by the application after
-- this migration records the exact policy version and a server-generated time.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "policyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "policyAcceptedAt" TIMESTAMP(3);
