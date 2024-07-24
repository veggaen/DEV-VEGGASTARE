'use client';

import { useState, useEffect } from 'react';
import { EmployeeRole } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogHeader, DialogContent, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCurrentUser } from '@/hooks/use-current-user';
import { ExtendedCompany, ExtendedEmployee } from '@/app/(protected)/nexus/company/[companyId]/page';
import { editEmployeeRoleAction } from '@/actions/edit-employee-role';

interface EditEmployeeRoleModalProps {
  company: ExtendedCompany;
  setCompany: React.Dispatch<React.SetStateAction<ExtendedCompany | null>>;
  selectedEmployee: ExtendedEmployee;
}

const EditEmployeeRoleModal: React.FC<EditEmployeeRoleModalProps> = ({ selectedEmployee, company, setCompany }) => {
  const clientUser = useCurrentUser();
  const [isShowing, setIsShowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [newRole, setNewRole] = useState<EmployeeRole>('USER'); // Set a default value

  useEffect(() => {
    if (selectedEmployee) {
      setNewRole(selectedEmployee.role as EmployeeRole);
    }
  }, [selectedEmployee]);

  const handleOpenChange = () => {
    setIsShowing(!isShowing);
  };

  const handleSaveRole = async () => {
    setIsLoading(true);
    try {
      const response = await editEmployeeRoleAction({ employeeId: selectedEmployee.id, newRole, clientUser, companyId: company.id });
      if (response.success) {
        setCompany((prevCompany) => {
          if (!prevCompany) return null;
          const updatedEmployees = prevCompany.employees.map((employee) =>
            employee.id === selectedEmployee.id ? { ...employee, role: newRole } : employee
          );
          return { ...prevCompany, employees: updatedEmployees };
        });
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setError(null);
        }, 5000);
      } else {
        setError(response.message);
        setSuccess(false);
      }
    } catch (error) {
      console.error('Error updating employee role:', error);
      setError('Failed to update role');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isShowing} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant='vegaNormalBtn' className='w-full bg-gray-200 text-black hover:bg-gray-300 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700' onClick={handleOpenChange}>
          Edit Role
        </Button>
      </DialogTrigger>
      <DialogContent className='text-black dark:text-white bg-gradient-to-tr dark:from-slate-700 dark:to-slate-900 from-blue-100 via-gray-200 to-blue-200 border-gray-700 dark:border-gray-700'>
        <DialogHeader>
          <DialogTitle className='flex gap-2'>
            Edit Employee Role | <p className='text-purple-600 italic font-bold'> {selectedEmployee?.user?.name}</p>
          </DialogTitle>
          <DialogDescription>
            Make changes to the employee role here. Click save when done.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor="role" className='text-black dark:text-white'>Role:</label>
          <select id="role" value={newRole} onChange={(e) => setNewRole(e.target.value as EmployeeRole)} className='bg-gray-200 text-black dark:bg-gray-700 dark:text-white'>
            <option value="OWNER">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff</option>
            <option value="USER">User</option>
          </select>
          {error && <div className='text-red-500'>{error}</div>}
          {success && <div className='text-green-500'>Role saved successfully.</div>}
        </div>
        <DialogFooter>
          <Button onClick={handleSaveRole} disabled={isLoading} className='bg-blue-500 hover:bg-blue-600 dark:bg-blue-400 dark:hover:bg-blue-500'>
            {isLoading ? 'Saving...' : 'Save Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditEmployeeRoleModal;