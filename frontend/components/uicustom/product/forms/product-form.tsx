'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyProductCreateSchema, ProductConditionValues, FiatCurrencyValues, ProductTypeValues, type FiatCurrencyType, type ProductConditionType, type ProductTypeType, type CategoryTag } from '@/schemas';
import { MyFormError } from '../../forms/form-error';
import { MyFormSuccess } from '../../forms/form-sucess';
import { MyCreateProductAction } from '@/actions/products';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { UserRole, WarehouseLocation } from '@prisma/client';
import { RxCrossCircled } from "react-icons/rx";
import { FaFileUpload, FaDownload } from "react-icons/fa";
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserCompanyPermission from '../../user-company-permission';
import { fetchUserEmployeePermissions } from '@/actions/user-company-permissions';
import { useRouter, usePathname } from 'next/navigation';
import { saveFormState, loadFormState, clearFormState, hasPendingFormData } from '@/lib/form-persistence';
import { CategoryTagInput } from '../../category-tag-input';

// Form persistence key
const FORM_STORAGE_KEY = 'product-create';

// Condition labels and descriptions
const CONDITION_OPTIONS: { value: ProductConditionType; label: string; description: string }[] = [
  { value: 'NEW', label: 'New', description: 'Brand new, unopened' },
  { value: 'AS_NEW', label: 'As New', description: 'Like new, barely used' },
  { value: 'GOOD', label: 'Good', description: 'Used, good condition' },
  { value: 'FAIR', label: 'Fair', description: 'Shows wear, functional' },
  { value: 'POOR', label: 'Poor', description: 'Significant wear' },
];

// Product type labels and descriptions
const PRODUCT_TYPE_OPTIONS: { value: ProductTypeType; label: string; description: string; icon: string }[] = [
  { value: 'PHYSICAL', label: 'Physical', description: 'Requires shipping', icon: '📦' },
  { value: 'DIGITAL', label: 'Digital', description: 'Downloadable file', icon: '💾' },
  { value: 'HYBRID', label: 'Hybrid', description: 'Both physical + digital', icon: '📦💾' },
];

