-- Daily Production Entry: the stitching rate can be filled in later, and the entry keeps a time of day.
ALTER TABLE "production_entries" ALTER COLUMN "carrierRate" DROP NOT NULL;
ALTER TABLE "production_entries" ADD COLUMN "entryTime" TEXT;
