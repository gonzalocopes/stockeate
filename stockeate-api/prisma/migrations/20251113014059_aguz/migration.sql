/*
  Warnings:

  - A unique constraint covering the columns `[userId,branchId]` on the table `BranchUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[digitalizedOriginId]` on the table `Remito` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dni]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."DigitalizationStatus" AS ENUM ('PROCESSING', 'PENDING_VALIDATION', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "public"."RemitoItem" DROP CONSTRAINT "RemitoItem_remitoId_fkey";

-- AlterTable
ALTER TABLE "public"."Branch" ADD COLUMN     "address" TEXT,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "taxCondition" TEXT;

-- AlterTable
ALTER TABLE "public"."Remito" ADD COLUMN     "customerAddress" TEXT,
ADD COLUMN     "customerCuit" TEXT,
ADD COLUMN     "customerTaxCondition" TEXT,
ADD COLUMN     "digitalizedOriginId" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "dni" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- CreateTable
CREATE TABLE "public"."DigitalizedRemito" (
    "id" TEXT NOT NULL,
    "status" "public"."DigitalizationStatus" NOT NULL DEFAULT 'PROCESSING',
    "originalFileUrl" TEXT NOT NULL,
    "extractedData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "DigitalizedRemito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchUser_userId_branchId_key" ON "public"."BranchUser"("userId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Remito_digitalizedOriginId_key" ON "public"."Remito"("digitalizedOriginId");

-- CreateIndex
CREATE UNIQUE INDEX "User_dni_key" ON "public"."User"("dni");

-- AddForeignKey
ALTER TABLE "public"."Remito" ADD CONSTRAINT "Remito_digitalizedOriginId_fkey" FOREIGN KEY ("digitalizedOriginId") REFERENCES "public"."DigitalizedRemito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RemitoItem" ADD CONSTRAINT "RemitoItem_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "public"."Remito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DigitalizedRemito" ADD CONSTRAINT "DigitalizedRemito_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DigitalizedRemito" ADD CONSTRAINT "DigitalizedRemito_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
