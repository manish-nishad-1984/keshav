-- Karigar, party, design and work type names are saved in CAPITAL letters, single-spaced, and are unique.

UPDATE "karigars"   SET "fullName" = upper(regexp_replace(btrim("fullName"), '\s+', ' ', 'g'));
UPDATE "parties"    SET "name"     = upper(regexp_replace(btrim("name"),     '\s+', ' ', 'g'));
UPDATE "items"      SET "itemName" = upper(regexp_replace(btrim("itemName"), '\s+', ' ', 'g'));
UPDATE "work_types" SET "name"     = upper(regexp_replace(btrim("name"),     '\s+', ' ', 'g'));

-- Names that now clash (same name, different case before) get " (2)", " (3)" ... on the later ones.
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "organizationId", "fullName" ORDER BY "createdAt", "id") AS rn
  FROM "karigars" WHERE "deletedAt" IS NULL
)
UPDATE "karigars" k SET "fullName" = k."fullName" || ' (' || r.rn || ')' FROM ranked r WHERE k."id" = r."id" AND r.rn > 1;

WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "organizationId", "name" ORDER BY "createdAt", "id") AS rn FROM "parties"
)
UPDATE "parties" p SET "name" = p."name" || ' (' || r.rn || ')' FROM ranked r WHERE p."id" = r."id" AND r.rn > 1;

WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "organizationId", "itemName" ORDER BY "createdAt", "id") AS rn
  FROM "items" WHERE "deletedAt" IS NULL
)
UPDATE "items" i SET "itemName" = i."itemName" || ' (' || r.rn || ')' FROM ranked r WHERE i."id" = r."id" AND r.rn > 1;

-- Database guard behind the service checks (deleted rows are ignored).
CREATE UNIQUE INDEX IF NOT EXISTS "karigars_org_fullName_active_key" ON "karigars" ("organizationId", "fullName") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "items_org_itemName_active_key" ON "items" ("organizationId", "itemName") WHERE "deletedAt" IS NULL;
