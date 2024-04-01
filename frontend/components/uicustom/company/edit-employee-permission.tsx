'use client'

import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from'@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Employee } from '@prisma/client';
import { useState, useEffect } from 'react';
import { ExtendedCompany, ExtendedEmployee } from '@/app/(protected)/settings/company/[...id]/page';
import { editCompanyEmployeePermission } from '@/actions/edit-company-employee-permission';



interface EditEmployeePermissionsModalProps {
  
  selectedEmployee: ExtendedEmployee;
  isOpen: boolean;
  onClose: () => void;
}

interface EmployeePermissions {
  CAN_REMOVE_EMPLOYEE: boolean;
  CAN_REMOVE_PERMISSION: boolean;
  CAN_ADD_PERMISSION: boolean;
  CAN_ADD_EMPLOYEE: boolean;
}

interface EditEmployeePermissionsModalProps {
  company: ExtendedCompany;
  selectedEmployee: ExtendedEmployee;
  isOpen: boolean;
  onClose: () => void;
}

interface EmployeePermissions {
  CAN_REMOVE_EMPLOYEE: boolean;
  CAN_REMOVE_PERMISSION: boolean;
  CAN_ADD_PERMISSION: boolean;
  CAN_ADD_EMPLOYEE: boolean;
}

const LOG_PREFIX = '[frontend/components/uicustom/company/edit-employee-permission.tsx]'
const EditEmployeePermissionsModal: React.FC<EditEmployeePermissionsModalProps> = ({ isOpen, onClose, selectedEmployee, company }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<EmployeePermissions>({
    CAN_REMOVE_EMPLOYEE: false,
    CAN_REMOVE_PERMISSION: false,
    CAN_ADD_PERMISSION: false,
    CAN_ADD_EMPLOYEE: false,
  });

  // Update permissions state when selectedEmployee changes
  useEffect(() => {
    if (selectedEmployee) {
      setPermissions({
        CAN_REMOVE_EMPLOYEE: selectedEmployee.permissions.CAN_REMOVE_EMPLOYEE,
        CAN_REMOVE_PERMISSION: selectedEmployee.permissions.CAN_REMOVE_PERMISSION,
        CAN_ADD_PERMISSION: selectedEmployee.permissions.CAN_ADD_PERMISSION,
        CAN_ADD_EMPLOYEE: selectedEmployee.permissions.CAN_ADD_EMPLOYEE,
      });
    }
  }, [selectedEmployee]);

  const handleCheckboxChange = (permission: keyof EmployeePermissions) => {
    setPermissions((prevPermissions) => ({
      ...prevPermissions,
      [permission]: !prevPermissions[permission],
    }));
  };

  const handleSavePermissions = async () => {
    setIsLoading(true);
    try {
      console.log('Saving permissions', permissions);
      console.log('Saving company name', company.name);
      console.log('Saving selectedEmployee', selectedEmployee);

      const response = await editCompanyEmployeePermission({ company, selectedEmployee, permissions });
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(true);
      }
    } catch (error) {
      console.error('Error updating employee permissions:', error);
      setError('Failed to update permissions');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogTrigger asChild>
        <Button variant='vegaNormalBtn' className='w-full'>
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent>
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
    </Dialog>
  );
};

export default EditEmployeePermissionsModal;