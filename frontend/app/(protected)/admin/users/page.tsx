'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  FiUsers, FiSearch, FiFilter, FiChevronLeft, FiChevronRight,
  FiEdit2, FiTrash2, FiShield, FiStar, FiEye, FiMoreVertical,
  FiMail, FiCalendar, FiCheckCircle, FiBriefcase, FiShoppingBag
} from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: 'OWNER' | 'ADMIN' | 'USER';
  verificationTier: string;
  verificationScore: number;
  createdAt: string;
  emailVerified: string | null;
  _count: {
    Company_Company_ownerIdToUser: number;
    Employee: number;
    Order: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Check auth
  useEffect(() => {
    if (status === 'loading') return;
    if (!session || (session.user?.role !== 'OWNER' && session.user?.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [session, status, router]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        sortBy,
        sortOrder,
        ...(roleFilter && { role: roleFilter }),
      });

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      
      const data = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to load users');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, roleFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN') {
      fetchUsers();
    }
  }, [fetchUsers, session?.user?.role]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(p => ({ ...p, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'ADMIN': return 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30';
      default: return 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/30';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
              <FiUsers className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                User Management
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {pagination.total} total users
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="search"
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Roles</SelectItem>
              <SelectItem value="OWNER">Owner</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="USER">User</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Join Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            title={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
          >
            <FiFilter className={cn(
              "h-4 w-4 transition-transform",
              sortOrder === 'asc' && "rotate-180"
            )} />
          </Button>
        </div>

        {/* Users Grid */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <FiUsers className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 ring-2 ring-zinc-100 dark:ring-zinc-800">
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {user.name || 'Unnamed User'}
                        </span>
                        <Badge variant="outline" className={cn("text-xs", getRoleBadgeColor(user.role))}>
                          {user.role === 'OWNER' && <FiStar className="h-3 w-3 mr-1" />}
                          {user.role === 'ADMIN' && <FiShield className="h-3 w-3 mr-1" />}
                          {user.role}
                        </Badge>
                        {user.emailVerified && (
                          <FiCheckCircle className="h-4 w-4 text-emerald-500" title="Email verified" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {user.email && (
                          <span className="flex items-center gap-1 truncate">
                            <FiMail className="h-3 w-3" />
                            {user.email}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FiCalendar className="h-3 w-3" />
                          {formatDate(user.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <FiBriefcase className="h-3 w-3" />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {user._count.Company_Company_ownerIdToUser}
                          </span>
                        </div>
                        <span className="text-xs">Companies</span>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <FiUsers className="h-3 w-3" />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {user._count.Employee}
                          </span>
                        </div>
                        <span className="text-xs">Employments</span>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <FiShoppingBag className="h-3 w-3" />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {user._count.Order}
                          </span>
                        </div>
                        <span className="text-xs">Orders</span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <FiMoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => router.push(`/admin/users/${user.id}`)}
                        >
                          <FiEye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                        >
                          <FiEdit2 className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => window.open(`/profile/${user.id}`, '_blank')}
                        >
                          <FiUsers className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        {session?.user?.role === 'OWNER' && user.role !== 'OWNER' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400"
                              onClick={() => {
                                // TODO: Implement delete confirmation modal
                                toast.error('Delete functionality coming soon');
                              }}
                            >
                              <FiTrash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
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
