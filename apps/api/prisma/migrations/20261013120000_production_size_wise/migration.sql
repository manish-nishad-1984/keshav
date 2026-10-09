-- Production entry per colour + size: what the stitching karigar handed in, cell by cell.

CREATE TABLE IF NOT EXISTS "production_entry_quantities" (
    "id" UUID NOT NULL,
    "productionEntryId" UUID NOT NULL,
    "colorId" UUID NOT NULL,
    "sizeId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "production_entry_quantities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "production_entry_quantities_productionEntryId_colorId_sizeId_key"
    ON "production_entry_quantities"("productionEntryId", "colorId", "sizeId");

ALTER TABLE "production_entry_quantities" ADD CONSTRAINT "production_entry_quantities_productionEntryId_fkey" FOREIGN KEY ("productionEntryId") REFERENCES "production_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_entry_quantities" ADD CONSTRAINT "production_entry_quantities_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_entry_quantities" ADD CONSTRAINT "production_entry_quantities_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: until now an entry was "everything the karigar still had pending", so each karigar's
-- entries of a lot, oldest first, are laid over their distributions, oldest first.
INSERT INTO "production_entry_quantities" ("id", "productionEntryId", "colorId", "sizeId", "quantity")
WITH cells AS (
    SELECT d."karigarId", d."cuttingEntryId", q."colorId", q."sizeId",
           SUM(q."quantity") OVER w AS cell_end,
           SUM(q."quantity") OVER w - q."quantity" AS cell_start
    FROM "cutting_distribution_quantities" q
    JOIN "cutting_distributions" d ON d."id" = q."distributionId"
    JOIN "sizes" s ON s."id" = q."sizeId"
    WINDOW w AS (
        PARTITION BY d."karigarId", d."cuttingEntryId"
        ORDER BY d."createdAt", d."id", q."colorId", s."sortOrder", q."sizeId"
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )
),
entries AS (
    SELECT p."id", p."carrierId" AS "karigarId", p."cuttingEntryId",
           SUM(p."carrierQuantity") OVER w AS entry_end,
           SUM(p."carrierQuantity") OVER w - p."carrierQuantity" AS entry_start
    FROM "production_entries" p
    WHERE p."deletedAt" IS NULL AND p."cuttingEntryId" IS NOT NULL
    WINDOW w AS (
        PARTITION BY p."carrierId", p."cuttingEntryId"
        ORDER BY p."createdAt", p."id"
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )
)
SELECT md5(random()::text || clock_timestamp()::text || e."id"::text || c."colorId"::text || c."sizeId"::text)::uuid,
       e."id", c."colorId", c."sizeId",
       SUM(LEAST(c.cell_end, e.entry_end) - GREATEST(c.cell_start, e.entry_start))::int
FROM entries e
JOIN cells c ON c."karigarId" = e."karigarId" AND c."cuttingEntryId" = e."cuttingEntryId"
WHERE LEAST(c.cell_end, e.entry_end) > GREATEST(c.cell_start, e.entry_start)
GROUP BY e."id", c."colorId", c."sizeId";
