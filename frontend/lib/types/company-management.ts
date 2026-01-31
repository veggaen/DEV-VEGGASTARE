import type { EmployeePermissions } from '@/lib/types/company-permissions';
import type { CompanyDetailsResponse, CompanyEmployeeResponse } from '@/lib/types/company';

export type ExtendedEmployee = Omit<CompanyEmployeeResponse, 'permissions'> & {
  permissions: CompanyEmployeeResponse['permissions'] & EmployeePermissions;
};

export type ExtendedCompany = Omit<CompanyDetailsResponse, 'employees'> & {
  employees: ExtendedEmployee[];
};
