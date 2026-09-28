export const AUDIT_ACTIONS = ['VIEW', 'EDIT', 'DELETE', 'CREATE', 'ROLE_CHANGE', 'VERIFY', 'SUSPEND', 'UNSUSPEND', 'IMPERSONATE', 'EXPORT'] as const;
export const AUDIT_TARGETS = ['USER', 'COMPANY', 'EMPLOYEE', 'PRODUCT', 'ORDER', 'CONVERSATION', 'WAREHOUSE', 'POLL', 'RUNTIME_CONFIG'] as const;
export const auditLabel = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, first => first.toUpperCase());
export interface AuditEntry {
  id: string; adminId: string; action: string; targetType: string; targetId: string;
  reason: string | null; createdAt: string;
  admin: { id: string; name: string | null; email: string | null; image: string | null };
}
export interface AuditDetail extends AuditEntry {
  previousData: unknown; newData: unknown; ipAddress: string | null; userAgent: string | null;
}
export interface AuditPage {
  logs: AuditEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
