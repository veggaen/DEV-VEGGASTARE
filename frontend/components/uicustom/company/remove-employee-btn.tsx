'use client';


import { MyRemoveEmployeeAction } from '@/actions/remove-company-employee';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-current-user';
import { User, UserRole } from '@prisma/client';
import React, { useState } from 'react';

interface RemoveEmployeeButtonProps {
  userId: string;
  companyId: string;
  onSuccess: (message: string) => void; // Updated to pass message to onSuccess callback
  onError: (error: string) => void;
}
const LOG_PREFIX = '[frontend/components/uicustom/company/remove-employee-btn.tsx]';

export const RemoveEmployeeButton: React.FC<RemoveEmployeeButtonProps> = ({
  userId,
  companyId,
  onSuccess,
  onError,
}) => {
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const clientUser = useCurrentUser();

  const handleRemove = async () => {
    if (isRemoving) return;

    const ok = window.confirm(
      "Remove this employee from the company?\n\nThis takes effect immediately and can't be undone."
    );
    if (!ok) return;

    console.log(`${LOG_PREFIX} ${clientUser?.name} is initiating the removal of employee with ID: ${userId} from companyID: ${companyId}`);
    setIsRemoving(true);
    const formData = { userId, companyId, clientUser };
    MyRemoveEmployeeAction(formData)
      .then((response) => {
        if (response.success) {
          console.log(LOG_PREFIX, response.message);
          // `Employee successfully removed. [User ID: ${userId}]`
          onSuccess(userId);
        } else {
          const errorMsg = 'error' in response ? response.error : response.message;
          console.error(LOG_PREFIX, errorMsg);
          onError(errorMsg);
        }
      })
      .catch((error) => {
        console.error(`${LOG_PREFIX} Unexpected error occurred while removing the employee: ${error}`);
        onError(`An unexpected error occurred. ${error}`);
      })
      .finally(() => {
        setIsRemoving(false);
      });
  };

  return (
    <Button variant='vegaNormalBtnRed' className='bg-gray-200 text-black hover:bg-gray-300 dark:bg-gray-800 dark:text-white dark:hover:bg-red-700' onClick={handleRemove} disabled={isRemoving}>
      <p className='hidden lg:block'>{isRemoving ? 'Removing...' : 'Remove Employee'}</p>
      <p className='lg:hidden'>{isRemoving ? 'Removing...' : 'Remove'}</p>
    </Button>
  );
};