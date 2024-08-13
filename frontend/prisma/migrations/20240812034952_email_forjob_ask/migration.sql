/*
  Warnings:

  - Added the required column `email` to the `JobRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "JobRequest" ADD COLUMN     "email" TEXT NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;
