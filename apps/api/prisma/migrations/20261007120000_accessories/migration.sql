-- Accessories: master, per-piece needs per design, and issue/return to karigars against a lot.

-- CreateEnum
CREATE TYPE "AccessoryTransactionType" AS ENUM ('ISSUE', 'RETURN');

-- CreateTable
CREATE TABLE "accessories" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_accessories" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "accessoryId" UUID NOT NULL,
    "quantityPerPiece" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "item_accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessory_transactions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "AccessoryTransactionType" NOT NULL,
    "karigarId" UUID NOT NULL,
    "cuttingEntryId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "entryTime" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "accessory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessory_transaction_lines" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "accessoryId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "accessory_transaction_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accessories_organizationId_name_key" ON "accessories"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "item_accessories_itemId_accessoryId_key" ON "item_accessories"("itemId", "accessoryId");

-- CreateIndex
CREATE INDEX "accessory_transactions_karigarId_cuttingEntryId_idx" ON "accessory_transactions"("karigarId", "cuttingEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "accessory_transaction_lines_transactionId_accessoryId_key" ON "accessory_transaction_lines"("transactionId", "accessoryId");

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_accessories" ADD CONSTRAINT "item_accessories_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_accessories" ADD CONSTRAINT "item_accessories_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_transactions" ADD CONSTRAINT "accessory_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_transactions" ADD CONSTRAINT "accessory_transactions_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "karigars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_transactions" ADD CONSTRAINT "accessory_transactions_cuttingEntryId_fkey" FOREIGN KEY ("cuttingEntryId") REFERENCES "cutting_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_transaction_lines" ADD CONSTRAINT "accessory_transaction_lines_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "accessory_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_transaction_lines" ADD CONSTRAINT "accessory_transaction_lines_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Permissions (production has no seed run, so add them here)
-- ---------------------------------------------------------------------------
INSERT INTO "permissions" ("id", "key", "module", "action")
SELECT md5(random()::text || clock_timestamp()::text || k)::uuid, k, split_part(k, ':', 1), split_part(k, ':', 2)
FROM unnest(ARRAY[
    'accessories:view', 'accessories:create', 'accessories:update', 'accessories:delete', 'accessories:manage',
    'accessory_issues:view', 'accessory_issues:create', 'accessory_issues:update', 'accessory_issues:delete'
]) AS k
ON CONFLICT ("key") DO NOTHING;

-- Full access for the admin system roles, view for the viewer role.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" IN ('accessories', 'accessory_issues')
WHERE r."slug" IN ('super_admin', 'admin')
   OR (r."slug" = 'viewer' AND p."action" = 'view')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Accessory Operator: a separate login that issues and takes back accessories. Editable in Roles.
INSERT INTO "roles" ("id", "organizationId", "name", "slug", "description", "isSystem", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || o."id"::text)::uuid, o."id", 'Accessory Operator', 'accessory_operator',
       'Issues accessories to karigars and takes back the extra.', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
ON CONFLICT ("organizationId", "slug") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || r."id"::text || p."id"::text)::uuid, r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."key" IN (
    'dashboard:view', 'books:view', 'karigars:view', 'accessories:view',
    'accessory_issues:view', 'accessory_issues:create', 'accessory_issues:update'
)
WHERE r."slug" = 'accessory_operator'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
