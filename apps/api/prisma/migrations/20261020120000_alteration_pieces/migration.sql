-- Alteration pieces: entered on a production hand-in, counted when the lot is closed.
ALTER TABLE "production_entries" ADD COLUMN IF NOT EXISTS "alterationQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cutting_entries" ADD COLUMN IF NOT EXISTS "closedAlteration" INTEGER;
