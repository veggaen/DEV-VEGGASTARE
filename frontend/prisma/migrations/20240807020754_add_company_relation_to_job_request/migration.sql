-- AlterTable
ALTER TABLE "JobRequest" ADD COLUMN     "companyIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
