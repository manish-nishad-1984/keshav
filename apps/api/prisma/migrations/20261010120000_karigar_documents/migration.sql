-- Karigar ID proofs: Aadhaar front/back, PAN and any other proof.

-- CreateEnum
CREATE TYPE "KarigarDocumentType" AS ENUM ('AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN', 'OTHER');

-- CreateTable
CREATE TABLE "karigar_documents" (
    "id" UUID NOT NULL,
    "karigarId" UUID NOT NULL,
    "type" "KarigarDocumentType" NOT NULL,
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "karigar_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "karigar_documents_karigarId_idx" ON "karigar_documents"("karigarId");

-- AddForeignKey
ALTER TABLE "karigar_documents" ADD CONSTRAINT "karigar_documents_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "karigars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

