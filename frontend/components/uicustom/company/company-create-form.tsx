/**
 * @fileOverview  Company creation form – card-sectioned, responsive, dark-mode ready.
 * @stability     stable
 */
'use client';

import React, { startTransition, useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { z } from 'zod';
import { MyFormError } from '../forms/form-error';
import { MyFormSuccess } from '../forms/form-sucess';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useEdgeStore } from '@/lib/edgestore';
import { useDropzone } from 'react-dropzone';
import { X, Upload, Plus, Trash2, MapPin, Loader2, Info, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import Image from 'next/image';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { MyCreateCompanyAction } from '@/actions/create-company';
import { companyCreationSchema } from '@/schemas';
import { EmployeeRole, User } from '@/generated/prisma/browser';
import { useRouter } from 'next/navigation';
import { formatNorwegianOrgNumber, normalizeNorwegianOrgNumber, type NorwayOrgLookupResult, type NorwayOrgSuggestion } from '@/lib/norway-org';

type UIEmployee = {
  userId: string;
  email: string;
  image: string;
  role: EmployeeRole;
  permissions: {
    CAN_ADD_EMPLOYEE: boolean;
    CAN_REMOVE_EMPLOYEE: boolean;
    CAN_EDIT_EMPLOYEE_ROLE: boolean;
    CAN_EDIT_PERMISSION: boolean;
    CAN_DELETE_COMPANY: boolean;
    CAN_POST_PRODUCT_POSITION_PERMISSION: boolean;
    CAN_EDIT_PRODUCT_POSITION_PERMISSION: boolean;
  };
};

const DEFAULT_PERMISSIONS = {
  CAN_REMOVE_EMPLOYEE: true,
  CAN_EDIT_PERMISSION: true,
  CAN_DELETE_COMPANY: true,
  CAN_POST_PRODUCT_POSITION_PERMISSION: true,
  CAN_EDIT_PRODUCT_POSITION_PERMISSION: true,
  CAN_ADD_EMPLOYEE: true,
  CAN_EDIT_EMPLOYEE_ROLE: true,
};

const INITIAL_OWNER_EMPLOYEE = (user: { id: string; email?: string | null; image?: string | null }) => ({
  userId: user.id,
  email: user.email || '',
  image: user.image || '',
  role: 'OWNER' as EmployeeRole,
  permissions: DEFAULT_PERMISSIONS,
});

const imageHandler = async (values: any, logoFile: File[], bannerFile: File[], edgestore: any) => {
  const uploadImages = async (files: File[]) => {
    return Promise.all(
      files.map(async (file) => {
        const uploadResult = await edgestore.myPublicImages.upload({ file });
        return uploadResult.url;
      })
    );
  };

  values.logo = await uploadImages(logoFile);
  values.bannerImage = await uploadImages(bannerFile);
  return values;
};

export const MyCompanyCreateForm = () => {
  const { edgestore } = useEdgeStore();
  const router = useRouter();
  const user = useCurrentUser();
  const UID = user?.id;
  const [logoFile, setLogoFile] = useState<File[]>([]);
  const [bannerFile, setBannerFile] = useState<File[]>([]);
  const [logoPreview, setLogoPreview] = useState<string[]>([]);
  const [bannerPreview, setBannerPreview] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employeeList, setEmployeeList] = useState<UIEmployee[]>(
    user?.id ? [INITIAL_OWNER_EMPLOYEE({ id: user.id, email: user.email, image: user.image })] : []
  );
  const [error, setError] = useState<string | undefined>('');
  const [error2, setError2] = useState<string | undefined>('');
  const [success, setSuccess] = useState<string | undefined>('');
  const [orgLookupState, setOrgLookupState] = useState<'idle' | 'loading' | 'found' | 'not-found' | 'error'>('idle');
  const [orgLookupData, setOrgLookupData] = useState<NorwayOrgLookupResult | null>(null);
  const [orgSuggestions, setOrgSuggestions] = useState<NorwayOrgSuggestion[]>([]);
  const [showOrgSuggestions, setShowOrgSuggestions] = useState(false);

  const form = useForm<z.infer<typeof companyCreationSchema>>({
    resolver: zodResolver(companyCreationSchema),
    defaultValues: {
      name: '',
      description: '',
      websiteUrl: '',
      logo: [''],
      bannerImage: [''],
      colorScheme: '',
      orgType: undefined,
      orgNumber: '',
      employmentNoticeDays: 14,
      creatorId: user?.id ?? '',
      ownerId: user?.id ?? '',
      employees: user?.id ? [{ ...INITIAL_OWNER_EMPLOYEE({ id: user.id, email: user.email, image: user.image }) }] : [],
      usesShipping: false,
      warehouseLocations: [{ address: '', postalCode: '', city: '', country: '', latitude: 0, longitude: 0 }],
    },
  });

  const { control, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset, getValues, setValue } = form;
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'warehouseLocations',
  });

  const isShippingEnabled = useWatch({ control: form.control, name: 'usesShipping' });
  const watchedOwnerId = useWatch({ control: form.control, name: 'ownerId' });
  const watchedOrgNumber = useWatch({ control: form.control, name: 'orgNumber' });

  useEffect(() => {
    if (!isShippingEnabled) {
      form.clearErrors('warehouseLocations');
      form.resetField('warehouseLocations');
    }
  }, [form, isShippingEnabled]);

  useEffect(() => {
    if (!isDirty || !UID) return;
    if (UID !== watchedOwnerId) {
      reset();
    }
  }, [UID, isDirty, watchedOwnerId, reset]);

  useEffect(() => {
    const fetchUsers = async () => {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data);
    };

    fetchUsers();
  }, [user]);

  useEffect(() => {
    const normalized = normalizeNorwegianOrgNumber(watchedOrgNumber);

    if (normalized.length < 3 || normalized.length >= 9) {
      const resetTimer = setTimeout(() => setOrgSuggestions([]), 0);
      return () => clearTimeout(resetTimer);
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/org-suggest?orgNumber=${encodeURIComponent(normalized)}&limit=6`);
        const payload = (await res.json()) as { suggestions?: NorwayOrgSuggestion[] };
        if (cancelled) return;
        setOrgSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      } catch {
        if (cancelled) return;
        setOrgSuggestions([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [watchedOrgNumber]);

  useEffect(() => {
    const normalized = normalizeNorwegianOrgNumber(watchedOrgNumber);

    if (!normalized) {
      const resetTimer = setTimeout(() => {
        setOrgLookupState('idle');
        setOrgLookupData(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    if (normalized.length < 9) {
      const resetTimer = setTimeout(() => {
        setOrgLookupState('idle');
        setOrgLookupData(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let cancelled = false;
    const loadingTimer = setTimeout(() => {
      if (!cancelled) setOrgLookupState('loading');
    }, 0);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/org-lookup?orgNumber=${encodeURIComponent(normalized)}`);
        const payload = (await res.json()) as NorwayOrgLookupResult;

        if (cancelled) return;

        if (!res.ok || !payload.found) {
          setOrgLookupState('not-found');
          setOrgLookupData(payload);
          return;
        }

        setOrgLookupState('found');
        setOrgLookupData(payload);

        // Optional autofill (non-destructive: only fill empty fields)
        if (payload.legalName && !getValues('name')?.trim()) {
          setValue('name', payload.legalName, { shouldDirty: true });
        }
        if (payload.websiteUrl && !getValues('websiteUrl')?.trim()) {
          setValue('websiteUrl', payload.websiteUrl, { shouldDirty: true });
        }
        if (payload.suggestedOrgType && !getValues('orgType')) {
          setValue('orgType', payload.suggestedOrgType, { shouldDirty: true });
        }

        if (payload.address) {
          const locations = getValues('warehouseLocations') || [];
          if (locations.length > 0) {
            const first = locations[0];
            const patched = {
              ...first,
              address: first.address || payload.address.address || '',
              city: first.city || payload.address.city || '',
              postalCode: first.postalCode || payload.address.postalCode || '',
              country: first.country || payload.address.country || 'NO',
            };
            const next = [...locations];
            next[0] = patched;
            setValue('warehouseLocations', next, { shouldDirty: true });
          }
        }
      } catch {
        if (cancelled) return;
        setOrgLookupState('error');
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(loadingTimer);
      clearTimeout(timer);
    };
  }, [watchedOrgNumber, getValues, setValue]);

  const onLogoDrop = (acceptedFiles: File[]) => {
    setLogoFile([...acceptedFiles]);
    const newPreviews = acceptedFiles.map(file => URL.createObjectURL(file));
    setLogoPreview([...newPreviews]);
  };

  const onBannerDrop = (acceptedFiles: File[]) => {
    setBannerFile([...bannerFile, ...acceptedFiles]);
    const newPreviews = acceptedFiles.map(file => URL.createObjectURL(file));
    setBannerPreview([...newPreviews]);
  };

  useEffect(() => {
    return () => {
      logoPreview.forEach(URL.revokeObjectURL);
      bannerPreview.forEach(URL.revokeObjectURL);
    };
  }, [logoPreview, bannerPreview]);

  const handleAddEmployee = () => {
    const userToAdd = users.find(user => user.id === selectedEmployeeId);
    if (userToAdd) {
      const newEmployee: UIEmployee = {
        userId: userToAdd.id,
        email: userToAdd.email || '',
        image: userToAdd.image || '',
        role: 'USER' as EmployeeRole,
        permissions: {
          CAN_REMOVE_EMPLOYEE: false,
          CAN_EDIT_PERMISSION: false,
          CAN_DELETE_COMPANY: false,
          CAN_POST_PRODUCT_POSITION_PERMISSION: false,
          CAN_EDIT_PRODUCT_POSITION_PERMISSION: false,
          CAN_ADD_EMPLOYEE: false,
          CAN_EDIT_EMPLOYEE_ROLE: false,
        },
      };

      setEmployeeList(prev => [...prev, newEmployee]);
      setSelectedEmployeeId('');
      setError2('');
    }
  };

  const handleRoleChange = (userId: string, newRole: EmployeeRole) => {
    if (userId === user?.id && newRole !== 'OWNER') {
      setError2("You cannot change your own role away from 'OWNER'.");
      setTimeout(() => setError2(''), 5000);
      setEmployeeList(currentList =>
        currentList.map(employee => (employee.userId === userId ? { ...employee, role: 'OWNER' } : employee))
      );
      return;
    }
    setEmployeeList(currentList =>
      currentList.map(employee => (employee.userId === userId ? { ...employee, role: newRole } : employee))
    );
  };

  const removeEmployee = (e: React.MouseEvent, userId: string) => {
    e.preventDefault();
    if (userId === user?.id) {
      setError2('Cannot remove yourself from the list of employees. (owner)');
      setTimeout(() => {
        setError2('');
      }, 5000);
      return;
    }
    setEmployeeList(employeeList.filter(employee => employee.userId !== userId));
  };

  const onSubmit = async (values: z.infer<typeof companyCreationSchema>) => {
    setError('');
    setError2('');
    setSuccess('');
    const newValues = await imageHandler(values, logoFile, bannerFile, edgestore);

    if (values.warehouseLocations) {
      values.warehouseLocations.forEach(location => {
        if (location.latitude !== undefined) {
          location.latitude = parseFloat(location.latitude.toString());
        }
        if (location.longitude !== undefined) {
          location.longitude = parseFloat(location.longitude.toString());
        }
      });
    }

    const updatedEmployeeList = user?.id ? [
      INITIAL_OWNER_EMPLOYEE({ id: user.id, email: user.email, image: user.image }),
      ...employeeList.filter(employee => employee.userId !== user?.id),
    ] : employeeList;

    const updatedFormData = {
      ...newValues,
      employees: updatedEmployeeList,
    };

    console.log('Submitting with FINAL updated data / VALUES:', updatedFormData);

    startTransition(() => {
      MyCreateCompanyAction(updatedFormData)
        .then((data) => {
          if ('error' in data) {
            setError(data.error);
          }
          if ('success' in data) {
            setSuccess(data.success);
            router.push(`/companies/${data.companyId}`);
          }
        });
    });

    setError('');
    setSuccess('');
  };

  const handleReset = () => {
    if (error || success) {
      setError('');
      setLogoFile([]);
      setLogoPreview([]);
      setBannerFile([]);
      setBannerPreview([]);
      form.reset();
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    }
  };

  const { getRootProps: getLogoRootProps, getInputProps: getLogoInputProps } = useDropzone({ onDrop: onLogoDrop, accept: { 'image/*': [] }, multiple: false });
  const { getRootProps: getBannerRootProps, getInputProps: getBannerInputProps } = useDropzone({ onDrop: onBannerDrop, accept: { 'image/*': [] }, multiple: true });

  const removeImageLogo = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setLogoFile((prev) => prev.filter((_, i) => i !== index));
    setLogoPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const removeImageBanner = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setBannerFile((prev) => prev.filter((_, i) => i !== index));
    setBannerPreview((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-8">

        {/* ── Section 1: Company Details ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Company Details</CardTitle>
            <CardDescription>Basic information about your company</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter company name" disabled={!user || isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Tell customers what your company does..."
                    disabled={!user || isSubmitting}
                    rows={3}
                    className="resize-none"
                  />
                </FormControl>
                <FormDescription>A brief description visible on your company profile</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="websiteUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://example.com" disabled={!user || isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* ── Section 2: Organization ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization</CardTitle>
            <CardDescription>Optional legal and organizational details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="orgType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Type</FormLabel>
                    <Select
                      value={(field.value as string) ?? 'UNSPECIFIED'}
                      onValueChange={(v) => field.onChange(v === 'UNSPECIFIED' ? undefined : v)}
                      disabled={!user || isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Not specified" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="UNSPECIFIED">Not specified</SelectItem>
                        <SelectItem value="ENK">Enkeltpersonforetak (ENK)</SelectItem>
                        <SelectItem value="AS">Aksjeselskap (AS)</SelectItem>
                        <SelectItem value="ANS">Ansvarlig selskap (ANS)</SelectItem>
                        <SelectItem value="DA">Delt ansvar (DA)</SelectItem>
                        <SelectItem value="SA">Samvirkeforetak (SA)</SelectItem>
                        <SelectItem value="FORENING">Forening / Lag</SelectItem>
                        <SelectItem value="NUF">NUF</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orgNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Organization Number
                      <span title="Paste with or without spaces. We sanitize to 9 digits automatically.">
                        <Info className="h-3.5 w-3.5 text-zinc-400" />
                      </span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          value={formatNorwegianOrgNumber(field.value || '')}
                          placeholder="123 456 789"
                          disabled={!user || isSubmitting}
                          inputMode="numeric"
                          pattern="[0-9 ]*"
                          maxLength={11}
                          onFocus={() => setShowOrgSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowOrgSuggestions(false), 120)}
                          onChange={(e) => {
                            const normalized = normalizeNorwegianOrgNumber(e.target.value);
                            field.onChange(normalized);
                            setShowOrgSuggestions(true);
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pasted = e.clipboardData.getData('text');
                            field.onChange(normalizeNorwegianOrgNumber(pasted));
                            setShowOrgSuggestions(true);
                          }}
                        />

                        {showOrgSuggestions && orgSuggestions.length > 0 && normalizeNorwegianOrgNumber(field.value).length >= 3 && normalizeNorwegianOrgNumber(field.value).length < 9 && (
                          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                            <ul className="max-h-56 overflow-auto py-1">
                              {orgSuggestions.map((suggestion) => (
                                <li key={`${suggestion.orgNumber}-${suggestion.legalName}`}>
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      field.onChange(suggestion.orgNumber);
                                      setShowOrgSuggestions(false);

                                      if (suggestion.legalName && !getValues('name')?.trim()) {
                                        setValue('name', suggestion.legalName, { shouldDirty: true });
                                      }
                                      if (suggestion.websiteUrl && !getValues('websiteUrl')?.trim()) {
                                        setValue('websiteUrl', suggestion.websiteUrl, { shouldDirty: true });
                                      }
                                      if (suggestion.suggestedOrgType && !getValues('orgType')) {
                                        setValue('orgType', suggestion.suggestedOrgType, { shouldDirty: true });
                                      }
                                    }}
                                  >
                                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{suggestion.legalName || 'Registered organization'}</div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {formatNorwegianOrgNumber(suggestion.orgNumber)}
                                      {suggestion.orgFormLabel ? ` • ${suggestion.orgFormLabel}` : ''}
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs space-y-1">
                      <div>9 digits (optional). Example: 937 051 107.</div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <a
                          href="https://www.brreg.no/en/"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 underline underline-offset-2"
                          title="Brønnøysundregistrene official register"
                        >
                          Brønnøysund
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                          href="https://www.altinn.no/en/start-and-run-business/"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 underline underline-offset-2"
                          title="Start a company in Norway via Altinn"
                        >
                          Start via Altinn
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </FormDescription>

                    {orgLookupState === 'loading' && (
                      <div className="text-xs text-zinc-500 inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Looking up organization in Brønnøysund…
                      </div>
                    )}

                    {orgLookupState === 'found' && orgLookupData?.found && (
                      <div className="rounded-md border border-emerald-300/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                        <div className="inline-flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Match found: {orgLookupData.legalName || 'Registered organization'}
                        </div>
                        <div>
                          Fields auto-filled where empty. Official company-email verification will be required before this org is linked.
                        </div>
                      </div>
                    )}

                    {orgLookupState === 'not-found' && (
                      <div className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 inline-flex items-start gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
                        No company found for this number. You can still create a company profile, but it will stay unverified.
                      </div>
                    )}

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="employmentNoticeDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Notice Period</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={0}
                      max={365}
                      disabled={!user || isSubmitting}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="max-w-48"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">Days of notice for employees (default 14)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ── Section 3: Branding ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Branding</CardTitle>
            <CardDescription>Upload your company logo and banner image</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo upload */}
              <div className="space-y-2">
                <FormField control={form.control} name="logo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo</FormLabel>
                    <FormDescription className="text-xs">Square image (1:1 ratio)</FormDescription>
                    <FormControl>
                      <Input {...field} name="logo" disabled={!user || isSubmitting} className="hidden" {...getLogoInputProps()} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div
                  {...getLogoRootProps()}
                  className={`
                    group relative cursor-pointer rounded-xl border-2 border-dashed transition-colors
                    ${logoPreview.length > 0
                      ? 'border-transparent bg-transparent p-0'
                      : 'border-zinc-200/80 dark:border-zinc-800/50 hover:border-emerald-400 dark:hover:border-emerald-500/60 bg-zinc-50 dark:bg-zinc-900/60 p-4'
                    }
                  `}
                >
                  {logoPreview.length < 1 ? (
                    <AspectRatio ratio={1}>
                      <div className="flex flex-col items-center justify-center size-full text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-500 transition-colors">
                        <Upload className="size-8 mb-2" />
                        <span className="text-sm font-medium">Upload logo</span>
                        <span className="text-xs mt-1 hidden sm:block">Drag & drop or click</span>
                      </div>
                    </AspectRatio>
                  ) : (
                    <div className="relative">
                      <AspectRatio ratio={1}>
                        <Image
                          src={logoPreview[0]}
                          alt="Logo preview"
                          fill
                          sizes="(max-width: 768px) 100vw, 300px"
                          className="object-cover rounded-xl"
                        />
                      </AspectRatio>
                      <button
                        type="button"
                        onClick={(e) => removeImageLogo(e, 0)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-red-600 text-white/80 hover:text-white transition-all duration-200 hover:scale-110"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Banner upload */}
              <div className="space-y-2">
                <FormField control={form.control} name="bannerImage" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banner</FormLabel>
                    <FormDescription className="text-xs">Wide image (3:1 ratio)</FormDescription>
                    <FormControl>
                      <Input {...field} name="bannerImage" disabled={!user || isSubmitting} className="hidden" {...getBannerInputProps()} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div
                  {...getBannerRootProps()}
                  className={`
                    group relative cursor-pointer rounded-xl border-2 border-dashed transition-colors
                    ${bannerPreview.length > 0
                      ? 'border-transparent bg-transparent p-0'
                      : 'border-zinc-200/80 dark:border-zinc-800/50 hover:border-emerald-400 dark:hover:border-emerald-500/60 bg-zinc-50 dark:bg-zinc-900/60 p-4'
                    }
                  `}
                >
                  {bannerPreview.length < 1 ? (
                    <AspectRatio ratio={3 / 1}>
                      <div className="flex flex-col items-center justify-center size-full text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-500 transition-colors">
                        <Upload className="size-8 mb-2" />
                        <span className="text-sm font-medium">Upload banner</span>
                        <span className="text-xs mt-1 hidden sm:block">Drag & drop or click</span>
                      </div>
                    </AspectRatio>
                  ) : (
                    <div className="space-y-3">
                      {bannerPreview.map((preview, index) => (
                        <div key={index} className="relative">
                          <AspectRatio ratio={3 / 1}>
                            <Image
                              src={preview}
                              alt={`Banner preview ${index + 1}`}
                              fill
                              sizes="(max-width: 768px) 100vw, 600px"
                              className="object-cover rounded-xl"
                            />
                          </AspectRatio>
                          <button
                            type="button"
                            onClick={(e) => removeImageBanner(e, index)}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-red-600 text-white/80 hover:text-white transition-all duration-200 hover:scale-110"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 4: Team (admin only) ── */}
        {user?.role === 'ADMIN' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team</CardTitle>
              <CardDescription>Add employees and assign roles</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="employees" render={() => (
                <FormItem>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select onValueChange={setSelectedEmployeeId} value={selectedEmployeeId}>
                      <FormControl>
                        <SelectTrigger className="sm:flex-1">
                          <SelectValue placeholder="Select a user to add..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users
                          .filter(userMap => !employeeList.some(employee => employee.userId === userMap.id))
                          .map((userMap) => (
                            <SelectItem key={userMap.id} value={userMap.id}>{userMap.email}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleAddEmployee} variant="vegaNormalBtn" size="default" className="shrink-0">
                      <Plus className="size-4 mr-1.5" />
                      Add
                    </Button>
                  </div>

                  {error2 && (
                    <p className="mt-2 text-sm text-orange-500 dark:text-orange-400">{error2}</p>
                  )}

                  {employeeList.length > 1 && (
                    <div className="mt-4 space-y-2">
                      {employeeList.map((employee) => {
                        if (employee.userId === user?.id) return null;
                        return (
                          <div
                            key={employee.userId}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800/50 transition-colors duration-150 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                          >
                            <span className="text-sm font-medium truncate sm:flex-1">
                              {employee.email}
                            </span>
                            <div className="flex items-center gap-2">
                              <Select
                                defaultValue={employee.role}
                                onValueChange={(newRole) => handleRoleChange(employee.userId, newRole as EmployeeRole)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.values(EmployeeRole)
                                    .filter(role => role !== 'OWNER' || employee.userId === user?.id)
                                    .map((role) => (
                                      <SelectItem key={role} value={role}>{role}</SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={employee.userId === user?.id}
                                onClick={(e) => removeEmployee(e, employee.userId)}
                                className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>
        )}

        {/* ── Section 5: Shipping ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">Shipping</CardTitle>
                <CardDescription>Enable shipping cost estimation for physical products</CardDescription>
              </div>
              <FormField control={form.control} name="usesShipping" render={({ field }) => (
                <FormItem className="flex items-center space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!user || isSubmitting}
                    />
                  </FormControl>
                </FormItem>
              )} />
            </div>
          </CardHeader>

          {isShippingEnabled && (
            <CardContent className="space-y-4 border-t border-zinc-100 dark:border-zinc-800/40 pt-6">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="relative rounded-xl border border-zinc-200/70 dark:border-zinc-800/40 bg-zinc-50 dark:bg-zinc-900/40 p-4 sm:p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      <MapPin className="size-4 text-zinc-400" />
                      Warehouse {index + 1}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 -mr-2"
                    >
                      <Trash2 className="size-4 mr-1" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField name={`warehouseLocations.${index}.address`} control={form.control} render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormControl>
                          <Input {...field} placeholder="Street address" disabled={!user || isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.postalCode`} control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="Postal code" disabled={!user || isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.city`} control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="City" disabled={!user || isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.country`} control={form.control} render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormControl>
                          <Input {...field} placeholder="Country" disabled={!user || isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.latitude`} control={form.control} render={({ field: { onChange, value } }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Latitude (opt)"
                            disabled={!user || isSubmitting}
                            value={value ?? ''}
                            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                            type="number"
                            step="any"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.longitude`} control={form.control} render={({ field: { onChange, value } }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Longitude (opt)"
                            disabled={!user || isSubmitting}
                            value={value ?? ''}
                            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                            type="number"
                            step="any"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                disabled={!user || isSubmitting}
                className="w-full"
                onClick={() => append({
                  address: '',
                  city: '',
                  country: '',
                  postalCode: '',
                  latitude: undefined,
                  longitude: undefined,
                })}
              >
                <Plus className="size-4 mr-1.5" />
                Add Warehouse Location
              </Button>
            </CardContent>
          )}
        </Card>

        {/* ── Submit Footer ── */}
        <div className="space-y-3">
          <MyFormError message={error} />
          <MyFormSuccess message={success} />
          <Button
            type="submit"
            disabled={!user || isSubmitting}
            className="w-full h-12 text-base font-medium"
            variant="vegaEmeraldBtn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Company'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};