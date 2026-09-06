-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('STITCHING', 'CUTTING', 'FINISHING', 'PACKING');

-- CreateTable
CREATE TABLE "karigars" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "photoUrl" TEXT,
    "workType" "WorkType" NOT NULL,
    "joinDate" TIMESTAMP(3),
    "address" TEXT,
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "karigars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "karigars_organizationId_code_key" ON "karigars"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "karigars" ADD CONSTRAINT "karigars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
