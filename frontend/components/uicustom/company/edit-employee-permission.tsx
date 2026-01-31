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
    CAN_REMOVE_EMPLOYEE: false,
    CAN_EDIT_PERMISSION: false,
    CAN_POST_PRODUCT_POSITION_PERMISSION: false,
    CAN_EDIT_PRODUCT_POSITION_PERMISSION: false,
    CAN_DELETE_COMPANY: false,
    CAN_ADD_EMPLOYEE: false,
    CAN_EDIT_EMPLOYEE_ROLE: false,
  });

  useEffect(() => {
    if (selectedEmployee) {
      setPermissions({
        CAN_REMOVE_EMPLOYEE: selectedEmployee.permissions.CAN_REMOVE_EMPLOYEE,
        CAN_EDIT_PERMISSION: selectedEmployee.permissions.CAN_EDIT_PERMISSION,
        CAN_DELETE_COMPANY: selectedEmployee.permissions.CAN_DELETE_COMPANY,
        CAN_POST_PRODUCT_POSITION_PERMISSION: selectedEmployee.permissions.CAN_POST_PRODUCT_POSITION_PERMISSION,
        CAN_EDIT_PRODUCT_POSITION_PERMISSION: selectedEmployee.permissions.CAN_EDIT_PRODUCT_POSITION_PERMISSION,
        CAN_ADD_EMPLOYEE: selectedEmployee.permissions.CAN_ADD_EMPLOYEE,
        CAN_EDIT_EMPLOYEE_ROLE: selectedEmployee.permissions.CAN_EDIT_EMPLOYEE_ROLE,
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
        <DialogContent className='text-black dark:text-white bg-gradient-to-tr dark:from-slate-700 dark:to-slate-900 from-blue-100 via-gray-200 to-blue-200 border-gray-700 dark:border-gray-700'>
          <DialogHeader>
            <DialogTitle className='flex gap-2'>
              Edit Profile Permissions | <p className='text-purple-600 italic font-bold'> {selectedEmployee?.user?.name}</p>
            </DialogTitle>
            <DialogDescription>
              Make changes to selected profile here. Click save when done.
            </DialogDescription>
          </DialogHeader>
          <div>
            {Object.entries(permissions).map(([key, value]) => (
              <div key={key} className='flex items-center gap-2 mb-2 bg-gray-400/50 border-gray-300 dark:bg-gray-700/50 dark:border-gray-700 text-white transition duration-300 ease-in-out hover:shadow-lg border hover:border-blue-500/50 dark:hover:border-blue-500/50 active:border-sky-500 hover:bg-sky-400 dark:hover:bg-sky-700 p-2 rounded-sm'>
                <Checkbox
                  id={key}
                  checked={value}
                  onCheckedChange={() => handleCheckboxChange(key as keyof EmployeePermissions)}
                  className='bg-gray-300 border-gray-600 dark:bg-gray-200 dark:border-gray-500 w-7 h-7'
                />
                <label htmlFor={key} className='text-black dark:text-white'>{key}</label>
              </div>
            ))}
            {error && <div className='text-red-500'>{error}</div>}
            {success && <div className='text-green-500'>Permissions saved successfully.</div>}
          </div>
          <DialogFooter>
            <Button onClick={handleSavePermissions} disabled={isLoading} className='bg-blue-500 hover:bg-blue-600 dark:bg-blue-400 dark:hover:bg-blue-500'>
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>

        {showOwnerWarning && (
          <Dialog open={showOwnerWarning} onOpenChange={setShowOwnerWarning}>
            <DialogContent className='bg-gray-100 text-black dark:bg-gray-900 dark:text-white'>
              <DialogHeader>
                <DialogTitle className='text-red-500 text-1xl'>Warning</DialogTitle>
                <DialogDescription className='text-yellow-500'>
                  Disabling Can Edit Permission will prevent you from reverting this change later. 
                  If no other employee has this permission, no one in the company will be able to change permissions in the future. 
                  Are you sure you want to proceed?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <div className='flex justify-between w-full'>
                  <Button variant="destructive" onClick={confirmDisableEditPermission} className='bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'>
                    Confirm
                  </Button>
                  <Button onClick={() => setShowOwnerWarning(false)} className='bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600'>
                    Cancel
                  </Button>
                </div>
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