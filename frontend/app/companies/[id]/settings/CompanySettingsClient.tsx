"use client";

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { MyNewEmployeeForm } from '@/components/uicustom/company/form/new-employee-form';
import { RemoveEmployeeButton } from '@/components/uicustom/company/remove-employee-btn';
import { useCurrentUser } from '@/hooks/use-current-user';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import DeleteCompanyBtn from '@/components/uicustom/company/delete-company-btn';
import type { EmployeePermissions } from '@/lib/types/company-permissions';
import { formatDistanceToNow } from 'date-fns';
import { MdAddCircleOutline, MdDelete, MdEdit, MdRemoveCircleOutline, MdPostAdd } from 'react-icons/md';
import ProgressBar from '@/components/bars/progress-bar';
import EditEmployeePermissionsModal from '@/components/uicustom/company/edit-employee-permission';
import { FaBriefcase } from 'react-icons/fa';
import BannerThemeWrapper from '@/components/uicustom/banner/BannerThemeWrapper';
import type { CompanyDetailsResponse } from '@/lib/types/company';

export interface TagReplacement {
        name: string;
        description: string;
    icon: ReactNode;
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

const CompanySettingsClient = () => {
        const params = useParams();
        const clientUser = useCurrentUser();
        const [change, setChange] = useState(false);
        const [company, setCompany] = useState<CompanyDetailsResponse | null>(null);
        const [loading, setLoading] = useState(true);
        const [loadError, setLoadError] = useState<string | null>(null);
        const [errorMessages, setErrorMessages] = useState<{ [key: string]: string | null }>({});
        const [selectedEmployee, setSelectedEmployee] = useState<CompanyDetailsResponse['employees'][number] | null>(null);
        const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    // Optional company metadata (org type / org number / notice days)
    const [regOrgType, setRegOrgType] = useState<string>('');
    const [regOrgNumber, setRegOrgNumber] = useState<string>('');
    const [regNoticeDays, setRegNoticeDays] = useState<number>(14);
    const [regSaving, setRegSaving] = useState(false);
    const [regError, setRegError] = useState<string | null>(null);
    const [regSuccess, setRegSuccess] = useState<string | null>(null);

        const rawCompanyId = (params as any)?.id ?? (params as any)?.companyId;
        const companyId = Array.isArray(rawCompanyId) ? rawCompanyId[0] : rawCompanyId;

        if (!companyId) {
                return <div className="text-center py-4">Invalid company id.</div>;
        }

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
                if (!companyId) return;
                setLoadError(null);
                setLoading(true);
                try {
                        const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}`, {
                                cache: 'no-store',
                        });
                        if (!response.ok) {
                                const bodyText = await response.text().catch(() => '');
                                throw new Error(`Failed to fetch company details (${response.status})${bodyText ? `: ${bodyText}` : ''}`);
                        }
                        const data = await response.json();
                        setCompany(data);
                } catch (error) {
                        console.error('Error fetching company details:', error);
                        setLoadError(error instanceof Error ? error.message : 'Failed to fetch company details');
                } finally {
                        setLoading(false);
                }
        }, [companyId]);

        useEffect(() => {
                if (!companyId) return;
                fetchCompanyDetails();
                const companyInterval = setInterval(() => {
                        fetchCompanyDetails(); // Fetch company details every 30 minutes
                }, 1800000); // 30 minutes

                return () => clearInterval(companyInterval);
        }, [companyId, change, fetchCompanyDetails]);

        const fetchWarehouseData = useCallback(async () => {
                if (!companyId) return;
                try {
                        const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/warehouses/stock`, {
                                cache: 'no-store',
                        });
                        if (!response.ok) {
                                throw new Error('Failed to fetch warehouse data');
                        }
                        const data = await response.json();
                        setWarehouses(data.warehouses);
                } catch (error) {
                        console.error('Error fetching warehouse data:', error);
                }
        }, [companyId]);

        useEffect(() => {
                if (!companyId) return;
                fetchWarehouseData(); // Initial fetch
                const warehouseInterval = setInterval(() => {
                        fetchWarehouseData(); // Fetch warehouse data every 30 seconds
                }, 300000); // 30 seconds

                return () => clearInterval(warehouseInterval);
        }, [companyId, fetchWarehouseData]);

            useEffect(() => {
                if (!company) return;
                setRegOrgType(company.orgType ?? '');
                setRegOrgNumber(((company as any).orgNumber ?? '') as string);
                setRegNoticeDays(((company as any).employmentNoticeDays ?? 14) as number);
                setRegError(null);
                setRegSuccess(null);
            }, [company?.id]);

        if (loading) return <div className="text-center py-4">Loading...</div>;
        if (loadError) return <div className="text-center py-4">{loadError}</div>;
        if (!company) return <div className="text-center py-4">Company not found.</div>;

        // Check if user is member/owner of company
        const isOwner = company.ownerId === clientUser?.id;
        const isCreator = company.creatorId === clientUser?.id;
        const currentEmployee = company.employees.find(employee => employee.userId === clientUser?.id);
        const isMember = !!currentEmployee;
        const isAdminUser = (clientUser as any)?.role === 'ADMIN' || (clientUser as any)?.role === 'OWNER';
        const hasInternalAccess = isOwner || isCreator || isMember || isAdminUser;

        // Redirect non-members to public page
        if (!hasInternalAccess) {
            return (
                <div className="w-full bg-slate-50 dark:bg-slate-950">
                    <div className="mx-auto w-full max-w-screen-2xl px-4 py-12 text-center">
                        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Access Restricted</h1>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            You don&apos;t have permission to access company settings.
                        </p>
                        <Link
                            href={`/companies/${company.id}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                        >
                            View Company Profile
                        </Link>
                    </div>
                </div>
            );
        }

        const showRegistrationPrompt =
            hasInternalAccess && (
                !company.orgType ||
                !((company as any).orgNumber as string | null | undefined) ||
                !((company as any).employmentNoticeDays as number | null | undefined)
            );
        const canUpdateRegistration =
                company.ownerId === clientUser?.id ||
                isAdminUser;

        const saveRegistration = async () => {
                if (!canUpdateRegistration) return;
                setRegSaving(true);
                setRegError(null);
                setRegSuccess(null);
                try {
                const trimmedOrgNumber = regOrgNumber.trim();
                const currentNoticeDays = (((company as any).employmentNoticeDays ?? 14) as number);
                const payload: any = {};
                if (regOrgType) payload.orgType = regOrgType;
                if (trimmedOrgNumber) payload.orgNumber = trimmedOrgNumber;
                if (Number.isFinite(regNoticeDays) && regNoticeDays !== currentNoticeDays) {
                    payload.employmentNoticeDays = regNoticeDays;
                }
                if (Object.keys(payload).length === 0) {
                    throw new Error('No changes to save.');
                }

                        const res = await fetch(`/api/companies/${encodeURIComponent(company.id)}/registration`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                                const msg = (data && (data.error || data.message)) || `Failed to update registration (${res.status})`;
                                throw new Error(msg);
                        }
                setRegSuccess('Company metadata updated.');
                        setChange((v) => !v);
                } catch (e: any) {
                        setRegError(e?.message || 'Failed to update registration');
                } finally {
                        setRegSaving(false);
                }
        };

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

        const handleNewEmployee = (newEmployee: CompanyDetailsResponse['employees'][number]) => {
                setCompany(prevCompany => {
                        if (!prevCompany) return null;
                        const updatedEmployees = [...prevCompany.employees, newEmployee];
                        return { ...prevCompany, employees: updatedEmployees };
                });
                console.log('Employee was added. Refreshing list...');
        };

        const handleEmployeeClick = (employee: CompanyDetailsResponse['employees'][number]) => {
                setSelectedEmployee(employee);
        };

        const sortedEmployees = company.employees.slice().sort((a, b) => {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        const sortedEmployeesRole = company.employees.slice().sort((a, b) => {
                return rolePriority[a.role] - rolePriority[b.role];
        });

        const currentUserPermissions = currentEmployee?.permissions;

        const formatDate = (date: string) => {
                return formatDistanceToNow(new Date(date), { addSuffix: true });
        };

        const banner = company.bannerImage?.[0] ?? null;

        return (
            <BannerThemeWrapper bannerUrl={banner} className="w-full">
                <div className="relative mx-auto w-full max-w-screen-2xl px-4 py-6">
                    <div className="overflow-hidden rounded-lg border border-black/10 bg-white/60 backdrop-blur-sm transition-[border-radius] duration-200 hover:rounded-2xl dark:border-white/10 dark:bg-white/[0.03]">
                        <div className="relative w-full">
                            {company.bannerImage?.[0] ? (
                                <AspectRatio ratio={3 / 1}>
                                    <Image
                                        src={company.bannerImage[0]}
                                        layout="fill"
                                        objectFit="cover"
                                        alt={`${company.name} banner`}
                                        className="object-cover"
                                    />
                                </AspectRatio>
                            ) : (
                                <div className="h-44 w-full bg-gradient-to-r from-indigo-500/30 via-sky-500/20 to-emerald-500/30 dark:from-indigo-500/20 dark:via-sky-500/10 dark:to-emerald-500/20" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                            <div className="absolute inset-0 flex items-end justify-between gap-4 p-4 md:p-6">
                                <div className="flex items-end gap-4">
                                    <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-white/20 bg-white/10 md:h-24 md:w-24">
                                        <Image
                                            src={company.logo?.[0] || "/users/avatar.webp"}
                                            layout="fill"
                                            objectFit="cover"
                                            alt={`${company.name} logo`}
                                            className="object-cover"
                                        />
                                    </div>
                                    <div className="pb-1">
                                        <h1 className="text-xl font-semibold tracking-tight text-white md:text-3xl">{company.name}</h1>
                                        <div className="mt-1 flex items-center gap-3 text-sm text-white/80">
                                            <span>Company Settings</span>
                                            <span className="opacity-50">•</span>
                                            <Link href={`/companies/${company.id}`} className="hover:text-white hover:underline underline-offset-2">
                                                Public profile
                                            </Link>
                                            <span className="opacity-50">•</span>
                                            <Link href={`/companies/${company.id}/hub`} className="hover:text-white hover:underline underline-offset-2">
                                                Hub
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {company.ownerId === clientUser?.id ? (
                                    <div className="pb-1">
                                        <DeleteCompanyBtn
                                            companyId={company.id}
                                            companyName={company.name}
                                            onCompanyDeleted={() => handleSuccess(company.id)}
                                            employeePermissions={currentUserPermissions as EmployeePermissions}
                                        />
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="px-4 py-5 md:px-6">
                            <div className="mb-8">
                                <p className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Description</p>
                                <p className="text-base text-slate-700 dark:text-slate-300 mb-4">{company.description}</p>
                                <div className="text-sm text-slate-700 dark:text-slate-300">
                                    <span className="font-medium">Website:</span>{' '}
                                    {company.websiteUrl ? (
                                        <a
                                            href={company.websiteUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sky-700 hover:underline dark:text-sky-300"
                                        >
                                            {company.websiteUrl}
                                        </a>
                                    ) : (
                                        <span className="opacity-80">No URL provided</span>
                                    )}
                                </div>
                            </div>

                            {showRegistrationPrompt ? (
                                <div className="mb-8 rounded-lg border border-black/10 bg-white/50 p-4 text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-base font-semibold">Optional company metadata</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                Add these details to improve invoices, contracts, and internal settings. Nothing is required.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <label className="flex flex-col gap-1">
                                            <span className="text-sm font-medium">Organization type (optional)</span>
                                            <select
                                                value={regOrgType}
                                                onChange={(e) => setRegOrgType(e.target.value)}
                                                disabled={!canUpdateRegistration || regSaving}
                                                className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
                                            >
                                                <option value="">Not specified</option>
                                                <option value="ENK">Enkeltpersonforetak (ENK)</option>
                                                <option value="AS">Aksjeselskap (AS)</option>
                                                <option value="ANS">Ansvarlig selskap (ANS)</option>
                                                <option value="DA">Delt ansvar (DA)</option>
                                                <option value="SA">Samvirkeforetak (SA)</option>
                                                <option value="FORENING">Forening / Lag</option>
                                                <option value="NUF">NUF</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                        </label>

                                        <label className="flex flex-col gap-1">
                                            <span className="text-sm font-medium">Org number (optional)</span>
                                            <input
                                                value={regOrgNumber}
                                                onChange={(e) => setRegOrgNumber(e.target.value)}
                                                disabled={!canUpdateRegistration || regSaving}
                                                inputMode="numeric"
                                                pattern="\d*"
                                                maxLength={9}
                                                placeholder="123456789"
                                                className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
                                            />
                                        </label>

                                        <label className="flex flex-col gap-1">
                                            <span className="text-sm font-medium">Default notice days (optional)</span>
                                            <input
                                                type="number"
                                                min={0}
                                                max={365}
                                                value={regNoticeDays}
                                                onChange={(e) => setRegNoticeDays(Number(e.target.value))}
                                                disabled={!canUpdateRegistration || regSaving}
                                                className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
                                            />
                                        </label>
                                    </div>

                                    <div className="mt-4 flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={saveRegistration}
                                            disabled={!canUpdateRegistration || regSaving}
                                            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
                                        >
                                            {regSaving ? 'Saving…' : 'Save'}
                                        </button>
                                        {regError ? <span className="text-sm text-red-700 dark:text-red-300">{regError}</span> : null}
                                        {regSuccess ? <span className="text-sm text-emerald-700 dark:text-emerald-300">{regSuccess}</span> : null}
                                        {!canUpdateRegistration ? (
                                            <span className="text-sm opacity-80">Only the company owner (or admins) can update this.</span>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {hasInternalAccess && (
                                    <div className="border border-black/10 bg-white/50 p-5 transition-[border-radius,box-shadow] duration-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] rounded-lg hover:rounded-2xl">
                                        <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Company ID:</p>
                                        <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.id || 'N/A'}</p>
                                    </div>
                                )}
                                <div className="border border-black/10 bg-white/50 p-5 transition-[border-radius,box-shadow] duration-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] rounded-lg hover:rounded-2xl">
                                    <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Founded by:</p>
                                    <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.creator.name || 'N/A'}</p>
                                </div>
                                {hasInternalAccess && (
                                    <div className="border border-black/10 bg-white/50 p-5 transition-[border-radius,box-shadow] duration-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] rounded-lg hover:rounded-2xl">
                                        <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Company Owner:</p>
                                        <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.owner.name || 'N/A'}</p>
                                    </div>
                                )}
                                {hasInternalAccess && (
                                    <div className="border border-black/10 bg-white/50 p-5 transition-[border-radius,box-shadow] duration-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] rounded-lg hover:rounded-2xl">
                                        <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Color Scheme:</p>
                                        <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.colorScheme || 'N/A'}</p>
                                    </div>
                                )}
                                {hasInternalAccess && (
                                    <div className="border border-black/10 bg-white/50 p-5 transition-[border-radius,box-shadow] duration-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] rounded-lg hover:rounded-2xl">
                                        <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Uses Shipping:</p>
                                        <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.usesShipping ? 'Yes' : 'No'}</p>
                                    </div>
                                )}
                                <div className="border border-black/10 bg-white/50 p-5 transition-[border-radius,box-shadow] duration-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] rounded-lg hover:rounded-2xl">
                                    <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Founded:</p>
                                    <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{formatDate(company.createdAt)}</p>
                                </div>
                                {hasInternalAccess && (
                                    <div className="border border-black/10 bg-white/50 p-5 transition-[border-radius,box-shadow] duration-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] rounded-lg hover:rounded-2xl">
                                        <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Last Updated:</p>
                                        <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{formatDate(company.updatedAt)}</p>
                                    </div>
                                )}
                                {!hasInternalAccess && company.employees && (
                                    <div className="border border-black/10 bg-white/50 p-5 transition-[border-radius,box-shadow] duration-200 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] rounded-lg hover:rounded-2xl">
                                        <p className="text-gray-700 dark:text-gray-300 text-lg mb-2 font-medium">Team Size:</p>
                                        <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{company.employees.length} {company.employees.length === 1 ? 'member' : 'members'}</p>
                                    </div>
                                )}
                            </div>
                            {hasInternalAccess && company.usesShipping && company.warehouseLocations && company.warehouseLocations.length > 0 && (
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
                                                    className="border border-black/10 bg-white/40 p-4 transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] rounded-lg hover:rounded-2xl"
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
                                                    <Link href={`/companies/${company.id}/warehouse/${warehouseLocation.id}`} className="mt-2 text-blue-600 hover:underline">View Inventory</Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                            {hasInternalAccess && company.employees && company.employees.length > 0 && (
                                <div className="border-t border-gray-200 dark:border-gray-700 mt-2">
                                    <div className='flex justify-start items-center w-full h-10'>
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Employees:</h2>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {sortedEmployeesRole.map((employee) => (
                                                <div
                                                    key={employee.id}
                                                    className="border border-black/10 bg-white/40 p-4 transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] rounded-lg hover:rounded-2xl"
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
                                                                {(employee as any).jobTitle ? (
                                                                    <p className="text-gray-500 dark:text-gray-400 text-sm">{(employee as any).jobTitle}</p>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2">
                                                            <p className="font-semibold">Permissions</p>
                                                            <div className="space-y-2">
                                                                {Object.keys(employee.permissions ?? {}).length === 0 ? (
                                                                        <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded text-center text-gray-500 dark:text-gray-400">No permissions</div>
                                                                ) : (
                                                                    Object.entries(employee.permissions ?? {}).map(([key, value]) => {
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
                            {hasInternalAccess && (
                                <div className="border-t border-gray-200 dark:border-gray-700">
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add a New Employee</h1>
                                    <MyNewEmployeeForm
                                        companyId={company.id}
                                        handleNewEmployee={handleNewEmployee}
                                        change={change}
                                        setChange={setChange}
                                    />
                                </div>
                            )}
                            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <Link 
                                    href="/companies" 
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                    Back to Companies
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </BannerThemeWrapper>
        );
};

export default CompanySettingsClient;
