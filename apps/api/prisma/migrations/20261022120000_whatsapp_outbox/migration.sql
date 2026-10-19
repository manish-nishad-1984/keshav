-- WhatsApp outbox (messages to send, with status).
DO $$ BEGIN
    CREATE TYPE "WhatsappStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "karigarId" UUID,
    "toNumber" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "dedupeKey" TEXT,
    "status" "WhatsappStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_organizationId_dedupeKey_key" ON "whatsapp_messages"("organizationId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_status_nextAttemptAt_idx" ON "whatsapp_messages"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_organizationId_createdAt_idx" ON "whatsapp_messages"("organizationId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
