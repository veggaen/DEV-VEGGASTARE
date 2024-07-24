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
import { EmployeePermissions, editCompanyEmployeePermissionAction } from '@/actions/edit-company-employee-permission';
import { useCurrentUser } from '@/hooks/use-current-user';
import { ExtendedCompany, ExtendedEmployee } from '@/app/(protected)/nexus/company/[companyId]/page';
import EditEmployeeRoleModal from './edit-employee-role-modal';

interface EditEmployeePermissionsModalProps {
  company: ExtendedCompany;
  setCompany: React.Dispatch<React.SetStateAction<ExtendedCompany | null>>;
  selectedEmployee: ExtendedEmployee;
  clientUser: any;
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
      });
    }
  }, [selectedEmployee, stateChange]);

  const handleOpenChange = () => {
    setIsShowing(!isShowing);
    setStateChange(!stateChange);
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
          setTimeout(() => {
            setSuccess(false);
            setError(null);
          }, 5000);
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
          <Button variant='vegaNormalBtn' className='w-full' onClick={handleClickEditPermissions}>
            Edit Permissions
          </Button>
        </DialogTrigger>
        <DialogContent className='bg-black'>
          <DialogHeader>
            <DialogTitle>
              Edit Profile Permissions ({selectedEmployee?.user?.name})
            </DialogTitle>
            <DialogDescription>
              Make changes to selected profile here. Click save when done.
            </DialogDescription>
          </DialogHeader>
          <div>
            {Object.entries(permissions).map(([key, value]) => (
              <div key={key}>
                <Checkbox
                  id={key}
                  checked={value}
                  onCheckedChange={() => handleCheckboxChange(key as keyof EmployeePermissions)}
                />
                <label htmlFor={key}>{key}</label>
              </div>
            ))}
            {error && <div className='text-red-500'>{error}</div>}
            {success && <div className='text-green-500'>Permissions saved successfully.</div>}
          </div>
          <DialogFooter>
            <Button onClick={handleSavePermissions} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>

        {showOwnerWarning && (
          <Dialog open={showOwnerWarning} onOpenChange={setShowOwnerWarning}>
            <DialogContent className='bg-black'>
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
                  <Button variant="destructive" onClick={confirmDisableEditPermission}>
                    Confirm
                  </Button>
                  <Button onClick={() => setShowOwnerWarning(false)}>Cancel</Button>
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