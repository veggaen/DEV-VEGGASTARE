"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { MyNewEmployeeForm } from '@/components/uicustom/company/form/new-employee-form';
import { RemoveEmployeeButton } from '@/components/uicustom/company/remove-employee-btn';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import DeleteCompanyBtn from '@/components/uicustom/company/delete-company-btn';
import type { EmployeePermissions } from '@/lib/types/company-permissions';
import { formatDistanceToNow } from 'date-fns';
import { MdAddCircleOutline, MdDelete, MdEdit, MdRemoveCircleOutline, MdPostAdd } from 'react-icons/md';
import ProgressBar from '@/components/bars/progress-bar';
import EditEmployeePermissionsModal from '@/components/uicustom/company/edit-employee-permission';
import EditEmployeeRoleModal from '@/components/uicustom/company/edit-employee-role-modal';
import { canManageTeamTarget, TEAM_RANK, TEAM_ROLES, TEAM_PERMISSION_KEYS } from '@/lib/company-team-policy';
import { FaBriefcase } from 'react-icons/fa';

import { CompanyPaymentSettings } from '@/components/uicustom/settings/company-payment-settings';
import type { CompanyDetailsResponse } from '@/lib/types/company';
import { CompanyReadNotice } from '@/components/uicustom/company/company-read-notice';
import { PageHeader } from '@/components/uicustom/chrome/page-header';
import { HoverChaser } from '@/components/uicustom/chrome/hover-chaser';
import { SectionHeader, StatusPill, fieldClass, settingsCard } from '@/components/uicustom/settings/settings-primitives';
import { cn } from '@/lib/utils';
import { FiArrowLeft, FiGlobe, FiInfo, FiMapPin, FiRefreshCw, FiTrash2, FiUsers } from 'react-icons/fi';

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

const rolePriority: Record<string, number> = {
        OWNER: 1,
        MANAGER: 2,
        WAREHOUSE_MANAGER: 3,
        STAFF: 4,
        WAREHOUSE_WORKER: 5,
        ACCOUNTANT: 6,
        USER: 7
};

