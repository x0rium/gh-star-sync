-- DropIndex
DROP INDEX "public"."Repository_fullName_key";

-- AlterTable
ALTER TABLE "public"."Repository" ADD COLUMN     "readmeFetchedAt" TIMESTAMP(3);
