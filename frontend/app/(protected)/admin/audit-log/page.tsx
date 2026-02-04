'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  FiActivity, FiSearch, FiFilter, FiChevronLeft, FiChevronRight,
  FiUser, FiBriefcase, FiPackage, FiEdit2, FiTrash2, FiEye,
  FiShield, FiAlertTriangle, FiCalendar, FiClock, FiGlobe
} from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  reason: string | null;
  createdAt: string;
  admin: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const actionColors: Record<string, string> = {
  VIEW: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  EDIT: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
  CREATE: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  ROLE_CHANGE: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
  VERIFY: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  SUSPEND: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
  UNSUSPEND: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  IMPERSONATE: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
  EXPORT: 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
};

const actionIcons: Record<string, React.ReactNode> = {
  VIEW: <FiEye className="h-3 w-3" />,
  EDIT: <FiEdit2 className="h-3 w-3" />,
  DELETE: <FiTrash2 className="h-3 w-3" />,
  CREATE: <FiActivity className="h-3 w-3" />,
  ROLE_CHANGE: <FiShield className="h-3 w-3" />,
  VERIFY: <FiShield className="h-3 w-3" />,
  SUSPEND: <FiAlertTriangle className="h-3 w-3" />,
  UNSUSPEND: <FiShield className="h-3 w-3" />,
  IMPERSONATE: <FiUser className="h-3 w-3" />,
  EXPORT: <FiGlobe className="h-3 w-3" />,
};

const targetTypeIcons: Record<string, React.ReactNode> = {
  USER: <FiUser className="h-4 w-4" />,
  COMPANY: <FiBriefcase className="h-4 w-4" />,
  EMPLOYEE: <FiUser className="h-4 w-4" />,
  PRODUCT: <FiPackage className="h-4 w-4" />,
  ORDER: <FiPackage className="h-4 w-4" />,
  CONVERSATION: <FiActivity className="h-4 w-4" />,
  WAREHOUSE: <FiPackage className="h-4 w-4" />,
};

export default function AdminAuditLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Check auth - only OWNER can view audit log
  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user?.role !== 'OWNER') {
      router.push('/');
    }
  }, [session, status, router]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(actionFilter && { action: actionFilter }),
        ...(targetTypeFilter && { targetType: targetTypeFilter }),
      });

      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit log');
      
      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to load audit log');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, actionFilter, targetTypeFilter]);

  useEffect(() => {
    if (session?.user?.role === 'OWNER') {
      fetchLogs();
    }
  }, [fetchLogs, session?.user?.role]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
  };

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
              <FiActivity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Audit Log
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Track all admin actions • {pagination.total} total entries
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Actions</SelectItem>
              <SelectItem value="VIEW">View</SelectItem>
              <SelectItem value="EDIT">Edit</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="ROLE_CHANGE">Role Change</SelectItem>
              <SelectItem value="VERIFY">Verify</SelectItem>
              <SelectItem value="SUSPEND">Suspend</SelectItem>
            </SelectContent>
          </Select>
          <Select value={targetTypeFilter} onValueChange={(v) => { setTargetTypeFilter(v); setPagination(p => ({ ...p, page: 1 })); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Target Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="USER">User</SelectItem>
              <SelectItem value="COMPANY">Company</SelectItem>
              <SelectItem value="EMPLOYEE">Employee</SelectItem>
              <SelectItem value="PRODUCT">Product</SelectItem>
              <SelectItem value="ORDER">Order</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs List */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <FiActivity className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400">No audit logs found</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {logs.map((log, index) => {
                const { date, time } = formatDateTime(log.createdAt);
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={log.admin.image || undefined} />
                        <AvatarFallback className="bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          {log.admin.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {log.admin.name || log.admin.email || 'Unknown Admin'}
                          </span>
                          <Badge variant="outline" className={cn("text-xs", actionColors[log.action])}>
                            {actionIcons[log.action]}
                            <span className="ml-1">{log.action}</span>
                          </Badge>
                          <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            {targetTypeIcons[log.targetType]}
                            <span className="text-sm">{log.targetType}</span>
                          </span>
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-1">
                          Target ID: <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{log.targetId}</code>
                        </div>
                        {log.reason && (
                          <div className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                            Reason: "{log.reason}"
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                          <span className="flex items-center gap-1">
                            <FiCalendar className="h-3 w-3" />
                            {date}
                          </span>
                          <span className="flex items-center gap-1">
                            <FiClock className="h-3 w-3" />
                            {time}
                          </span>
                          {log.ipAddress && (
                            <span className="flex items-center gap-1">
                              <FiGlobe className="h-3 w-3" />
                              {log.ipAddress}
                            </span>
                          )}
                        </div>
                      </div>

                      {(log.previousData || log.newData) && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <FiEye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Badge variant="outline" className={actionColors[log.action]}>
                                  {log.action}
                                </Badge>
                                {log.targetType} Change Details
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              {log.previousData && (
                                <div>
                                  <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                                    Previous Data
                                  </h4>
                                  <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg overflow-x-auto">
                                    {JSON.stringify(log.previousData, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.newData && (
                                <div>
                                  <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                                    New Data
                                  </h4>
                                  <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg overflow-x-auto">
                                    {JSON.stringify(log.newData, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.userAgent && (
                                <div>
                                  <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                                    User Agent
                                  </h4>
                                  <p className="text-xs text-zinc-600 dark:text-zinc-300 break-all">
                                    {log.userAgent}
                                  </p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                >
                  <FiChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                  <FiChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
