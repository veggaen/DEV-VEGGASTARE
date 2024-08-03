'use server';

import { ExtendedCompany, ExtendedEmployee } from '@/app/(protected)/nexus/company/[companyId]/page';
import { dbPrisma } from '@/lib/db';
import { ExtendedUser } from '@/next-auth';
import { PrismaClient, Employee, UserRole } from '@prisma/client';
import { NextApiResponse } from 'next';

export type EmployeePermissions = {
  CAN_REMOVE_EMPLOYEE: boolean;
  CAN_EDIT_PERMISSION: boolean;
  CAN_POST_PRODUCT_POSITION_PERMISSION: boolean;
  CAN_EDIT_PRODUCT_POSITION_PERMISSION: boolean;
  CAN_DELETE_COMPANY: boolean;
  CAN_ADD_EMPLOYEE: boolean;
  CAN_EDIT_EMPLOYEE_ROLE: boolean;
};

export type EditPermissionRequest = {
  company: ExtendedCompany;
  selectedEmployee: ExtendedEmployee;
  permissions: EmployeePermissions;
  clientUser: ExtendedUser;
};

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  updatedCompany?: any;
  error?: string;
}

const prisma = new PrismaClient();

const LOG_PREFIX = '[frontend/actions/edit-company-employee-permission.tsx]';

export async function editCompanyEmployeePermissionAction(
  { company, selectedEmployee, permissions, clientUser }: EditPermissionRequest,
  res?: NextApiResponse<ApiResponse<Employee>>
): Promise<ApiResponse<Employee>> {
  try {
    console.log('editCompanyEmployeePermissionAction() 1/2');
    const permissionData = Object.entries(permissions).reduce((acc, [key, value]) => {
      acc[key as keyof EmployeePermissions] = value === true ? true : value === false ? false : undefined;
      return acc;
    }, {} as Record<keyof EmployeePermissions, boolean | undefined>);

    // Check if any permission is being set to true
    const isAnyPermissionSetToTrue = Object.values(permissionData).some((value) => value === true);

    console.log('Is any permission set to true?', isAnyPermissionSetToTrue ? 'Yes, true' : 'Not, false');

    // Fetch the employee data for the employee matching the clientUser.id
    const clientUserEmployeeData = await dbPrisma.employee.findFirst({
      where: {
        userId: clientUser.id,
        companyId: company.id,
      },
      include: {
        user: true,
      },
    });

    if (!clientUserEmployeeData) {
      console.error('Permission denied: Employee not found.');
      return { error: 'Permission denied: Employee not found.' };
    }

    const parsedPermissions = JSON.parse(clientUserEmployeeData.permissions as unknown as string) as EmployeePermissions;

    const clientUserExtendedEmployeeData: ExtendedEmployee = {
      ...clientUserEmployeeData,
      permissions: parsedPermissions,
    };

    // Check if the user has permission to add permission
    if (!clientUserExtendedEmployeeData.permissions.CAN_EDIT_PERMISSION) {
      console.log('clientPermissions: ', clientUserExtendedEmployeeData.permissions.CAN_EDIT_PERMISSION);
      console.error('Permission denied: User does not have permission CAN_EDIT_PERMISSION and is needed to manage permission.');
      return { error: 'Permission denied: User does not have permission CAN_EDIT_PERMISSION and is needed to manage permission.' };
    }

    // do the update
    const updatedEmployee = await dbPrisma.employee.update({
      where: { id: selectedEmployee.id },
      data: { permissions: permissionData },
    });
    console.log('Updated employee data: ', updatedEmployee);
    // Fetch the updated company data
    const newCompany = await dbPrisma.company.findUnique({
      where: { id: company.id },
      include: {
        creator: true,
        owner: true,
        employees: {
          include: {
            user: true,
          },
        },
        warehouseLocations: true,
      },
    });

    console.log('editCompanyEmployeePermissionAction() 2/2 clientUserEmployeeData:', clientUserEmployeeData);
    console.log('editCompanyEmployeePermissionAction() 2/2 permissionData:', permissionData);

    return { success: true, data: updatedEmployee, updatedCompany: newCompany };
  } catch (error) {
    console.error('Error editing company employee permission:', error);
    return { error: 'Internal Server Error' };
  } finally {
    await prisma.$disconnect();
  }
}