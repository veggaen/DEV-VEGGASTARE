import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { calculateTax, type TaxCalculationInput } from '@/lib/tax';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { parseJsonOrError } from '@/lib/api-validate';

const CalcSchema = z.object({
  period: z.string().min(4).max(7).default(() => `${new Date().getFullYear()}`),
  ownerSalary: z.coerce.number().nonnegative().optional(),
  dividendsPaid: z.coerce.number().nonnegative().optional(),
  partnerShares: z.coerce.number().int().positive().optional(),
  memberAllocations: z.coerce.number().nonnegative().optional(),
  isFinancialSector: z.boolean().optional(),
  vatCollected: z.coerce.number().nonnegative().optional(),
  vatPaid: z.coerce.number().nonnegative().optional(),
  // Allow manual overrides for what-if scenarios
  overrideGrossIncome: z.coerce.number().nonnegative().optional(),
  overrideTotalExpenses: z.coerce.number().nonnegative().optional(),
  overrideTotalSalaries: z.coerce.number().nonnegative().optional(),
});

/**
 * POST /api/companies/[companyId]/tax/calculate
 * Run a tax calculation with optional what-if overrides
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await params;

  const employee = await dbPrisma.employee.findUnique({
    where: { userId_companyId: { userId: session.id, companyId } },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  const perms = (employee.permissions as Record<string, boolean>) ?? {};
  const isOwnerOrManager = employee.role === 'OWNER' || employee.role === 'MANAGER';
  if (!isOwnerOrManager && !perms.CAN_VIEW_TAX_REPORTS) {
    return NextResponse.json({ error: 'No permission' }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(req, CalcSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const body = bodyResult.data;

  const company = await dbPrisma.company.findUnique({
    where: { id: companyId },
    select: { orgType: true, taxHelperEnabled: true },
  });
  if (!company || company.taxHelperEnabled !== 'ENABLED') {
    return NextResponse.json({ error: 'Tax helper not enabled' }, { status: 400 });
  }

  // Get actual data from DB
  const period = body.period ?? `${new Date().getFullYear()}`;
  const year = period.length === 4 ? parseInt(period) : parseInt(period.slice(0, 4));
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);

  const [salesAgg, expenseAgg, salaryAgg, empCount] = await Promise.all([
    dbPrisma.sale.aggregate({
      where: { companyId, date: { gte: yearStart, lte: yearEnd } },
      _sum: { totalAmount: true },
    }),
    dbPrisma.expense.aggregate({
      where: { companyId, date: { gte: yearStart, lte: yearEnd } },
      _sum: { amount: true },
    }),
    dbPrisma.salaryPayment.aggregate({
      where: { Employee: { companyId }, paidAt: { gte: yearStart, lte: yearEnd } },
      _sum: { grossAmount: true },
    }),
    dbPrisma.employee.count({ where: { companyId } }),
  ]);

  const input: TaxCalculationInput = {
    orgType: (company.orgType ?? 'OTHER') as TaxCalculationInput['orgType'],
    period,
    grossIncome: body.overrideGrossIncome ?? (salesAgg._sum.totalAmount ?? 0),
    totalExpenses: body.overrideTotalExpenses ?? (expenseAgg._sum.amount ?? 0),
    totalSalariesPaid: body.overrideTotalSalaries ?? (salaryAgg._sum.grossAmount ?? 0),
    employeeCount: empCount,
    ownerSalary: body.ownerSalary,
    dividendsPaid: body.dividendsPaid,
    partnerShares: body.partnerShares,
    memberAllocations: body.memberAllocations,
    isFinancialSector: body.isFinancialSector,
    vatCollected: body.vatCollected,
    vatPaid: body.vatPaid,
  };

  const breakdown = calculateTax(input);

  // Optionally save as a report
  const report = await dbPrisma.taxReport.upsert({
    where: {
      companyId_period_type: {
        companyId,
        period,
        type: period.length === 4 ? 'annual' : 'monthly_preview',
      },
    },
    update: {
      data: breakdown as unknown as Prisma.InputJsonValue,
    },
    create: {
      companyId,
      period,
      type: period.length === 4 ? 'annual' : 'monthly_preview',
      data: breakdown as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    breakdown,
    reportId: report.id,
    savedAt: report.generatedAt.toISOString(),
  });
}
