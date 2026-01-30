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
import { RxCrossCircled } from "react-icons/rx";
import { FaFileUpload } from "react-icons/fa";
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { Textarea } from '@/components/ui/textarea';
import UserCompanyPermission from '../../user-company-permission';
import { fetchUserEmployeePermissions } from '@/actions/user-company-permissions';

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
	const [isUploadingImages, setIsUploadingImages] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<number[]>([]);
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


  const MAX_IMAGES = 8;

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = (acceptedFiles: File[]) => {
    const remaining = Math.max(0, MAX_IMAGES - images.length);
    const nextFiles = acceptedFiles.slice(0, remaining);
    if (nextFiles.length === 0) return;

    setImages((prev) => [...prev, ...nextFiles]);
    const newPreviews = nextFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
  });

  const imageHandler = async () => {
    if (!images || images.length === 0) return [];
		setIsUploadingImages(true);
		setUploadProgress(images.map(() => 0));

    const uploadedUrls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        const uploadResult = await edgestore.myPublicImages.upload({
					file: image,
					onProgressChange: (p: number) => {
						setUploadProgress((prev) => {
							const next = prev.slice();
							next[i] = p;
							return next;
						});
					},
				});
        uploadedUrls.push(uploadResult.url);
      } catch (error) {
        console.error('Upload error', error);
				setIsUploadingImages(false);
        throw error;
      }
    }
		setIsUploadingImages(false);
    return uploadedUrls;
  };

  const removeImage = (e: any, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const url = imagePreviews[index];
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setUploadProgress((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImage = (from: number, to: number) => {
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setImagePreviews((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setUploadProgress((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
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
      MyCreateProductAction(values, postalCodes)
        .then((data) => {
          if ('error' in data) {
            setError(data.error);
          }
          if ('success' in data) {
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
    imagePreviews.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    setImagePreviews([]);
    setImages([]);
    setUploadProgress([]);
    setIsUploadingImages(false);
    handleReset();
  };

  const handleReset = () => {
		imagePreviews.forEach((url) => {
			try {
				URL.revokeObjectURL(url);
			} catch {
				// ignore
			}
		});
    setError('');
    setImages([]);
    setImagePreviews([]);
		setUploadProgress([]);
		setIsUploadingImages(false);
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
    section: 'space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5',
    sectionTitle: 'text-sm font-medium text-white/90 mb-3',
    item: `group flex flex-col w-full items-start`,
    itemHoverEffect: `group flex flex-col w-full items-start`,
    itemRole: `${clientUser?.role === UserRole.ADMIN ? 'group items-start hidden flex-col' : 'hidden'}`,
    label: `text-sm font-medium text-white/80 group-focus-within:text-white transition-colors duration-200`,
    labelHint: 'text-xs text-white/50 mt-0.5 font-normal',
    input: `w-full bg-white/[0.06] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white placeholder:text-white/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all duration-200`,
    inputCheckbox: `rounded border-white/30 bg-white/[0.06] text-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-0`,
    toggle: `hover:cursor-pointer flex gap-3 items-center py-3 px-4 w-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200`,
  };

  return (
    <div className='w-full h-full'>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex justify-center w-full'>
          <div className='grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-6 w-full max-w-[1200px]'>
            {/* Main form fields */}
            <div className='space-y-6'>
              {/* Basic info section */}
              <div className={customStyles.section}>
                <h3 className={customStyles.sectionTitle}>Basic Information</h3>
                
                <FormField control={form.control} name='title' render={({ field }) => (
                  <FormItem className={customStyles.item}>
                    <FormLabel className={customStyles.label}>
                      Product title
                      <span className={customStyles.labelHint}> — Make it catchy and descriptive</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isPending} placeholder='e.g., Handcrafted Leather Wallet' type='text' className={customStyles.input} spellCheck='false' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name='category' render={({ field }) => (
                  <FormItem className={customStyles.item}>
                    <FormLabel className={customStyles.label}>
                      Category
                      <span className={customStyles.labelHint}> — Help buyers find your listing</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isPending} placeholder='e.g., Accessories, Electronics, Art' type='text' className={customStyles.input} spellCheck='false' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name='description' render={({ field }) => (
                  <FormItem className={customStyles.item}>
                    <FormLabel className={customStyles.label}>
                      Description
                      <span className={customStyles.labelHint}> — Tell buyers what makes this special</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={isPending} placeholder='Describe your product in detail. Include materials, dimensions, condition, and any unique features...' className={`${customStyles.input} min-h-[120px] resize-y`} spellCheck='false' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Pricing & Inventory */}
              <div className={customStyles.section}>
                <h3 className={customStyles.sectionTitle}>Pricing & Inventory</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name='price' render={({ field }) => (
                    <FormItem className={customStyles.item}>
                      <FormLabel className={customStyles.label}>Price (USD)</FormLabel>
                      <FormControl>
                        <div className='relative'>
                          <span className='absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm'>$</span>
                          <Input
                            {...field}
                            disabled={isPending}
                            placeholder='0.00'
                            type='text'
                            className={`${customStyles.input} pl-7`}
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
                  )} />

                  <FormField control={form.control} name='quantity' render={({ field }) => (
                    <FormItem className={customStyles.item}>
                      <FormLabel className={customStyles.label}>Quantity available</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isPending}
                          placeholder='1'
                          type='number'
                          min='1'
                          className={customStyles.input}
                          onChange={(e) => form.setValue('quantity', Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Product type toggles */}
              <div className={customStyles.section}>
                <h3 className={customStyles.sectionTitle}>Product Options</h3>
                
                {/* Company product toggle */}
                <div className="space-y-3">
                  <label htmlFor='checkbox-isCompanyProduct' className={customStyles.toggle}>
                    <input
                      className={customStyles.inputCheckbox}
                      type="checkbox"
                      id='checkbox-isCompanyProduct'
                      checked={isCompanyProduct}
                      onChange={() => handleCompanyProduct()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/90">List as company product</div>
                      <div className="text-xs text-white/50 mt-0.5">Post on behalf of your business</div>
                    </div>
                  </label>
                  
                  {isCompanyProduct && (
                    <div className="pl-4 border-l-2 border-emerald-500/30">
                      <UserCompanyPermission permissionTag="CAN_POST_PRODUCT_POSITION_PERMISSION" onCompanySelect={handleCompanySelect} />
                    </div>
                  )}
                </div>

                {/* Physical product toggle */}
                <div className="space-y-3 mt-4">
                  <label htmlFor='checkbox-isPhysicalProduct' className={customStyles.toggle}>
                    <input
                      className={customStyles.inputCheckbox}
                      type="checkbox"
                      id='checkbox-isPhysicalProduct'
                      checked={isPhysicalProduct}
                      onChange={() => handlePhysicalProduct()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/90">Physical product</div>
                      <div className="text-xs text-white/50 mt-0.5">Requires shipping — add dimensions & origin</div>
                    </div>
                  </label>

                  {isPhysicalProduct && (
                    <div className="pl-4 border-l-2 border-emerald-500/30 space-y-4">
                      {/* Warehouse locations */}
                      {warehouseLocations.length > 0 && (
                        <div className="space-y-2">
                          <div className={customStyles.label}>Ship from warehouse</div>
                          <div className='flex flex-wrap gap-2'>
                            {warehouseLocations.map((location, index) => (
                              <label
                                key={index}
                                className={`${customStyles.toggle} !py-2 !px-3 !w-auto cursor-pointer ${
                                  postalCodes.includes(location.postalCode) ? 'border-emerald-500/50 bg-emerald-500/10' : ''
                                }`}
                              >
                                <input
                                  type='checkbox'
                                  value={location.postalCode}
                                  checked={postalCodes.includes(location.postalCode)}
                                  onChange={() => handleSelectWarehouseLocation(location.postalCode)}
                                  className={customStyles.inputCheckbox}
                                />
                                <span className="text-sm text-white/80">{location.postalCode} - {location.city}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Manual postal code - shown when not company or no warehouses */}
                      {(isCompanyProduct === false || warehouseLocations.length === 0) && (
                        <div className="space-y-2">
                          <div className={customStyles.label}>
                            Ship from location
                            <span className={customStyles.labelHint}> — Optional: enter postal code</span>
                          </div>
                          <FormField control={form.control} name='shipFromPostalId' render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={isPending}
                                  placeholder='Enter postal code (optional)'
                                  type='text'
                                  value={postalCodeInput}
                                  onChange={(e) => {
                                    const newPostalCode = e.target.value;
                                    setPostalCodeInput(newPostalCode);
                                    fetchPostalCodeDetails(newPostalCode);
                                  }}
                                  className={customStyles.input}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          
                          {suggestions.length > 0 && (
                            <select
                              onChange={handleSelectChange}
                              className={customStyles.input}
                            >
                              {suggestions
                                .filter((suggestion) => suggestion.postal_code.startsWith(postalCodeInput) || suggestion.city.toLowerCase().includes(postalCodeInput.toLowerCase()))
                                .map((filteredSuggestion, index) => (
                                  <option key={index} value={filteredSuggestion.postal_code}>
                                    {filteredSuggestion.postal_code} - {filteredSuggestion.city}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      )}

                      {warehouseLocationError && (
                        <p className="text-amber-400/80 text-sm">{warehouseLocationError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Specifications */}
              <div className={customStyles.section}>
                <h3 className={customStyles.sectionTitle}>
                  Specifications
                  <span className="font-normal text-white/50 ml-2">— Optional details</span>
                </h3>
                
                <FormField control={form.control} name='specifications' render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="space-y-3">
                        {specifications.map((spec, index) => (
                          <div key={index} className="flex gap-2 items-start">
                            <select
                              value={spec.key}
                              onChange={(e) => handleSpecificationChange(index, 'key', e.target.value)}
                              className={`${customStyles.input} w-32 sm:w-40 flex-shrink-0`}
                            >
                              {examplePlaceholders.map((placeholder, i) => (
                                <option key={i} value={placeholder}>{placeholder}</option>
                              ))}
                            </select>
                            <Input
                              value={spec.value}
                              onChange={(e) => handleSpecificationChange(index, 'value', e.target.value)}
                              placeholder={
                                spec.key === 'Weight' ? 'grams' :
                                ['Height', 'Length', 'Width'].includes(spec.key) ? 'cm' : 'Value'
                              }
                              type={spec.type}
                              className={customStyles.input}
                            />
                            <button
                              type="button"
                              onClick={() => removeSpecification(index)}
                              className="flex-shrink-0 p-2.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              aria-label="Remove specification"
                            >
                              <RxCrossCircled className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={addSpecification}
                          className="inline-flex items-center gap-2 text-sm text-emerald-400/80 hover:text-emerald-400 transition-colors"
                        >
                          <span className="text-lg">+</span>
                          Add specification
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Admin-only user ID field */}
              <FormField control={form.control} name='userId' render={({ field }) => (
                <FormItem className={customStyles.itemRole}>
                  <FormLabel className={customStyles.label}>User ID (Admin)</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={clientUser?.role === UserRole.ADMIN ? isPending : true} value={clientUser?.role === UserRole.ADMIN ? uId : clientUser?.id} onChange={e => setUId(e.target.value)} placeholder='User ID' type='text' className={customStyles.input} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Right column - Images & Submit */}
            <div className="lg:w-[340px] xl:w-[380px] space-y-6">
              <div className={customStyles.section}>
                <FormField control={form.control} name='image' render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input {...field} disabled={isPending} name='image' spellCheck='false' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex items-end justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className={customStyles.sectionTitle + ' !mb-0'}>Product Images</h3>
                    <div className="text-xs text-white/50">
                      Upload up to {MAX_IMAGES} images. Drag to reorder.
                    </div>
                  </div>
                  <div className="text-sm font-medium text-white/60 tabular-nums">
                    {imagePreviews.length}/{MAX_IMAGES}
                  </div>
                </div>

                <div
                  {...getRootProps()}
                  className={
                    "relative w-full rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-4 " +
                    "transition-all duration-200 hover:bg-white/[0.04] hover:border-white/20 cursor-pointer"
                  }
                >
                  <input {...getInputProps()} />

                  {imagePreviews.length === 0 ? (
                    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                        <FaFileUpload className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white/80">Drop images here</div>
                        <div className="text-xs text-white/50 mt-1">or tap to browse</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {imagePreviews.map((preview, index) => (
                        <div
                          key={preview}
                          className="group/tile relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]"
                        >
                          <Image
                            src={preview}
                            alt={`preview-${index}`}
                            fill
                            sizes="(max-width: 640px) 50vw, 180px"
                            className="object-cover"
                          />

                          {/* Overlay controls */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover/tile:opacity-100 transition-opacity duration-200" />
                          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1.5 opacity-0 group-hover/tile:opacity-100 transition-opacity">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/50 text-white/80 backdrop-blur hover:bg-black/70 disabled:opacity-30"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveImage(index, index - 1); }}
                                disabled={index === 0}
                              >
                                <FiChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/50 text-white/80 backdrop-blur hover:bg-black/70 disabled:opacity-30"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveImage(index, index + 1); }}
                                disabled={index === imagePreviews.length - 1}
                              >
                                <FiChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-500/70 text-white backdrop-blur hover:bg-red-500"
                              onClick={(e) => removeImage(e, index)}
                            >
                              <RxCrossCircled className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Upload progress */}
                          {(isUploadingImages || isPending) && images.length > 0 && (
                            <div className="absolute top-1.5 left-1.5 right-1.5">
                              <div className="h-1 w-full overflow-hidden rounded-full bg-black/30">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-[width] duration-100"
                                  style={{ width: `${Math.max(0, Math.min(100, uploadProgress[index] ?? 0))}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* First image badge */}
                          {index === 0 && (
                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/80 text-white">
                              Cover
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit section */}
              <div className="space-y-4">
                <MyFormError message={error} />
                <MyFormSuccess message={success} />
                
                <Button
                  type='submit'
                  disabled={isPending || isUploadingImages}
                  className='w-full h-12 text-base font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/25 transition-all duration-200'
                >
                  {isPending || isUploadingImages ? 'Creating...' : 'Create Listing'}
                </Button>

                {isEditing && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleCancelEdit}
                    className='w-full border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06]'
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};