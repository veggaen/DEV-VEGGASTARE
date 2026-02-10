import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonOrError } from '@/lib/api-validate';
import { calculateEmployeeCost } from '@/lib/tax';

const CreateSalarySchema = z.object({
  employeeId: z.string().min(1),
  grossAmount: z.coerce.number().positive(),
  netAmount: z.coerce.number().nonnegative(),
  deductions: z.object({
    incomeTax: z.coerce.number().nonnegative(),
    employeeNI: z.coerce.number().nonnegative(),
    employerNI: z.coerce.number().nonnegative(),
    pension: z.coerce.number().nonnegative().optional(),
    otherDeductions: z.coerce.number().nonnegative().optional(),
  }),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  paidAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * GET /api/companies/[companyId]/tax/salaries
 * List salary payments
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
  if (!isOwnerOrManager && !perms.CAN_MANAGE_SALARIES && !perms.CAN_VIEW_TAX_REPORTS) {
    return NextResponse.json({ error: 'No permission' }, { status: 403 });
  }

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get('year') ?? `${new Date().getFullYear()}`);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);

  const salaries = await dbPrisma.salaryPayment.findMany({
    where: {
      Employee: { companyId },
      paidAt: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31T23:59:59`),
      },
    },
    include: {
      Employee: {
        select: {
          id: true,
          role: true,
          jobTitle: true,
          User: { select: { name: true, image: true } },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    salaries: salaries.map(s => ({
      ...s,
      paidAt: s.paidAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}

/**
 * POST /api/companies/[companyId]/tax/salaries
 * Record a salary payment
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
  if (!isOwnerOrManager && !perms.CAN_MANAGE_SALARIES) {
    return NextResponse.json({ error: 'No permission to manage salaries' }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(req, CreateSalarySchema);
  if (!bodyResult.ok) return bodyResult.response;

  const data = bodyResult.data;

  // Verify employee belongs to this company
  const targetEmployee = await dbPrisma.employee.findUnique({
    where: { id: data.employeeId },
  });
  if (!targetEmployee || targetEmployee.companyId !== companyId) {
    return NextResponse.json({ error: 'Employee not found in this company' }, { status: 404 });
  }

  const salary = await dbPrisma.salaryPayment.create({
    data: {
      employeeId: data.employeeId,
      grossAmount: data.grossAmount,
      netAmount: data.netAmount,
      deductions: (data.deductions ?? {}) as never,
      period: data.period,
      paidAt: data.paidAt,
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json({
    ...salary,
    paidAt: salary.paidAt.toISOString(),
    createdAt: salary.createdAt.toISOString(),
    updatedAt: salary.updatedAt.toISOString(),
  }, { status: 201 });
}

/**
 * POST /api/companies/[companyId]/tax/salaries/estimate
 * Estimate employee cost for a given gross salary
 */
export async function PUT(
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

  const bodyResult = await parseJsonOrError(req, z.object({
    grossSalary: z.coerce.number().positive(),
  }));
  if (!bodyResult.ok) return bodyResult.response;

  const estimate = calculateEmployeeCost(bodyResult.data.grossSalary);

  return NextResponse.json(estimate);
}
