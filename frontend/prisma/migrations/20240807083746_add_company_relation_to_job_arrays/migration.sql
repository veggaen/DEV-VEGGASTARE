/*
  Warnings:

  - You are about to drop the column `description` on the `JobRequest` table. All the data in the column will be lost.
  - The `images` column on the `JobRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `links` column on the `JobRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `docs` column on the `JobRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "JobRequest" DROP COLUMN "description",
ADD COLUMN     "descriptions" TEXT[],
DROP COLUMN "images",
ADD COLUMN     "images" TEXT[],
DROP COLUMN "links",
ADD COLUMN     "links" TEXT[],
DROP COLUMN "docs",
ADD COLUMN     "docs" TEXT[];
