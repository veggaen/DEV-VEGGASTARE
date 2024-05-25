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
import { MdWork, MdAddCircleOutline, MdDelete, MdEdit, MdRemoveCircleOutline, MdPostAdd } from 'react-icons/md';

export interface ExtendedEmployee extends Employee {
    user: User;
    permissions: { [key: string]: any | EmployeePermissions };
}

export interface ExtendedCompany extends Company {
    creator: User;
    owner: User;
    employees: ExtendedEmployee[];
    warehouseLocations?: WarehouseLocation[];
}

export interface TagReplacement {
    name: string;
    description: string;
    icon: JSX.Element;
}

const CompanyDetails = () => {
    const params = useParams();
    const clientUser = useCurrentUser();
    const [change, setChange] = useState(false);
    const [company, setCompany] = useState<ExtendedCompany | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessages, setErrorMessages] = useState<{ [key: string]: string | null }>({});
    const [selectedEmployee, setSelectedEmployee] = useState<ExtendedEmployee | null>();

    const tagReplacements: { [key: string]: TagReplacement } = {
        CAN_REMOVE_EMPLOYEE: { name: 'Can Remove Employee', description: 'Allows the user to remove employees within the company.', icon: <MdRemoveCircleOutline className="text-xl h-8 w-8" /> },
        CAN_EDIT_PERMISSION: { name: 'Can Edit Permission', description: 'Allows the user to edit permissions of employees within the company.', icon: <MdEdit className="text-xl h-8 w-8" /> },
        CAN_DELETE_COMPANY: { name: 'Can Delete Company', description: 'Allows the user to delete the company.', icon: <MdDelete className="text-xl h-8 w-8" /> },
        CAN_POST_PRODUCT_POSITION_PERMISSION: { name: 'Can Post Product Position', description: 'Allows the user to post products on behalf of the company.', icon: <MdPostAdd className="text-xl h-8 w-8" /> },
        CAN_ADD_EMPLOYEE: { name: 'Can Add Employee', description: 'Allows the user to add new employees to the company.', icon: <MdAddCircleOutline className="text-xl h-8 w-8" /> },
    };

    useEffect(() => {
        const fetchCompanyDetails = async () => {
            try {
                const response = await fetch(`/api/companies/${params.id}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch company details');
                }
                const data = await response.json();
                setCompany(data);
            } catch (error) {
                console.error('Error fetching company details:', error);
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
            const updatedEmployees = prevCompany.employees.filter((employee) => employee.userId !== removedUserId);
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

    const currentUserPermissions = company.employees.find((employee) => employee.userId === clientUser?.id)?.permissions;

    const formatDate = (date: Date) => {
        return format(new Date(date), 'MMMM d, yyyy');
    };

    return (
        <div className="w-full pt-6 md:p-8 bg-gray-50 dark:bg-gray-900">
            <div className="w-full mx-auto">
                <div className="bg-white dark:bg-gray-800 md:rounded-lg shadow overflow-hidden">
                    {company.bannerImage && (
                        <div className="relative w-full">
                            <AspectRatio ratio={3 / 1}>
                                <Image src={company.bannerImage[0]} layout="fill" objectFit="cover" alt={`${company.name} logo`} />
                            </AspectRatio>
                        </div>
                    )}
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            {company.logo && (
                                <div className="relative w-20 h-20">
                                    <AspectRatio ratio={1 / 1}>
                                        <Image src={company.logo[0]} layout="fill" objectFit="cover" alt={`${company.name} logo`} className="rounded-full" />
                                    </AspectRatio>
                                </div>
                            )}
                            {company.ownerId === clientUser?.id && (
                                <DeleteCompanyBtn
                                    companyId={company.id}
                                    companyName={company.name}
                                    onCompanyDeleted={() => handleSuccess(company.id)}
                                    employeePermissions={currentUserPermissions}
                                />
                            )}
                        </div>
                        <h1 className="text-3xl font-bold dark:text-white mb-2">{company.name}</h1>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">{company.description}</p>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Website: <a href={company.websiteUrl ?? ''} className="text-blue-600 hover:underline">{company.websiteUrl ?? 'No URL provided'}</a>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 dark:bg-black/10 bg-black/10 px-4 py-4 rounded-lg">
                                {sortedEmployees.map((employee) => (
                                    <div key={employee.id} className="flex dark:bg-black/20 bg-black/20 border dark:border-black/30 border-black/30 p-4 rounded-lg">
                                        <div className="flex flex-col justify-between gap-2 w-full dark:text-gray-300 text-gray-50">
                                            <div className="flex flex-col gap-2">
                                                <div className="relative w-full flex justify-center items-center p-4">
                                                    {employee.user.image ? (
                                                        <Image src={employee.user.image} width={80} height={80} className="rounded-full" alt={`${company.name} logo`} />
                                                    ) : (
                                                        <Image src="/users/avatar.webp" width={80} height={80} className="rounded-full" alt={`${company.name} logo`} />
                                                    )}
                                                </div>
                                                <div className="w-full flex flex-col justify-between items-center gap-4 dark:bg-black/20 bg-black/20 border dark:border-black/30 border-black/30 px-4 py-2 rounded-lg">
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-1">
                                                            <AiOutlineUser className="text-xl" />
                                                            <p className="hidden xs:block font-semibold">
                                                                Name
                                                            </p>
                                                        </div>
                                                        <p className="text-end bg-gray-500/20 p-2 rounded">{employee.user.name}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-1">
                                                            <AiOutlineMail className="text-xl" />
                                                            <p className="hidden xs:block font-semibold">
                                                                Email
                                                            </p>
                                                        </div>
                                                        <p className="text-end bg-gray-500/20 p-2 rounded">{employee.user.email}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-1">
                                                            <MdWork className="text-xl" />
                                                            <p className="hidden xs:block font-semibold">
                                                                Role
                                                            </p>
                                                        </div>
                                                        <p className="text-end bg-gray-500/20 p-2 rounded">{employee.role}</p>
                                                    </div>
                                                    <div className="flex flex-col w-full">
                                                        <p className="font-semibold">Permissions</p>
                                                        <div className="flex flex-col gap-1">
                                                            {Object.keys(employee.permissions).length === 0 ? (
                                                                <div className="w-full flex justify-between items-center bg-gray-500/10 p-2 rounded dark:text-gray-300 text-gray-50">
                                                                    <p className="">Permissions</p>
                                                                    <p className="p-1 rounded text-center min-w-12 bg-red-500/20">N/A</p>
                                                                </div>
                                                            ) : (
                                                                Object.entries(employee.permissions).map(([key, value]) => {
                                                                    const tag = tagReplacements[key] || { name: key, description: '', icon: null };
                                                                    return (
                                                                        <div key={key} className="w-full flex justify-between items-center gap-2 bg-gray-500/10 p-2 rounded dark:text-gray-300 text-gray-50" title={tag.description}>
                                                                            <p className="flex items-center gap-2" title={tag.description}>
                                                                                {tag.icon}
                                                                                {tag.name}
                                                                            </p>
                                                                            <p className={`p-1 rounded text-center min-w-12 ${value === true ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                                                                {value !== null && value !== undefined ? value.toString() : 'N/A'}
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between w-full">
                                                        <p className="font-semibold text-nowrap">Created at</p>
                                                        <p className="text-end bg-gray-500/20 p-2 rounded">{formatDate(employee.createdAt).toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between w-full">
                                                        <p className="font-semibold text-nowrap">Updated at</p>
                                                        <p className="text-end bg-gray-500/20 p-2 rounded">{formatDate(employee.updatedAt).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="">
                                                {errorMessages[employee.userId] && (
                                                    <div className="text-red-500 dark:text-red-400">{errorMessages[employee.userId]}</div>
                                                )}
                                                {clientUser && (
                                                    <div className="flex gap-2 w-full" onClick={() => handleEmployeeClick(employee)}>
                                                        <EditEmployee clientUser={clientUser} company={company} selectedEmployee={selectedEmployee!!} setCompany={setCompany} />
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
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                        <h1 className="text-xl font-bold dark:text-white mb-4">Add a new employee?</h1>
                        <MyNewEmployeeForm companyId={company.id} handleNewEmployee={handleNewEmployee} change={change} setChange={setChange} />
                    </div>
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                        <Link href="/settings/company">
                            <div className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Back to Companies</div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyDetails;