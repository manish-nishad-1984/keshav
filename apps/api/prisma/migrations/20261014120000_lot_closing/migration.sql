-- Lot closing: an admin can close a lot with a reason for the pieces that were never delivered.
ALTER TABLE "cutting_entries" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "cutting_entries" ADD COLUMN IF NOT EXISTS "closeReason" TEXT;
ALTER TABLE "cutting_entries" ADD COLUMN IF NOT EXISTS "closeNote" TEXT;
ALTER TABLE "cutting_entries" ADD COLUMN IF NOT EXISTS "closedShortage" INTEGER;
ALTER TABLE "cutting_entries" ADD COLUMN IF NOT EXISTS "closedById" UUID;
