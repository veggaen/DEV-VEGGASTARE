'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Company, Employee, User, WarehouseLocation } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { MyNewEmployeeForm } from '@/components/uicustom/company/form/new-employee-form';
import { RemoveEmployeeButton } from '@/components/uicustom/company/remove-employee-btn';
import { useCurrentUser } from '@/hooks/use-current-user';
import EditEmployee from '@/components/uicustom/company/edit-employee-permission';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import DeleteCompanyBtn from '@/components/uicustom/company/delete-company-btn';
import { EmployeePermissions } from '@/actions/edit-company-employee-permission';
import { format } from 'date-fns';
import { AiOutlineMail, AiOutlineUser } from 'react-icons/ai';
import { MdWork } from 'react-icons/md';

export interface ExtendedEmployee extends Employee {
    user: User; // Extending with custom properties
    permissions: { [key: string]: any | EmployeePermissions}; // Explicitly define permissions type
}

export interface ExtendedCompany extends Company {
    creator: User; // Extending with custom properties
    owner: User; // Extending with custom properties
    employees: ExtendedEmployee []; // Extending with custom properties
    warehouseLocations?: WarehouseLocation[]; // Extending with custom properties
}

export interface TagReplacement {
  name: string;
  description: string;
}

const CompanyDetails = () => {
  const params = useParams();
  const clientUser = useCurrentUser();
  const [change, setChange] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [company, setCompany] = useState<ExtendedCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<{ [key: string]: string | null }>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<ExtendedEmployee | null>();

  const tagReplacements: { [key: string]: TagReplacement } = {
    CAN_REMOVE_EMPLOYEE: {
      name: 'Can Remove Employee', 
      description: 'Allows the user to remove employees within the company.' 
    },
    CAN_EDIT_PERMISSION: {
      name: 'Can Edit Permission', 
      description: 'Allows the user to edit permissions of employees within the company.' 
    },
    CAN_DELETE_COMPANY: {
      name: 'Can Delete Company',
      description: 'Allows the user to delete the company.'
    },
    CAN_POST_PRODUCT_POSITION_PERMISSION: {
      name: 'Can Post Product Position', 
      description: 'Allows the user to post products on behalf of the company.' 
    },
    CAN_ADD_EMPLOYEE: {
      name: 'Can Add Employee', 
      description: 'Allows the user to add new employees to the company.' 
    },
    // Add more mappings as needed
  };

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      try {
        const response = await fetch(`/api/companies/${params.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch company details");
        }
        const data = await response.json();
        setCompany(data);
      } catch (error) {
        console.error("Error fetching company details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchCompanyDetails();
    }
  }, [params.id, change]);

  if (loading) return <div>Loading...</div>;
  if (!company) return <div>Company not found.</div>;

  const handleSuccess = (removedUserId: string) => {
    setCompany((prevCompany) => {
      if (!prevCompany) return null;

      // Filter out the removed employee
      const updatedEmployees = prevCompany.employees.filter(
        (employee) => employee.userId !== removedUserId
      );

      // Return the updated company state
      return { ...prevCompany, employees: updatedEmployees };
    });
  };

  const updateErrorMessage = (userId: string, message: string | null) => {
    setErrorMessages((prevErrorMessages) => ({
      ...prevErrorMessages,
      [userId]: message,
    }));
  };

  const handleNewEmployee = (newEmployee: ExtendedEmployee) => {
    setCompany((prevCompany) => {
      if (!prevCompany) return null;
      // Add the new employee to the current list
      const updatedEmployees = [...prevCompany.employees, newEmployee];
      // Return the updated company state
      return { ...prevCompany, employees: updatedEmployees };
    });
    
    console.log("Employee was added. Refreshing list...");
  };

  const handleEmployeeClick = (employee: ExtendedEmployee) => {
    setSelectedEmployee(employee);
    setSelectedEmployeeId(employee.id);
  };

  const sortedEmployees = company.employees.slice().sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Get permissions of the current user in the company
  const currentUserPermissions = company.employees.find(employee => employee.userId === clientUser?.id)?.permissions;

  // form date
  const formatDate = (date: Date) => {
    return format(new Date(date), 'MMMM d, yyyy');
  };


  return (
    <div className="w-full md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="w-full mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {company.logo && (
            <div className="relative w-full h-[720px]">
              <Image src={company.logo[0]} layout="fill" objectFit="cover" alt={`${company.name} logo`} />
            </div>
          )}
          <div className="p-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold dark:text-white mb-4">{company.name}</h1>
              {company.ownerId === clientUser?.id && (
                <DeleteCompanyBtn
                  companyId={company.id}
                  companyName={company.name}
                  onCompanyDeleted={() => handleSuccess(company.id)}
                  employeePermissions={currentUserPermissions}
                />
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4 truncate">{company.description}</p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Website: <a href={company.websiteUrl ?? ''} className="text-blue-600 hover:underline">{company.websiteUrl ?? 'No URL provided'}</a>
            </p>
            <div className="grid grid-cols-2 gap-6">
              <p className="text-gray-700 dark:text-gray-300">Company ID: {company.id || 'N/A'}</p>
              <p className="text-gray-700 dark:text-gray-300">Company Creator: {company.creator.name || 'N/A'}</p>
              <p className="text-gray-700 dark:text-gray-300">Company Owner: {company.owner.name || 'N/A'}</p>
              <p className="text-gray-700 dark:text-gray-300">Color Scheme: {company.colorScheme || 'N/A'}</p>
              <p className="text-gray-700 dark:text-gray-300">Uses Shipping: {company.usesShipping ? 'Yes' : 'No'}</p>
              <p className="text-gray-700 dark:text-gray-300">Created At: {new Date(company.createdAt).toLocaleDateString()}</p>
              <p className="text-gray-700 dark:text-gray-300">Last Updated: {new Date(company.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
          {company.usesShipping && company.warehouseLocations && company.warehouseLocations.length > 0 && (
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold dark:text-white mb-4">Warehouse Locations</h2>
              <ul className="list-disc pl-5">
                {company.warehouseLocations.map((location, index) => (
                  <li key={index} className="mb-2 text-gray-700 dark:text-gray-300">
                    {location.address}, {location.city}, {location.country}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {company.employees && company.employees.length > 0 && (
            <div className="p-2 md:p-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold dark:text-white mb-4">Employees</h2>
              <div className={`flex flex-col sm:grid sm:grid-flow-row sm:grid-cols-2 xl:grid-cols-3 auto-rows-max justify-center gap-4 dark:bg-black/10 bg-black/10 px-4 py-4 rounded-lg`}>
                {sortedEmployees.map((employee) => (
                  <div key={employee.id} className={`flex dark:bg-black/20 w-full bg-black/20 border dark:border-black/30 border-black/30 p-3 rounded-lg even:bg-black/20 odd:bg-black/20 dark:even:bg-gray-500/20 dark:odd:bg-gray-400/20`}>
                      <div className="flex flex-col justify-between gap-2 w-full dark:text-gray-300 text-gray-50">
                        <div className='flex flex-col gap-2'>
                          <div className="relative w-full flex justify-center items-center p-4">
                            {employee.user.image ?
                            <Image src={employee.user.image} width={80} height={80} className="rounded-[50%]" alt={`${company.name} logo`} />
                              :
                            <Image src='/users/avatar.webp' width={80} height={80} className="rounded-[50%]" alt={`${company.name} logo`} />
                            }
                          </div>
                          <div className='w-full flex flex-col justify-between items-center gap-4 dark:bg-black/20 bg-black/20 border dark:border-black/30 border-black/30 px-4 py-2 rounded-lg'>
                            <div className='flex items-center justify-between w-full'>
                              <p className='font-semibold flex items-center gap-1'><AiOutlineUser className="text-xl" />Name</p><p className='text-end bg-gray-500/20 p-2 rounded'>{employee.user.name}</p>
                            </div>
                            <div className='flex items-center justify-between w-full'>
                              <p className='font-semibold flex items-center gap-1'><AiOutlineMail className="text-xl" />Email</p><p className='text-end bg-gray-500/20 p-2 rounded'>{employee.user.email}</p>
                            </div>
                            <div className='flex items-center justify-between w-full'>
                              <p className='font-semibold flex items-center gap-1'><MdWork className="text-xl" />Role</p><p className='text-end bg-gray-500/20 p-2 rounded'>{employee.role}</p>
                            </div>
                            <div className='flex flex-col w-full'>
                              <p className='font-semibold'>Permissions</p>
                              <div className="flex flex-col gap-1">
                                {Object.keys(employee.permissions).length === 0 ? (
                                  <div className="w-full flex justify-between items-center bg-gray-500/10 p-2 rounded dark:text-gray-300 text-gray-50">
                                    <p className="">Permissions</p>
                                    <p className={`p-1 rounded text-center min-w-12 bg-red-500/20`}>N/A</p>
                                  </div>
                                ) : (
                                  Object.entries(employee.permissions).map(([key, value]) => {
                                    const tag = tagReplacements[key] || { name: key, description: '' }; // Get the custom tag name or use the original key
                                    return (
                                      <div key={key} className="w-full flex justify-between items-center gap-2 bg-gray-500/10 p-2 rounded dark:text-gray-300 text-gray-50" title={tag.description}>
                                        <p className="" title={tag.description}>{tag.name}</p>
                                        <p className={`p-1 rounded text-center min-w-12 ${value === true ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}> {value !== null && value !== undefined ? value.toString() : 'N/A'} </p>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                            <div className='flex items-center justify-between w-full'>
                              <p className='font-semibold text-nowrap'>Created at</p><p className='text-end bg-gray-500/20 p-2 rounded'>{formatDate(employee.createdAt).toLocaleString()}</p>
                            </div>
                            <div className='flex items-center justify-between w-full'>
                              <p className='font-semibold text-nowrap'>Updated at</p><p className='text-end bg-gray-500/20 p-2 rounded'>{formatDate(employee.updatedAt).toLocaleString()}</p>
                            </div>
                          </div>
                          
                        </div>
                        <div className=''>
                          {errorMessages[employee.userId] && (
                            <div className="text-red-500 dark:text-red-400">{errorMessages[employee.userId]}</div>
                          )}
                          {clientUser && (
                            <div className='flex gap-2 w-full' onClick={() => handleEmployeeClick(employee)} >
                                <EditEmployee
                                  clientUser={clientUser}
                                  company={company}
                                  selectedEmployee={selectedEmployee!!}
                                  setCompany={setCompany}
                                />
                              <RemoveEmployeeButton userId={employee.userId} companyId={company.id} onSuccess={handleSuccess} onError={(message) => updateErrorMessage(employee.userId, message)} />
                            </div>
                          )}
                        </div>
                      </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={`p-6 border-t border-gray-200 dark:border-gray-700`}>
            <h1 className='text-xl font-bold dark:text-white mb-4'>Add a new employee?</h1>
            <MyNewEmployeeForm companyId={company.id} handleNewEmployee={handleNewEmployee} change={ change } setChange={ setChange } />
          </div>
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <Link href="/settings/company">
              <div className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                Back to Companies
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyDetails;