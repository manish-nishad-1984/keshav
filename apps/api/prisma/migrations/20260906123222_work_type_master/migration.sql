-- CreateTable
CREATE TABLE "work_types" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "work_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_types_organizationId_name_key" ON "work_types"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "work_types" ADD CONSTRAINT "work_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed one WorkType row per existing organization for each of the four legacy enum values, so
-- existing Karigar rows have something to backfill onto below.
INSERT INTO "work_types" ("id", "organizationId", "name", "isActive", "updatedAt")
SELECT gen_random_uuid(), o."id", v.name, true, CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN (VALUES ('Stitching'), ('Cutting'), ('Finishing'), ('Packing')) AS v(name);

-- Add the new FK column, nullable for now so existing rows can be backfilled before it's required.
ALTER TABLE "karigars" ADD COLUMN "workTypeId" UUID;

-- Backfill workTypeId from the old workType enum value, matching by organization + label.
UPDATE "karigars" k
SET "workTypeId" = wt."id"
FROM "work_types" wt
WHERE wt."organizationId" = k."organizationId"
  AND wt."name" = CASE k."workType"
    WHEN 'STITCHING' THEN 'Stitching'
    WHEN 'CUTTING' THEN 'Cutting'
    WHEN 'FINISHING' THEN 'Finishing'
    WHEN 'PACKING' THEN 'Packing'
  END;

-- Every karigar now has a matching work type — enforce it going forward.
ALTER TABLE "karigars" ALTER COLUMN "workTypeId" SET NOT NULL;

-- Drop the old enum column and type now that workTypeId fully replaces it.
ALTER TABLE "karigars" DROP COLUMN "workType";
DROP TYPE "WorkType";

-- AddForeignKey
ALTER TABLE "karigars" ADD CONSTRAINT "karigars_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
