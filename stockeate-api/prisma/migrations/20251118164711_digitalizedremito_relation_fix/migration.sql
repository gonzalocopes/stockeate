-- DropForeignKey
ALTER TABLE "public"."DigitalizedRemito" DROP CONSTRAINT "DigitalizedRemito_userId_fkey";

-- AlterTable
ALTER TABLE "public"."DigitalizedRemito" ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."DigitalizedRemito" ADD CONSTRAINT "DigitalizedRemito_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
