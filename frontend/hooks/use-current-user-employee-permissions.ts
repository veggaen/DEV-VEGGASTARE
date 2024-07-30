import { fetchUserEmployeePermissions } from '@/actions/user-company-permissions';
import { useState, useEffect } from 'react';

export function useCurrentUserEmployeeCheckPermission(clientUser: any, companyId: string, permissionTag: string) {
    const [permissions, setPermissions] = useState(null);
    const [isPermissionAvailable, setIsPermissionAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
  
    useEffect(() => {
      const checkPermissions = async () => {
        if (!clientUser || !companyId) {
          setError('Client user or company ID not provided');
          setIsLoading(false);
          return;
        }
  
        try {
          const permissionsResponse = await fetchUserEmployeePermissions(clientUser, companyId);
          setPermissions(permissionsResponse);
          setIsPermissionAvailable(!!permissionsResponse?.[permissionTag]);
        } catch (err) {
          setError('Failed to fetch company or permissions');
          console.error('Error in fetching user permissions:', err);
        } finally {
          setIsLoading(false);
        }
      };
  
      checkPermissions();
    }, [clientUser, companyId, permissionTag]);
  
    return { permissions, isPermissionAvailable, isLoading, error };
  
}