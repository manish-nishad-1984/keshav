-- Sample work: karigar, work type, design, qty, rate, total. Counts in the karigar ledger.
CREATE TABLE IF NOT EXISTS "sample_entries" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "karigarId" UUID NOT NULL,
    "workTypeId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "entryTime" TEXT,
    "quantity" INTEGER NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "remarks" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    CONSTRAINT "sample_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sample_entries_organizationId_date_idx" ON "sample_entries"("organizationId", "date");
CREATE INDEX IF NOT EXISTS "sample_entries_karigarId_idx" ON "sample_entries"("karigarId");

DO $$ BEGIN
    ALTER TABLE "sample_entries" ADD CONSTRAINT "sample_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sample_entries" ADD CONSTRAINT "sample_entries_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "karigars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sample_entries" ADD CONSTRAINT "sample_entries_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "sample_entries" ADD CONSTRAINT "sample_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Permissions (production has no seed run, so add them here)
INSERT INTO "permissions" ("id", "key", "module", "action")
SELECT md5(random()::text || clock_timestamp()::text || k)::uuid, k, split_part(k, ':', 1), split_part(k, ':', 2)
FROM unnest(ARRAY['sample_entries:view', 'sample_entries:create', 'sample_entries:update', 'sample_entries:delete']) AS k
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'sample_entries'
WHERE r."slug" IN ('super_admin', 'admin')
   OR (r."slug" = 'viewer' AND p."action" = 'view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Every other role gets the same actions it already has on daily production entries.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "role_permissions" rp ON rp."roleId" = r."id"
JOIN "permissions" ep ON ep."id" = rp."permissionId" AND ep."module" = 'production_entries' AND ep."action" IN ('view', 'create', 'update', 'delete')
JOIN "permissions" p ON p."key" = 'sample_entries:' || ep."action"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
