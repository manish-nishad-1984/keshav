-- CreateTable
CREATE TABLE "production_entries" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "karigarId" UUID NOT NULL,
    "workTypeId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "photoUrl" TEXT,
    "remarks" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "production_entries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "karigars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
