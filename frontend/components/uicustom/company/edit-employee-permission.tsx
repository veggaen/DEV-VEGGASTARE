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
import { useState } from 'react';



interface EditEmployeePermissionsModalProps {
  selectedEmployee: Employee;
  isOpen: boolean;
  onClose: () => void;
}

interface EmployeePermissions {
  CAN_REMOVE_EMPLOYEE: boolean;
  CAN_REMOVE_PERMISSION: boolean;
  CAN_ADD_PERMISSION: boolean;
  CAN_ADD_EMPLOYEE: boolean;
}

const EditEmployee: React.FC<EditEmployeePermissionsModalProps> = ({isOpen, onClose, selectedEmployee}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<EmployeePermissions>({
    CAN_REMOVE_EMPLOYEE: false,
    CAN_REMOVE_PERMISSION: false,
    CAN_ADD_PERMISSION: false,
    CAN_ADD_EMPLOYEE: false,
  });

  const handleCheckboxChange = (permission: keyof EmployeePermissions) => {
    setPermissions((prevPermissions) => ({
      ...prevPermissions,
      [permission]: !prevPermissions[permission],
    }));
  };

  const handleOpen = () => {
    console.log('open');
  };
  
  const handleSave = () => {
    // Implement save logic here
    console.log('save...');
    onClose();
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant='vegaNormalBtn' className='w-full'>Edit Profile</Button>
        </DialogTrigger>
        <DialogContent className="w-fit dark:bg-black dark:border-white/20 bg-white border-black/20 text-black dark:text-white">
          <DialogHeader>
            <DialogTitle><div className={'flex justify-start gap-2'}><div>Edit profile Permissions</div><div>( {/* {selectedEmployee.user.name} */} )</div></div></DialogTitle>
            <DialogDescription>
              Make changes to selected profile here. Click save when done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-6 dark:bg-white/10 bg-black/10 border dark:border-white/20 border-black/20 px-4 rounded-lg">
            <div className="flex flex-col justify-start items-start gap-4 ">
            <h2>Edit Permissions</h2>
              <div className='flex justify-between items-center text-nowrap w-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 py-2 px-4 rounded-lg transition-colors duration-500 active:bg-blue-500/50'>
                <label htmlFor="can-add-employee" className='w-full'>Can Add Employee</label>
                <Checkbox
                  id="can-add-employee"
                  checked={permissions.CAN_ADD_EMPLOYEE}
                  onCheckedChange={() => handleCheckboxChange('CAN_ADD_EMPLOYEE')}
                />
              </div>
              <div className='flex justify-between items-center text-nowrap w-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 py-2 px-4 rounded-lg transition-colors duration-500 active:bg-blue-500/50'>
                <label htmlFor="can-remove-employee" className='w-full'>Can Remove Employee</label>
                <Checkbox
                  id="can-remove-employee"
                  checked={permissions.CAN_REMOVE_EMPLOYEE}
                  onCheckedChange={() => handleCheckboxChange('CAN_REMOVE_EMPLOYEE')}
                />
              </div>
              <div className='flex justify-between items-center text-nowrap w-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 py-2 px-4 rounded-lg transition-colors duration-500 active:bg-blue-500/50'>
                <label htmlFor="can-add-permission" className='w-full'>Can Add Permission</label>
                <Checkbox
                  id="can-add-permission"
                  checked={permissions.CAN_ADD_PERMISSION}
                  onCheckedChange={() => handleCheckboxChange('CAN_ADD_PERMISSION')}
                />
              </div>
              <div className='flex justify-between items-center text-nowrap w-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 py-2 px-4 rounded-lg transition-colors duration-500 active:bg-blue-500/50'>
                <label htmlFor="can-remove-permission" className='w-full'>Can Remove Permission</label>
                <Checkbox
                  id="can-remove-permission"
                  checked={permissions.CAN_REMOVE_PERMISSION}
                  onCheckedChange={() => handleCheckboxChange('CAN_REMOVE_PERMISSION')}
                />
              </div>
        
              {error && <div className="text-red-500">{error}</div>}
              {success && <div className="text-green-500">Permissions saved successfully.</div>}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </>
  );
};

export default EditEmployee;