'use client';

import React, { useState, useRef, useCallback, useEffect, startTransition } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmployeeRole, User, UserRole } from '@prisma/client';
import { employeeSchema } from '@/schemas';
import { MyAddEmployeeAction } from '@/actions/create-company-employee';
import { ExtendedEmployee } from '@/app/(protected)/nexus/company/[companyId]/page';
import { useCurrentUser } from '@/hooks/use-current-user';


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
          if (data.error) {
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="relative group">
        <div>{`${isLoading}`}</div>
        <label htmlFor="userSearch" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Search for a user</label>
        <input
          id="userSearch"
          type="text"
          ref={searchInputRef}
          placeholder="Search for a user..."
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          //onFocus={() => setShowDropdown(true)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        />
        {showDropdown && searchTerm && (
          <div ref={dropdownRef} className={`absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-[100px] overflow-auto`}>
            {users.filter(user =>
              user.name?.toLowerCase().includes(searchTerm.toLowerCase())
            ).map((user, index) => (
              <div
                key={user.id}
                onClick={() => handleUserSelect(user)}
                className={`px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${highlightedIndex === index ? 'bg-blue-100 dark:bg-blue-800' : ''}`}
              >
                {user.name}
              </div>
            ))}
            {users.length === 0 && <div className="px-4 py-2 text-gray-400 dark:text-gray-600">No users found</div>}
          </div>
        )}
      </div>

      {selectedUser && <div>
        <h1>Selected user: {selectedUser.name}</h1>
        <label htmlFor="roleSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Role</label>
        <select
          id="roleSelect"
          {...register('role')}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        >
          {Object.values(EmployeeRole).map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        {errors.role && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{`${errors.role.message}`}</p>}
      </div>}

      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
      {success && <div className="text-sm text-green-600 dark:text-green-400">{success}</div>}

      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Add Employee
      </button>
    </form>
  );
};