const FIAT_CURRENCY_META: Record<FiatCurrencyType, { label: string; prefix: string }> = {
  USD: { label: 'USD', prefix: '$' },
  NOK: { label: 'NOK', prefix: 'kr' },
  EUR: { label: 'EUR', prefix: '€' },
  GBP: { label: 'GBP', prefix: '£' },
};

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
  // Router for login redirect
  const router = useRouter();
  const pathname = usePathname();
  
  // General States
  const { user: clientUser, status: sessionStatus, isLoading: isSessionLoading } = useCurrentUserWithStatus();
  const { edgestore } = useEdgeStore();
  const [uId, setUId] = useState<string | undefined>(clientUser?.id); // role admin to modify input value
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
	const [isUploadingImages, setIsUploadingImages] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [isPhysicalProduct, setIsPhysicalProduct] = useState<boolean>(false);
  const [isCompanyProduct, setIsCompanyProduct] = useState<boolean>(false);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  
  // Form restoration state
  const [hasRestoredForm, setHasRestoredForm] = useState(false);
  const [showFileReselectionNotice, setShowFileReselectionNotice] = useState(false);
  
  // Digital product states
  const [productType, setProductType] = useState<ProductTypeType>('PHYSICAL');
  const [digitalFile, setDigitalFile] = useState<File | null>(null);
  const [digitalFileName, setDigitalFileName] = useState<string>('');
  const [digitalFileSize, setDigitalFileSize] = useState<number>(0);
  const [isUploadingDigitalFile, setIsUploadingDigitalFile] = useState(false);
  const [digitalFileProgress, setDigitalFileProgress] = useState<number>(0);
  const [digitalAssetId, setDigitalAssetId] = useState<string>('');
  const [maxDownloads, setMaxDownloads] = useState<number | null>(5); // Default 5 downloads
  const [downloadExpiryDays, setDownloadExpiryDays] = useState<number | null>(null); // null = never expires
  
  // Shipping specs come first for physical products, then general specs
  const shippingSpecKeys = ['Weight (g)', 'Height (cm)', 'Length (cm)', 'Width (cm)'];
  const generalSpecKeys = ['Custom', 'Material', 'Color', 'Size', 'Brand', 'Model', 'Country of Origin', 'Warranty', 'Certification'];
  const examplePlaceholders = [...shippingSpecKeys, ...generalSpecKeys];
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const form = useForm<z.infer<typeof MyProductCreateSchema>>({
    resolver: zodResolver(MyProductCreateSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      category: '', // Legacy, will be set from categories array
      categories: [], // New multi-category system
      price: 0,
      priceCurrency: 'USD',
      acceptedFiatCurrencies: ['USD'],
      condition: 'NEW',
      stock: 0,
      userId: '', // Start empty, will be set when user loads
      image: [],
      quantity: 1, // Default to 1 since quantity must be at least 1
      isPhysicalProduct: false,
      productType: 'PHYSICAL',
      digitalAssetId: undefined,
      downloadsEnabled: true,
      maxDownloads: 5,
      downloadExpiryDays: null,
    },
  });

  const priceCurrency = form.watch('priceCurrency');
  const priceCurrencyMeta = FIAT_CURRENCY_META[(priceCurrency ?? 'USD') as FiatCurrencyType];

  // Update userId when clientUser loads
  useEffect(() => {
    if (!clientUser?.id) return;
    setUId(clientUser.id);
    form.setValue('userId', clientUser.id, { shouldValidate: true, shouldDirty: false, shouldTouch: false });
  }, [clientUser?.id, form]);

  // Restore form state from sessionStorage after login redirect
  useEffect(() => {
    if (hasRestoredForm) return;
    if (isSessionLoading) return; // Wait for session to load
    
    const savedState = loadFormState<z.infer<typeof MyProductCreateSchema>>(FORM_STORAGE_KEY);
    if (!savedState) {
      setHasRestoredForm(true);
      return;
    }

    console.log(`${MyLogPrefix} Restoring saved form state`);
    
    // Restore form values
    Object.entries(savedState).forEach(([key, value]) => {
      if (value !== undefined && key !== 'userId' && key !== 'image') {
        form.setValue(key as keyof z.infer<typeof MyProductCreateSchema>, value as never, { 
          shouldValidate: false,
          shouldDirty: true,
        });
      }
    });

    // Restore component state
    if (savedState.productType) {
      setProductType(savedState.productType as ProductTypeType);
    }
    if (savedState.isPhysicalProduct !== undefined) {
      setIsPhysicalProduct(savedState.isPhysicalProduct as boolean);
    }

    // Show notice that files need to be re-selected
    const hadFiles = savedState.productType === 'DIGITAL' || savedState.productType === 'HYBRID';
    if (hadFiles) {
      setShowFileReselectionNotice(true);
    }

    // Clear saved state after restoration
    clearFormState(FORM_STORAGE_KEY);
    setHasRestoredForm(true);
  }, [form, hasRestoredForm, isSessionLoading]);

  // Auto-save form state periodically (every 5 seconds when form is dirty)
  useEffect(() => {
    if (sessionStatus === 'authenticated') return; // Don't auto-save for logged-in users
    if (!form.formState.isDirty) return;

    const saveTimer = setInterval(() => {
      const values = form.getValues();
      // Also save component state that's not in the form
      const extendedValues = {
        ...values,
        productType,
        isPhysicalProduct,
        // Don't save: images, digitalFile, specifications (complex objects)
      };
      saveFormState(FORM_STORAGE_KEY, extendedValues);
    }, 5000);

    return () => clearInterval(saveTimer);
  }, [form, form.formState.isDirty, sessionStatus, productType, isPhysicalProduct]);

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

  // Initialize shipping specs on mount if product type is PHYSICAL or HYBRID
  useEffect(() => {
    if (hasRestoredForm && specifications.length === 0) {
      if (productType === 'PHYSICAL' || productType === 'HYBRID') {
        const shippingSpecs: Specification[] = [
          { key: 'Weight (g)', value: '', type: 'number' },
          { key: 'Height (cm)', value: '', type: 'number' },
          { key: 'Length (cm)', value: '', type: 'number' },
          { key: 'Width (cm)', value: '', type: 'number' },
        ];
        setSpecifications(shippingSpecs);
        setIsPhysicalProduct(true);
      }
    }
  }, [hasRestoredForm, productType, specifications.length]);


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

  // Digital asset file handler
  const digitalFileHandler = async (): Promise<string | null> => {
    if (!digitalFile) return null;
    
    setIsUploadingDigitalFile(true);
    setDigitalFileProgress(0);

    try {
      // Upload file to EdgeStore digitalAssets bucket
      const uploadResult = await edgestore.digitalAssets.upload({
        file: digitalFile,
        onProgressChange: (p: number) => {
          setDigitalFileProgress(p);
        },
      });

      // Extract file extension
      const fileExtension = digitalFile.name.split('.').pop() || '';

      // Create digital asset record in database
      const response = await fetch('/api/digital-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: digitalFile.name,
          fileSize: digitalFile.size,
          mimeType: digitalFile.type || 'application/octet-stream',
          fileExtension: fileExtension,
          storageKey: uploadResult.url,
          companyId: companyId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create digital asset record');
      }

      const assetData = await response.json();
      setDigitalAssetId(assetData.id);
      setIsUploadingDigitalFile(false);
      return assetData.id;
    } catch (error) {
      console.error('Digital file upload error:', error);
      setIsUploadingDigitalFile(false);
      throw error;
    }
  };

  // Digital file dropzone handlers
  const onDigitalFileDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setDigitalFile(file);
      setDigitalFileName(file.name);
      setDigitalFileSize(file.size);
    }
  }, []);

  const removeDigitalFile = () => {
    setDigitalFile(null);
    setDigitalFileName('');
    setDigitalFileSize(0);
    setDigitalAssetId('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const { getRootProps: getDigitalRootProps, getInputProps: getDigitalInputProps } = useDropzone({
    onDrop: onDigitalFileDrop,
    accept: {
      'image/*': [],
      'application/pdf': [],
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'application/x-7z-compressed': ['.7z'],
      'text/*': [],
      'application/json': [],
      'audio/*': [],
      'video/*': [],
      'font/*': [],
      'application/font-woff': [],
      'application/font-woff2': [],
    },
    multiple: false,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

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
    // Filter out shipping specs if not a physical product
    const availablePlaceholders = isPhysicalProduct
      ? examplePlaceholders
      : examplePlaceholders.filter(placeholder => !shippingSpecKeys.includes(placeholder));
  
    // Find next unused placeholder (skip 'Custom' as first choice for preset)
    const nextPlaceholder = availablePlaceholders.find(placeholder =>
      placeholder !== 'Custom' && !specifications.some(spec => spec.key === placeholder)
    ) ?? 'Custom';
  
    const newSpec: Specification = {
      key: nextPlaceholder,
      value: '',
      type: shippingSpecKeys.includes(nextPlaceholder) ? 'number' : 'text'
    };
  
    setSpecifications([...specifications, newSpec]);
  };

  const onSubmit = async (values: z.infer<typeof MyProductCreateSchema>) => {
    setError('');
    setSuccess('');

    setIsSubmitting(true);
    try {
      const finalPostalCodes = Array.from(
        new Set([
          ...postalCodes.map((p) => p.trim()),
          ...(postalCodeInput.trim() ? [postalCodeInput.trim()] : []),
        ].filter(Boolean))
      );

      // Keep schema values in sync with current UI state
      values.userId = clientUser?.id ?? values.userId;
      values.companyId = companyId && companyId.length > 0 ? companyId : values.companyId;
      values.isPhysicalProduct = isPhysicalProduct;
      values.shipFromPostalId = finalPostalCodes.join(', ');
      
      // Set product type and digital asset fields
      values.productType = productType;
      values.downloadsEnabled = true;
      values.maxDownloads = maxDownloads;
      values.downloadExpiryDays = downloadExpiryDays;

      // Ensure acceptedFiatCurrencies is at least the selected priceCurrency
      if (!Array.isArray((values as any).acceptedFiatCurrencies) || (values as any).acceptedFiatCurrencies.length === 0) {
        (values as any).acceptedFiatCurrencies = [(values as any).priceCurrency ?? 'USD'];
      }

      // Validate physical product requirements
      if ((productType === 'PHYSICAL' || productType === 'HYBRID') && finalPostalCodes.length === 0) {
        setError('Please add at least one ship-from postal code for physical products.');
        return;
      }

      // Validate digital product requirements
      if ((productType === 'DIGITAL' || productType === 'HYBRID') && !digitalFile && !digitalAssetId) {
        setError('Please upload a digital file for digital products.');
        return;
      }

      // Handle digital file upload
      if (digitalFile && !digitalAssetId) {
        const assetId = await digitalFileHandler();
        if (assetId) {
          values.digitalAssetId = assetId;
        } else {
          setError('Failed to upload digital file.');
          return;
        }
      } else if (digitalAssetId) {
        values.digitalAssetId = digitalAssetId;
      }

      if (images.length > 0) {
        const resUploadedImageUrls = await imageHandler();
        values.image = resUploadedImageUrls;
      } else {
        values.image = (values.image ?? []).filter(Boolean);
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

      const data = await MyCreateProductAction(values, finalPostalCodes);
      if ('error' in data) {
        setError(data.error);
      }
      if ('success' in data) {
        setSuccess(data.success);
        handleReset();
      }
    } catch (e) {
      console.error(MyLogPrefix, 'Create product failed:', e);
      setError('Failed to create product.');
    } finally {
      setIsSubmitting(false);
    }
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
    setHasAttemptedSubmit(false);
    // Reset digital product states
    setProductType('PHYSICAL');
    setDigitalFile(null);
    setDigitalFileName('');
    setDigitalFileSize(0);
    setIsUploadingDigitalFile(false);
    setDigitalFileProgress(0);
    setDigitalAssetId('');
    setMaxDownloads(5);
    setDownloadExpiryDays(null);
    // Reset form but preserve userId
    const currentUserId = clientUser?.id || '';
    form.reset();
    // Restore userId after reset
    if (currentUserId) {
      form.setValue('userId', currentUserId, { shouldValidate: true });
    }
    setTimeout(() => {
      setSuccess('');
    }, 5000);
  };

  const handlePhysicalProduct = () => {
    const newIsPhysical = !isPhysicalProduct;
    setIsPhysicalProduct(newIsPhysical);
    
    // Auto-add shipping specs when enabling physical product (required for Bring API)
    if (newIsPhysical) {
      const shippingSpecs: Specification[] = [
        { key: 'Weight (g)', value: '', type: 'number' },  // grossWeight in grams for Bring API
        { key: 'Height (cm)', value: '', type: 'number' }, // height in cm
        { key: 'Length (cm)', value: '', type: 'number' }, // length in cm  
        { key: 'Width (cm)', value: '', type: 'number' },  // width in cm
      ];
      // Add shipping specs at the start, keep any existing non-shipping specs
      const existingNonShipping = specifications.filter(
        spec => !['Weight (g)', 'Height (cm)', 'Length (cm)', 'Width (cm)', 'Weight', 'Height', 'Length', 'Width'].includes(spec.key)
      );
      setSpecifications([...shippingSpecs, ...existingNonShipping]);
    } else {
      // Remove shipping specs when disabling physical product
      const filtered = specifications.filter(
        spec => !['Weight (g)', 'Height (cm)', 'Length (cm)', 'Width (cm)', 'Weight', 'Height', 'Length', 'Width'].includes(spec.key)
      );
      setSpecifications(filtered);
    }
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

  const handleSelectChange = (selectedValue: string) => {
    const selectedPostalCodeData = suggestions.find(suggestion => suggestion.postal_code === selectedValue);
    setSelectedPostalCodeDetail(selectedPostalCodeData ?? null);
    setPostalCodeInput(selectedValue);
  };

  const customStyles = {
    section: 'space-y-3',
    sectionAlt: 'space-y-3 pt-4',
    sectionTitle: 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2',
    item: `group flex flex-col w-full items-start`,
    itemHoverEffect: `group flex flex-col w-full items-start`,
    itemRole: `${clientUser?.role === UserRole.ADMIN ? 'group items-start hidden flex-col' : 'hidden'}`,
    label: `text-xs font-medium text-foreground/90 mb-1`,
    labelHint: 'text-xs text-muted-foreground/70 mt-0.5 font-normal',
    // NOTE: shadcn Input/SelectTrigger/Textarea components come with their own border/bg.
    // These classes intentionally override that so everything looks consistent.
    input: `w-full rounded-md px-3 py-2 text-sm !border !border-input !bg-background hover:!bg-muted/40 text-foreground placeholder:text-muted-foreground/70 !outline-none focus-visible:!ring-2 focus-visible:!ring-emerald-500/40 focus-visible:!ring-offset-0 transition-colors duration-150`,
    selectTrigger: `w-full rounded-md px-3 py-2 text-sm !border !border-input !bg-background hover:!bg-muted/40 text-foreground !outline-none focus-visible:!ring-2 focus-visible:!ring-emerald-500/40 focus-visible:!ring-offset-0 transition-colors duration-150`,
    textarea: `w-full rounded-md px-3 py-2 text-sm !border !border-input !bg-background hover:!bg-muted/40 text-foreground placeholder:text-muted-foreground/70 !outline-none focus-visible:!ring-2 focus-visible:!ring-emerald-500/40 focus-visible:!ring-offset-0 transition-colors duration-150 resize-none`,
    selectContent: `border border-border bg-popover text-popover-foreground shadow-lg`,
    selectItem: `text-popover-foreground focus:bg-muted focus:text-foreground data-[state=checked]:bg-emerald-500/15 data-[state=checked]:text-foreground`,
    inputCheckbox: `rounded border border-input bg-background text-emerald-600 focus:ring-emerald-500/30 focus:ring-offset-0`,
    toggle: `hover:cursor-pointer flex gap-3 items-center py-2 px-3 w-full rounded-md border border-border bg-muted/30 hover:bg-muted/50 transition-colors duration-150`,
  };

  // Debug: get validation errors
  const formErrors = form.formState.errors;
  const errorKeys = Object.keys(formErrors) as (keyof typeof formErrors)[];

  // Human-readable field labels for validation messages
  const fieldLabels: Record<string, string> = {
    title: 'Product title',
    description: 'Description',
    category: 'Category',
    price: 'Price',
    priceCurrency: 'Currency',
    condition: 'Condition',
    userId: 'User account',
    quantity: 'Quantity',
    image: 'Product images',
    productType: 'Product type',
    digitalAssetId: 'Digital file',
  };

  // Check if physical product has required shipping specs filled (moved up for getMissingItems)
  const needsShippingSpecs = productType === 'PHYSICAL' || productType === 'HYBRID';
  const hasRequiredShippingSpecs = !needsShippingSpecs || shippingSpecKeys.every(key => {
    const spec = specifications.find(s => s.key === key);
    return spec && spec.value !== '' && spec.value !== 0;
  });

  // Check if digital product has required file (moved up for getMissingItems)
  const needsDigitalFile = productType === 'DIGITAL' || productType === 'HYBRID';
  const hasRequiredDigitalFile = !needsDigitalFile || digitalFile !== null || digitalAssetId !== '';

  // Check if user is loaded (moved up for getMissingItems)
  const isUserLoaded = !isSessionLoading && sessionStatus === 'authenticated' && !!clientUser?.id && !!form.getValues('userId');

  // Build comprehensive list of missing/invalid items
  const getMissingItems = (): string[] => {
    const items: string[] = [];
    
    // Check form validation errors with nice labels
    errorKeys.forEach((key) => {
      // Skip userId error - handled separately with login prompt
      if (key === 'userId') return;
      
      const label = fieldLabels[key] || key;
      const errorMsg = (formErrors[key] as { message?: string })?.message;
      if (errorMsg && errorMsg !== 'Required') {
        items.push(`${label}: ${errorMsg}`);
      } else {
        items.push(`${label} is required`);
      }
    });

    // Check images (not part of zod validation but required)
    if (imagePreviews.length === 0 && !errorKeys.includes('image')) {
      items.push('At least one product image is required');
    }

    // Check shipping specs for physical products
    if (needsShippingSpecs && !hasRequiredShippingSpecs) {
      const missingSpecs = shippingSpecKeys.filter(key => {
        const spec = specifications.find(s => s.key === key);
        return !spec || spec.value === '' || spec.value === 0;
      });
      if (missingSpecs.length > 0) {
        items.push(`Shipping dimensions (${missingSpecs.join(', ')}) are required for physical products`);
      }
    }

    // Check digital file for digital products
    if (needsDigitalFile && !hasRequiredDigitalFile) {
      items.push('A digital file is required for digital/hybrid products');
    }

    return items;
  };

  const missingItems = getMissingItems();
  const hasValidationIssues = missingItems.length > 0;

  // Log form state for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('Form state:', {
      isValid: form.formState.isValid,
      isDirty: form.formState.isDirty,
      errors: formErrors,
      values: form.getValues(),
      userId: form.getValues('userId'),
      clientUserId: clientUser?.id,
      missingItems,
    });
  }

  // Only disable button during actual submission or image upload
  const isSubmitDisabled = isSubmitting || isUploadingImages || isUploadingDigitalFile;
  const submitLabel = isUploadingImages 
    ? 'Uploading images...'
    : isUploadingDigitalFile
      ? 'Uploading digital file...'
    : isSubmitting 
      ? 'Creating...' 
      : 'Create Listing';

  // Handle form submission with validation
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setError(''); // Clear previous errors
    
    // Check if user is loaded
    if (!isUserLoaded) {
      if (isSessionLoading) {
        setError('Please wait for session to load...');
        return;
      } else if (sessionStatus === 'unauthenticated') {
        // Save form state before redirecting to login
        const values = form.getValues();
        const extendedValues = {
          ...values,
          productType,
          isPhysicalProduct,
        };
        saveFormState(FORM_STORAGE_KEY, extendedValues);
        
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(pathname || '/products/create');
        router.push(`/auth/login?callbackUrl=${returnUrl}`);
        return;
      } else {
        // Session is authenticated but form userId not set yet - retry setting it
        if (clientUser?.id) {
          form.setValue('userId', clientUser.id, { shouldValidate: true });
          // Try again after setting
          if (!form.getValues('userId')) {
            setError('Failed to load user data. Please refresh the page.');
            return;
          }
          // userId now set, continue with submission
        } else {
          setError('Failed to load user data. Please refresh the page.');
          return;
        }
      }
    }

    // Check shipping specs for physical products
    if (needsShippingSpecs && !hasRequiredShippingSpecs) {
      setError('Physical products require Weight, Height, Length, and Width specifications');
      return;
    }

    // Check digital file for digital products
    if (needsDigitalFile && !hasRequiredDigitalFile) {
      setError('Digital products require a file upload');
      return;
    }

    // Trigger form validation and submit if valid
    const isValid = await form.trigger();
    if (isValid) {
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <div className='w-full flex flex-col'>
      {/* File Re-selection Notice - shown after login redirect */}
      {showFileReselectionNotice && (
        <div className="mb-4 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-500">Form restored</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Your form data was restored after login. Please re-select any <strong>images</strong> and <strong>digital files</strong> as they could not be preserved for security reasons.
              </p>
              <button
                type="button"
                onClick={() => setShowFileReselectionNotice(false)}
                className="mt-2 text-xs text-amber-500 hover:text-amber-400 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={handleFormSubmit} className='flex flex-col w-full gap-6'>
          
          {/* Images Section - FIRST, horizontal strip at top */}
          <div className="w-full">
            <FormField control={form.control} name='image' render={() => (
              <FormItem className="hidden">
                <FormMessage />
              </FormItem>
            )} />

            <div
              {...getRootProps()}
                className="relative w-full rounded-lg border border-border bg-muted/20 hover:bg-muted/30 p-3 cursor-pointer transition-colors duration-150"
            >
              <input {...getInputProps()} />

              {imagePreviews.length === 0 ? (
                <div className="flex items-center justify-center gap-4 py-10">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted">
                    <FaFileUpload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-foreground">Drop images here or click to browse</div>
                    <div className="text-xs text-muted-foreground">Up to {MAX_IMAGES} images • PNG, JPG, WEBP</div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-3">
                  {/* Count - centered at top */}
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {imagePreviews.length} of {MAX_IMAGES} images
                  </div>

                  {/* Image thumbnails + placeholder - centered */}
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    {imagePreviews.map((preview, index) => (
                      <div
                        key={preview}
                        className="group/tile relative flex-shrink-0 w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 lg:w-56 lg:h-56 overflow-hidden rounded-lg border border-border bg-muted/30"
                      >
                        <Image
                          src={preview}
                          alt={`preview-${index}`}
                          fill
                          sizes="(max-width: 640px) 144px, (max-width: 1024px) 208px, 224px"
                          className="object-cover"
                        />

                        {/* Remove button */}
                        <button
                          type="button"
                          className="group/remove absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover/tile:opacity-100 transition-opacity"
                          onClick={(e) => removeImage(e, index)}
                        >
                          <RxCrossCircled className="h-7 w-7 text-white/90 transition-colors duration-150 group-hover/remove:text-red-400" />
                        </button>

                        {/* Upload progress */}
                        {(isUploadingImages || isSubmitting) && images.length > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                            <div
                              className="h-full bg-emerald-400 transition-[width] duration-100"
                              style={{ width: `${Math.max(0, Math.min(100, uploadProgress[index] ?? 0))}%` }}
                            />
                          </div>
                        )}

                        {/* Cover badge */}
                        {index === 0 && (
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500 text-white rounded">
                            Cover
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add more indicator - right next to images */}
                    {imagePreviews.length < MAX_IMAGES && (
                      <div className="flex-shrink-0 w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 lg:w-56 lg:h-56 rounded-lg border border-dashed border-border/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                        <span className="text-3xl">+</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main content grid - 2 columns on desktop */}
          <div className='grid min-h-0 grid-cols-1 lg:grid-cols-2 gap-8 w-full flex-1'>
            
            {/* Column 1: Basic info + Pricing */}
            <div className='flex flex-col gap-5 h-full'>
              {/* Basic info section */}
              <div className={customStyles.section}>
                <h3 className={customStyles.sectionTitle}>Basic Information</h3>
                
                <FormField control={form.control} name='title' render={({ field }) => (
                  <FormItem className={customStyles.item}>
                    <FormLabel className={customStyles.label}>
                      Product title
                    </FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isSubmitting} placeholder='e.g., Handcrafted Leather Wallet' type='text' className={customStyles.input} spellCheck='false' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className={`grid grid-cols-1 ${productType !== 'DIGITAL' ? 'sm:grid-cols-[1fr,160px]' : ''} gap-2`}>
                  <FormField control={form.control} name='categories' render={({ field }) => (
                    <FormItem className={customStyles.item}>
                      <FormLabel className={customStyles.label}>Categories</FormLabel>
                      <FormControl>
                        <CategoryTagInput
                          value={field.value || []}
                          onChange={(tags) => {
                            field.onChange(tags);
                            // Also update legacy 'category' field with the first category name
                            const primaryCategory = tags[0]?.name || '';
                            form.setValue('category', primaryCategory, { shouldValidate: true });
                          }}
                          disabled={isSubmitting}
                          placeholder="Add categories..."
                          maxTags={5}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Condition - hide for pure digital products */}
                  {productType !== 'DIGITAL' && (
                    <FormField control={form.control} name='condition' render={({ field }) => (
                      <FormItem className={customStyles.item}>
                        <FormLabel className={customStyles.label}>Condition</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger className={customStyles.selectTrigger}>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent className={customStyles.selectContent}>
                              {CONDITION_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className={customStyles.selectItem}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {CONDITION_OPTIONS.find((opt) => opt.value === field.value)?.description}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>

                <FormField control={form.control} name='description' render={({ field }) => (
                  <FormItem className={customStyles.item}>
                    <FormLabel className={customStyles.label}>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={isSubmitting} placeholder='Describe your product...' className={`${customStyles.textarea} min-h-[100px]`} spellCheck='false' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Pricing & Inventory - compact */}
              <div className={customStyles.sectionAlt}>
                <h3 className={customStyles.sectionTitle}>Pricing & Stock</h3>
                
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <FormField control={form.control} name='price' render={({ field }) => (
                    <FormItem className={customStyles.item}>
                      <FormLabel className={customStyles.label}>Price ({priceCurrencyMeta.label})</FormLabel>
                      <FormControl>
                        <div className='relative'>
                          <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'>
                            {priceCurrencyMeta.prefix}
                          </span>
                          <Input
                            {...field}
                            disabled={isSubmitting}
                            placeholder='0'
                            type='text'
                            className={`${customStyles.input} pl-8`}
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

                  <FormField control={form.control} name='priceCurrency' render={({ field }) => (
                    <FormItem className={customStyles.item}>
                      <FormLabel className={customStyles.label}>Currency</FormLabel>
                      <FormControl>
                        <Select
                          disabled={isSubmitting}
                          value={field.value}
                          onValueChange={(value) => {
                            const next = value as FiatCurrencyType;
                            field.onChange(next);

                            const currentAccepted = form.getValues('acceptedFiatCurrencies') ?? [];
                            if (!currentAccepted.includes(next)) {
                              form.setValue('acceptedFiatCurrencies', [...currentAccepted, next], { shouldValidate: true });
                            }
                          }}
                        >
                          <SelectTrigger className={customStyles.selectTrigger}>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent className={customStyles.selectContent}>
                            {FiatCurrencyValues.map((code) => (
                              <SelectItem key={code} value={code} className={customStyles.selectItem}>
                                {code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name='quantity' render={({ field }) => (
                    <FormItem className={customStyles.item}>
                      <FormLabel className={customStyles.label}>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isSubmitting}
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
            </div>

            {/* Column 2: Options + Specifications */}
            <div className='flex flex-col gap-5 h-full'>
              {/* Product Type Selection */}
              <div className={customStyles.section}>
                <h3 className={customStyles.sectionTitle}>Product Type</h3>
                
                <div className="grid grid-cols-3 gap-2">
                  {PRODUCT_TYPE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`${customStyles.toggle} cursor-pointer flex-col items-center text-center !py-3 ${
                        productType === option.value ? 'ring-2 ring-emerald-500/50 bg-emerald-500/10' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="productType"
                        value={option.value}
                        checked={productType === option.value}
                        onChange={(e) => {
                          const newType = e.target.value as ProductTypeType;
                          setProductType(newType);
                          // Auto-enable physical product mode for PHYSICAL and HYBRID
                          if (newType === 'PHYSICAL' || newType === 'HYBRID') {
                            setIsPhysicalProduct(true);
                            // Add shipping specs if not already present
                            if (specifications.length === 0 || !specifications.some(s => shippingSpecKeys.includes(s.key))) {
                              const shippingSpecs: Specification[] = [
                                { key: 'Weight (g)', value: '', type: 'number' },
                                { key: 'Height (cm)', value: '', type: 'number' },
                                { key: 'Length (cm)', value: '', type: 'number' },
                                { key: 'Width (cm)', value: '', type: 'number' },
                              ];
                              setSpecifications([...shippingSpecs, ...specifications.filter(s => !shippingSpecKeys.includes(s.key))]);
                            }
                          } else {
                            setIsPhysicalProduct(false);
                            // Remove shipping specs for digital-only
                            setSpecifications(specifications.filter(s => !shippingSpecKeys.includes(s.key)));
                          }
                        }}
                        className="sr-only"
                      />
                      <span className="text-2xl mb-1">{option.icon}</span>
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Digital File Upload - shown for DIGITAL and HYBRID */}
              {(productType === 'DIGITAL' || productType === 'HYBRID') && (
                <div className={customStyles.section}>
                  <h3 className={customStyles.sectionTitle}>
                    Digital File
                    <span className="font-normal text-emerald-400/70 ml-1 normal-case tracking-normal">— required</span>
                  </h3>
                  
                  {!digitalFile ? (
                    <div
                      {...getDigitalRootProps()}
                      className="relative w-full rounded-lg border-2 border-dashed border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 p-6 cursor-pointer transition-colors duration-150"
                    >
                      <input {...getDigitalInputProps()} />
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <FaDownload className="h-8 w-8 text-purple-400" />
                        <div className="text-sm text-foreground">Drop your digital file here</div>
                        <div className="text-xs text-muted-foreground">
                          Max 100MB • Images, PDFs, ZIP, RAR, audio, video, fonts
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <FaDownload className="h-5 w-5 text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{digitalFileName}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(digitalFileSize)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeDigitalFile}
                          className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <RxCrossCircled className="h-5 w-5" />
                        </button>
                      </div>
                      
                      {isUploadingDigitalFile && (
                        <div className="mt-3">
                          <div className="h-1.5 bg-purple-500/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 transition-[width] duration-100"
                              style={{ width: `${digitalFileProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Uploading... {digitalFileProgress}%</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Download Settings */}
                  <div className="mt-4 space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Download Settings</h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={customStyles.label}>Max Downloads</label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Unlimited"
                          value={maxDownloads ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMaxDownloads(val ? parseInt(val, 10) : null);
                          }}
                          className={customStyles.input}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Leave empty for unlimited</p>
                      </div>
                      
                      <div>
                        <label className={customStyles.label}>Expiry (days)</label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Never"
                          value={downloadExpiryDays ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDownloadExpiryDays(val ? parseInt(val, 10) : null);
                          }}
                          className={customStyles.input}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Leave empty for never</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Company & Shipping Options */}
              <div className={customStyles.section}>
                <h3 className={customStyles.sectionTitle}>Additional Options</h3>
                
                {/* Company product toggle */}
                <div className="space-y-2">
                  <label htmlFor='checkbox-isCompanyProduct' className={customStyles.toggle}>
                    <input
                      className={customStyles.inputCheckbox}
                      type="checkbox"
                      id='checkbox-isCompanyProduct'
                      checked={isCompanyProduct}
                      onChange={() => handleCompanyProduct()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">Company product</div>
                      <div className="text-xs text-muted-foreground">Post on behalf of your business</div>
                    </div>
                  </label>
                  
                  {isCompanyProduct && (
                    <div className="pl-4 ml-2 border-l border-emerald-500/20">
                      <UserCompanyPermission permissionTag="CAN_POST_PRODUCT_POSITION_PERMISSION" onCompanySelect={handleCompanySelect} />
                    </div>
                  )}
                </div>

                {/* Shipping options - shown for PHYSICAL and HYBRID */}
                {(productType === 'PHYSICAL' || productType === 'HYBRID') && (
                  <div className="space-y-3 mt-3">
                    <div className="text-sm font-medium text-foreground flex items-center gap-2">
                      📦 Shipping Location
                    </div>

                    {/* Warehouse locations */}
                    {warehouseLocations.length > 0 && (
                      <div className="space-y-2">
                        <div className={customStyles.label}>Ship from warehouse</div>
                        <div className='flex flex-wrap gap-2'>
                          {warehouseLocations.map((location, index) => (
                            <label
                              key={index}
                              className={`${customStyles.toggle} !py-2 !px-3 !w-auto cursor-pointer ${
                                postalCodes.includes(location.postalCode) ? 'ring-1 ring-emerald-500/40 bg-emerald-500/10' : ''
                              }`}
                            >
                              <input
                                type='checkbox'
                                value={location.postalCode}
                                checked={postalCodes.includes(location.postalCode)}
                                onChange={() => handleSelectWarehouseLocation(location.postalCode)}
                                className={customStyles.inputCheckbox}
                              />
                              <span className="text-sm text-foreground">{location.postalCode} - {location.city}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Manual postal code */}
                    {(isCompanyProduct === false || warehouseLocations.length === 0) && (
                      <div className="space-y-2">
                        <div className={customStyles.label}>Ship from location</div>
                        <FormField control={form.control} name='shipFromPostalId' render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                disabled={isSubmitting}
                                placeholder='Postal code'
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
                          <Select onValueChange={handleSelectChange}>
                            <SelectTrigger className={customStyles.selectTrigger}>
                              <SelectValue placeholder="Select postal code" />
                            </SelectTrigger>
                            <SelectContent className={customStyles.selectContent}>
                              {suggestions
                                .filter((s) => s.postal_code.startsWith(postalCodeInput) || s.city.toLowerCase().includes(postalCodeInput.toLowerCase()))
                                .map((s, i) => (
                                  <SelectItem key={i} value={s.postal_code} className={customStyles.selectItem}>
                                    {s.postal_code} - {s.city}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {warehouseLocationError && (
                      <p className="text-amber-400/80 text-xs">{warehouseLocationError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Specifications - compact */}
              <div className={customStyles.sectionAlt}>
                <h3 className={customStyles.sectionTitle}>
                  Specifications
                  {(productType === 'PHYSICAL' || productType === 'HYBRID') ? (
                    <span className="font-normal text-emerald-400/70 ml-1 normal-case tracking-normal">— shipping info required</span>
                  ) : (
                    <span className="font-normal text-muted-foreground ml-1 normal-case tracking-normal">— optional</span>
                  )}
                </h3>
                
                {(productType === 'PHYSICAL' || productType === 'HYBRID') && specifications.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Weight in grams, dimensions in cm (for Bring shipping API)
                  </p>
                )}
                
                <FormField control={form.control} name='specifications' render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="space-y-2">
                        {specifications.map((spec, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            {spec.key === 'Custom' || !examplePlaceholders.includes(spec.key) ? (
                              // Custom: editable text input for key
                              <Input
                                value={spec.key === 'Custom' ? '' : spec.key}
                                onChange={(e) => handleSpecificationChange(index, 'key', e.target.value || 'Custom')}
                                placeholder="Spec name"
                                className={`${customStyles.input} w-28 sm:w-32 flex-shrink-0 text-sm`}
                              />
                            ) : (
                              // Preset: dropdown select
                              <Select
                                value={spec.key}
                                onValueChange={(value) => handleSpecificationChange(index, 'key', value)}
                              >
                                <SelectTrigger className={`${customStyles.selectTrigger} w-28 sm:w-32 flex-shrink-0 text-sm`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className={customStyles.selectContent}>
                                  <SelectItem value="Custom" className={customStyles.selectItem}>Custom...</SelectItem>
                                  {examplePlaceholders.filter(p => p !== 'Custom').map((placeholder, i) => (
                                    <SelectItem key={i} value={placeholder} className={customStyles.selectItem}>
                                      {placeholder}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Input
                              value={spec.value}
                              onChange={(e) => {
                                // For number specs, only allow numeric input
                                const isNumberSpec = shippingSpecKeys.includes(spec.key);
                                if (isNumberSpec) {
                                  const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                                  handleSpecificationChange(index, 'value', numericValue);
                                } else {
                                  handleSpecificationChange(index, 'value', e.target.value);
                                }
                              }}
                              placeholder={shippingSpecKeys.includes(spec.key) ? "Enter number" : "Value"}
                              type="text"
                              inputMode={shippingSpecKeys.includes(spec.key) ? "numeric" : "text"}
                              className={`${customStyles.input} flex-1 text-sm`}
                            />
                            {/* Only show remove button for non-shipping specs when physical/hybrid */}
                            {!(isPhysicalProduct && shippingSpecKeys.includes(spec.key)) && (
                              <button
                                type="button"
                                onClick={() => removeSpecification(index)}
                                className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                              >
                                <RxCrossCircled className="h-4 w-4" />
                              </button>
                            )}
                            {/* Show locked indicator for required shipping specs */}
                            {isPhysicalProduct && shippingSpecKeys.includes(spec.key) && (
                              <div className="flex-shrink-0 p-1.5 text-muted-foreground/50" title="Required for shipping">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={addSpecification}
                            className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors"
                          >
                            + Add preset spec
                          </button>
                          <span className="text-muted-foreground/40">|</span>
                          <button
                            type="button"
                            onClick={() => setSpecifications([...specifications, { key: 'Custom', value: '', type: 'text' }])}
                            className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors"
                          >
                            + Add custom spec
                          </button>
                        </div>
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
                    <Input {...field} disabled={clientUser?.role === UserRole.ADMIN ? isSubmitting : true} value={clientUser?.role === UserRole.ADMIN ? uId : clientUser?.id} onChange={e => setUId(e.target.value)} placeholder='User ID' type='text' className={customStyles.input} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Submit section - full width at bottom of form */}
          <div className="w-full space-y-2 pt-4">
            {/* Login prompt - always visible when not authenticated */}
            {sessionStatus === 'unauthenticated' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
                <span className="text-blue-500">🔐</span>
                <span className="text-blue-600 dark:text-blue-400">
                  You must be logged in to create a listing
                </span>
                <span className="text-muted-foreground text-xs">
                  (Your form data will be saved)
                </span>
              </div>
            )}

            {/* Show validation summary - always visible when there are issues */}
            {hasValidationIssues && !success && (
              <div className="text-xs space-y-1.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span>⚠️</span> Please complete the following ({missingItems.length} item{missingItems.length !== 1 ? 's' : ''}):
                </p>
                <ul className="list-disc list-inside text-amber-600/90 dark:text-amber-400/90 space-y-0.5">
                  {missingItems.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <MyFormError message={error} />
            <MyFormSuccess message={success} />

            <Button
              type='submit'
              disabled={isSubmitDisabled}
              className='w-full h-11 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors duration-150 disabled:opacity-60 disabled:hover:bg-emerald-600'
            >
              {submitLabel}
            </Button>

            {isEditing && (
              <Button
                type='button'
                variant='outline'
                onClick={handleCancelEdit}
                className='w-full'
              >
                Cancel
              </Button>
            )}
          </div>

        </form>
      </Form>
    </div>
  );
};