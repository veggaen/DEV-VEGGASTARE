'use server';

import { ExtendedEmployee } from '@/app/companies/[id]/settings/CompanySettingsClient';
import { dbPrisma } from '@/lib/db';
import { ExtendedUser } from '@/next-auth';
import { Prisma, Employee } from '@prisma/client';
import { NextApiResponse } from 'next';

export interface EmployeePermissions {
  CAN_REMOVE_EMPLOYEE?: boolean;
  CAN_EDIT_PERMISSION?: boolean;
  CAN_DELETE_COMPANY?: boolean;
  CAN_POST_PRODUCT_POSITION_PERMISSION?: boolean;
  CAN_EDIT_PRODUCT_POSITION_PERMISSION?: boolean;
  CAN_ADD_EMPLOYEE?: boolean;
  CAN_EDIT_EMPLOYEE_ROLE?: boolean;
}

interface EditPermissionRequest {
  clientUser: ExtendedUser;
  company: any;
  selectedEmployee: ExtendedEmployee;
  permissions: EmployeePermissions;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  updatedCompany?: any;
  error?: string;
}

const LOG_PREFIX = '[frontend/actions/edit-company-employee-permission.tsx]'
const isDev = process.env.NODE_ENV !== 'production';
export async function editCompanyEmployeePermissionAction(
  { company, selectedEmployee, permissions, clientUser }: EditPermissionRequest,
  res?: NextApiResponse<ApiResponse<Employee>>
): Promise<ApiResponse<Employee>> {
  try {
      if (isDev) console.log(LOG_PREFIX, 'editCompanyEmployeePermissionAction() 1/2');
      const permissionData = Object.entries(permissions).reduce((acc, [key, value]) => {
        acc[key as keyof EmployeePermissions] = value === true ? true : value === false ? false : undefined;
        return acc;
      }, {} as Record<keyof EmployeePermissions, boolean | undefined>);

      // Check if any permission is being set to true
      const isAnyPermissionSetToTrue = Object.values(permissionData).some((value) => value === true);

      if (isDev) console.log(LOG_PREFIX, 'Is any permission set to true?', isAnyPermissionSetToTrue ? 'Yes' : 'No');

      
      // Fetch the employee data for the employee matching the clientUser.id
      const clientUserEmployeeData: Employee | null = await dbPrisma.employee.findFirst({
      where: {
        userId: clientUser.id,
        companyId: company.id,
      },
        include: {
          User: true,
        },
      });
      if (!clientUserEmployeeData){
        console.error('Permission denied: Employee not found.');
        return { error: 'Permission denied: Employee not found.' };
      }
        
      // Check if the user has permission to add permission
      if (!(clientUserEmployeeData?.permissions as EmployeePermissions)?.CAN_EDIT_PERMISSION === true) {
        if (isDev) console.log(LOG_PREFIX, 'clientPermissions.CAN_EDIT_PERMISSION:', (clientUserEmployeeData.permissions as EmployeePermissions).CAN_EDIT_PERMISSION)
        console.error('Permission denied: User does not have permission CAN_EDIT_PERMISSION and is needed to manage permission.');
        return { error: 'Permission denied: User does not have permission CAN_EDIT_PERMISSION and is needed to manage permission.' };
      }
      
      // do the update
      const updatedEmployee = await dbPrisma.employee.update({
          where: { id: selectedEmployee.id },
          data: { permissions: permissionData },
      });
        if (isDev) console.log(LOG_PREFIX, 'Updated employee:', updatedEmployee.id);
      // Fetch the updated company data
      const newCompany = await dbPrisma.company.findUnique({
          where: { id: company.id },
          include: {
              User_Company_creatorIdToUser: true,
              User_Company_ownerIdToUser: true,
              Employee: {
                  include: {
                      User: true,
                  },
              },
              WarehouseLocation: true,
          },
      });

        if (isDev) console.log(LOG_PREFIX, 'editCompanyEmployeePermissionAction() 2/2');

      return { success: true, data: updatedEmployee, updatedCompany: newCompany };
  } catch (error) {
      console.error('Error editing company employee permission:', error);
      return { error: 'Internal Server Error' };
  }
}