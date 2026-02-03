'use client';

import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect } from 'react';
import type { EmployeePermissions } from '@/lib/types/company-permissions';
import { PERMISSION_GROUPS, PERMISSION_LABELS } from '@/lib/permissions';
import { editCompanyEmployeePermissionAction } from '@/actions/edit-company-employee-permission';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { ExtendedCompany, ExtendedEmployee } from '@/lib/types/company-management';
import EditEmployeeRoleModal from './edit-employee-role-modal';


interface EditEmployeePermissionsModalProps {
  company: ExtendedCompany;
  setCompany: React.Dispatch<React.SetStateAction<ExtendedCompany | null>>;
  selectedEmployee: ExtendedEmployee;
}

const LOG_PREFIX = '[frontend/components/uicustom/company/edit-employee-permission.tsx]';
const EditEmployeePermissionsModal: React.FC<EditEmployeePermissionsModalProps> = ({ selectedEmployee, company, setCompany }) => {
  const clientUser = useCurrentUser();
  const [isShowing, setIsShowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stateChange, setStateChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [showOwnerWarning, setShowOwnerWarning] = useState(false);
  const [permissions, setPermissions] = useState<EmployeePermissions>({
    // Employee Management
    CAN_ADD_EMPLOYEE: false,
    CAN_REMOVE_EMPLOYEE: false,
    CAN_EDIT_EMPLOYEE_ROLE: false,
    CAN_EDIT_PERMISSION: false,
    // Company Management
    CAN_DELETE_COMPANY: false,
    CAN_EDIT_COMPANY_DETAILS: false,
    CAN_MANAGE_WAREHOUSES: false,
    // Product Management
    CAN_POST_PRODUCT_POSITION_PERMISSION: false,
    CAN_EDIT_PRODUCT_POSITION_PERMISSION: false,
    CAN_DELETE_PRODUCT: false,
    CAN_VIEW_ANALYTICS: false,
    // Financial
    CAN_VIEW_SALES: false,
    CAN_MANAGE_PRICING: false,
    CAN_PROCESS_REFUNDS: false,
  });

  useEffect(() => {
    if (selectedEmployee) {
      setPermissions({
        // Employee Management
        CAN_ADD_EMPLOYEE: selectedEmployee.permissions.CAN_ADD_EMPLOYEE ?? false,
        CAN_REMOVE_EMPLOYEE: selectedEmployee.permissions.CAN_REMOVE_EMPLOYEE ?? false,
        CAN_EDIT_EMPLOYEE_ROLE: selectedEmployee.permissions.CAN_EDIT_EMPLOYEE_ROLE ?? false,
        CAN_EDIT_PERMISSION: selectedEmployee.permissions.CAN_EDIT_PERMISSION ?? false,
        // Company Management
        CAN_DELETE_COMPANY: selectedEmployee.permissions.CAN_DELETE_COMPANY ?? false,
        CAN_EDIT_COMPANY_DETAILS: selectedEmployee.permissions.CAN_EDIT_COMPANY_DETAILS ?? false,
        CAN_MANAGE_WAREHOUSES: selectedEmployee.permissions.CAN_MANAGE_WAREHOUSES ?? false,
        // Product Management
        CAN_POST_PRODUCT_POSITION_PERMISSION: selectedEmployee.permissions.CAN_POST_PRODUCT_POSITION_PERMISSION ?? false,
        CAN_EDIT_PRODUCT_POSITION_PERMISSION: selectedEmployee.permissions.CAN_EDIT_PRODUCT_POSITION_PERMISSION ?? false,
        CAN_DELETE_PRODUCT: selectedEmployee.permissions.CAN_DELETE_PRODUCT ?? false,
        CAN_VIEW_ANALYTICS: selectedEmployee.permissions.CAN_VIEW_ANALYTICS ?? false,
        // Financial
        CAN_VIEW_SALES: selectedEmployee.permissions.CAN_VIEW_SALES ?? false,
        CAN_MANAGE_PRICING: selectedEmployee.permissions.CAN_MANAGE_PRICING ?? false,
        CAN_PROCESS_REFUNDS: selectedEmployee.permissions.CAN_PROCESS_REFUNDS ?? false,
      });
    }
  }, [selectedEmployee, stateChange]);

  const handleOpenChange = (open: boolean) => {
    setIsShowing(open);
    setStateChange((v) => !v);
    setError(null);
    setSuccess(false);
  };

  const handleClickEditPermissions = () => {
    console.log(`${LOG_PREFIX} Edit Permissions button clicked`);
    setIsShowing(!isShowing);
  };

  const handleCheckboxChange = (permission: keyof EmployeePermissions) => {
    if (selectedEmployee.userId === company.ownerId && permission === 'CAN_EDIT_PERMISSION' && permissions.CAN_EDIT_PERMISSION) {
      setShowOwnerWarning(true);
    } else {
      setPermissions((prevPermissions) => ({
        ...prevPermissions,
        [permission]: !prevPermissions[permission],
      }));
    }
  };

  const confirmDisableEditPermission = () => {
    setPermissions((prevPermissions) => ({
      ...prevPermissions,
      CAN_EDIT_PERMISSION: !prevPermissions.CAN_EDIT_PERMISSION,
    }));
    setShowOwnerWarning(false);
  };

  const handleSavePermissions = async () => {
    setIsLoading(true);
    try {
      if (clientUser) {
        console.log('Saving permissions', permissions);
        console.log('Saving company name', company.name);
        console.log('Saving selectedEmployee', selectedEmployee);

        const response = await editCompanyEmployeePermissionAction({ company, selectedEmployee, permissions, clientUser });
        if (response.success) {
          setCompany(response.updatedCompany);
          setSuccess(true);
          window.setTimeout(() => {
            setIsShowing(false);
            setSuccess(false);
            setError(null);
          }, 650);
        }
        if (response.error) {
          setError(response.error);
          setSuccess(false);
        }
      }
    } catch (error) {
      console.error('Error updating employee permissions:', error);
      setError('Failed to update permissions');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex flex-wrap gap-2'>
      <Dialog open={isShowing} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant='vegaNormalBtn' className='w-full bg-gray-200 text-black hover:bg-gray-300 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700' onClick={handleClickEditPermissions}>
            Edit Permissions
          </Button>
        </DialogTrigger>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto text-black dark:text-white bg-background border-border'>
          <DialogHeader>
            <DialogTitle className='flex gap-2 items-center'>
              Edit Permissions
              <span className='text-primary font-medium'>{selectedEmployee?.user?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Configure what this employee can do within the company.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Employee Management */}
            <div className="rounded-lg border border-border p-3">
              <div className="text-sm font-semibold mb-2 text-foreground">Employee Management</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['CAN_ADD_EMPLOYEE', 'CAN_REMOVE_EMPLOYEE', 'CAN_EDIT_EMPLOYEE_ROLE', 'CAN_EDIT_PERMISSION'] as const).map((key) => (
                  <label key={key} className='flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors'>
                    <Checkbox
                      id={key}
                      checked={permissions[key]}
                      onCheckedChange={() => handleCheckboxChange(key)}
                      className='h-4 w-4'
                    />
                    <span className='text-sm'>{PERMISSION_LABELS[key] || key}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Company Management */}
            <div className="rounded-lg border border-border p-3">
              <div className="text-sm font-semibold mb-2 text-foreground">Company Management</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['CAN_EDIT_COMPANY_DETAILS', 'CAN_MANAGE_WAREHOUSES', 'CAN_DELETE_COMPANY'] as const).map((key) => (
                  <label key={key} className={`flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors ${key === 'CAN_DELETE_COMPANY' ? 'text-red-600 dark:text-red-400' : ''}`}>
                    <Checkbox
                      id={key}
                      checked={permissions[key]}
                      onCheckedChange={() => handleCheckboxChange(key)}
                      className='h-4 w-4'
                    />
                    <span className='text-sm'>{PERMISSION_LABELS[key] || key}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Product Management */}
            <div className="rounded-lg border border-border p-3">
              <div className="text-sm font-semibold mb-2 text-foreground">Product Management</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['CAN_POST_PRODUCT_POSITION_PERMISSION', 'CAN_EDIT_PRODUCT_POSITION_PERMISSION', 'CAN_DELETE_PRODUCT', 'CAN_VIEW_ANALYTICS'] as const).map((key) => (
                  <label key={key} className='flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors'>
                    <Checkbox
                      id={key}
                      checked={permissions[key]}
                      onCheckedChange={() => handleCheckboxChange(key)}
                      className='h-4 w-4'
                    />
                    <span className='text-sm'>{PERMISSION_LABELS[key] || key}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Financial */}
            <div className="rounded-lg border border-border p-3">
              <div className="text-sm font-semibold mb-2 text-foreground">Financial</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['CAN_VIEW_SALES', 'CAN_MANAGE_PRICING', 'CAN_PROCESS_REFUNDS'] as const).map((key) => (
                  <label key={key} className='flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors'>
                    <Checkbox
                      id={key}
                      checked={permissions[key]}
                      onCheckedChange={() => handleCheckboxChange(key)}
                      className='h-4 w-4'
                    />
                    <span className='text-sm'>{PERMISSION_LABELS[key] || key}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <div className='text-sm text-red-500 p-2 rounded bg-red-500/10'>{error}</div>}
            {success && <div className='text-sm text-green-500 p-2 rounded bg-green-500/10'>Permissions saved successfully.</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShowing(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>

        {showOwnerWarning && (
          <Dialog open={showOwnerWarning} onOpenChange={setShowOwnerWarning}>
            <DialogContent className='bg-background'>
              <DialogHeader>
                <DialogTitle className='text-red-500'>Warning</DialogTitle>
                <DialogDescription className='text-amber-500'>
                  Disabling &quot;Manage Permissions&quot; will prevent you from reverting this change later. 
                  If no other employee has this permission, no one in the company will be able to change permissions in the future. 
                  Are you sure you want to proceed?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowOwnerWarning(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDisableEditPermission}>
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </Dialog>
      <EditEmployeeRoleModal
        company={company}
        setCompany={setCompany}
        selectedEmployee={selectedEmployee}
      />
    </div>
  );
};

export default EditEmployeePermissionsModal;