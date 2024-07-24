"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Company, Employee, User, WarehouseLocation } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { MyNewEmployeeForm } from '@/components/uicustom/company/form/new-employee-form';
import { RemoveEmployeeButton } from '@/components/uicustom/company/remove-employee-btn';
import { useCurrentUser } from '@/hooks/use-current-user';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import DeleteCompanyBtn from '@/components/uicustom/company/delete-company-btn';
import { EmployeePermissions } from '@/actions/edit-company-employee-permission';
import { formatDistanceToNow } from 'date-fns';
import { MdAddCircleOutline, MdDelete, MdEdit, MdRemoveCircleOutline, MdPostAdd } from 'react-icons/md';
import ProgressBar from '@/components/bars/progress-bar';
import EditEmployeePermissionsModal from '@/components/uicustom/company/edit-employee-permission';
import { FaBriefcase } from 'react-icons/fa';

export interface ExtendedEmployee extends Employee {
    user: User;
    permissions: { [key: string]: any | EmployeePermissions };
}

export interface ExtendedCompany extends Company {
    creator: User;
    owner: User;
    employees: ExtendedEmployee[];
    warehouseLocations?: (WarehouseLocation & { inventory?: { quantity: number; stock: number }[] })[];
}

export interface TagReplacement {
    name: string;
    description: string;
    icon: JSX.Element;
}

interface Warehouse {
    id: string;
    address: string;
    city: string;
    country: string;
    initialStock: number;
    currentStock: number;
}

const rolePriority = {
    OWNER: 1,
    MANAGER: 2,
    STAFF: 3,
    USER: 4
};

