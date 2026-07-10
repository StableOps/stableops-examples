CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'DETECTED', 'CONFIRMED', 'FINALIZED', 'REVERTED', 'EXPIRED', 'CANCELED');

CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "stableOpsOrderId" TEXT,
  "checkoutUrl" TEXT,
  "checkoutExpiresAt" TIMESTAMP(3) NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "fulfilledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "stableOpsOrderId" TEXT,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "orderId" TEXT,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_stableOpsOrderId_key" ON "Order"("stableOpsOrderId");
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
