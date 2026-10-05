-- Cutting entry redesign: colour rows x Size Master quantities, optional entry time, rates removed.
-- Existing data is carried over:
--   * every organization gets the default sizes S/38/28 ... 5XL/52/42
--   * free-text sizes on existing lines that don't match a default become extra sizes
--   * each existing lot becomes one colour row (its old colour); line quantities map onto sizes
--   * old totalAmount values stay on the lots (column becomes nullable; new lots leave it null)
-- IDs use md5()::uuid rather than gen_random_uuid() so this runs on any Postgres version.

-- ---------------------------------------------------------------------------
-- Size Master
-- ---------------------------------------------------------------------------
CREATE TABLE "sizes" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sizes_organizationId_name_key" ON "sizes"("organizationId", "name");

ALTER TABLE "sizes" ADD CONSTRAINT "sizes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "sizes" ("id", "organizationId", "name", "detail", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id"::text || d.name)::uuid, o."id", d.name, d.detail, d.sort, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN (VALUES
    ('S', '38/28', 1), ('M', '40/30', 2), ('L', '42/32', 3), ('XL', '44/34', 4),
    ('2XL', '46/36', 5), ('3XL', '48/38', 6), ('4XL', '50/40', 7), ('5XL', '52/42', 8)
) AS d(name, detail, sort);

-- Sizes typed on existing lots that aren't one of the defaults (matched case-insensitively).
INSERT INTO "sizes" ("id", "organizationId", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || x."organizationId"::text || x.name)::uuid, x."organizationId", x.name, 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (c."organizationId", upper(trim(l."size"))) c."organizationId", upper(trim(l."size")) AS name
    FROM "cutting_entry_lines" l
    JOIN "cutting_entries" c ON c."id" = l."cuttingEntryId"
    WHERE trim(l."size") <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "sizes" s WHERE s."organizationId" = c."organizationId" AND upper(s."name") = upper(trim(l."size"))
      )
    ORDER BY c."organizationId", upper(trim(l."size"))
) x;

-- ---------------------------------------------------------------------------
-- Colour rows and per-size quantities
-- ---------------------------------------------------------------------------
CREATE TABLE "cutting_entry_rows" (
    "id" UUID NOT NULL,
    "cuttingEntryId" UUID NOT NULL,
    "colorId" UUID NOT NULL,
    "photoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cutting_entry_rows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cutting_row_quantities" (
    "id" UUID NOT NULL,
    "rowId" UUID NOT NULL,
    "sizeId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "cutting_row_quantities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cutting_row_quantities_rowId_sizeId_key" ON "cutting_row_quantities"("rowId", "sizeId");

ALTER TABLE "cutting_entry_rows" ADD CONSTRAINT "cutting_entry_rows_cuttingEntryId_fkey" FOREIGN KEY ("cuttingEntryId") REFERENCES "cutting_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cutting_entry_rows" ADD CONSTRAINT "cutting_entry_rows_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cutting_row_quantities" ADD CONSTRAINT "cutting_row_quantities_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "cutting_entry_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cutting_row_quantities" ADD CONSTRAINT "cutting_row_quantities_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One row per existing lot, in its old single colour.
INSERT INTO "cutting_entry_rows" ("id", "cuttingEntryId", "colorId", "sortOrder", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || c."id"::text)::uuid, c."id", c."colorId", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "cutting_entries" c;

-- Old lines -> quantities on that row (lines sharing a size are summed).
INSERT INTO "cutting_row_quantities" ("id", "rowId", "sizeId", "quantity")
SELECT md5(random()::text || clock_timestamp()::text || q."rowId"::text || q."sizeId"::text)::uuid, q."rowId", q."sizeId", q.qty
FROM (
    SELECT r."id" AS "rowId", s."id" AS "sizeId", SUM(l."quantity")::int AS qty
    FROM "cutting_entry_lines" l
    JOIN "cutting_entries" c ON c."id" = l."cuttingEntryId"
    JOIN "cutting_entry_rows" r ON r."cuttingEntryId" = c."id"
    JOIN "sizes" s ON s."organizationId" = c."organizationId" AND upper(s."name") = upper(trim(l."size"))
    GROUP BY r."id", s."id"
) q
WHERE q.qty > 0;

UPDATE "cutting_entry_rows" r
SET "totalQuantity" = COALESCE((SELECT SUM(q."quantity") FROM "cutting_row_quantities" q WHERE q."rowId" = r."id"), 0);

-- ---------------------------------------------------------------------------
-- Cutting entries: time, total quantity, legacy amount, colour moved to rows
-- ---------------------------------------------------------------------------
ALTER TABLE "cutting_entries" ADD COLUMN "entryTime" TEXT;
ALTER TABLE "cutting_entries" ADD COLUMN "totalQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cutting_entries" ALTER COLUMN "totalAmount" DROP NOT NULL;

UPDATE "cutting_entries" c
SET "totalQuantity" = COALESCE((SELECT SUM(r."totalQuantity") FROM "cutting_entry_rows" r WHERE r."cuttingEntryId" = c."id"), 0);

ALTER TABLE "cutting_entries" DROP CONSTRAINT "cutting_entries_colorId_fkey";
ALTER TABLE "cutting_entries" DROP COLUMN "colorId";

DROP TABLE "cutting_entry_lines";

-- Avg is entered with up to 3 decimals (e.g. 1.530 kg); widening keeps every existing value.
ALTER TABLE "cutting_entries" ALTER COLUMN "averageValue" TYPE DECIMAL(10,3);