const CompanySettingsClient = () => {
        const params = useParams();
        const clientUser = useCurrentUser();
        const [change, setChange] = useState(false);
        const [company, setCompany] = useState<CompanyDetailsResponse | null>(null);
        const [loading, setLoading] = useState(true);
        const registrationDirty = useRef(false);
        const [loadError, setLoadError] = useState<string | null>(null);
        const [accessStatus, setAccessStatus] = useState<number | null>(null);
        const companyRequest = useRef(0);
        const [errorMessages, setErrorMessages] = useState<{ [key: string]: string | null }>({});
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
                const request = ++companyRequest.current;
                setLoadError(null);
                setAccessStatus(null);
                setLoading(true);
                try {
                        const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}`, {
                                cache: 'no-store',
                                signal: AbortSignal.timeout(12_000),
                        });
                        if (request !== companyRequest.current) return;
                        if (!response.ok) {
                                setAccessStatus(response.status);
                                throw new Error('Company could not load');
                        }
                        const data = await response.json();
                        if (request === companyRequest.current) setCompany(data);
                } catch {
                        if (request === companyRequest.current) { setCompany(null); setLoadError('Company could not load'); }
                } finally {
                        if (request === companyRequest.current) setLoading(false);
                }
        }, [companyId]);

        useEffect(() => {
                if (!companyId) return;
                const requests = companyRequest;
                fetchCompanyDetails();
                const companyInterval = setInterval(() => {
                        fetchCompanyDetails(); // Fetch company details every 30 minutes
                }, 1800000); // 30 minutes

                return () => { clearInterval(companyInterval); requests.current++; };
        }, [companyId, change, fetchCompanyDetails]);

        const fetchWarehouseData = useCallback(async () => {
                if (!companyId || !company?.usesShipping) return;
                try {
                        const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/warehouses/stock`, {
                                cache: 'no-store',
                                signal: AbortSignal.timeout(12_000),
                        });
                        if (!response.ok) {
                                throw new Error('Failed to fetch warehouse data');
                        }
                        const data = await response.json();
                        setWarehouses(data.warehouses);
                } catch (error) {
                        console.error('Error fetching warehouse data:', error);
                }
        }, [companyId, company?.usesShipping]);

        useEffect(() => {
                if (!companyId || !company?.usesShipping) return;
                fetchWarehouseData(); // Initial fetch
                const warehouseInterval = setInterval(() => {
                        fetchWarehouseData();
                }, 300000); // Five minutes; only after an authorized company read.

                return () => clearInterval(warehouseInterval);
        }, [companyId, company?.usesShipping, fetchWarehouseData]);

            useEffect(() => {
                if (!company || registrationDirty.current) return;
                setRegOrgType(company.orgType ?? '');
                setRegOrgNumber(((company as any).orgNumber ?? '') as string);
                setRegNoticeDays(((company as any).employmentNoticeDays ?? 14) as number);
                setRegError(null);
                setRegSuccess(null);
            }, [company]);

        if (!companyId) return <div className="text-center py-4">Invalid company id.</div>;

        if (loading && !company) return <div role="status" className="mx-auto w-full max-w-7xl px-4 py-8 text-sm text-muted-foreground">Loading company settings…</div>;
        if (loadError) return <CompanyReadNotice companyId={companyId} status={accessStatus} retry={fetchCompanyDetails} />;
        if (!company) return <div className="text-center py-4">Company not found.</div>;

        // Check if user is member/owner of company
        const isOwner = company.ownerId === clientUser?.id;
        const currentEmployee = company.employees.find(employee => employee.userId === clientUser?.id);
        const isMember = !!currentEmployee;
        const isAdminUser = (clientUser as any)?.role === 'ADMIN' || (clientUser as any)?.role === 'OWNER';
        const hasInternalAccess = isOwner || isMember || isAdminUser;

        // Redirect non-members to public page
        if (!hasInternalAccess) {
            return (
                <div className="w-full bg-background">
                    <div className="mx-auto w-full max-w-screen-2xl px-4 py-12 text-center">
                        <h1 className="text-2xl font-semibold text-foreground mb-4">Access Restricted</h1>
                        <p className="text-foreground/80 mb-6">
                            You don&apos;t have permission to access company settings.
                        </p>
                        <Link
                            href={`/companies/${company.id}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-surface-3 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
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
                registrationDirty.current = false;
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
        };

        const sortedEmployeesRole = company.employees.slice().sort((a, b) => {
                return rolePriority[a.role] - rolePriority[b.role];
        });

        const currentUserPermissions = currentEmployee?.permissions;

        const formatDate = (date: string) => {
                return formatDistanceToNow(new Date(date), { addSuffix: true });
        };

        let website: string | null = null;
        try { const url = new URL(company.websiteUrl ?? ''); if (['https:', 'http:'].includes(url.protocol)) website = url.href; } catch { /* no public website */ }
        const canManageTeam = isOwner || isAdminUser;
        const allowedRoles = TEAM_ROLES.filter(role => canManageTeam || (currentEmployee && TEAM_RANK[role] < TEAM_RANK[currentEmployee.role]));
        const allowedPermissions = TEAM_PERMISSION_KEYS.filter(key => canManageTeam || currentUserPermissions?.[key] === true);
        const canEditMember = (employee: CompanyDetailsResponse['employees'][number]) => canManageTeamTarget(clientUser?.id ?? '', company.ownerId, canManageTeam, currentEmployee, employee);

        const roleTone = (role: string): 'warning' | 'accent' | 'neutral' => (role === 'OWNER' ? 'warning' : role === 'MANAGER' ? 'accent' : 'neutral');
        const field = cn(fieldClass, 'w-full border px-3 text-foreground outline-none');

        return <section className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <PageHeader
                eyebrow="Company settings"
                title={<span className="flex items-center gap-3"><Image src={company.logo?.[0] || '/users/avatar.webp'} width={48} height={48} alt="" className="size-12 shrink-0 rounded-xl border border-border/60 object-cover" />{company.name}</span>}
                description="Details, registration, warehouses and the team. Changes apply immediately."
                back={<Link href="/companies" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FiArrowLeft aria-hidden="true" className="size-4" />All companies</Link>}
                actions={<nav aria-label="Company navigation" className="flex flex-wrap gap-2">
                    <Button asChild variant="vegaNormalBtn" className="min-h-11"><Link href={`/companies/${company.id}`}>Public profile</Link></Button>
                    <Button asChild variant="vegaNormalBtn" className="min-h-11"><Link href={`/companies/${company.id}/hub`}>Company hub</Link></Button>
                </nav>}
            />

            {isOwner && <CompanyPaymentSettings companyId={company.id} />}

            <section aria-labelledby="company-details-heading" className={cn(settingsCard, 'space-y-4 p-4 sm:p-5')}>
                <SectionHeader id="company-details-heading" icon={FiInfo} title="Company details" description={company.description || 'No description yet.'} actions={website ? <a href={website} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-sm font-medium text-foreground hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FiGlobe aria-hidden="true" className="size-4 text-brand-accent" />Company website ↗</a> : undefined} />
                <HoverChaser as="div" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" boxClassName="rounded-xl">
                    {[['Company ID', company.id], ['Owner', company.owner.name], ['Founded by', company.creator.name], ['Shipping', company.usesShipping ? 'Enabled' : 'Not used'], ['Founded', formatDate(company.createdAt)], ['Updated', formatDate(company.updatedAt)]].map(([label, value]) => (
                        <div key={label} data-chase className="min-w-0 rounded-xl border border-border/50 bg-foreground/[0.02] px-3 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium text-foreground">{value || 'Not specified'}</p></div>
                    ))}
                </HoverChaser>
                {showRegistrationPrompt && (
                    <div className="rounded-xl border border-dashed border-border/70 p-4">
                        <p className="text-sm font-semibold text-foreground">Registration (optional)</p>
                        <p className="text-xs text-muted-foreground">Improves invoices, contracts and internal settings. Nothing is required.</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium">Organization type</span>
                                <select value={regOrgType} onChange={(e) => { registrationDirty.current = true; setRegOrgType(e.target.value); }} disabled={!canUpdateRegistration || regSaving} className={field}>
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
                                <span className="text-xs font-medium">Org number</span>
                                <input value={regOrgNumber} onChange={(e) => { registrationDirty.current = true; setRegOrgNumber(e.target.value); }} disabled={!canUpdateRegistration || regSaving} inputMode="numeric" maxLength={9} placeholder="123456789" className={field} />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium">Default notice days</span>
                                <input type="number" min={0} max={365} value={regNoticeDays} onChange={(e) => { registrationDirty.current = true; setRegNoticeDays(Number(e.target.value)); }} disabled={!canUpdateRegistration || regSaving} className={field} />
                            </label>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <Button type="button" variant="vegaEmeraldBtn" onClick={saveRegistration} disabled={!canUpdateRegistration || regSaving} className="min-h-10">{regSaving ? 'Saving…' : 'Save registration'}</Button>
                            {regError ? <span role="alert" className="text-sm text-destructive">{regError}</span> : null}
                            {regSuccess ? <span role="status" className="text-sm text-brand-accent-hover dark:text-brand-accent-light">{regSuccess}</span> : null}
                            {!canUpdateRegistration ? <span className="text-xs text-muted-foreground">Only the company owner (or admins) can update this.</span> : null}
                        </div>
                    </div>
                )}
            </section>

            {company.usesShipping && <section aria-label="Warehouses" className={cn(settingsCard, 'space-y-4 p-4 sm:p-5')}>
                <SectionHeader icon={FiMapPin} title={`Warehouses · ${company.warehouseLocations?.length ?? 0}`} description="Stock per location. Open a warehouse to manage its inventory." />
                {warehouses.length === 0 ? <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No warehouse stock reported yet.</p> : (
                    <HoverChaser as="ul" className="grid gap-3 sm:grid-cols-2" boxClassName="rounded-xl">
                        {warehouses.map(warehouse => <li key={warehouse.id} data-chase className="min-w-0 space-y-3 rounded-xl border border-border/50 bg-foreground/[0.02] p-4 text-sm">
                            <p className="break-words font-medium">{warehouse.address}, {warehouse.city}, {warehouse.country}</p>
                            <p className="text-xs text-muted-foreground">Stock {warehouse.currentStock.toLocaleString()} / {warehouse.initialStock.toLocaleString()}</p>
                            <ProgressBar value={warehouse.currentStock} max={warehouse.initialStock} />
                            <Button asChild variant="vegaNormalBtn" size="sm" className="min-h-9"><Link href={`/nexus/company/${company.id}/warehouse/${warehouse.id}`}>View inventory</Link></Button>
                        </li>)}
                    </HoverChaser>
                )}
            </section>}

            <section aria-label="Team" className={cn(settingsCard, 'space-y-4 p-4 sm:p-5')}>
                <SectionHeader icon={FiUsers} title={`Team · ${company.employees.length}`} description="Roles decide what each member can do; permissions fine-tune it." actions={<Button variant="vegaNormalBtn" size="sm" className="min-h-9 gap-1.5" onClick={() => setChange(value => !value)}><FiRefreshCw aria-hidden="true" className="size-3.5" />Refresh team</Button>} />
                <HoverChaser className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" boxClassName="rounded-xl">
                    {sortedEmployeesRole.map(employee => {
                        const granted = Object.entries(employee.permissions ?? {}).filter(([, value]) => value === true).map(([key]) => tagReplacements[key]?.name || key.replaceAll('_', ' '));
                        return <article key={employee.id} data-chase className="min-w-0 space-y-3 rounded-xl border border-border/50 bg-foreground/[0.02] p-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <Image src={employee.user.image || '/users/avatar.webp'} width={40} height={40} className="size-10 shrink-0 rounded-full object-cover ring-1 ring-border/60" alt="" />
                                <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{employee.user.name || 'Team member'}</h2><p className="truncate text-xs text-muted-foreground">{employee.user.email}</p></div>
                                <StatusPill tone={roleTone(employee.role)}>{employee.role.replaceAll('_', ' ')}</StatusPill>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {granted.length === 0 ? <span className="text-xs text-muted-foreground">No extra permissions</span> : granted.map(name => <StatusPill key={name}>{name}</StatusPill>)}
                            </div>
                            <details className="text-xs"><summary className="cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">All permissions</summary><dl className="mt-2 space-y-1">{Object.entries(employee.permissions ?? {}).map(([key, value]) => <div key={key} className="flex items-start justify-between gap-3"><dt className="min-w-0 break-words text-muted-foreground">{tagReplacements[key]?.name || key.replaceAll('_', ' ')}</dt><dd className="shrink-0 font-medium">{value === true ? 'Allowed' : 'Not allowed'}</dd></div>)}</dl></details>
                            {errorMessages[employee.userId] && <p role="alert" className="text-sm text-destructive">{errorMessages[employee.userId]}</p>}
                            <div className="flex flex-wrap gap-2">
                                {canEditMember(employee) && (canManageTeam || currentUserPermissions?.CAN_EDIT_PERMISSION === true) && <EditEmployeePermissionsModal key={'permissions-' + employee.updatedAt + change} company={company} selectedEmployee={employee} setCompany={setCompany} allowedPermissions={allowedPermissions} />}
                                {canEditMember(employee) && (canManageTeam || currentUserPermissions?.CAN_EDIT_EMPLOYEE_ROLE === true) && <EditEmployeeRoleModal key={'role-' + employee.updatedAt + change} company={company} selectedEmployee={employee} setCompany={setCompany} allowedRoles={allowedRoles} />}
                                {canEditMember(employee) && (canManageTeam || currentUserPermissions?.CAN_REMOVE_EMPLOYEE === true) && <RemoveEmployeeButton key={'remove-' + employee.updatedAt + change} userId={employee.userId} employeeId={employee.id} expectedUpdatedAt={employee.updatedAt} name={employee.user.name || 'This member'} companyId={company.id} onSuccess={handleSuccess} onError={message => updateErrorMessage(employee.userId, message)} />}
                            </div>
                        </article>;
                    })}
                </HoverChaser>
                {(canManageTeam || currentUserPermissions?.CAN_ADD_EMPLOYEE === true) && <div className="border-t border-border/60 pt-5"><h2 className="mb-1 text-base font-semibold">Add an employee</h2><p className="mb-4 text-sm text-muted-foreground">Invite a Veggat member by name and give them a role.</p><MyNewEmployeeForm key={String(change)} companyId={company.id} handleNewEmployee={handleNewEmployee} allowedRoles={allowedRoles} excludedUserIds={[company.ownerId, ...company.employees.map(member => member.userId)]} /></div>}
            </section>

            {isOwner && <section aria-label="Delete company" className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-4 sm:p-5">
                <SectionHeader icon={FiTrash2} title="Delete company" description="Removes the storefront, its products and the team. This cannot be undone." className="border-destructive/20" />
                <div className="pt-4"><DeleteCompanyBtn companyId={company.id} companyName={company.name} onCompanyDeleted={() => handleSuccess(company.id)} employeePermissions={currentUserPermissions as EmployeePermissions} /></div>
            </section>}
        </section>;
};

export default CompanySettingsClient;
