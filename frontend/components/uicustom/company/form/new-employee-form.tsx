'use client';

import React, { useState, useRef, useCallback, useEffect, startTransition } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmployeeRole, User, UserRole } from '@prisma/client';
import { employeeSchema } from '@/schemas';
import { MyAddEmployeeAction } from '@/actions/create-company-employee';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { ExtendedEmployee } from '@/lib/types/company-management';


interface MyNewEmployeeFormProps {
  companyId: string;
  handleNewEmployee?: (newEmployee: ExtendedEmployee) => void; // Correctly typed
  change: boolean;
  setChange: React.Dispatch<React.SetStateAction<boolean>>;
}

export const MyNewEmployeeForm: React.FC<MyNewEmployeeFormProps> = ({
  companyId,
  handleNewEmployee,
  setChange,
  change,
}) => {
  const clientUser = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(employeeSchema),
  });

  useEffect(() => {
    const fetchUsers = async () => {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data);
    };

    fetchUsers();
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleUserSelect = useCallback((user: User) => {
    setSearchTerm(user.name || '');
    setSelectedUser(user);
    setValue('userId', user.id);
    setShowDropdown(false);
  }, [setValue]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setShowDropdown(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [handleClickOutside]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setShowDropdown(true);
    //setShowDropdown((prevShowDropdown) => !prevShowDropdown);
    setHighlightedIndex(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (highlightedIndex === null) {
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prevIndex) => (prevIndex !== null && prevIndex < users.length - 1 ? prevIndex + 1 : 0));
      }
    } else if (event.key === 'ArrowUp') { // Add handling for ArrowUp key
      event.preventDefault();
      if (highlightedIndex === null) {
        setHighlightedIndex(users.length - 1);
      } else {
        setHighlightedIndex((prevIndex) => (prevIndex !== null && prevIndex > 0 ? prevIndex - 1 : users.length - 1));
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex !== null) {
        handleUserSelect(users[highlightedIndex]);
      } else if (users.length > 0) {
        handleUserSelect(users[0]);
      }
    }
  };

  const forceReset = () => {
    reset();
    setSearchTerm('');
    setSelectedUser(null);
  };

  if (isLoading) {
    console.log('Adding new user to company... Loading...');
  }

  const onSubmit: SubmitHandler<Record<string, any>> = async (data) => {
    const formData = { ...data, companyId, clientUser };

    startTransition(() => {
      setIsLoading(true);
      MyAddEmployeeAction(formData)
        .then((data) => {
          if ('error' in data) {
            setError(data.error)
          }
          if (data.success) {
            setSuccess(data.message || '');
            setChange(!change);
            forceReset();
          }
          setTimeout(() => {
            setSuccess('');
            setError('');
          }, 30000);
        })
        .catch((error) => {
          console.error('Unexpected error occurred while adding employee:', error);
          setError('An unexpected error occurred');
        })
        .finally(() => {
          setIsLoading(false);
        });
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 border border-black/10 bg-white/40 p-5 backdrop-blur-sm transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] rounded-lg hover:rounded-2xl"
    >
      <div className="relative">
        <label htmlFor="userSearch" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          Search user
        </label>
        <input
          id="userSearch"
          type="text"
          ref={searchInputRef}
          placeholder="Type a name…"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="mt-1 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-slate-900 outline-none transition-[border-radius,box-shadow] focus:ring-2 focus:ring-sky-500/30 dark:border-white/10 dark:bg-slate-900 dark:text-white hover:rounded-2xl"
        />
        {showDropdown && searchTerm && (
          <div
            ref={dropdownRef}
            className="absolute z-10 mt-2 w-full overflow-auto rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-slate-950 max-h-[160px]"
          >
            {users
              .filter((user) => user.name?.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((user, index) => (
                <div
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className={
                    "cursor-pointer px-3 py-2 text-sm text-slate-900 hover:bg-black/5 dark:text-white dark:hover:bg-white/[0.06] " +
                    (highlightedIndex === index ? "bg-black/5 dark:bg-white/[0.06]" : "")
                  }
                >
                  {user.name}
                </div>
              ))}
            {users.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No users found</div>
            )}
          </div>
        )}
      </div>

      {selectedUser ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Selected</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{selectedUser.name}</p>
          </div>

          <div>
            <label htmlFor="roleSelect" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Role
            </label>
            <select
              id="roleSelect"
              {...register('role')}
              className="mt-1 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-slate-900 outline-none transition-[border-radius,box-shadow] focus:ring-2 focus:ring-sky-500/30 dark:border-white/10 dark:bg-slate-900 dark:text-white hover:rounded-2xl"
            >
              {Object.values(EmployeeRole).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {errors.role && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{`${errors.role.message}`}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="jobTitle" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Job title (optional)
            </label>
            <input
              id="jobTitle"
              type="text"
              placeholder="e.g. Operations Lead"
              {...register('jobTitle')}
              className="mt-1 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-slate-900 outline-none transition-[border-radius,box-shadow] focus:ring-2 focus:ring-sky-500/30 dark:border-white/10 dark:bg-slate-900 dark:text-white hover:rounded-2xl"
            />
          </div>
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}
      {success ? <div className="text-sm text-emerald-700 dark:text-emerald-300">{success}</div> : null}

      <button
        type="submit"
        disabled={!selectedUser || isLoading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-[border-radius,background-color,opacity] hover:bg-slate-800 hover:rounded-2xl disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
      >
        {isLoading ? 'Adding…' : 'Add Employee'}
      </button>
    </form>
  );
};