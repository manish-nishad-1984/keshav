-- PCs can have up to two decimals; remaining fabric after cutting (same unit as Avg).
ALTER TABLE "cutting_entries" ALTER COLUMN "pieces" TYPE DECIMAL(10,2);
ALTER TABLE "cutting_entries" ADD COLUMN IF NOT EXISTS "remainingFabric" DECIMAL(10,3);
