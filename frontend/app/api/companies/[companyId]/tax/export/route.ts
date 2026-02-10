import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';

/**
 * GET /api/companies/[companyId]/tax/export?format=csv|json
 * Exports tax data as CSV or JSON for Norwegian tax compliance.
 * Includes sales, expenses, salaries, crypto payments, and tax calculation.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'csv';
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  // Verify access
  const employee = await dbPrisma.employee.findUnique({
    where: { userId_companyId: { userId: session.id, companyId } },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 });
  }

  const perms = (employee.permissions as Record<string, boolean>) ?? {};
  const isOwnerOrManager = employee.role === 'OWNER' || employee.role === 'MANAGER';
  if (!isOwnerOrManager && !perms.CAN_VIEW_TAX_REPORTS) {
    return NextResponse.json({ error: 'No permission to export tax data' }, { status: 403 });
  }

  const company = await dbPrisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, orgType: true, orgNumber: true, vatRegistered: true },
  });

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);

  // Fetch all data in parallel
  const [sales, expenses, salaries, cryptoPayments] = await Promise.all([
    // Sales
    dbPrisma.sale.findMany({
      where: { companyId, date: { gte: yearStart, lte: yearEnd } },
      orderBy: { date: 'asc' },
    }),

    // Expenses
    dbPrisma.expense.findMany({
      where: { companyId, date: { gte: yearStart, lte: yearEnd } },
      orderBy: { date: 'asc' },
    }),

    // Salaries
    dbPrisma.salaryPayment.findMany({
      where: {
        Employee: { companyId },
        paidAt: { gte: yearStart, lte: yearEnd },
      },
      include: { Employee: { select: { User: { select: { name: true } } } } },
      orderBy: { paidAt: 'asc' },
    }),

    // Crypto payments received (orders with crypto payment data)
    dbPrisma.payment.findMany({
      where: {
        chainFamily: { not: null },
        createdAt: { gte: yearStart, lte: yearEnd },
        Order: {
          OrderItem: {
            some: {
              Product: { companyId },
            },
          },
        },
      },
      include: {
        Order: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            createdAt: true,
            OrderItem: {
              select: { title: true, quantity: true, priceAtTime: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (format === 'json') {
    return NextResponse.json({
      company: { name: company.name, orgNumber: company.orgNumber, orgType: company.orgType },
      year,
      exportedAt: new Date().toISOString(),
      sales: sales.map((s) => ({
        date: s.date.toISOString().split('T')[0],
        amount: s.totalAmount,
        profit: s.profit,
      })),
      expenses: expenses.map((e) => ({
        date: e.date.toISOString().split('T')[0],
        amount: e.amount,
        category: e.category,
        description: e.description ?? '',
      })),
      salaries: salaries.map((s) => ({
        date: s.paidAt.toISOString().split('T')[0],
        employeeName: s.Employee?.User?.name ?? 'Unknown',
        grossAmount: s.grossAmount,
        netAmount: s.netAmount,
      })),
      cryptoPayments: cryptoPayments.map((p) => ({
        date: p.createdAt.toISOString().split('T')[0],
        orderId: p.Order?.id ?? '',
        txHash: p.transactionId ?? '',
        chainFamily: p.chainFamily ?? '',
        chainId: p.chainId ?? '',
        tokenSymbol: p.tokenSymbol ?? '',
        nativeAmount: p.nativeAmount ?? '',
        usdAmount: p.Order?.totalAmount ?? 0,
        nokRateAtTime: p.nokRateAtTime ?? null,
        usdRateAtTime: p.usdRateAtTime ?? null,
        nokEquivalent: p.nokRateAtTime && p.nativeAmount
          ? (parseFloat(p.nativeAmount) * p.nokRateAtTime).toFixed(2)
          : null,
        senderAddress: p.senderAddress ?? '',
        receiverAddress: p.receiverAddress ?? '',
        items: p.Order?.OrderItem?.map((i) => `${i.title} x${i.quantity}@${i.priceAtTime}`).join('; ') ?? '',
      })),
    });
  }

  // CSV format
  const lines: string[] = [];

  // Header row
  lines.push(`# Tax Export for ${company.name} (${company.orgNumber ?? 'N/A'}) — Year ${year}`);
  lines.push(`# Org Type: ${company.orgType ?? 'N/A'} | VAT Registered: ${company.vatRegistered ? 'Yes' : 'No'}`);
  lines.push(`# Exported: ${new Date().toISOString()}`);
  lines.push('');

  // Sales section
  lines.push('## SALES');
  lines.push('Date,Amount (USD),Profit (USD)');
  for (const s of sales) {
    lines.push(`${s.date.toISOString().split('T')[0]},${s.totalAmount},${s.profit}`);
  }
  lines.push('');

  // Expenses section
  lines.push('## EXPENSES');
  lines.push('Date,Amount (USD),Category,Description');
  for (const e of expenses) {
    lines.push(`${e.date.toISOString().split('T')[0]},${e.amount},${e.category},"${(e.description ?? '').replace(/"/g, '""')}"`);
  }
  lines.push('');

  // Salaries section
  lines.push('## SALARIES');
  lines.push('Date,Employee,Gross Amount,Net Amount');
  for (const s of salaries) {
    lines.push(`${s.paidAt.toISOString().split('T')[0]},"${s.Employee?.User?.name ?? 'Unknown'}",${s.grossAmount},${s.netAmount}`);
  }
  lines.push('');

  // Crypto payments section (critical for Norwegian tax compliance)
  lines.push('## CRYPTO PAYMENTS RECEIVED');
  lines.push('Date,Order ID,TX Hash,Chain,Token,Native Amount,USD Amount,NOK Rate,NOK Equivalent,Sender,Receiver,Items');
  for (const p of cryptoPayments) {
    const nokEquiv = p.nokRateAtTime && p.nativeAmount
      ? (parseFloat(p.nativeAmount) * p.nokRateAtTime).toFixed(2)
      : '';
    const itemsStr = p.Order?.OrderItem?.map((i) => `${i.title} x${i.quantity}`).join('; ') ?? '';
    lines.push([
      p.createdAt.toISOString().split('T')[0],
      p.Order?.id ?? '',
      p.transactionId ?? '',
      `${p.chainFamily ?? ''}${p.chainId ? `(${p.chainId})` : ''}`,
      p.tokenSymbol ?? '',
      p.nativeAmount ?? '',
      p.Order?.totalAmount ?? '',
      p.nokRateAtTime ?? '',
      nokEquiv,
      p.senderAddress ?? '',
      p.receiverAddress ?? '',
      `"${itemsStr.replace(/"/g, '""')}"`,
    ].join(','));
  }

  // Summary
  lines.push('');
  lines.push('## SUMMARY');
  const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSalaries = salaries.reduce((sum, s) => sum + s.grossAmount, 0);
  const totalCryptoNOK = cryptoPayments.reduce((sum, p) => {
    if (p.nokRateAtTime && p.nativeAmount) {
      return sum + parseFloat(p.nativeAmount) * p.nokRateAtTime;
    }
    return sum;
  }, 0);
  lines.push(`Total Sales (USD),${totalSales.toFixed(2)}`);
  lines.push(`Total Expenses (USD),${totalExpenses.toFixed(2)}`);
  lines.push(`Total Salaries (Gross USD),${totalSalaries.toFixed(2)}`);
  lines.push(`Total Crypto Received (NOK equivalent),${totalCryptoNOK.toFixed(2)}`);
  lines.push(`Net Income (USD),${(totalSales - totalExpenses - totalSalaries).toFixed(2)}`);

  const csv = lines.join('\n');
  const filename = `tax-export-${company.orgNumber ?? company.name}-${year}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
