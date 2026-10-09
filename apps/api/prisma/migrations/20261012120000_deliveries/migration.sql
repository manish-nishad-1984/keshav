-- Delivery: finished pieces of a lot sent to its party, per colour and size, with a challan number.

CREATE TABLE "deliveries" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "challanNumber" INTEGER NOT NULL,
    "cuttingEntryId" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "entryTime" TEXT,
    "remarks" TEXT,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_quantities" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "colorId" UUID NOT NULL,
    "sizeId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "delivery_quantities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deliveries_organizationId_challanNumber_key" ON "deliveries"("organizationId", "challanNumber");
CREATE INDEX "deliveries_cuttingEntryId_idx" ON "deliveries"("cuttingEntryId");
CREATE UNIQUE INDEX "delivery_quantities_deliveryId_colorId_sizeId_key" ON "delivery_quantities"("deliveryId", "colorId", "sizeId");

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_cuttingEntryId_fkey" FOREIGN KEY ("cuttingEntryId") REFERENCES "cutting_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_quantities" ADD CONSTRAINT "delivery_quantities_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_quantities" ADD CONSTRAINT "delivery_quantities_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_quantities" ADD CONSTRAINT "delivery_quantities_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Permissions (production has no seed run, so add them here)
-- ---------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "key", "module", "action")
SELECT md5(random()::text || clock_timestamp()::text || k)::uuid, k, split_part(k, ':', 1), split_part(k, ':', 2)
FROM unnest(ARRAY['deliveries:view', 'deliveries:create', 'deliveries:update', 'deliveries:delete']) AS k
ON CONFLICT ("key") DO NOTHING;

-- Full access for the admin system roles.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'deliveries'
WHERE r."slug" IN ('super_admin', 'admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Viewer can see deliveries.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."key" = 'deliveries:view'
WHERE r."slug" = 'viewer'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
