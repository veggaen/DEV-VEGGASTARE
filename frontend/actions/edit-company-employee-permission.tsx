'use server';
import { ExtendedEmployee } from '@/app/(protected)/settings/company/[...id]/page';
import { Prisma, PrismaClient, Employee } from '@prisma/client';
import { NextApiResponse } from 'next';

interface EmployeePermissions {
  CAN_REMOVE_EMPLOYEE: boolean;
  CAN_REMOVE_PERMISSION: boolean;
  CAN_ADD_PERMISSION: boolean;
  CAN_ADD_EMPLOYEE: boolean;
}

interface EditPermissionRequest {
  company: any;
  selectedEmployee: ExtendedEmployee;
  permissions: EmployeePermissions;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

const prisma = new PrismaClient();

const LOG_PREFIX = '[frontend/actions/edit-company-employee-permission.tsx]'
export async function editCompanyEmployeePermission(
    { company, selectedEmployee, permissions }: EditPermissionRequest,
    res?: NextApiResponse<ApiResponse<Employee>>
  ): Promise<ApiResponse<Employee>> {
    try {
      console.log(LOG_PREFIX,`editCompanyEmployeePermission: company name: ${JSON.stringify(company.name)}, selectedEmployee: ${JSON.stringify(selectedEmployee)}, permissions: ${JSON.stringify(permissions)}`);
      const permissionData = Object.entries(permissions).reduce((acc, [key, value]) => {
        acc[key as keyof EmployeePermissions] = value === true ? true : value === false ? false : undefined;
        return acc;
      }, {} as Record<keyof EmployeePermissions, boolean | undefined>);
      const updatedEmployee = await prisma.employee.update({
        where: { id: selectedEmployee.id },
        data: { permissions: permissionData },
      });
      console.log('Updated employee permissions: ', updatedEmployee)
  
      return { success: true, data: updatedEmployee };
    } catch (error) {
      console.error('Error editing company employee permission:', error);
      return { error: 'Internal Server Error' };
    } finally {
      await prisma.$disconnect();
    }
  }