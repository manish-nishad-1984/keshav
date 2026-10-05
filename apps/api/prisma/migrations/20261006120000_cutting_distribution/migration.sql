-- Cutting Distribution: pieces of a cut lot handed to a karigar, per colour and size.

CREATE TABLE "cutting_distributions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "cuttingEntryId" UUID NOT NULL,
    "karigarId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "entryTime" TEXT,
    "remarks" TEXT,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "cutting_distributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cutting_distribution_quantities" (
    "id" UUID NOT NULL,
    "distributionId" UUID NOT NULL,
    "colorId" UUID NOT NULL,
    "sizeId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "cutting_distribution_quantities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cutting_distributions_cuttingEntryId_idx" ON "cutting_distributions"("cuttingEntryId");
CREATE UNIQUE INDEX "cutting_distribution_quantities_distributionId_colorId_size_key" ON "cutting_distribution_quantities"("distributionId", "colorId", "sizeId");

ALTER TABLE "cutting_distributions" ADD CONSTRAINT "cutting_distributions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cutting_distributions" ADD CONSTRAINT "cutting_distributions_cuttingEntryId_fkey" FOREIGN KEY ("cuttingEntryId") REFERENCES "cutting_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cutting_distributions" ADD CONSTRAINT "cutting_distributions_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "karigars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cutting_distribution_quantities" ADD CONSTRAINT "cutting_distribution_quantities_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "cutting_distributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cutting_distribution_quantities" ADD CONSTRAINT "cutting_distribution_quantities_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cutting_distribution_quantities" ADD CONSTRAINT "cutting_distribution_quantities_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Permissions (production has no seed run, so add them here)
-- ---------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "key", "module", "action")
SELECT md5(random()::text || clock_timestamp()::text || k)::uuid, k, split_part(k, ':', 1), split_part(k, ':', 2)
FROM unnest(ARRAY[
    'cutting_distribution:view', 'cutting_distribution:create', 'cutting_distribution:update', 'cutting_distribution:delete'
]) AS k
ON CONFLICT ("key") DO NOTHING;

-- Full access for the admin system roles.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'cutting_distribution'
WHERE r."slug" IN ('super_admin', 'admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Every other role gets the same distribution actions it already has on cutting (view for viewer).
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "role_permissions" rp ON rp."roleId" = r."id"
JOIN "permissions" cp ON cp."id" = rp."permissionId" AND cp."module" = 'cutting' AND cp."action" IN ('view', 'create', 'update', 'delete')
JOIN "permissions" p ON p."key" = 'cutting_distribution:' || cp."action"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- The form's karigar dropdown reads the karigar list.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."key" = 'karigars:view'
WHERE EXISTS (
    SELECT 1 FROM "role_permissions" rp
    JOIN "permissions" dp ON dp."id" = rp."permissionId"
    WHERE rp."roleId" = r."id" AND dp."key" = 'cutting_distribution:create'
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