const CompanyDetails = () => {
    const params = useParams();
    const clientUser = useCurrentUser();
    const [change, setChange] = useState(false);
    const [company, setCompany] = useState<ExtendedCompany | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessages, setErrorMessages] = useState<{ [key: string]: string | null }>({});
    const [selectedEmployee, setSelectedEmployee] = useState<ExtendedEmployee | null>(null);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    const tagReplacements: { [key: string]: TagReplacement } = {
        CAN_REMOVE_EMPLOYEE: { name: 'Can Remove Employee', description: 'Allows the user to remove employees within the company.', icon: <MdRemoveCircleOutline className="text-xl h-8 w-8" /> },
        CAN_EDIT_PERMISSION: { name: 'Can Edit Permission', description: 'Allows the user to edit permissions of employees within the company.', icon: <MdEdit className="text-xl h-8 w-8" /> },
        CAN_DELETE_COMPANY: { name: 'Can Delete Company', description: 'Allows the user to delete the company.', icon: <MdDelete className="text-xl h-8 w-8" /> },
        CAN_POST_PRODUCT_POSITION_PERMISSION: { name: 'Can Post Product Position', description: 'Allows the user to post products on behalf of the company.', icon: <MdPostAdd className="text-xl h-8 w-8" /> },
        CAN_EDIT_PRODUCT_POSITION_PERMISSION: { name: 'Can Edit Product Position', description: 'Allows the user to edit products on behalf of the company.', icon: <MdEdit className="text-xl h-8 w-8" /> },
        CAN_ADD_EMPLOYEE: { name: 'Can Add Employee', description: 'Allows the user to add new employees to the company.', icon: <MdAddCircleOutline className="text-xl h-8 w-8" /> },
        CAN_EDIT_EMPLOYEE_ROLE: { name: 'Can Edit Employee Role', description: 'Allows the user to edit employees role in the company.', icon: <FaBriefcase className="text-xl h-8 w-8" /> },
    };

    const fetchCompanyDetails = useCallback(async () => {
        if (!params.companyId) return;
        try {
            const response = await fetch(`/api/companies/${params.companyId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch company details');
            }
            const data = await response.json();
            console.log('Fetched company details:', data); // Debug log
            setCompany(data);
        } catch (error) {
            console.error('Error fetching company details:', error);
        } finally {
            setLoading(false);
        }
    }, [params.companyId]);

    useEffect(() => {
        if (params.companyId) {
            fetchCompanyDetails();
            const companyInterval = setInterval(() => {
                fetchCompanyDetails(); // Fetch company details every 30 minutes
            }, 1800000); // 30 minutes

            return () => clearInterval(companyInterval);
        }
    }, [params.companyId, change, fetchCompanyDetails]);

    const fetchWarehouseData = useCallback(async () => {
        if (!params.companyId) return;
        try {
            const response = await fetch(`/api/companies/${params.companyId}/warehouses/stock`);
            if (!response.ok) {
                throw new Error('Failed to fetch warehouse data');
            }
            const data = await response.json();
            setWarehouses(data.warehouses);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching warehouse data:', error);
        }
    }, [params.companyId]);

    useEffect(() => {
        fetchWarehouseData(); // Initial fetch
        const warehouseInterval = setInterval(() => {
            fetchWarehouseData(); // Fetch warehouse data every 30 seconds
        }, 300000); // 30 seconds

        return () => clearInterval(warehouseInterval);
    }, [params.companyId, fetchWarehouseData]);

    if (loading) return <div className="text-center py-4">Loading...</div>;
    if (!company) return <div className="text-center py-4">Company not found.</div>;

    const handleSuccess = (removedUserId: string) => {
        setCompany(prevCompany => {
            if (!prevCompany) return null;
            const updatedEmployees = prevCompany.employees.filter(employee => employee.userId !== removedUserId);
            return { ...prevCompany, employees: updatedEmployees };
        });
    };

    const updateErrorMessage = (userId: string, message: string | null) => {
        setErrorMessages(prevErrorMessages => ({
            ...prevErrorMessages,
            [userId]: message,
        }));
    };

    const handleNewEmployee = (newEmployee: ExtendedEmployee) => {
        setCompany(prevCompany => {
            if (!prevCompany) return null;
            const updatedEmployees = [...prevCompany.employees, newEmployee];
            return { ...prevCompany, employees: updatedEmployees };
        });
        console.log('Employee was added. Refreshing list...');
    };

    const handleEmployeeClick = (employee: ExtendedEmployee) => {
        setSelectedEmployee(employee);
    };

    const sortedEmployees = company.employees.slice().sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const sortedEmployeesRole = company.employees.slice().sort((a, b) => {
        return rolePriority[a.role] - rolePriority[b.role];
    });

    const currentUserPermissions = company.employees.find(employee => employee.userId === clientUser?.id)?.permissions;

    const formatDate = (date: Date) => {
        return formatDistanceToNow(new Date(date), { addSuffix: true });
    };

    return (
      <div className="w-full bg-gray-100 dark:bg-gray-900">
        <div className="relative w-full mx-auto max-w-7xl sm:px-4 md:px-6 lg:px-8 md:py-4">
          <div className="bg-white dark:bg-gray-800 md:rounded-lg shadow-md overflow-hidden">
            {company.bannerImage && (
            <div className="relative w-full">
              <AspectRatio ratio={3 / 1}>
                <Image 
                  src={company.bannerImage[0]} 
                  layout="fill" 
                  objectFit="cover" 
                  alt={`${company.name} banner`} 
                  className="object-cover" 
                />
              </AspectRatio>
              <div className="absolute inset-0 flex md:flex-col items-center justify-evenly md:justify-center p-4 text-center bg-black bg-opacity-50 z-10">
                {company.logo && (
                  <div className="relative w-24 h-24 md:mb-4">
                    <AspectRatio ratio={1 / 1}>
                      <Image 
                        src={company.logo[0]} 
                        layout="fill" 
                        objectFit="cover" 
                        alt={`${company.name} logo`} 
                        className="rounded-full border-4 border-gray-200 dark:border-gray-700" 
                      />
                    </AspectRatio>
                  </div>
                )}
                <h1 className="sm:text-lg md:text-xl lg:text-4xl font-extrabold text-white mb-4">{company.name}</h1>
                {company.ownerId === clientUser?.id && (
                  <div>
                    <DeleteCompanyBtn
                      companyId={company.id}
                      companyName={company.name}
                      onCompanyDeleted={() => handleSuccess(company.id)}
                      employeePermissions={currentUserPermissions as EmployeePermissions}
                    />
                  </div>
                )}
              </div>
            </div>
            )}
            <div className="bg-gray-50 dark:bg-slate-800 px-4 py-2">
              <div className="mb-8">
                <p className="text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white mb-4">Description</p>
                <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300 mb-6">{company.description}</p>
                <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300 mb-6">
                  Website: <Link href={company.websiteUrl ?? ''} className="text-blue-600 hover:underline">{company.websiteUrl ?? 'No URL provided'}</Link>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Company ID:</p>
                  <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.id || 'N/A'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Company Creator:</p>
                  <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.creator.name || 'N/A'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Company Owner:</p>
                  <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.owner.name || 'N/A'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Color Scheme:</p>
                  <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.colorScheme || 'N/A'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Uses Shipping:</p>
                  <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.usesShipping ? 'Yes' : 'No'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Created At:</p>
                  <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{formatDate(company.createdAt)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Last Updated:</p>
                  <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{formatDate(company.updatedAt)}</p>
                </div>
              </div>
              {company.usesShipping && company.warehouseLocations && company.warehouseLocations.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 mt-2">
              <div className='flex justify-start items-center w-full h-10'>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Warehouse Locations:</h2>
                  </div>
                  <ul className="space-y-6">
                    {warehouses.map((warehouseLocation, index) => {
                      console.log(`Warehouse ${index + 1}: Initial Total Stock: ${warehouseLocation.initialStock}, Current Total Stock: ${warehouseLocation.currentStock}`); // Debug log
                        
                      return (
                        <li 
                          key={index} 
                          className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                        >
                          <p className="text-gray-700 dark:text-gray-300 text-lg mb-2">
                            {warehouseLocation.address}, {warehouseLocation.city}, {warehouseLocation.country}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 mb-2">
                            Initial Stock: <span className="font-semibold">{warehouseLocation.initialStock || 'N/A'}</span>
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Current Stock: <span className="font-semibold">{warehouseLocation.currentStock || 'N/A'}</span>
                          </p>
                          {/* Add the overall progress bar */}
                          <ProgressBar value={warehouseLocation.currentStock} max={warehouseLocation.initialStock} />
                          <Link href={`/nexus/company/${company.id}/warehouse/${warehouseLocation.id}`} className="mt-2 text-blue-600 hover:underline">View Inventory</Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {company.employees && company.employees.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 mt-2">
                  <div className='flex justify-start items-center w-full h-10'>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Employees:</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedEmployeesRole.map((employee) => (
                      <div 
                          key={employee.id} 
                          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex-1 min-w-0">
                            <div className='flex gap-2'>
                              <div className="flex-shrink-0">
                                {employee.user.image ? (
                                  <Image 
                                    src={employee.user.image} 
                                    width={80} 
                                    height={80} 
                                    className="rounded-full" 
                                    alt={`${employee.user.name} avatar`} 
                                  />
                                ) : (
                                  <Image 
                                    src="/users/avatar.webp" 
                                    width={80} 
                                    height={80} 
                                    className="rounded-full" 
                                    alt="Default avatar" 
                                  />
                                )}
                              </div>
                              <div>
                                <div className="text-lg font-semibold text-gray-900 dark:text-white">{employee.user.name}</div>
                                <p className="text-gray-600 dark:text-gray-400">{employee.user.email}</p>
                                <p className="text-gray-600 dark:text-gray-400">{employee.role}</p>
                              </div>
                            </div>
                            <div className="mt-2">
                              <p className="font-semibold">Permissions</p>
                              <div className="space-y-2">
                                {Object.keys(employee.permissions).length === 0 ? (
                                    <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded text-center text-gray-500 dark:text-gray-400">No permissions</div>
                                ) : (
                                  Object.entries(employee.permissions).map(([key, value]) => {
                                    const tag = tagReplacements[key] || { name: key, description: '', icon: null };
                                    return (
                                      <div 
                                          key={key} 
                                          className="flex justify-between items-center bg-gray-200 dark:bg-gray-700 p-2 rounded"
                                      >
                                        <div className="flex items-center space-x-2">
                                          {tag.icon}
                                          <p>{tag.name}</p>
                                        </div>
                                        <p className={`px-2 py-1 rounded ${value === true ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                          {value !== null && value !== undefined ? value.toString() : 'N/A'}
                                        </p>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                            <div className="mt-4 text-gray-600 dark:text-gray-400">
                              <div className="flex justify-between">
                                <span className="font-semibold">Created At</span>
                                <span>{formatDate(employee.createdAt)}</span>
                              </div>
                              <div className="flex justify-between mt-2">
                                <span className="font-semibold">Updated At</span>
                                <span>{formatDate(employee.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          {errorMessages[employee.userId] && (
                            <div className="text-red-500 dark:text-red-400">{errorMessages[employee.userId]}</div>
                          )}
                          {clientUser && (
                          <div className='flex gap-2 w-full' onClick={() => handleEmployeeClick(employee)}>
                            <EditEmployeePermissionsModal 
                              clientUser={clientUser} 
                              company={company} 
                              selectedEmployee={selectedEmployee!!} 
                              setCompany={setCompany} 
                            />
                            <RemoveEmployeeButton
                              userId={employee.userId}
                              companyId={company.id}
                              onSuccess={handleSuccess}
                              onError={(message) => updateErrorMessage(employee.userId, message)}
                            />
                          </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add a New Employee</h1>
                <MyNewEmployeeForm 
                  companyId={company.id} 
                  handleNewEmployee={handleNewEmployee} 
                  change={change} 
                  setChange={setChange} 
                />
              </div>
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <Link 
                  href="/nexus/company" 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Back to Companies
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
};

export default CompanyDetails;