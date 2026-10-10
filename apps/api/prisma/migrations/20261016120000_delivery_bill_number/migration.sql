-- Delivery: the client's bill number (optional, for their reference).
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "billNumber" TEXT;
