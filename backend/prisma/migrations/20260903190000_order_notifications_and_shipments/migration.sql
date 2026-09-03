-- Durable customer communications and signed Printful shipment events.
-- These tables remain server-only: RLS is enabled and browser roles receive
-- no grants or policies.

BEGIN;

CREATE TABLE "shipments" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'printful',
  "providerShipmentId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "carrier" TEXT,
  "service" TEXT,
  "trackingNumber" TEXT,
  "trackingUrl" TEXT,
  "items" JSONB,
  "reshipment" BOOLEAN NOT NULL DEFAULT false,
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_email_deliveries" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'resend',
  "providerMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_webhook_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT,
  "provider" TEXT NOT NULL,
  "eventHash" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "publicKeyFingerprint" TEXT,
  "storeId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipments_provider_providerShipmentId_key"
  ON "shipments"("provider", "providerShipmentId");
CREATE INDEX "shipments_orderId_shippedAt_idx" ON "shipments"("orderId", "shippedAt");
CREATE UNIQUE INDEX "customer_email_deliveries_eventKey_key"
  ON "customer_email_deliveries"("eventKey");
CREATE INDEX "customer_email_deliveries_orderId_createdAt_idx"
  ON "customer_email_deliveries"("orderId", "createdAt");
CREATE INDEX "customer_email_deliveries_status_updatedAt_idx"
  ON "customer_email_deliveries"("status", "updatedAt");
CREATE UNIQUE INDEX "provider_webhook_events_provider_eventHash_key"
  ON "provider_webhook_events"("provider", "eventHash");
CREATE INDEX "provider_webhook_events_orderId_createdAt_idx"
  ON "provider_webhook_events"("orderId", "createdAt");
CREATE INDEX "provider_webhook_events_provider_status_updatedAt_idx"
  ON "provider_webhook_events"("provider", "status", "updatedAt");

ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId")
  REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_email_deliveries"
  ADD CONSTRAINT "customer_email_deliveries_orderId_fkey" FOREIGN KEY ("orderId")
  REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_webhook_events"
  ADD CONSTRAINT "provider_webhook_events_orderId_fkey" FOREIGN KEY ("orderId")
  REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.shipments FROM anon, authenticated;
REVOKE ALL ON TABLE public.customer_email_deliveries FROM anon, authenticated;
REVOKE ALL ON TABLE public.provider_webhook_events FROM anon, authenticated;

COMMIT;
