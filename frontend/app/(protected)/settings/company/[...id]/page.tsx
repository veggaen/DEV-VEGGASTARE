// frontend\app\(protected)\settings\company\[...id]\page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Company, Employee, User, WarehouseLocation } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { MyNewEmployeeForm } from '@/components/uicustom/company/form/new-employee-form';
import { RemoveEmployeeButton } from '@/components/uicustom/company/remove-employee-btn';
import { useCurrentUser } from '@/hooks/use-current-user';
import Modal from '@/components/uicustom/my-modal';
import EditEmployeePermissionsForm from '@/components/uicustom/company/edit-employee-permission';
import EditEmployee from '@/components/uicustom/company/edit-employee-permission';
import { Button } from '@/components/ui/button';

export interface ExtendedEmployee extends Employee {
    user: User; // Extending with custom properties
}

interface ExtendedCompany extends Company {
    creator: User; // Extending with custom properties
    owner: User; // Extending with custom properties
    employees: ExtendedEmployee []; // Extending with custom properties
    warehouseLocations?: WarehouseLocation[]; // Extending with custom properties
}

const CompanyDetails = () => {
  const params = useParams();
  const user = useCurrentUser();
  const [change, setChange] = useState(false)
  const [isAddingEmployee, setIsAddingEmployee] = useState(false)
  const [company, setCompany] = useState<ExtendedCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  // State hooks and effects to fetch company details
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  

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

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900">
  <div className="max-w-4xl mx-auto">
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {company.logo && (
        <div className="relative w-full h-56">
          <Image src={company.logo[0]} layout="fill" objectFit="cover" alt={`${company.name} logo`} />
        </div>
      )}
      <div className="p-6">
        <h1 className="text-3xl font-bold dark:text-white mb-4">{company.name}</h1>
        <p className="text-gray-700 dark:text-gray-300 mb-4">{company.description}</p>
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
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold dark:text-white mb-4">Employees</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 dark:bg-black/10 bg-black/10 px-4 py-4 rounded-lg">
            {company.employees.map((employee) => (
              <div key={employee.id} className='flex justify-start items-start h-full dark:bg-black/20 bg-black/20 border dark:border-black/30 border-black/30 px-4 py-2 rounded-lg mb-4'>

                <li className="py-4 flex justify-between items-center w-full">
                  <div className="w-full flex flex-col gap-2 px-4 text-gray-700 dark:text-gray-300 ">
                <div className="relative w-full flex justify-center items-center p-4">
                  {employee.user.image ?
                  <Image src={employee.user.image} width={80} height={80} className="rounded-[50%]" alt={`${company.name} logo`} />
                    :
                  <Image src='/users/avatar.webp' width={80} height={80} className="rounded-[50%]" alt={`${company.name} logo`} />
                  }
                  
                </div>
                    <div className='w-full flex justify-between gap-4 dark:bg-black/20 bg-black/20 border dark:border-black/30 border-black/30 px-4 py-2 rounded-lg'><p>Name:</p><p>{employee.user.name}</p></div>
                    <div className='w-full flex justify-between gap-4 dark:bg-black/20 bg-black/20 border dark:border-black/30 border-black/30 px-4 py-2 rounded-lg'><p>Email:</p><p>{employee.user.email}</p></div>
                    <div className='w-full flex justify-between gap-4 dark:bg-black/20 bg-black/20 border dark:border-black/30 border-black/30 px-4 py-2 rounded-lg'><p>Role:</p><p>{employee.user.role}</p></div>
                    <div className='w-full flex justify-between gap-4 dark:bg-black/20 bg-black/20 border dark:border-black/30 border-black/30 px-4 py-2 rounded-lg'><p>Permissions:</p><p>{JSON.stringify(employee.permissions)}</p></div>
                  {user && (
                    <div className='flex gap-2 w-full'>
                        <EditEmployee
                          selectedEmployee={employee as ExtendedEmployee}
                          isOpen={isEditModalOpen}
                          onClose={() => setIsEditModalOpen(false)}
                        />
                      <RemoveEmployeeButton userId={employee.userId} companyId={company.id} onSuccess={handleSuccess} onError={(error) => console.error(error)} />
                    </div>
                  )}
                  </div>
                </li>
              </div>
            ))}
          </ul>
        </div>
      )}
      <div className={`p-6 border-t border-gray-200 dark:border-gray-700`}>
        
          <MyNewEmployeeForm companyId={company.id} handleNewEmployee={handleNewEmployee} change={ change } setChange={ setChange } />
        {/* {isAddingEmployee ? <div>
          <div onClick={() => {setIsAddingEmployee(!isAddingEmployee)}}>Cancel</div>
        </div> : <div onClick={() => {setIsAddingEmployee(!isAddingEmployee)}}>Add Employee btn</div>} */}
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