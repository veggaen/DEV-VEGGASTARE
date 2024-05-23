'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/use-current-user';
import { EmployeePermissions } from '@/actions/edit-company-employee-permission';
import { useRouter } from 'next/navigation';

interface DeleteCompanyBtnProps {
  companyId: string;
  companyName: string;
  onCompanyDeleted: () => void;
  employeePermissions: EmployeePermissions;
}

const DeleteCompanyBtn = ({ companyId, companyName, onCompanyDeleted, employeePermissions }: DeleteCompanyBtnProps) => {
  console.log('delete company button')
  console.log('employeePermissions ', employeePermissions)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const user = useCurrentUser();
  const router = useRouter()

  const handleDeleteClick = () => {
    if (!employeePermissions.CAN_DELETE_COMPANY) {
      toast.error('You do not have permission to delete this company');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/companies/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyId, userId: user?.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete company');
      }

      onCompanyDeleted();
      toast.success('Company deleted successfully');
      router.push('/settings/company')
    } catch (error) {
      toast.error(`Error deleting company: ${(error as Error).message}`);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="vegaNormalBtnRed"
            onClick={() => {
              if (!employeePermissions.CAN_DELETE_COMPANY) {
                toast.error('You do not have permission to delete this company');
                return;
              }
            }}
            className="bg-black/10 dark:bg-black/10 font-semibold"
          >
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] dark:bg-black bg-white">
          <DialogHeader>
            <DialogTitle className='text-red-500'>Confirm Deletion</DialogTitle>
            <DialogDescription className='text-yellow-500'>
              Are YOU sure you want to DELETE the company "{companyName}"? This action CANNOT be UNDONE.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={confirmDelete} variant="destructive" disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeleteCompanyBtn;