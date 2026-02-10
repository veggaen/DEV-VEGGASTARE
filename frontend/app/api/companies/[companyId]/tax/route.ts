import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { calculateTax, type TaxCalculationInput } from '@/lib/tax';

/**
 * GET /api/companies/[companyId]/tax
 * Returns tax dashboard data: profile, current period calc, expense summary, salary summary
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await params;

  // Verify access — must be an employee with tax view permission
  const employee = await dbPrisma.employee.findUnique({
    where: { userId_companyId: { userId: session.id, companyId } },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 });
  }

  const perms = (employee.permissions as Record<string, boolean>) ?? {};
  const isOwnerOrManager = employee.role === 'OWNER' || employee.role === 'MANAGER';
  if (!isOwnerOrManager && !perms.CAN_VIEW_TAX_REPORTS) {
    return NextResponse.json({ error: 'No permission to view tax data' }, { status: 403 });
  }

  const company = await dbPrisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      orgType: true,
      orgNumber: true,
      taxHelperEnabled: true,
      vatRegistered: true,
      vatNumber: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  if (company.taxHelperEnabled !== 'ENABLED') {
    return NextResponse.json({
      company,
      enabled: false,
      message: 'Tax helper is not enabled for this company. Enable it in company settings.',
    });
  }

  // Get current year data
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);

  // Aggregate financial data
  const [salesAgg, expenseAgg, salaryAgg, recentExpenses, recentReports, employeeCount] = await Promise.all([
    // Total sales this year
    dbPrisma.sale.aggregate({
      where: { companyId, date: { gte: yearStart, lte: yearEnd } },
      _sum: { totalAmount: true, profit: true },
      _count: true,
    }),

    // Total expenses this year
    dbPrisma.expense.aggregate({
      where: { companyId, date: { gte: yearStart, lte: yearEnd } },
      _sum: { amount: true },
      _count: true,
    }),

    // Total salaries this year
    dbPrisma.salaryPayment.aggregate({
      where: {
        Employee: { companyId },
        paidAt: { gte: yearStart, lte: yearEnd },
      },
      _sum: { grossAmount: true, netAmount: true },
      _count: true,
    }),

    // Recent expenses (last 10)
    dbPrisma.expense.findMany({
      where: { companyId },
      orderBy: { date: 'desc' },
      take: 10,
    }),

    // Recent tax reports
    dbPrisma.taxReport.findMany({
      where: { companyId },
      orderBy: { generatedAt: 'desc' },
      take: 5,
    }),

    // Employee count
    dbPrisma.employee.count({ where: { companyId } }),
  ]);

  // Calculate current tax estimate
  const orgType = (company.orgType ?? 'OTHER') as TaxCalculationInput['orgType'];
  const taxInput: TaxCalculationInput = {
    orgType,
    period: `${year}`,
    grossIncome: salesAgg._sum.totalAmount ?? 0,
    totalExpenses: expenseAgg._sum.amount ?? 0,
    totalSalariesPaid: salaryAgg._sum.grossAmount ?? 0,
    employeeCount,
  };

  const taxBreakdown = calculateTax(taxInput);

  // Expense breakdown by category
  const expensesByCategory = await dbPrisma.expense.groupBy({
    by: ['category'],
    where: { companyId, date: { gte: yearStart, lte: yearEnd } },
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: 'desc' } },
  });

  // Monthly revenue trend
  const monthlySales = await dbPrisma.sale.findMany({
    where: { companyId, date: { gte: yearStart, lte: yearEnd } },
    select: { date: true, totalAmount: true, profit: true },
    orderBy: { date: 'asc' },
  });

  // Group sales by month
  const monthlyTrend: { month: string; revenue: number; profit: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStr = `${year}-${String(m + 1).padStart(2, '0')}`;
    const monthSales = monthlySales.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === m;
    });
    monthlyTrend.push({
      month: monthStr,
      revenue: monthSales.reduce((sum, s) => sum + s.totalAmount, 0),
      profit: monthSales.reduce((sum, s) => sum + s.profit, 0),
    });
  }

  return NextResponse.json({
    company,
    enabled: true,
    year,
    summary: {
      grossIncome: salesAgg._sum.totalAmount ?? 0,
      totalProfit: salesAgg._sum.profit ?? 0,
      totalExpenses: expenseAgg._sum.amount ?? 0,
      totalSalariesGross: salaryAgg._sum.grossAmount ?? 0,
      totalSalariesNet: salaryAgg._sum.netAmount ?? 0,
      saleCount: salesAgg._count,
      expenseCount: expenseAgg._count,
      salaryPaymentCount: salaryAgg._count,
      employeeCount,
    },
    taxBreakdown,
    expensesByCategory: expensesByCategory.map(e => ({
      category: e.category,
      total: e._sum.amount ?? 0,
      count: e._count,
    })),
    monthlyTrend,
    recentExpenses,
    recentReports: recentReports.map(r => ({
      ...r,
      generatedAt: r.generatedAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}
