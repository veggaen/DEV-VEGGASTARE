/*
  Warnings:

  - Made the column `userId` on table `JobRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "JobRequest" ALTER COLUMN "userId" SET NOT NULL;
