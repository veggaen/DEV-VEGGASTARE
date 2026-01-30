'use client'

import { useCurrentUserEmployeeCheckPermission } from '@/hooks/use-current-user-employee-permissions';
import { useState } from 'react';

interface UserPermissionCheckProps {
  clientUser: { id: string };
  companyId: string;
  permissionTag: string;
  result?: unknown;
}

export default function UserPermissionCheck({ clientUser, companyId, permissionTag, result }: UserPermissionCheckProps) {
    const { permissions, isPermissionAvailable, isLoading, error } = useCurrentUserEmployeeCheckPermission(clientUser, companyId, permissionTag);
  
    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
  
    return (
      <div>
        {isPermissionAvailable
          ? <p>User has the {permissionTag} permission.</p>
          : <p>User does not have the {permissionTag} permission.</p>}
      </div>
    );
  };