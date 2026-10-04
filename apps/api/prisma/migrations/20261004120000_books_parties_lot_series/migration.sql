-- Book Master (lot-number series), Party Master, cutting lots per book, PCs on cutting entries,
-- and Style No. removed from items. Existing data is carried over:
--   * every organization gets one book named after the current financial year (e.g. 2026-27,
--     using its fiscalYearStartMonth); all existing cutting lots move into it, numbers unchanged
--   * each distinct party name on existing cutting entries becomes a Party row
-- IDs use md5()::uuid rather than gen_random_uuid() so this runs on any Postgres version.

-- ---------------------------------------------------------------------------
-- Books
-- ---------------------------------------------------------------------------
CREATE TABLE "books" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startNumber" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "books_organizationId_name_key" ON "books"("organizationId", "name");

ALTER TABLE "books" ADD CONSTRAINT "books_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "books" ("id", "organizationId", "name", "startNumber", "isActive", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || o."id"::text)::uuid,
    o."id",
    fy.y::text || '-' || lpad(((fy.y + 1) % 100)::text, 2, '0'),
    1,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN EXTRACT(MONTH FROM CURRENT_DATE)::int >= o."fiscalYearStartMonth" THEN EXTRACT(YEAR FROM CURRENT_DATE)::int
        ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int - 1
    END AS y
) fy;

-- ---------------------------------------------------------------------------
-- Parties
-- ---------------------------------------------------------------------------
CREATE TABLE "parties" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "referenceName" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parties_organizationId_name_key" ON "parties"("organizationId", "name");

ALTER TABLE "parties" ADD CONSTRAINT "parties_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "parties" ("id", "organizationId", "name", "isActive", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || d."organizationId"::text || d."name")::uuid,
    d."organizationId",
    d."name",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "organizationId", COALESCE(NULLIF(trim("partyName"), ''), 'Unknown') AS "name"
    FROM "cutting_entries"
) d;

-- ---------------------------------------------------------------------------
-- Cutting entries: book, party, pieces
-- ---------------------------------------------------------------------------
ALTER TABLE "cutting_entries" ADD COLUMN "bookId" UUID;
ALTER TABLE "cutting_entries" ADD COLUMN "partyId" UUID;
ALTER TABLE "cutting_entries" ADD COLUMN "pieces" INTEGER;

-- Exactly one book exists per organization at this point.
UPDATE "cutting_entries" c SET "bookId" = b."id" FROM "books" b WHERE b."organizationId" = c."organizationId";

UPDATE "cutting_entries" c SET "partyId" = p."id"
FROM "parties" p
WHERE p."organizationId" = c."organizationId"
  AND p."name" = COALESCE(NULLIF(trim(c."partyName"), ''), 'Unknown');

ALTER TABLE "cutting_entries" ALTER COLUMN "bookId" SET NOT NULL;
ALTER TABLE "cutting_entries" ALTER COLUMN "partyId" SET NOT NULL;
ALTER TABLE "cutting_entries" DROP COLUMN "partyName";

DROP INDEX "cutting_entries_organizationId_lotNumber_key";
CREATE UNIQUE INDEX "cutting_entries_bookId_lotNumber_key" ON "cutting_entries"("bookId", "lotNumber");

ALTER TABLE "cutting_entries" ADD CONSTRAINT "cutting_entries_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cutting_entries" ADD CONSTRAINT "cutting_entries_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Items: Style No. removed
-- ---------------------------------------------------------------------------
DROP INDEX "items_organizationId_styleNo_key";
ALTER TABLE "items" DROP COLUMN "styleNo";

-- ---------------------------------------------------------------------------
-- Permissions for the new modules (production has no seed run, so add them here)
-- ---------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "key", "module", "action")
SELECT md5(random()::text || clock_timestamp()::text || k)::uuid, k, split_part(k, ':', 1), split_part(k, ':', 2)
FROM unnest(ARRAY[
    'parties:view', 'parties:create', 'parties:update', 'parties:delete',
    'books:view', 'books:create', 'books:update', 'books:delete'
]) AS k
ON CONFLICT ("key") DO NOTHING;

-- Full access for the admin system roles.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" IN ('parties', 'books')
WHERE r."slug" IN ('super_admin', 'admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- View access for the viewer role and for any role that already works with cutting lots or
-- production entries (they need to see the book selector and party list).
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."key" IN ('parties:view', 'books:view')
WHERE r."slug" = 'viewer'
   OR EXISTS (
        SELECT 1 FROM "role_permissions" rp
        JOIN "permissions" ep ON ep."id" = rp."permissionId"
        WHERE rp."roleId" = r."id" AND ep."key" IN ('cutting:view', 'production_entries:view')
   )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
