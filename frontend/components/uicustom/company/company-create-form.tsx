'use client';

import React, { startTransition, useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { z } from 'zod';
import { MyFormError } from '../forms/form-error';
import { MyFormSuccess } from '../forms/form-sucess';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useEdgeStore } from '@/lib/edgestore';
import { useDropzone } from 'react-dropzone';
import { UploadCloudIcon, XCircle } from 'lucide-react';
import Image from 'next/image';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { MyCreateCompanyAction } from '@/actions/create-company';
import { companyCreationSchema } from '@/schemas';
import { EmployeeRole, User } from '@prisma/client';
import { useRouter } from 'next/navigation';

type UIEmployee = {
  userId: string;
  email: string;
  image: string;
  role: EmployeeRole;
  permissions: { [key: string]: boolean };
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

const INITIAL_OWNER_EMPLOYEE = (user: User) => ({
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
  const [employeeList, setEmployeeList] = useState<UIEmployee[]>(user ? [INITIAL_OWNER_EMPLOYEE(user)] : []);
  const [error, setError] = useState<string | undefined>('');
  const [error2, setError2] = useState<string | undefined>('');
  const [success, setSuccess] = useState<string | undefined>('');

  const form = useForm<z.infer<typeof companyCreationSchema>>({
    resolver: zodResolver(companyCreationSchema),
    defaultValues: {
      name: '',
      description: '',
      websiteUrl: '',
      logo: [''],
      bannerImage: [''],
      colorScheme: '',
      creatorId: user?.id ?? '',
      ownerId: user?.id ?? '',
      employees: user ? [{ ...INITIAL_OWNER_EMPLOYEE(user) }] : [],
      usesShipping: false,
      warehouseLocations: [{ address: '', postalCode: '', city: '', country: '', latitude: 0, longitude: 0 }],
    },
  });

  const { control, handleSubmit, formState: { errors, isSubmitting }, watch, reset } = form;
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'warehouseLocations',
  });

  const isShippingEnabled = watch('usesShipping');

  useEffect(() => {
    if (!isShippingEnabled) {
      form.clearErrors('warehouseLocations');
      form.resetField('warehouseLocations');
    }

    const subscription = form.watch((allValues) => {
      if (form.formState.isDirty && UID !== form.formState.defaultValues?.ownerId || form.formState.isDirty && UID !== allValues.ownerId) {
        form.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isShippingEnabled, UID]);

  useEffect(() => {
    const fetchUsers = async () => {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data);
    };

    fetchUsers();
  }, [user]);

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

    const updatedEmployeeList = [
      INITIAL_OWNER_EMPLOYEE(user!),
      ...employeeList.filter(employee => employee.userId !== user?.id),
    ];

    const updatedFormData = {
      ...values,
      employees: updatedEmployeeList,
    };

    console.log('Submitting with FINAL updated data / VALUES:', updatedFormData);

    startTransition(() => {
      MyCreateCompanyAction(updatedFormData)
        .then((data) => {
          if (data.error) {
            setError(data.error);
          }
          if (data.success) {
            setSuccess(data.success);
            router.push(`/nexus/company/${data.companyId}`);
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

  const smColumnsLogo = logoPreview.length ? Math.min(logoPreview.length, 2) : 1;
  const mdColumnsLogo = logoPreview.length ? Math.min(logoPreview.length, 3) : 1;
  const lgColumnsLogo = logoPreview.length ? Math.min(logoPreview.length, 4) : 1;
  const xlColumnsLogo = logoPreview.length ? Math.min(logoPreview.length, 5) : 1;
  const gridClassLogo = `sm:grid-cols-${smColumnsLogo} md:grid-cols-${mdColumnsLogo} lg:grid-cols-${lgColumnsLogo} xl:grid-cols-${xlColumnsLogo}`;

  const smColumnsBanner = bannerPreview.length ? Math.min(bannerPreview.length, 1) : 1;
  const mdColumnsBanner = bannerPreview.length ? Math.min(bannerPreview.length, 1) : 1;
  const lgColumnsBanner = bannerPreview.length ? Math.min(bannerPreview.length, 1) : 1;
  const xlColumnsBanner = bannerPreview.length ? Math.min(bannerPreview.length, 1) : 1;
  const gridClassBanner = `sm:grid-cols-${smColumnsBanner} md:grid-cols-${mdColumnsBanner} lg:grid-cols-${lgColumnsBanner} xl:grid-cols-${xlColumnsBanner}`;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-[640px] flex flex-col justify-start items-center border-y sm:border bg-slate-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600 sm:rounded">
        <div className="w-full flex flex-col justify-start items-center">
          <div>
            <h1 className='font-bold py-4 px-6'>Create a Company</h1>
          </div>
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className='w-full px-4 py-2'>
              <FormLabel>Company Name</FormLabel>
              <FormDescription className='px-4 py-0'>
                Enter a name to use for this company.
              </FormDescription>
              <FormControl>
                <Input {...field} placeholder="Enter company name" disabled={!user || isSubmitting} type="text" spellCheck='false' className='' />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem className='w-full px-4 py-2'>
              <FormLabel>Company Description</FormLabel>
              <FormDescription className='px-4 py-0'>
                Enter a description for the company.
              </FormDescription>
              <FormControl>
                <Input {...field} placeholder="Enter company description" disabled={!user || isSubmitting} type="text" spellCheck='false' className='' />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name='websiteUrl' render={({ field }) => (
            <FormItem className='w-full px-4 py-2'>
              <FormLabel>Company Website</FormLabel>
              <FormDescription className='px-4 py-0'>
                Add existing website url to your company.
              </FormDescription>
              <FormControl>
                <Input {...field} placeholder="Enter company website url" disabled={!user || isSubmitting} type="text" spellCheck='false' className='' />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name='logo' render={({ field }) => (
            <FormItem className='w-full px-4 pt-2' title='Optimal image ratio 1:1'>
              <FormLabel>Company Logo</FormLabel>
              <FormDescription className='px-4 py-0'>
                Add a logo to your company use a ratio of 1 : 1 for images.
              </FormDescription>
              <FormControl>
                <Input {...field} name='logo' disabled={!user || isSubmitting} spellCheck='false' className='hidden' {...getLogoInputProps()} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className='w-full px-4 py-2'>
            <div className={`h-full w-full flex justify-center items-center rounded-md bg-slate-100 dark:bg-slate-900 border border-input disabled:pointer-events-none px-3 py-2 text-sm ring-offset-bg-black/20 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}>
              <div {...getLogoRootProps()} className={`w-full dropzone cursor-pointer bg-slate-100 dark:bg-slate-900 rounded-md border border-dashed ${logoPreview.length >= 1 ? 'border-transparent dark:border-transparent bg-white/0 dark:bg-black/0 hover:bg-transparent dark:hover:bg-transparent' : ' border-gray-600/60 dark:border-gray-600/60'}`}>
                {logoPreview.length < 1 && (
                  <AspectRatio ratio={1 / 1}>
                    <div className={`text-center flex flex-col justify-center items-center w-full h-full text-black dark:text-white focus:outline-none transition rounded-md`} title='Optimal image ratio 1:1'>
                      <UploadCloudIcon className="mx-auto h-8 w-8 text-gray-600 dark:text-gray-200" />
                      <p className="p-4 pt-0 text-sm text-gray-600 dark:text-gray-200 hidden xxs:flex">
                        Drag a LOGO here or <br /> Click to select
                      </p>
                    </div>
                  </AspectRatio>
                )}
                {logoPreview.length >= 1 && (
                  <div className={`grid gap-3 ${gridClassLogo} min-w-[64px] xs:min-w-[300px] sm:min-w-[420px] grow place-items-stretch`}>
                    {logoPreview.map((preview, index) => (
                      <div key={index} className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300`}>
                        <div className="relative flex flex-col">
                          <div className='min-w-0 shrink-0 grow-0 basis-full flex justify-center'>
                            <AspectRatio ratio={1 / 1}>
                              <Image src={preview} alt={`preview-${index}`} fill sizes="100%" priority className="object-fill" />
                            </AspectRatio>
                          </div>
                          <div onClick={(e) => removeImageLogo(e, index)} className="absolute top-1 right-1 hover:scale-110 transform duration-300 bg-gray-800/30 hover:bg-red-600/40 text-white p-1 rounded-full">
                            <XCircle className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <FormField control={form.control} name='bannerImage' render={({ field }) => (
            <FormItem className='w-full px-4 py-2' title='Optimal image ratio 3:1'>
              <FormLabel>Company Banner</FormLabel>
              <FormDescription className='px-4 py-0'>
                Add a banner to your company use a ratio of 3 : 1 for images.
              </FormDescription>
              <FormControl>
                <Input {...field} name='bannerImage' disabled={!user || isSubmitting} spellCheck='false' className='hidden' {...getBannerInputProps()} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className='w-full px-4 py-2'>
            <div className={`h-full w-full flex justify-center items-center rounded-md bg-slate-100 dark:bg-slate-900 border border-input disabled:pointer-events-none px-3 py-2 text-sm ring-offset-bg-black/20 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}>
              <div {...getBannerRootProps()} className={`w-full dropzone cursor-pointer bg-slate-100 dark:bg-slate-900 rounded-md border border-dashed ${bannerPreview.length >= 1 ? 'border-transparent dark:border-transparent bg-white/0 dark:bg-black/0 hover:bg-transparent dark:hover:bg-transparent' : ' border-gray-600/60 dark:border-gray-600/60'}`}>
                {bannerPreview.length < 1 && (
                  <AspectRatio ratio={3 / 1}>
                    <div className={`text-center flex flex-col justify-center items-center w-full h-full text-black dark:text-white focus:outline-none transition rounded-md`} title='Optimal image ratio 3:1'>
                      <UploadCloudIcon className="h-8 w-8 text-gray-600 dark:text-gray-200" />
                      <p className="p-4 pt-0 text-sm text-gray-600 dark:text-gray-200 hidden xs:block">
                        Drag a Banner here or Click to select
                      </p>
                    </div>
                  </AspectRatio>
                )}
                {bannerPreview.length >= 1 && (
                  <div className={`grid gap-3 ${gridClassBanner} min-w-[64px] xs:min-w-[300px] sm:min-w-[420px] grow place-items-stretch`}>
                    {bannerPreview.map((preview, index) => (
                      <div key={index} className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300`}>
                        <div className="relative flex flex-col">
                          <div className='min-w-0 shrink-0 grow-0 basis-full flex justify-center'>
                            <AspectRatio ratio={3 / 1}>
                              <Image src={preview} alt={`preview-${index}`} fill sizes="100%" priority className="object-fill" />
                            </AspectRatio>
                          </div>
                          <div onClick={(e) => removeImageBanner(e, index)} className="absolute top-1 right-1 hover:scale-110 transform duration-300 bg-gray-800/30 hover:bg-red-600/40 text-white p-1 rounded-full">
                            <XCircle className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <FormField control={form.control} name='employees' render={({ field }) => (
            <FormItem className='w-full px-4 py-2'>
              <FormLabel>Employees</FormLabel>
              <FormDescription className='px-4 py-0'>
                Select users to add to your company as Employees and assign their roles.
              </FormDescription>
              <div className="flex flex-col bg-slate-50 dark:bg-slate-900 p-2 rounded">
                <div className={'grid gap-2 p-2'}>
                  <Select onValueChange={setSelectedEmployeeId} value={selectedEmployeeId}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users
                        .filter(userMap => !employeeList.some(employee => employee.userId === userMap.id))
                        .map((userMap) => (
                          <React.Fragment key={userMap.id}>
                            <SelectItem value={userMap.id}>{userMap.email}</SelectItem>
                          </React.Fragment>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button type='button' onClick={handleAddEmployee} variant='vegaNormalBtn' className={''}>
                    Add Employee
                  </Button>
                  {error2 && <p className='text-orange-300'>{error2 && error2}</p>}
                </div>
                <div className={`flex flex-col justify-between items-center gap-3 p-4 pt-0 ${employeeList.length <= 1 ? 'hidden' : ''}`}>
                  {employeeList.map((employee, index) => (
                    <div key={employee.userId} className={`flex justify-between items-center gap-3 p-2 w-full bg-slate-200 dark:bg-slate-700 ${employee.userId === user?.id && 'hidden'} rounded`} >
                      <div className={'capitalize bg-slate-100 dark:bg-slate-800 p-2 rounded'}>{employee.email}</div>
                      <Select defaultValue={employee.role} onValueChange={(newRole) => handleRoleChange(employee.userId, newRole as EmployeeRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent >
                          {Object.values(EmployeeRole).filter(role => role !== 'OWNER' || employee.userId === user?.id).map((role) => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant='vegaNormalBtn' disabled={employee.userId === user?.id} onClick={(e) => removeEmployee(e, employee.userId)}>Remove</Button>
                    </div>
                  ))}
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name='usesShipping' render={({ field }) => (
            <FormItem className='w-full px-4 py-2'>
              <div className="flex flex-col justify-start w-full items-start space-y-2">
                <FormLabel>
                  <div className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-pretty">
                    <p className='hidden xs:flex'>Enable Shipping Cost Estimation for Physical Products?</p>
                    <p className='xs:hidden'>Enable Shipping Cost Calc?</p>
                  </div>
                </FormLabel>
                <div className="flex h-10 bg-slate-50 dark:bg-slate-900 w-full space-x-2 rounded-md border border-input disabled:pointer-events-none bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <FormControl>
                    <Input {...field} className='w-5 h-5 ' disabled={!user || isSubmitting} type='checkbox' value={field.value ? 'false' : 'true'} />
                  </FormControl>
                  <span className={`text-sm font-medium ${field.value ? 'Activated' : 'text-black/50 dark:text-white/50'}`}>
                    {field.value ? 'Activated' : 'Inactivated'}
                  </span>
                </div>
                <FormDescription className={`px-4 py-0 ${!form.watch('usesShipping') && 'hidden'}`}>
                  Add warehouse locations for shipping data estimation of physical products.
                </FormDescription>
              </div>
              <FormMessage />
            </FormItem>
          )} />
          <div className='w-full space-y-3 px-4 pb-2 '>
            {form.watch('usesShipping') && (
              fields.map((field, index) => {
                return (
                  <div key={field.id} className="space-y-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-800 py-4 px-2 rounded">
                    <FormLabel className='w-full'>
                      <div className='flex flex-col xs:flex-row justify-between space-y-2'>
                        <h1 className='py-4 pl-2 font-semibold'>Warehouse Location {index + 1}</h1>
                        <Button type="button" variant='vegaNormalBtnRed' className='' onClick={() => remove(index)}>Remove Location</Button>
                      </div>
                    </FormLabel>
                    <FormField name={`warehouseLocations.${index}.address`} control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="Address" disabled={!user || isSubmitting} type="text" title={"Enter street name and number."} className='bg-white dark:bg-slate-800' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.postalCode`} control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="postal code" disabled={!user || isSubmitting} type="text" title={"Enter your ZIP/postal code. E.g., 12345 or A1B 2C3."} className='bg-white dark:bg-slate-800' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.city`} control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="City" disabled={!user || isSubmitting} type="text" title={"Enter the name of your city."} className='bg-white dark:bg-slate-800' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.country`} control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="Country" disabled={!user || isSubmitting} type="text" title={"Select your country from the list."} className='bg-white dark:bg-slate-800' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.latitude`} control={form.control} render={({ field: { onChange, value } }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="Latitude (Optional)" disabled={!user || isSubmitting} value={value} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} type="number" step="any" title={"Enter latitude in decimal format (e.g., 59.9139)."} className='bg-white dark:bg-slate-800' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name={`warehouseLocations.${index}.longitude`} control={form.control} render={({ field: { onChange, value } }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="Longitude (Optional)" disabled={!user || isSubmitting} value={value} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} type="number" step="any" title={"Enter longitude in decimal format (e.g., 10.7522)."} className='bg-white dark:bg-slate-800' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )
              })
            )}
            {form.watch('usesShipping') && (
              <Button type="button" variant='vegaNormalBtn' disabled={!user || isSubmitting} className='w-full' onClick={() => append({
                address: '',
                city: '',
                country: '',
                postalCode: '',
                latitude: undefined,
                longitude: undefined
              })}>
                Add Location
              </Button>
            )}
          </div>
        </div>
        <div className='w-full px-4 py-2'>
          <MyFormError message={error} />
          <MyFormSuccess message={success} />
          <Button type="submit" disabled={!user || isSubmitting} className="w-full" variant="vegaEmeraldBtn">Create Company</Button>
        </div>
      </form>
    </Form>
  );
};