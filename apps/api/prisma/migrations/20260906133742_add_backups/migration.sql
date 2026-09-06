-- CreateEnum
CREATE TYPE "BackupTrigger" AS ENUM ('MANUAL', 'AUTO');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "autoBackupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoBackupTime" TEXT;

-- CreateTable
CREATE TABLE "backups" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "triggeredBy" "BackupTrigger" NOT NULL,
    "payload" JSONB NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
