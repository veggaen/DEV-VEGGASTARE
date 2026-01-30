import { fetchUserEmployeePermissions } from '@/actions/user-company-permissions';
import { useState, useEffect } from 'react';
import { Prisma } from '@prisma/client';

type JsonValue = Prisma.JsonValue;
type JsonObject = Prisma.JsonObject;

interface UsePermissionResult {
  permissions: JsonObject | null;
  isPermissionAvailable: boolean;
  isLoading: boolean;
  error: string;
}

export function useCurrentUserEmployeeCheckPermission(clientUser: any, companyId: string, permissionTag: string): UsePermissionResult {
    const [permissions, setPermissions] = useState<JsonObject | null>(null);
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
                const permissionsResponse: JsonValue | Response = await fetchUserEmployeePermissions(clientUser, companyId);

                if (typeof permissionsResponse === 'object' && permissionsResponse !== null && !('status' in permissionsResponse)) {
                    const permissionsData = permissionsResponse as JsonObject;
                    setPermissions(permissionsData);
                    setIsPermissionAvailable(!!permissionsData?.[permissionTag]);
                } else {
                    setError('Invalid response type for permissions');
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

    return { permissions, isPermissionAvailable, isLoading, error };
}