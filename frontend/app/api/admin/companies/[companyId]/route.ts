import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { 
  isAdmin, 
  isOwner,
  logAdminAction, 
  ADMIN_COMPANY_EDITABLE_FIELDS, 
  sanitizeFields 
} from '@/lib/admin';
import { AdminAction, AdminTargetType } from '@/generated/prisma/browser';

const LOG_PREFIX = '[api/admin/companies/[companyId]]';

type RouteContext = { params: Promise<{ companyId: string }> };

// GET /api/admin/companies/[companyId] - Get full company details for admin
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { companyId } = await context.params;

  try {
    const company = await dbPrisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        description: true,
        websiteUrl: true,
        logo: true,
        bannerImage: true,
        colorScheme: true,
        orgNumber: true,
        orgType: true,
        usesShipping: true,
        createdAt: true,
        updatedAt: true,
        employmentNoticeDays: true,
        User_Company_ownerIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        User_Company_creatorIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        _count: {
          select: {
            Employee: true,
            Product: true,
            Sale: true,
            WarehouseLocation: true,
          },
        },
        // Get employees
        Employee: {
          select: {
            id: true,
            role: true,
            jobTitle: true,
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          take: 10,
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Log that admin viewed this company
    await logAdminAction({
      adminId: session.id,
      action: AdminAction.VIEW,
      targetType: AdminTargetType.COMPANY,
      targetId: companyId,
    });

    return NextResponse.json({ company });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching company:`, error);
    return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 });
  }
}

// PATCH /api/admin/companies/[companyId] - Update company as admin
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { companyId } = await context.params;

  try {
    const body = await request.json();
    const { reason, ...updateFields } = body;

    // Get current company data for audit log
    const currentCompany = await dbPrisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        description: true,
        websiteUrl: true,
        logo: true,
        bannerImage: true,
        colorScheme: true,
        orgNumber: true,
        orgType: true,
        usesShipping: true,
      },
    });

    if (!currentCompany) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Sanitize to only allowed fields
    const sanitizedData = sanitizeFields(updateFields, ADMIN_COMPANY_EDITABLE_FIELDS);

    if (Object.keys(sanitizedData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Validate URLs
    if ('websiteUrl' in sanitizedData && sanitizedData.websiteUrl) {
      try {
        new URL(sanitizedData.websiteUrl as string);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL for websiteUrl' },
          { status: 400 }
        );
      }
    }

    // Update the company
    const updatedCompany = await dbPrisma.company.update({
      where: { id: companyId },
      data: sanitizedData,
      select: {
        id: true,
        name: true,
        description: true,
        websiteUrl: true,
        logo: true,
        bannerImage: true,
        colorScheme: true,
        orgNumber: true,
        orgType: true,
        usesShipping: true,
        updatedAt: true,
      },
    });

    // Log the action
    await logAdminAction({
      adminId: session.id,
      action: AdminAction.EDIT,
      targetType: AdminTargetType.COMPANY,
      targetId: companyId,
      previousData: currentCompany,
      newData: updatedCompany,
      reason,
    });

    return NextResponse.json({ 
      company: updatedCompany,
      message: 'Company updated successfully',
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating company:`, error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}

// DELETE /api/admin/companies/[companyId] - Delete company (OWNER only)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  
  // Only OWNER can delete companies
  if (!session?.id || !isOwner(session.role)) {
    return NextResponse.json(
      { error: 'Only the platform owner can delete companies' }, 
      { status: 403 }
    );
  }

  const { companyId } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Get company data for audit log before deletion
    const company = await dbPrisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        orgNumber: true,
        ownerId: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Log before deletion
    await logAdminAction({
      adminId: session.id,
      action: AdminAction.DELETE,
      targetType: AdminTargetType.COMPANY,
      targetId: companyId,
      previousData: company,
      reason,
    });

    // Delete the company (cascade will handle related records)
    await dbPrisma.company.delete({
      where: { id: companyId },
    });

    return NextResponse.json({ 
      message: 'Company deleted successfully',
      deletedCompanyId: companyId,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error deleting company:`, error);
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
  }
}
