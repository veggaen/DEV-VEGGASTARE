-- CreateEnum (FiatCurrency — needed by Expense and Purchase tables)
DO $$ BEGIN
  CREATE TYPE "FiatCurrency" AS ENUM ('USD', 'NOK', 'EUR', 'GBP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
CREATE TYPE "TaxHelperStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('OFFICE', 'TRAVEL', 'UNION_DUES', 'EQUIPMENT', 'SOFTWARE', 'MARKETING', 'INSURANCE', 'PROFESSIONAL_SERVICES', 'RENT', 'UTILITIES', 'VEHICLE', 'MEALS', 'DEBT_INTEREST', 'DEPRECIATION', 'SALARY_COST', 'EMPLOYER_NI', 'OTHER');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'VIPPS';
ALTER TYPE "PaymentMethod" ADD VALUE 'KLARNA';

-- AlterTable Company
ALTER TABLE "Company" ADD COLUMN "taxHelperEnabled" "TaxHelperStatus" NOT NULL DEFAULT 'DISABLED',
ADD COLUMN "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "vatNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_vatNumber_key" ON "Company"("vatNumber");

-- CreateTable TaxReport
CREATE TABLE "TaxReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "comments" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxReport_companyId_period_type_key" ON "TaxReport"("companyId", "period", "type");
CREATE INDEX "TaxReport_companyId_generatedAt_idx" ON "TaxReport"("companyId", "generatedAt");

ALTER TABLE "TaxReport" ADD CONSTRAINT "TaxReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable Expense
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" "FiatCurrency" NOT NULL DEFAULT 'NOK',
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "receiptUrl" TEXT,
    "approvedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_companyId_date_idx" ON "Expense"("companyId", "date");
CREATE INDEX "Expense_companyId_category_idx" ON "Expense"("companyId", "category");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable Purchase
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" "FiatCurrency" NOT NULL DEFAULT 'NOK',
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "vatAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Purchase_companyId_date_idx" ON "Purchase"("companyId", "date");

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable SalaryPayment
CREATE TABLE "SalaryPayment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "deductions" JSONB NOT NULL,
    "period" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalaryPayment_employeeId_paidAt_idx" ON "SalaryPayment"("employeeId", "paidAt");

ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable WorkHourLog
CREATE TABLE "WorkHourLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkHourLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkHourLog_employeeId_date_idx" ON "WorkHourLog"("employeeId", "date");

ALTER TABLE "WorkHourLog" ADD CONSTRAINT "WorkHourLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;