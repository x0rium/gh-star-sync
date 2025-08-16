/*
  Warnings:

  - Added the required column `repoCreatedAt` to the `Repository` table without a default value. This is not possible if the table is not empty.
  - Added the required column `repoPushedAt` to the `Repository` table without a default value. This is not possible if the table is not empty.
  - Added the required column `repoStarredAt` to the `Repository` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Repository" ADD COLUMN     "repoCreatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "repoPushedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "repoStarredAt" TIMESTAMP(3) NOT NULL;
