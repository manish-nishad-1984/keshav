-- Press Entry: pieces ironed by press karigars, at the online / offline rate from Settings.

-- CreateTable
CREATE TABLE "press_entries" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "karigarId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "entryTime" TEXT,
    "isOnline" BOOLEAN NOT NULL,
    "pieces" INTEGER NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "remarks" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "press_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "press_entries_organizationId_date_idx" ON "press_entries"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "press_entries" ADD CONSTRAINT "press_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_entries" ADD CONSTRAINT "press_entries_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "karigars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A "Press" work type for every organization, so press karigars can be added in Karigar Master.
INSERT INTO "work_types" ("id", "organizationId", "name", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id"::text)::uuid, o."id", 'Press', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
WHERE NOT EXISTS (SELECT 1 FROM "work_types" w WHERE w."organizationId" = o."id" AND lower(w."name") = 'press');

-- Default press rates (Settings → General): online ₹2, offline ₹3 per piece.
INSERT INTO "company_settings" ("id", "organizationId", "scope", "key", "value", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id"::text)::uuid, o."id", 'press', 'rates',
       '{"onlineRate": 2, "offlineRate": 3}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
ON CONFLICT ("organizationId", "scope", "key") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Permissions (production has no seed run, so add them here)
-- ---------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "key", "module", "action")
SELECT md5(random()::text || clock_timestamp()::text || k)::uuid, k, split_part(k, ':', 1), split_part(k, ':', 2)
FROM unnest(ARRAY['press_entries:view', 'press_entries:create', 'press_entries:update', 'press_entries:delete']) AS k
ON CONFLICT ("key") DO NOTHING;

-- Full access for the admin system roles, view for the viewer role.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'press_entries'
WHERE r."slug" IN ('super_admin', 'admin')
   OR (r."slug" = 'viewer' AND p."action" = 'view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Every other role gets the same press actions it already has on daily production entries.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "role_permissions" rp ON rp."roleId" = r."id"
JOIN "permissions" ep ON ep."id" = rp."permissionId" AND ep."module" = 'production_entries' AND ep."action" IN ('view', 'create', 'update', 'delete')
JOIN "permissions" p ON p."key" = 'press_entries:' || ep."action"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
