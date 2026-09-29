-- CreateEnum
CREATE TYPE "AverageUnit" AS ENUM ('KILOGRAM', 'METER');

-- CreateTable
CREATE TABLE "pattern_types" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "pattern_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_entries" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "patternTypeId" UUID NOT NULL,
    "characterId" UUID NOT NULL,
    "isOnline" BOOLEAN NOT NULL,
    "itemId" UUID NOT NULL,
    "partyName" TEXT NOT NULL,
    "averageValue" DECIMAL(10,2) NOT NULL,
    "averageUnit" "AverageUnit" NOT NULL,
    "colorId" UUID NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "cutting_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_entry_lines" (
    "id" UUID NOT NULL,
    "cuttingEntryId" UUID NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cutting_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pattern_types_organizationId_name_key" ON "pattern_types"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "colors_organizationId_name_key" ON "colors"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "cutting_entries_organizationId_lotNumber_key" ON "cutting_entries"("organizationId", "lotNumber");

-- AddForeignKey
ALTER TABLE "pattern_types" ADD CONSTRAINT "pattern_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colors" ADD CONSTRAINT "colors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_entries" ADD CONSTRAINT "cutting_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_entries" ADD CONSTRAINT "cutting_entries_patternTypeId_fkey" FOREIGN KEY ("patternTypeId") REFERENCES "pattern_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_entries" ADD CONSTRAINT "cutting_entries_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "pattern_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_entries" ADD CONSTRAINT "cutting_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_entries" ADD CONSTRAINT "cutting_entries_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_entry_lines" ADD CONSTRAINT "cutting_entry_lines_cuttingEntryId_fkey" FOREIGN KEY ("cuttingEntryId") REFERENCES "cutting_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameColumn: karigarId -> carrierId (preserves existing values and the FK constraint,
-- which stays attached through the rename; only its auto-generated name still says
-- "karigarId", which is cosmetic and harmless)
ALTER TABLE "production_entries" RENAME COLUMN "karigarId" TO "carrierId";

-- RenameColumn: quantity -> carrierQuantity
ALTER TABLE "production_entries" RENAME COLUMN "quantity" TO "carrierQuantity";

-- RenameColumn: rate -> carrierRate
ALTER TABLE "production_entries" RENAME COLUMN "rate" TO "carrierRate";

-- RenameColumn: totalAmount -> carrierTotal
ALTER TABLE "production_entries" RENAME COLUMN "totalAmount" TO "carrierTotal";

-- AlterTable: new nullable columns (lot tracking + the two new optional finishing stages)
ALTER TABLE "production_entries"
    ADD COLUMN "cuttingEntryId" UUID,
    ADD COLUMN "lotNumber" TEXT,
    ADD COLUMN "designNumber" TEXT,
    ADD COLUMN "overlockCarrierId" UUID,
    ADD COLUMN "overlockRate" DECIMAL(10,2),
    ADD COLUMN "overlockTotal" DECIMAL(12,2),
    ADD COLUMN "flatlockKarigarId" UUID,
    ADD COLUMN "flatlockRate" DECIMAL(10,2),
    ADD COLUMN "flatlockTotal" DECIMAL(12,2);

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_cuttingEntryId_fkey" FOREIGN KEY ("cuttingEntryId") REFERENCES "cutting_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_overlockCarrierId_fkey" FOREIGN KEY ("overlockCarrierId") REFERENCES "karigars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_flatlockKarigarId_fkey" FOREIGN KEY ("flatlockKarigarId") REFERENCES "karigars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
