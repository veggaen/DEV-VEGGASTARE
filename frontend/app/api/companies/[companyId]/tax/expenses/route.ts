import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonOrError } from '@/lib/api-validate';

const CreateExpenseSchema = z.object({
  category: z.enum([
    'OFFICE', 'TRAVEL', 'UNION_DUES', 'EQUIPMENT', 'SOFTWARE', 'MARKETING',
    'INSURANCE', 'PROFESSIONAL_SERVICES', 'RENT', 'UTILITIES', 'VEHICLE',
    'MEALS', 'DEBT_INTEREST', 'DEPRECIATION', 'SALARY_COST', 'EMPLOYER_NI', 'OTHER',
  ]),
  amount: z.coerce.number().positive(),
  currency: z.enum(['USD', 'NOK', 'EUR', 'GBP']).default('NOK'),
  date: z.coerce.date(),
  description: z.string().trim().max(500).optional(),
  receiptUrl: z.string().url().optional(),
});

/**
 * GET /api/companies/[companyId]/tax/expenses
 * List expenses with optional filters
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

  const employee = await dbPrisma.employee.findUnique({
    where: { userId_companyId: { userId: session.id, companyId } },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  const perms = (employee.permissions as Record<string, boolean>) ?? {};
  const isOwnerOrManager = employee.role === 'OWNER' || employee.role === 'MANAGER';
  if (!isOwnerOrManager && !perms.CAN_VIEW_TAX_REPORTS && !perms.CAN_MANAGE_EXPENSES) {
    return NextResponse.json({ error: 'No permission' }, { status: 403 });
  }

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get('year') ?? `${new Date().getFullYear()}`);
  const category = url.searchParams.get('category') ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') ?? '0');

  const where: Record<string, unknown> = {
    companyId,
    date: {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31T23:59:59`),
    },
  };
  if (category) where.category = category;

  const [expenses, total] = await Promise.all([
    dbPrisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    }),
    dbPrisma.expense.count({ where }),
  ]);

  return NextResponse.json({
    expenses: expenses.map(e => ({
      ...e,
      date: e.date.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    total,
    limit,
    offset,
  });
}

/**
 * POST /api/companies/[companyId]/tax/expenses
 * Create a new expense
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
  if (!isOwnerOrManager && !perms.CAN_MANAGE_EXPENSES && !perms.CAN_EDIT_TAX_DATA) {
    return NextResponse.json({ error: 'No permission to manage expenses' }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(req, CreateExpenseSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const data = bodyResult.data;

  const expense = await dbPrisma.expense.create({
    data: {
      companyId,
      category: data.category,
      amount: data.amount,
      currency: data.currency,
      date: data.date,
      description: data.description ?? null,
      receiptUrl: data.receiptUrl ?? null,
      createdBy: session.id,
    },
  });

  return NextResponse.json({
    ...expense,
    date: expense.date.toISOString(),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  }, { status: 201 });
}
