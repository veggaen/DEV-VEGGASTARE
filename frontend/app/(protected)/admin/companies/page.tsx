'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  FiBriefcase, FiSearch, FiFilter, FiChevronLeft, FiChevronRight,
  FiEdit2, FiTrash2, FiEye, FiMoreVertical, FiCalendar, FiUsers,
  FiPackage, FiDollarSign, FiGlobe, FiHash
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

interface Company {
  id: string;
  name: string;
  description: string | null;
  logo: string[];
  orgNumber: string | null;
  orgType: string | null;
  createdAt: string;
  User_Company_ownerIdToUser: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  _count: {
    Employee: number;
    Product: number;
    Sale: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminCompaniesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Check auth
  useEffect(() => {
    if (status === 'loading') return;
    if (!session || (session.user?.role !== 'OWNER' && session.user?.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [session, status, router]);

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        sortBy,
        sortOrder,
      });

      const res = await fetch(`/api/admin/companies?${params}`);
      if (!res.ok) throw new Error('Failed to fetch companies');
      
      const data = await res.json();
      setCompanies(data.companies);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to load companies');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, sortBy, sortOrder]);

  useEffect(() => {
    if (session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN') {
      fetchCompanies();
    }
  }, [fetchCompanies, session?.user?.role]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(p => ({ ...p, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

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
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
              <FiBriefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Company Management
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {pagination.total} total companies
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
              placeholder="Search by name, org number, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Created Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
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

        {/* Companies Grid */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : companies.length === 0 ? (
            <div className="p-12 text-center">
              <FiBriefcase className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400">No companies found</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {companies.map((company, index) => (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 rounded-lg">
                      <AvatarImage src={company.logo?.[0]} />
                      <AvatarFallback className="rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {company.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {company.name}
                        </span>
                        {company.orgType && (
                          <Badge variant="outline" className="text-xs">
                            {company.orgType}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {company.orgNumber && (
                          <span className="flex items-center gap-1">
                            <FiHash className="h-3 w-3" />
                            {company.orgNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FiCalendar className="h-3 w-3" />
                          {formatDate(company.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Owner Info */}
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={company.User_Company_ownerIdToUser.image || undefined} />
                        <AvatarFallback className="text-xs">
                          {company.User_Company_ownerIdToUser.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-zinc-600 dark:text-zinc-300 truncate max-w-[120px]">
                        {company.User_Company_ownerIdToUser.name || company.User_Company_ownerIdToUser.email}
                      </span>
                    </div>

                    <div className="hidden lg:flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <FiUsers className="h-3 w-3" />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {company._count.Employee}
                          </span>
                        </div>
                        <span className="text-xs">Employees</span>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <FiPackage className="h-3 w-3" />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {company._count.Product}
                          </span>
                        </div>
                        <span className="text-xs">Products</span>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <FiDollarSign className="h-3 w-3" />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {company._count.Sale}
                          </span>
                        </div>
                        <span className="text-xs">Sales</span>
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
                          onClick={() => router.push(`/admin/companies/${company.id}`)}
                        >
                          <FiEye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/admin/companies/${company.id}/edit`)}
                        >
                          <FiEdit2 className="h-4 w-4 mr-2" />
                          Edit Company
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => window.open(`/company/${company.id}`, '_blank')}
                        >
                          <FiGlobe className="h-4 w-4 mr-2" />
                          View Public Page
                        </DropdownMenuItem>
                        {session?.user?.role === 'OWNER' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400"
                              onClick={() => {
                                toast.error('Delete functionality coming soon');
                              }}
                            >
                              <FiTrash2 className="h-4 w-4 mr-2" />
                              Delete Company
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
