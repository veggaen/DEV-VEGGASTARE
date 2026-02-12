import { fetchUserEmployeePermissions } from '@/actions/user-company-permissions';
import { useState, useEffect } from 'react';
import { Prisma } from '@/generated/prisma/browser';

type JsonObject = Prisma.JsonObject;

interface UsePermissionResult {
  permissions: JsonObject | null;
  isPermissionAvailable: boolean;
  isLoading: boolean;
  error: string;
  role: string | null;
}

export function useCurrentUserEmployeeCheckPermission(clientUser: any, companyId: string, permissionTag: string): UsePermissionResult {
    const [permissions, setPermissions] = useState<JsonObject | null>(null);
    const [isPermissionAvailable, setIsPermissionAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        const checkPermissions = async () => {
            if (!clientUser || !companyId) {
                setError('Client user or company ID not provided');
                setIsLoading(false);
                return;
            }

            try {
                const res = await fetchUserEmployeePermissions(clientUser, companyId);

                if (res.success) {
                    const permissionsData = res.permissions as JsonObject;
                    setPermissions(permissionsData);
                    setRole(res.role);
                    setIsPermissionAvailable(!!permissionsData?.[permissionTag]);
                } else {
                    setError(res.error);
                    setPermissions(null);
                }
            } catch (err) {
                setError('Failed to fetch company or permissions');
                console.error('Error in fetching user permissions:', err);
            } finally {
                setIsLoading(false);
            }
        };

        checkPermissions();
    }, [clientUser, companyId, permissionTag]);

    return { permissions, isPermissionAvailable, isLoading, error, role };
}