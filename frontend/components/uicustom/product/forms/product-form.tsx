'use client';

import React, { useEffect, useState, useCallback, useRef, useTransition } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyProductCreateSchema } from '@/schemas';
import { MyFormError } from '../../forms/form-error';
import { MyFormSuccess } from '../../forms/form-sucess';
import { MyCreateProductAction } from '@/actions/products';
import { useCurrentUser } from '@/hooks/use-current-user';
import { UserRole, WarehouseLocation } from '@prisma/client';
import { UploadCloudIcon, XCircle } from 'lucide-react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { Textarea } from '@/components/ui/textarea';
import UserCompanyPermission from '../../user-company-permission';
import { fetchUserEmployeePermissions } from '@/actions/user-company-permissions';
import { getUserById } from '@/data/user';

interface PostalCodeDetails {
  postal_code: string;
  city: string;
  municipalityId: string;
  municipality: string;
  county: string;
  po_box: boolean;
  latitude: string;
  longitude: string;
}

interface PostalCodesResponse {
  postal_codes: PostalCodeDetails[];
}

interface Specification {
  key: string;
  value: string | number;
  type: 'text' | 'number';
  placeholder?: string;
}

const MyLogPrefix = '[frontend/components/uicustom/forms/product-form.tsx]';

export const MyProductCreationForm = () => {
  // General States
  const clientUser = useCurrentUser();
  const { edgestore } = useEdgeStore();
  const [uId, setUId] = useState<string | undefined>(clientUser?.id); // role admin to modify input value
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isPhysicalProduct, setIsPhysicalProduct] = useState<boolean>(false);
  const [isCompanyProduct, setIsCompanyProduct] = useState<boolean>(false);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const examplePlaceholders = ['Weight', 'Height', 'Length', 'Width', 'Material', 'Color', 'Size', 'Brand', 'Model', 'Country of Origin', 'Warranty', 'Certification'];
  const [postalCodeInput, setPostalCodeInput] = useState('');
  const [suggestions, setSuggestions] = useState<PostalCodeDetails[]>([]);
  const [postalCodes, setPostalCodes] = useState<string[]>([]);
  const [postalCodeDetails, setPostalCodeDetails] = useState<PostalCodesResponse | null>(null);
  const [selectedPostalCodeDetail, setSelectedPostalCodeDetail] = useState<PostalCodeDetails | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [companyId, setCompanyId] = useState<string>('');
  const [permissionTag, setPermissionTag] = useState('CAN_POST_PRODUCT_POSITION_PERMISSION');
  const [PermissionCheckResult, setPermissionCheckResult] = useState<boolean>(false);
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([]);
  const [warehouseLocationError, setWarehouseLocationError] = useState<string | null>(null);
  const companiesFetched = useRef(false);

  // UI States
  const [counter, setCounter] = useState(0);
  const [error, setError] = useState<string | undefined>('');
  const [success, setSuccess] = useState<string | undefined>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPendingSpecifications, startTransitionSpecifications] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof MyProductCreateSchema>>({
    resolver: zodResolver(MyProductCreateSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      price: 0.0,
      stock: 0,
      userId: clientUser?.id,
      image: [''],
      quantity: 0, // Add default value for quantity
      isPhysicalProduct: false,
    },
  });

  const fetchPostalCodeDetails = async (postalCode: string) => {
    if (!postalCode) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const pageRequests = [1, 2].map(page =>
        fetch(`/api/bring-shipping-suggest-postcode?postalCode=${postalCode}&page=${page}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }).then(response => {
          if (!response.ok) throw new Error(`Failed to fetch page ${page}`);
          return response.json() as Promise<PostalCodesResponse>;
        })
      );

      const pagesData = await Promise.all(pageRequests);
      const combinedPostalCodes = pagesData.flatMap(data => data.postal_codes);
      setSuggestions(combinedPostalCodes);
    } catch (error) {
      console.error('Error fetching postal code suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (postalCodeInput) {
      fetchPostalCodeDetails(postalCodeInput);
    }
  }, [postalCodeInput]);

  const validateIsAdmin = async (values: z.infer<typeof MyProductCreateSchema>) => {
    if (values.userId) {
      console.log('Checking clientUser role by Id:', values.userId);
      startTransitionSpecifications(async () => {
        await getUserById(values.userId)
          .then((data) => {
            if (data?.role === UserRole.ADMIN) {
              console.log(`${MyLogPrefix} validateIsAdmin(data.role) TRUE`, data?.role);
            } else {
              console.log(`${MyLogPrefix} validateIsAdmin(data.role) FALSE`, data?.role.toString());
            }
          });
      });
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    setImages([...images, ...acceptedFiles]);
    const newPreviews = acceptedFiles.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
    setCounter(counter + 1);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
  });

  const imageHandler = async () => {
    let uploadedUrls = [];
    for (let image of images) {
      try {
        const uploadResult = await edgestore.myPublicImages.upload({ file: image });
        uploadedUrls.push(uploadResult.url);
      } catch (error) {
        console.error('Upload error', error);
      }
    }
    return uploadedUrls;
  };

  const removeImage = (e: any, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    setCounter(counter - 1);
    const newImagePreviews = imagePreviews.filter((_, i) => i !== index);
    setImagePreviews(newImagePreviews);
  };

  const handleSpecificationChange = (
    index: number,
    field: 'key' | 'value',
    value: string | number
  ) => {
    const updatedSpecifications: Specification[] = specifications.map((spec, specIndex) =>
      index === specIndex
        ? {
            ...spec,
            [field]: field === 'key'
              ? value
              : (spec.key === 'Weight' || spec.key === 'Height' || spec.key === 'Length' || spec.key === 'Width') && field === 'value'
                ? parseFloat(value.toString()) || 0
                : value,
            type: field === 'key' && (value === 'Weight' || value === 'Height' || value === 'Length' || value === 'Width')
              ? 'number'
              : 'text',
          }
        : spec
    );
    setSpecifications(updatedSpecifications);
  };

  const removeSpecification = (index: number) => {
    const updatedSpecifications = specifications.filter((_, specIndex) => index !== specIndex);
    setSpecifications(updatedSpecifications);
  };

  const addSpecification = () => {
    const excludeKeys = ['Weight', 'Height', 'Length', 'Width'];
    const filteredPlaceholders = isPhysicalProduct
      ? examplePlaceholders
      : examplePlaceholders.filter(placeholder => !excludeKeys.includes(placeholder));
  
    const nextPlaceholder = filteredPlaceholders.find(placeholder =>
      !specifications.some(spec => spec.key === placeholder)
    ) ?? ''; // Ensure nextPlaceholder is a string
  
    const newSpec: Specification = {
      key: nextPlaceholder,
      value: '',
      type: excludeKeys.includes(nextPlaceholder) ? 'number' : 'text'
    };
  
    setSpecifications([...specifications, newSpec]);
  };

  const onSubmit = async (values: z.infer<typeof MyProductCreateSchema>) => {
    setError('');
    setSuccess('');
  
    if (images) {
      const resUploadedImageUrls = await imageHandler();
      if (resUploadedImageUrls.length > 0) {
        values.image = resUploadedImageUrls;
      } else {
        setError('Error image not found? Please try again!');
        return;
      }
    }
  
    const formattedSpecifications = specifications.map((spec) => {
      return {
        key: spec.key,
        value:
          typeof spec.value === 'number'
            ? spec.value
            : spec.key === 'Weight'
            ? parseFloat(spec.value.toString()) || 0
            : spec.value,
      };
    });
  
    if (specifications && specifications.length > 0) {
      values.specifications = formattedSpecifications;
    }
  
    if (companyId && companyId.length > 0) {
      values.companyId = companyId;
    }
  
    if (isPhysicalProduct && isPhysicalProduct === true) {
      values.isPhysicalProduct = isPhysicalProduct;
    }
  
    // Add postal code input if not empty
    if (postalCodeInput.trim() !== '') {
      postalCodes.push(postalCodeInput.trim());
    }
  
    values.shipFromPostalId = postalCodes.join(', ');
  
    startTransition(() => {
      validateIsAdmin(values);
      MyCreateProductAction(values, postalCodes)
        .then((data) => {
          if (data.error) {
            setError(data.error);
          }
          if (data.success) {
            setSuccess(data.success);
            handleReset();
          }
        });
    });
  };

  const handleStartEdit = () => {
    setIsEditing(!isEditing);
    handleReset();
  };

  const handleCancelEdit = () => {
    form.reset();
    setIsEditing(false);
    setCounter(0);
    setImagePreviews([]);
    handleReset();
  };

  const handleReset = () => {
    setCounter(0);
    setError('');
    setImages([]);
    setImagePreviews([]);
    setSpecifications([]);
    setIsPhysicalProduct(false);
    setIsCompanyProduct(false);
    setPostalCodes([]);
    form.reset();
    setTimeout(() => {
      setSuccess('');
    }, 5000);
  };

  const handlePhysicalProduct = () => {
    setIsPhysicalProduct(!isPhysicalProduct);
  };

  const handleCompanyProduct = () => {
    const newIsCompanyProduct = !isCompanyProduct;
    setIsCompanyProduct(newIsCompanyProduct);
    setPostalCodes([]);
    setWarehouseLocations([]);
    setWarehouseLocationError(null);

    if (newIsCompanyProduct && !companiesFetched.current) {
      console.log('Fetching companies...');
      companiesFetched.current = true; // Set this to true to avoid re-fetching
    }
  };

  useEffect(() => {
    if (isCompanyProduct === false && companyId !== '') {
      setCompanyId('');
      setPostalCodes([]);
      setWarehouseLocations([]);
      setWarehouseLocationError(null);
      setIsCompanyProduct(false)
      companiesFetched.current = false;
      console.log(`[FormManager] 'isCompanyProduct' has been removed and states has been reset.`)
    }
  }, [companyId, isCompanyProduct])

  const handleCompanySelect = useCallback(async (companyId: string) => {
    console.log(`Selected company ID: ${companyId}`);
    setCompanyId(companyId);

    try {
      const response = await fetch(`/api/companies/${companyId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch company details');
      }
      const companyDetails = await response.json();
      setWarehouseLocations(companyDetails.warehouseLocations || []);
      setWarehouseLocationError(companyDetails.warehouseLocations.length === 0 ? 'Selected company does not have warehouse locations. Please enter the postal code manually.' : null);
    } catch (error) {
      console.error('Error fetching company details:', error);
      setWarehouseLocationError('Error fetching company details. Please enter the postal code manually.');
    }
  }, []);

  const handleSelectWarehouseLocation = (postalCodeOrEvent: string | React.ChangeEvent<HTMLInputElement>) => {
    let selectedValue;
    if (typeof postalCodeOrEvent === 'string') {
      selectedValue = postalCodeOrEvent;
    } else {
      selectedValue = postalCodeOrEvent.target.value;
    }
  
    const isChecked = typeof postalCodeOrEvent === 'string' 
      ? !postalCodes.includes(selectedValue) 
      : postalCodeOrEvent.target.checked;
  
    if (isChecked) {
      setPostalCodes([...postalCodes, selectedValue]);
    } else {
      setPostalCodes(postalCodes.filter(code => code !== selectedValue));
    }
    console.log(`Selected postal codes: ${postalCodes}`);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    const selectedPostalCodeData = suggestions.find(suggestion => suggestion.postal_code === selectedValue);
    setSelectedPostalCodeDetail(selectedPostalCodeData ?? null);
    setPostalCodeInput(selectedValue);
  };

  const customStyles = {
    item: `group flex flex-col w-full items-start`,
    itemHoverEffect: `group flex flex-col w-full items-start hover:bg-black/30 p-2 rounded`,
    itemRole: `${clientUser?.role === UserRole.ADMIN ? 'group items-start hidden flex-col' : 'hidden'}`,
    label: `text-sm font-medium text-black/80 dark:text-white/80 group-focus-within:text-black dark:group-focus-within:text-white group-focus-within:scale-110 transition transform duration-300 ease-in-out`,
    input: `w-full border disabled:bg-white/60 bg-slate-50 hover:bg-slate-200 dark:disabled:bg-black/50 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:text-black transition transform duration-300 ease-in-out`,
    inputCheckbox: `border disabled:bg-white/60 bg-slate-50 hover:bg-slate-200 dark:disabled:bg-black/50 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:text-black transition transform duration-300 ease-in-out`
  };

  return (
    <div className='w-full h-full'>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex justify-center w-full'>
          <div className='flex flex-col justify-center items-start lg:flex-row w-full h-full bg-neutral-300 dark:bg-slate-700 max-w-[1440px] rounded-xl overflow-hidden shadow-lg'>
            <div className='gap-y-2 flex flex-col justify-start items-start w-full h-full py-2 pb-4 px-4 lg:w-4/6'>
              <FormField control={form.control} name='title' render={({ field }) => (
                <FormItem className={`${customStyles.itemHoverEffect}`}>
                  <FormLabel className={`${customStyles.label} text-md`}>What should the product title for this product be?</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isPending} placeholder='Choose a title' type='text' className={`${customStyles.input}`} spellCheck='false' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              />
              <FormField control={form.control} name='category' render={({ field }) => (
                <FormItem className={`${customStyles.itemHoverEffect}`}>
                  <FormLabel className={`${customStyles.label} text-md`}>What category can we use for this product?</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isPending} placeholder='Choose a category' type='text' className={`${customStyles.input}`} spellCheck='false' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              />
              <FormField control={form.control} name='description' render={({ field }) => (
                <FormItem className={`${customStyles.itemHoverEffect}`}>
                  <FormLabel className={`${customStyles.label} text-md`}>How would you best describe this product?</FormLabel>
                  <FormControl>
                    <Textarea {...field} disabled={isPending} placeholder='This product is great because I made it myself' className={`${customStyles.input} h-40 text-wrap no-underline`} spellCheck='false' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              />
              <FormField control={form.control} name='price' render={({ field }) => (
                <FormItem className={`${customStyles.itemHoverEffect}`}>
                  <FormLabel className={`${customStyles.label} text-md`}>What should be the price of a single unit of this product?</FormLabel>
                  <FormControl>
                    <div className={'relative w-full items-end'}>
                      <div className={`pointer-events-none absolute inset-y-0 right-2 flex items-center pl-3`}>
                        <span className='sm:text-sm z-10 group-focus-within:scale-110 transition transform duration-300 ease-in-out'>$</span>
                      </div>
                      <Input
                        {...field}
                        disabled={isPending}
                        placeholder='Set a price'
                        type='text'
                        step='1'
                        className={`${customStyles.input} text-end appearance-none pr-6`}
                        spellCheck='false'
                        onChange={e => {
                          const value = e.target.value;
                          form.setValue('price', value ? parseFloat(value) : 0, { shouldValidate: true });
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              />
              <FormField control={form.control} name='userId' render={({ field }) => (
                <FormItem className={`${customStyles.itemRole}`}>
                  <FormLabel className={`${customStyles.label}`}>Whats the UserID of the actor that is creating this product?</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={clientUser?.role === UserRole.ADMIN ? isPending : true} value={clientUser?.role === UserRole.ADMIN ? uId : clientUser?.id} onChange={e => setUId(e.target.value)} placeholder='Your Id' type='text' className={`${customStyles.input}`} spellCheck='false' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              />
              <div className={`hover:bg-black/30 p-2 rounded flex flex-col gap-4 justify-center items-start w-full`}>
                <FormLabel htmlFor='checkbox-isCompanyProduct' className={`${customStyles.label} text-md`}>
                  Should this product be posted on behalf of a Company?
                </FormLabel>
                <label
                  htmlFor='checkbox-isCompanyProduct'
                  className='hover:cursor-pointer group flex gap-4 justify-start items-center py-2 px-4 w-full border disabled:bg-white/60 bg-slate-50 hover:bg-slate-200 dark:disabled:bg-black/50 dark:bg-black/50 dark:hover:bg-black/40 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:text-black transition transform duration-300 ease-in-out'
                  title={
                    isCompanyProduct
                      ? "Yes, post this on-behalf of selected company."
                      : "No, post this as an individual owned product."
                  }
                >
                  <div className={'flex gap-4 justify-start items-center'}>
                    <input
                      className={`${customStyles.inputCheckbox} group-hover:bg-slate-200`}
                      type="checkbox"
                      id={`checkbox-isCompanyProduct`}
                      checked={isCompanyProduct}
                      onChange={() => handleCompanyProduct()}
                    />
                    <p className={``}>
                      {isCompanyProduct === true ? 'Yes' : 'No'}
                    </p>
                  </div>
                </label>
                {isCompanyProduct === true &&
                  <UserCompanyPermission permissionTag="CAN_POST_PRODUCT_POSITION_PERMISSION" onCompanySelect={handleCompanySelect} />
                }
              </div>
              <div className={`hover:bg-black/30 p-2 rounded flex flex-col gap-4 justify-center items-start w-full`}>
                <FormLabel htmlFor='checkbox-isPhysicalProduct' className={`${customStyles.label} text-md`}>
                  Is the product a real world asset and requires shipping?
                </FormLabel>
                <label
                  htmlFor='checkbox-isPhysicalProduct'
                  className='hover:cursor-pointer group flex gap-4 justify-start items-center py-2 px-4 w-full border disabled:bg-white/60 bg-slate-50 hover:bg-slate-200 dark:disabled:bg-black/50 dark:bg-black/50 dark:hover:bg-black/40 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:text-black transition transform duration-300 ease-in-out'
                  title={
                    isPhysicalProduct
                      ? "Yes, this is a tangible product. Please provide detailed specifications including weight and dimensions, as these are necessary for accurate shipping calculations."
                      : "No, this is a digital product. No shipping details are required. However, you may still provide relevant specifications that describe your product to potential buyers."
                  }
                >
                  <div className={'flex gap-4 justify-start items-center'}>
                    <input
                      className={`${customStyles.inputCheckbox} group-hover:bg-slate-200`}
                      type="checkbox"
                      id={`checkbox-isPhysicalProduct`}
                      checked={isPhysicalProduct}
                      onChange={() => handlePhysicalProduct()}
                    />
                    <p className={``}>
                      {isPhysicalProduct === true ? 'Yes' : 'No'}
                    </p>
                  </div>
                </label>
                {isPhysicalProduct === true && (
                  <div className='w-full'>
                    {warehouseLocations.length > 0 && (
                      <div className=''>
                        <FormLabel className={`${customStyles.label}`}>Select one or multiple warehouses from company registred locations</FormLabel>
                        <div className='flex flex-wrap gap-2'>
                          {warehouseLocations.map((location, index) => (
                            <div key={index} className={`border disabled:bg-white/60 bg-slate-50 hover:bg-slate-200 dark:disabled:bg-black/50 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:text-black transition transform duration-300 ease-in-out group flex justify-start items-center`} onClick={() => handleSelectWarehouseLocation(location.postalCode)}>
                              <div className='flex gap-2 justify-start items-center py-2 px-4'>
                                <input
                                  type='checkbox'
                                  value={location.postalCode}
                                  checked={postalCodes.includes(location.postalCode)}
                                  onChange={() => handleSelectWarehouseLocation(location.postalCode)}
                                  className={`${customStyles.inputCheckbox} h-[15px] w-[15px] group-hover:bg-slate-200`}
                                  onClick={(e) => e.stopPropagation()} // Prevent the parent click event from firing
                                />
                                <label className=''>{`${location.postalCode} - ${location.city}`}</label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {isCompanyProduct === false && 
                    <FormField control={form.control} name='shipFromPostalId' render={({ field }) => (
                      <FormItem className={`${customStyles.item}`}>
                        <FormLabel className={`${customStyles.label}`}>Enter warehouse postal code</FormLabel>
                        <FormControl>
                          <Input {...field} id='postalCode'
                            disabled={isPending}
                            placeholder='postal ID'
                            type='text'
                            value={postalCodeInput}
                            onChange={(e) => {
                              const newPostalCode = e.target.value;
                              setPostalCodeInput(newPostalCode);
                              fetchPostalCodeDetails(newPostalCode);
                            }}
                            className={`${customStyles.input} postal-code-input`}
                            spellCheck='false'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      )}
                    />
                    }
                    {warehouseLocationError && (
                      <p className="text-red-600 dark:text-red-400">{warehouseLocationError}</p>
                    )}
                    {suggestions.length > 0 && (
                      <>
                        <select
                          onChange={handleSelectChange}
                          className={`${customStyles.input}`}
                        >
                          {suggestions
                            .filter((suggestion) => suggestion.postal_code.startsWith(postalCodeInput) || suggestion.city.toLowerCase().includes(postalCodeInput.toLowerCase()))
                            .map((filteredSuggestion, index) => (
                              <option key={index} value={filteredSuggestion.postal_code}>
                                {filteredSuggestion.postal_code} - {filteredSuggestion.city}
                              </option>
                            ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </div>
              <FormField control={form.control} name='specifications' render={({ field }) => (
              <FormItem className={`${customStyles.itemHoverEffect}`}>
                <FormLabel className={`${customStyles.label}`}>Specifications</FormLabel>
                <FormControl>
                  <div>
                    <div
                      className={`hover:cursor-pointer py-2 px-4 my-2 w-fit bg-slate-50 hover:bg-slate-200 dark:disabled:bg-black/50 dark:bg-black/60 dark:hover:bg-black/50 border-gray-200 dark:border-gray-500 text-black dark:text-white rounded`}
                      onClick={addSpecification}
                      title="Adds a specification to the product."
                    >
                      Add Specification
                    </div>
                    {specifications.map((spec, index) => (
                      <div key={index}>
                        <div className={`flex gap-2 items-center`}>
                          <select
                            name="specification"
                            value={spec.key}
                            onChange={(e) => handleSpecificationChange(index, 'key', e.target.value)}
                            title="Select the specification type"
                            className="border p-2 bg-white dark:disabled:bg-black/50 dark:bg-black/70 border-gray-200 dark:border-gray-500 text-black dark:text-white rounded"
                          >
                            {examplePlaceholders.map((placeholder, i) => (
                              <option key={i} value={placeholder}>{placeholder}</option>
                            ))}
                          </select>
                          <Input
                            value={spec.value}
                            onChange={(e) => handleSpecificationChange(index, 'value', e.target.value)}
                            placeholder="Value"
                            type={spec.type}
                            spellCheck='false'
                            title={
                              spec.key === 'Weight' ? "Enter weight in grams" :
                              ['Height', 'Length', 'Width'].includes(spec.key) ? "Enter measurements in centimeters" :
                              ""
                            }
                          />
                          <div className={`hover:cursor-pointer py-2 px-4 rounded bg-black/30 m-2`} onClick={(event) => removeSpecification(index)}>Remove</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
            />
            <FormField control={form.control} name='quantity' render={({ field }) => (
              <FormItem className={`${customStyles.itemHoverEffect}`}>
                <FormLabel className={`${customStyles.label}`}>Quantity</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={isPending}
                    placeholder='Set quantity'
                    type='number'
                    className={`${customStyles.input}`}
                    spellCheck='false'
                    onChange={(e) => form.setValue('quantity', Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
            />
            </div>

            <div className='w-full h-full'>
              <div className="w-full h-full py-2 pt-4 px-4 flex flex-col items-start">
                <FormField control={form.control} name='image' render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input {...field} disabled={isPending} name='image' spellCheck='false' {...getInputProps()} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div {...getRootProps()} className={`disabled:bg-white/60 bg-white dark:disabled:bg-black/50 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-500 text-black dark:text-white rounded focus:outline-none transition dropzone flex flex-col h-full w-full justify-center items-center border border-dashed ${imagePreviews ? ' border-gray-600/60 dark:border-gray-600/60' : 'border-gray-400 dark:border-gray-400'} rounded-md cursor-pointer`}>
                  {imagePreviews.length < 1 && (
                    <div className="text-center flex flex-col min-h-48 justify-center items-center h-[420px] max-h-[420px]">
                      <UploadCloudIcon className="mx-auto h-8 w-8 text-gray-600 dark:text-gray-200" />
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-200">
                        Drag n drop an IMAGE here, or click to select an IMAGE
                      </p>
                    </div>
                  )}
                  <div className={`grid ${counter == 2 ? 'grid-cols-2' : counter == 3 ? 'grid-cols-3' : counter >= 4 ? 'grid-cols-4' : 'grid-cols-1'}`}>
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative m-1">
                        <Image src={preview} alt={`preview-${index}`} height={600} width={450} className="h-full w-full rounded-md object-cover" />
                        <div onClick={(e) => removeImage(e, index)} className="absolute top-1 right-1 hover:scale-110 transform duration-300 bg-gray-800/30 hover:bg-red-600/40 text-white p-1 rounded-full">
                          <XCircle className="h-4 w-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className='w-full py-2'>
                  <MyFormError message={error} />
                  <MyFormSuccess message={success} />
                  <Button type='submit' disabled={isPending} className='w-full' variant='vegaEmeraldBtn'>
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};