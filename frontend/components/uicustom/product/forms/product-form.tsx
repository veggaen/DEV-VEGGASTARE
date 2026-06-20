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
import { UserRole, WarehouseLocation } from '@/generated/prisma/browser';
import { RxCrossCircled } from "react-icons/rx";
import { FaFileUpload, FaDownload } from "react-icons/fa";
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserCompanyPermission from '../../user-company-permission';
import { fetchUserEmployeePermissions } from '@/actions/user-company-permissions';
import { useRouter, usePathname } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { saveFormState, loadFormState, clearFormState, hasPendingFormData } from '@/lib/form-persistence';
import { CategoryTagInput } from '../../category-tag-input';
import { AddressInput, type AddressData } from '../../../uicustom/address-input';
import { CryptoTokenSelector, type AcceptedTokenEntry } from './crypto-token-selector';
import EvmWalletVerify from '@/components/crypto-related/EvmWalletVerify';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProductForm');

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

const SHIPPING_SPEC_KEYS = ['Weight (g)', 'Height (cm)', 'Length (cm)', 'Width (cm)'];
const GENERAL_SPEC_KEYS = ['Custom', 'Material', 'Color', 'Size', 'Brand', 'Model', 'Country of Origin', 'Warranty', 'Certification'];
const REPO_ACCESS_SPEC_KEY = '__repo_access';

type RepoAccessMode = 'COLLABORATOR' | 'TEAM';
type RepoAccessPermission = 'pull' | 'push' | 'maintain' | 'admin';

type RepoAccessDraft = {
  owner: string;
  repo: string;
  mode: RepoAccessMode;
  permission: RepoAccessPermission;
  org: string;
  teamSlug: string;
  defaultBranch: string;
  previewBranch: string;
  devBranch: string;
  notes: string;
};

const DEFAULT_REPO_ACCESS_DRAFT: RepoAccessDraft = {
  owner: '',
  repo: '',
  mode: 'COLLABORATOR',
  permission: 'pull',
  org: '',
  teamSlug: '',
  defaultBranch: '',
  previewBranch: '',
  devBranch: '',
  notes: '',
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

interface ProductCompanyContext {
  id: string;
  name: string;
  ownerId: string;
  creatorId: string;
  warehouseLocations: WarehouseLocation[];
  employees: Array<{
    userId: string;
    role?: string;
    permissions?: Record<string, unknown>;
  }>;
}

interface Specification {
  key: string;
  value: string | number;
  type: 'text' | 'number';
  placeholder?: string;
}

interface Feature {
  text: string;
  key?: string;   // Optional category label (e.g. "Durability", "Storage")
  icon?: string;  // Reserved for future icon support
}

// Legacy prefix kept for backward compat — prefer `log.*` calls
const MyLogPrefix = '[ProductForm]';

export const MyProductCreationForm = () => {
  // Router for login redirect
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
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
  const [features, setFeatures] = useState<Feature[]>([]);
  
  // Crypto accepted tokens state
  const [acceptedTokens, setAcceptedTokens] = useState<AcceptedTokenEntry[]>([]);
  const [hasVerifiedWallet, setHasVerifiedWallet] = useState<boolean | null>(null); // null = not checked yet
  const [showWalletWarning, setShowWalletWarning] = useState(false);
  
  // Seller payment setup state (receiving wallet picker + PayPal status)
  const [sellerWallets, setSellerWallets] = useState<Array<{ id: string; label: string; address: string; chainId?: number | null; isDefault?: boolean; verifiedAt: string | null }>>([]);
  const [sellerPaypalEmail, setSellerPaypalEmail] = useState<string | null>(null);
  const [sellerPaypalVerified, setSellerPaypalVerified] = useState(false);
  const [selectedReceiverWalletId, setSelectedReceiverWalletId] = useState<string | null>(null);
  
  const [repoAccessEnabled, setRepoAccessEnabled] = useState(false);
  const [repoAccessDraft, setRepoAccessDraft] = useState<RepoAccessDraft>(DEFAULT_REPO_ACCESS_DRAFT);
  
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
  const examplePlaceholders = [...SHIPPING_SPEC_KEYS, ...GENERAL_SPEC_KEYS];
  
  // Feature category presets - helps users categorize features
  const featureCategoryPresets = [
    'Storage', 'Design', 'Durability', 'Material', 'Comfort', 
    'Security', 'Performance', 'Compatibility', 'Included', 'Bonus'
  ];
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
  const [prefilledCompanyContext, setPrefilledCompanyContext] = useState<ProductCompanyContext | null>(null);
  const [isPrefilledCompanyLoading, setIsPrefilledCompanyLoading] = useState(false);
  const [canManageCompanyWarehouse, setCanManageCompanyWarehouse] = useState(false);
  const [availableFiatMethods, setAvailableFiatMethods] = useState<Array<{ type: string; displayName: string; icon: string }>>([]);
  const [isPaymentMethodsLoading, setIsPaymentMethodsLoading] = useState(false);
  const companiesFetched = useRef(false);
  
  // Ship-from address state (for manual entry with full address)
  const [shipFromAddress, setShipFromAddress] = useState<Partial<AddressData>>({});

  // UI States
  const [error, setError] = useState<string | undefined>('');
  const [success, setSuccess] = useState<string | undefined>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // ── Funnel step state (staged listing flow) ──────────────────────────────
  // The form is split into a left-rail funnel. All field sections stay mounted
  // (so react-hook-form state + in-progress uploads never reset on step change);
  // we only toggle which step's panel is visible. Navigation is free — users can
  // jump to any step — and validation is soft until the final Publish.
  const [activeStep, setActiveStep] = useState<number>(0);

  // ── Price display unit ────────────────────────────────────────────────────
  // The Currency dropdown lets sellers express the price in a fiat OR a crypto
  // unit (incl. a custom token). The stored `priceCurrency` always stays a valid
  // fiat so cart/checkout USD-conversion keeps working today; the chosen crypto
  // unit is captured here as a display preference until the crypto-pricing
  // pipeline is wired end-to-end. `__CRYPTO__` / `__CUSTOM__` are UI-only values.
  const [priceUnit, setPriceUnit] = useState<string>('USD');
  const [customPriceToken, setCustomPriceToken] = useState({ symbol: '', chain: 'EVM', address: '' });
  const CRYPTO_PRICE_UNITS = ['ETH', 'USDC', 'HEX', 'PLS', 'SOL'] as const;
  const isCryptoPriceUnit = (CRYPTO_PRICE_UNITS as readonly string[]).includes(priceUnit) || priceUnit === '__CUSTOM__';
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
      acceptedTokens: [],
      receiverWalletId: null,
    },
  });

  const priceCurrency = form.watch('priceCurrency');
  const priceCurrencyMeta = FIAT_CURRENCY_META[(priceCurrency ?? 'USD') as FiatCurrencyType];

  const sourceParam = searchParams.get('source') ?? '';
  const prefilledCompanyId = (searchParams.get('companyId') ?? '').trim();
  const hasCompanyPrefillFromQuery = !!prefilledCompanyId;
  const cameFromCompanyHub = sourceParam === 'company-hub' && !!prefilledCompanyId;
  const selectedCompanyId = cameFromCompanyHub ? prefilledCompanyId : companyId;
  const isWarehouseMissingForSelectedCompany =
    isCompanyProduct &&
    !!selectedCompanyId &&
    !isPrefilledCompanyLoading &&
    warehouseLocations.length === 0;
  const isDigitalOnlyLiteMode = isWarehouseMissingForSelectedCompany;
  const isTestModeEnabled = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

  const companySettingsHref = selectedCompanyId
    ? `/companies/${selectedCompanyId}/settings?returnTo=${encodeURIComponent(
        cameFromCompanyHub
          ? `/products/create?source=company-hub&companyId=${selectedCompanyId}`
          : hasCompanyPrefillFromQuery
            ? `/products/create?companyId=${selectedCompanyId}`
          : '/products/create'
      )}`
    : '/companies';

  // Update userId when clientUser loads
  useEffect(() => {
    if (!clientUser?.id) return;
    setUId(clientUser.id);
    form.setValue('userId', clientUser.id, { shouldValidate: true, shouldDirty: false, shouldTouch: false });
  }, [clientUser?.id, form]);

  const reloadSellerWallets = useCallback(async () => {
    const wRes = await fetch('/api/wallets/evm');
    if (!wRes.ok) {
      setSellerWallets([]);
      setHasVerifiedWallet(false);
      setShowWalletWarning(acceptedTokens.length > 0);
      return [];
    }

    const wData = await wRes.json();
    const all = Array.isArray(wData?.wallets) ? wData.wallets : [];
    const verified = all.filter((w: { verifiedAt?: string | null }) => !!w.verifiedAt);
    setSellerWallets(verified);
    setHasVerifiedWallet(verified.length > 0);
    setShowWalletWarning(acceptedTokens.length > 0 && verified.length === 0);

    if (!selectedReceiverWalletId && verified.length > 0) {
      const preferred = verified.find((w: { isDefault?: boolean }) => w.isDefault) ?? verified[0];
      setSelectedReceiverWalletId(preferred.id);
    }

    return verified;
  }, [acceptedTokens.length, selectedReceiverWalletId]);

  // Check for verified wallet when user enables crypto tokens
  useEffect(() => {
    if (acceptedTokens.length === 0 || !clientUser?.id) {
      setShowWalletWarning(false);
      return;
    }
    // Only check once per session
    if (hasVerifiedWallet !== null) {
      setShowWalletWarning(!hasVerifiedWallet);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/wallets/evm');
        if (!res.ok) {
          if (!cancelled) { setHasVerifiedWallet(false); setShowWalletWarning(true); }
          return;
        }
        const data = await res.json();
        const wallets = Array.isArray(data?.wallets) ? data.wallets : [];
        const hasVerified = wallets.some((w: { verified?: boolean; verifiedAt?: string | null }) => w.verified || !!w.verifiedAt);
        if (!cancelled) {
          setHasVerifiedWallet(hasVerified);
          setShowWalletWarning(!hasVerified);
        }
      } catch {
        if (!cancelled) { setHasVerifiedWallet(false); setShowWalletWarning(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [acceptedTokens.length, clientUser?.id, hasVerifiedWallet]);

  // ── Fetch seller payment info (wallets + PayPal status) ─────────────────
  useEffect(() => {
    if (!clientUser?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const verifiedWallets = await reloadSellerWallets();
        // Fetch PayPal status via server action (import is already available)
        const { getSellerPaymentStatus } = await import('@/actions/seller-payment');
        const pRes = await getSellerPaymentStatus({ target: 'user' });
        if (!cancelled && 'data' in pRes) {
          setSellerPaypalEmail(pRes.data.paypalEmail);
          setSellerPaypalVerified(pRes.data.paypalEmailVerified);
          // Default to user's default receiving wallet if set
          if (pRes.data.defaultReceivingWalletId && !selectedReceiverWalletId) {
            setSelectedReceiverWalletId(pRes.data.defaultReceivingWalletId);
          } else if (!selectedReceiverWalletId && verifiedWallets.length > 0) {
            const preferred = verifiedWallets.find((w: { isDefault?: boolean }) => w.isDefault) ?? verifiedWallets[0];
            setSelectedReceiverWalletId(preferred.id);
          }
        }
      } catch { /* silently fail */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientUser?.id, reloadSellerWallets]);

  useEffect(() => {
    if (!hasCompanyPrefillFromQuery || !prefilledCompanyId) return;

    let cancelled = false;
    setIsPrefilledCompanyLoading(true);
    setIsCompanyProduct(true);
    setCompanyId(prefilledCompanyId);

    (async () => {
      try {
        const response = await fetch(`/api/companies/${encodeURIComponent(prefilledCompanyId)}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load selected company context');
        }

        const company = (await response.json()) as ProductCompanyContext;
        if (cancelled) return;

        setPrefilledCompanyContext(company);
        setWarehouseLocations(company.warehouseLocations || []);

        if (company.warehouseLocations?.length) {
          setPostalCodes((prev) => (prev.length > 0 ? prev : [company.warehouseLocations[0].postalCode]));
          setWarehouseLocationError(null);
        } else {
          setPostalCodes([]);
          setWarehouseLocationError('This company has no warehouse addresses yet. Physical and hybrid listings are disabled.');
        }

        const currentUserId = clientUser?.id;
        const employee = company.employees?.find((entry) => entry.userId === currentUserId);
        const permissions = (employee?.permissions ?? {}) as Record<string, unknown>;
        const canManageWarehouse =
          company.ownerId === currentUserId ||
          company.creatorId === currentUserId ||
          employee?.role === 'OWNER' ||
          employee?.role === 'MANAGER' ||
          permissions.CAN_MANAGE_WAREHOUSES === true ||
          permissions.CAN_EDIT_COMPANY_DETAILS === true;

        setCanManageCompanyWarehouse(Boolean(canManageWarehouse));
      } catch (error) {
        if (cancelled) return;
        log.error('Failed loading company-hub context', error);
        setWarehouseLocationError('Could not load company context from hub. Please reselect company manually.');
      } finally {
        if (!cancelled) {
          setIsPrefilledCompanyLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasCompanyPrefillFromQuery, prefilledCompanyId, clientUser?.id]);

  useEffect(() => {
    let cancelled = false;
    setIsPaymentMethodsLoading(true);

    fetch('/api/payments')
      .then((response) => (response.ok ? response.json() : { methods: [] }))
      .then((payload) => {
        if (cancelled) return;
        const methods = Array.isArray(payload?.methods) ? payload.methods : [];
        setAvailableFiatMethods(
          methods.filter((entry: { type?: string }) => entry?.type !== 'crypto')
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableFiatMethods([]);
      })
      .finally(() => {
        if (!cancelled) setIsPaymentMethodsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDigitalOnlyLiteMode) return;
    if (productType !== 'DIGITAL') {
      setProductType('DIGITAL');
    }
    if (isPhysicalProduct) {
      setIsPhysicalProduct(false);
    }
    if (specifications.some((s) => SHIPPING_SPEC_KEYS.includes(s.key))) {
      setSpecifications((prev) => prev.filter((s) => !SHIPPING_SPEC_KEYS.includes(s.key)));
    }
    setPostalCodes([]);
  }, [isDigitalOnlyLiteMode, productType, isPhysicalProduct, specifications]);

  // Restore form state from sessionStorage after login redirect
  useEffect(() => {
    if (hasRestoredForm) return;
    if (isSessionLoading) return; // Wait for session to load
    
    const savedState = loadFormState<z.infer<typeof MyProductCreateSchema>>(FORM_STORAGE_KEY);
    if (!savedState) {
      setHasRestoredForm(true);
      return;
    }

    log.info('Restoring saved form state');
    
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
      log.error('Postal code suggestions fetch failed', error);
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
        log.error('Image upload failed', error);
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
      log.error('Digital file upload failed', error);
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
      'font/ttf': ['.ttf'],
      'font/otf': ['.otf'],
      'font/woff': ['.woff'],
      'font/woff2': ['.woff2'],
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

  // Drag-to-reorder image thumbnails. The first image is always the cover, so
  // dragging any tile to position 0 promotes it to cover.
  const dragImageIndexRef = useRef<number | null>(null);
  const [dragImageIndex, setDragImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);

  const handleImageReorder = (to: number) => {
    const from = dragImageIndexRef.current;
    if (from === null || from === to) return;
    moveImage(from, to);
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
      : examplePlaceholders.filter(placeholder => !SHIPPING_SPEC_KEYS.includes(placeholder));
  
    // Find next unused placeholder (skip 'Custom' as first choice for preset)
    const nextPlaceholder = availablePlaceholders.find(placeholder =>
      placeholder !== 'Custom' && !specifications.some(spec => spec.key === placeholder)
    ) ?? 'Custom';
  
    const newSpec: Specification = {
      key: nextPlaceholder,
      value: '',
      type: SHIPPING_SPEC_KEYS.includes(nextPlaceholder) ? 'number' : 'text'
    };
  
    setSpecifications([...specifications, newSpec]);
  };

  // ── Feature handlers ──
  const addFeature = (withCategory?: string) => {
    setFeatures([...features, { text: '', key: withCategory || '' }]);
  };

  const updateFeature = (index: number, field: keyof Feature, value: string) => {
    setFeatures(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  const removeFeature = (index: number) => {
    setFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const reorderFeatures = (from: number, to: number) => {
    setFeatures(prev => {
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  // Helper to get specification value by key (for shipping estimates)
  const getSpecValue = (key: string): number => {
    const spec = specifications.find(s => s.key === key);
    if (!spec) return 0;
    const val = typeof spec.value === 'number' ? spec.value : parseFloat(String(spec.value));
    return isNaN(val) ? 0 : val;
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

      if (repoAccessEnabled) {
        const owner = repoAccessDraft.owner.trim();
        const repo = repoAccessDraft.repo.trim();
        if (!owner || !repo) {
          setError('GitHub repo access requires owner and repo.');
          return;
        }
        if (repoAccessDraft.mode === 'TEAM' && !repoAccessDraft.teamSlug.trim()) {
          setError('GitHub repo access in TEAM mode requires a team slug.');
          return;
        }

        const repoAccessPayload: Record<string, string> = {
          owner,
          repo,
          mode: repoAccessDraft.mode,
          permission: repoAccessDraft.permission,
        };

        if (repoAccessDraft.org.trim()) repoAccessPayload.org = repoAccessDraft.org.trim();
        if (repoAccessDraft.teamSlug.trim()) repoAccessPayload.teamSlug = repoAccessDraft.teamSlug.trim();
        if (repoAccessDraft.defaultBranch.trim()) repoAccessPayload.defaultBranch = repoAccessDraft.defaultBranch.trim();
        if (repoAccessDraft.previewBranch.trim()) repoAccessPayload.previewBranch = repoAccessDraft.previewBranch.trim();
        if (repoAccessDraft.devBranch.trim()) repoAccessPayload.devBranch = repoAccessDraft.devBranch.trim();
        if (repoAccessDraft.notes.trim()) repoAccessPayload.notes = repoAccessDraft.notes.trim();

        const cleanedSpecs = formattedSpecifications.filter((spec) => spec.key !== REPO_ACCESS_SPEC_KEY);
        cleanedSpecs.push({
          key: REPO_ACCESS_SPEC_KEY,
          value: JSON.stringify(repoAccessPayload),
        });

        values.specifications = cleanedSpecs;
      } else if (formattedSpecifications && formattedSpecifications.length > 0) {
        values.specifications = formattedSpecifications.filter((spec) => spec.key !== REPO_ACCESS_SPEC_KEY);
      }
  
      // Format features - filter out empty entries
      const formattedFeatures = features
        .filter(f => f.text.trim().length > 0)
        .map(f => ({
          text: f.text.trim(),
          ...(f.key?.trim() ? { key: f.key.trim() } : {}),
        }));
      
      if (formattedFeatures.length > 0) {
        values.features = formattedFeatures;
      }

      // Include accepted crypto tokens
      values.acceptedTokens = acceptedTokens;

      // Include selected receiver wallet
      if (selectedReceiverWalletId) {
        values.receiverWalletId = selectedReceiverWalletId;
      }

      const data = await MyCreateProductAction(values, finalPostalCodes);
      if ('error' in data) {
        setError(data.error);
      }
      if ('success' in data) {
        setSuccess(data.success);
        handleReset();
        // Redirect to the newly created product page
        router.push(`/products/${data.productId}`);
      }
    } catch (e) {
      log.error('Create product failed', e);
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
    setFeatures([]);
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
    setRepoAccessEnabled(false);
    setRepoAccessDraft(DEFAULT_REPO_ACCESS_DRAFT);
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
    setCanManageCompanyWarehouse(false);
    setPrefilledCompanyContext(null);

    if (newIsCompanyProduct && !companiesFetched.current) {
      log.debug('Fetching companies');
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
      log.debug('Company product mode toggled off — state reset');
    }
  }, [companyId, isCompanyProduct])

  const handleCompanySelect = useCallback(async (companyId: string) => {
    log.debug(`Selected company: ${companyId}`);
    setCompanyId(companyId);

    try {
      const response = await fetch(`/api/companies/${companyId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch company details');
      }
      const companyDetails = (await response.json()) as ProductCompanyContext;
      setPrefilledCompanyContext(companyDetails);
      setWarehouseLocations(companyDetails.warehouseLocations || []);

      const currentUserId = clientUser?.id;
      const employee = companyDetails.employees?.find((entry) => entry.userId === currentUserId);
      const permissions = (employee?.permissions ?? {}) as Record<string, unknown>;
      const canManageWarehouse =
        companyDetails.ownerId === currentUserId ||
        companyDetails.creatorId === currentUserId ||
        employee?.role === 'OWNER' ||
        employee?.role === 'MANAGER' ||
        permissions.CAN_MANAGE_WAREHOUSES === true ||
        permissions.CAN_EDIT_COMPANY_DETAILS === true;

      setCanManageCompanyWarehouse(Boolean(canManageWarehouse));

      if (Array.isArray(companyDetails.warehouseLocations) && companyDetails.warehouseLocations.length > 0) {
        setPostalCodes((prev) => (prev.length > 0 ? prev : [companyDetails.warehouseLocations[0].postalCode]));
      }
      setWarehouseLocationError(companyDetails.warehouseLocations.length === 0 ? 'Selected company does not have warehouse locations. Physical and hybrid listings are disabled until a warehouse is added.' : null);
    } catch (error) {
      log.error('Company details fetch failed', error);
      setWarehouseLocationError('Error fetching company details. Please enter the postal code manually.');
    }
  }, [clientUser?.id]);

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
    log.debug(`Postal codes selected: ${postalCodes}`);
  };

  const handleSelectChange = (selectedValue: string) => {
    const selectedPostalCodeData = suggestions.find(suggestion => suggestion.postal_code === selectedValue);
    setSelectedPostalCodeDetail(selectedPostalCodeData ?? null);
    setPostalCodeInput(selectedValue);
  };

  const customStyles = {
    section: 'space-y-4 border-t border-border/70 pt-6 first:border-t-0 first:pt-0',
    sectionAlt: 'space-y-4 border-t border-border/70 pt-6',
    sectionTitle: 'text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]',
    item: `group flex flex-col w-full items-start`,
    itemHoverEffect: `group flex flex-col w-full items-start`,
    itemRole: `${clientUser?.role === UserRole.ADMIN ? 'group items-start hidden flex-col' : 'hidden'}`,
    label: `text-xs font-medium text-foreground/90 mb-1`,
    labelHint: 'text-xs text-muted-foreground/70 mt-0.5 font-normal',
    // NOTE: shadcn Input/SelectTrigger/Textarea components come with their own border/bg.
    // These classes intentionally override that so everything looks consistent.
    input: `w-full rounded-lg px-3 py-2 text-sm !border !border-input !bg-background/75 hover:!bg-muted/30 text-foreground placeholder:text-muted-foreground/70 !outline-none focus-visible:!ring-2 focus-visible:!ring-emerald-500/40 focus-visible:!ring-offset-0 transition-colors duration-150`,
    selectTrigger: `w-full rounded-lg px-3 py-2 text-sm !border !border-input !bg-background/75 hover:!bg-muted/30 text-foreground !outline-none focus-visible:!ring-2 focus-visible:!ring-emerald-500/40 focus-visible:!ring-offset-0 transition-colors duration-150`,
    textarea: `w-full rounded-lg px-3 py-2 text-sm !border !border-input !bg-background/75 hover:!bg-muted/30 text-foreground placeholder:text-muted-foreground/70 !outline-none focus-visible:!ring-2 focus-visible:!ring-emerald-500/40 focus-visible:!ring-offset-0 transition-colors duration-150 resize-none`,
    selectContent: `border border-border bg-popover text-popover-foreground shadow-lg`,
    selectItem: `text-popover-foreground focus:bg-muted focus:text-foreground data-[state=checked]:bg-emerald-500/15 data-[state=checked]:text-foreground`,
    inputCheckbox: `rounded border border-input bg-background text-emerald-600 focus:ring-emerald-500/30 focus:ring-offset-0`,
    toggle: `hover:cursor-pointer flex gap-3 items-center py-2 px-3 w-full rounded-lg border border-border/80 bg-transparent hover:bg-muted/30 transition-colors duration-150`,
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
  const hasRequiredShippingSpecs = !needsShippingSpecs || SHIPPING_SPEC_KEYS.every(key => {
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
      const missingSpecs = SHIPPING_SPEC_KEYS.filter(key => {
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

  // ── Funnel steps ─────────────────────────────────────────────────────────
  // Each step owns a slice of the form. `done` is a soft, glanceable signal for
  // the left rail (a quiet dot) — it never blocks navigation. The Digital step
  // is hidden entirely for purely physical products.
  const watchedTitle = form.watch('title');
  const watchedPrice = form.watch('price');
  const showDigitalStep = productType === 'DIGITAL' || productType === 'HYBRID';
  const showShippingStep = productType === 'PHYSICAL' || productType === 'HYBRID';

  const FUNNEL_STEPS: {
    id: string;
    label: string;
    hint: string;
    show: boolean;
    done: boolean;
  }[] = [
    {
      id: 'type',
      label: 'Type & photos',
      hint: 'What are you selling, and how does it look',
      show: true,
      done: imagePreviews.length > 0,
    },
    {
      id: 'details',
      label: 'Details',
      hint: 'Title, categories, description, highlights',
      show: true,
      done: !!watchedTitle && watchedTitle.trim().length > 0,
    },
    {
      id: 'digital',
      label: 'Digital file',
      hint: 'Upload the file buyers receive',
      show: showDigitalStep,
      done: !!digitalFile || digitalAssetId !== '',
    },
    {
      id: 'pricing',
      label: 'Price & payment',
      hint: 'Set the price and accepted methods',
      show: true,
      done: Number(watchedPrice) > 0,
    },
    {
      id: 'delivery',
      label: 'Delivery & payout',
      hint: 'Where it ships from, how you get paid',
      show: true,
      done: showShippingStep ? postalCodes.length > 0 : true,
    },
    {
      id: 'review',
      label: 'Review & publish',
      hint: 'Check everything, then go live',
      show: true,
      done: !hasValidationIssues,
    },
  ];

  const visibleSteps = FUNNEL_STEPS.filter((s) => s.show);
  // Clamp activeStep if the visible set shrinks (e.g. switching away from Digital).
  const safeActiveStep = Math.min(activeStep, visibleSteps.length - 1);
  const currentStep = visibleSteps[safeActiveStep];
  const goToStep = (idx: number) => {
    setActiveStep(Math.max(0, Math.min(idx, visibleSteps.length - 1)));
    // Scroll the content column back to top on step change for a clean read.
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const isStepActive = (id: string) => currentStep?.id === id;

  // Throttled form-state debug log — only fires once per 5 s to avoid console spam
  const lastFormLogRef = useRef(0);
  if (process.env.NODE_ENV === 'development') {
    const now = Date.now();
    if (now - lastFormLogRef.current > 5000) {
      lastFormLogRef.current = now;
      log.debug('Form state', {
        isValid: form.formState.isValid,
        isDirty: form.formState.isDirty,
        errorKeys: Object.keys(formErrors),
        userId: form.getValues('userId') ? '✓' : '✗',
        missing: missingItems.length,
      });
    }
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

    // Funnel guard: only the Review step publishes. Pressing Enter in a field on
    // an earlier step advances to the next step instead of submitting the listing.
    if (currentStep?.id !== 'review') {
      goToStep(safeActiveStep + 1);
      return;
    }

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
          // Session may still be hydrating — wait briefly and retry once
          await new Promise(r => setTimeout(r, 1000));
          if (clientUser?.id) {
            form.setValue('userId', clientUser.id, { shouldValidate: true });
          } else {
            setError('Failed to load user data. Please refresh the page.');
            return;
          }
        }
      }
    }

    // Sync productType to form state so validation sees the correct value
    form.setValue('productType', productType, { shouldValidate: false });

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
      {/* File Re-selection Notice — quiet inline line shown after login redirect */}
      {showFileReselectionNotice && (
        <div className="mb-6 flex items-start gap-2 border-l-2 border-amber-500/50 pl-3 text-xs text-muted-foreground">
          <p className="flex-1 leading-relaxed">
            <span className="font-medium text-foreground">Draft restored.</span>{' '}
            Please re-select your <strong className="text-foreground/90">images</strong> and{' '}
            <strong className="text-foreground/90">digital files</strong> — they can&apos;t be preserved across login for security.
          </p>
          <button
            type="button"
            onClick={() => setShowFileReselectionNotice(false)}
            className="shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={handleFormSubmit}
          className='grid w-full grid-cols-1 gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14'
        >
          {/* ── Left rail: text-only step nav ─────────────────────────────── */}
          <nav aria-label="Listing steps" className="lg:sticky lg:top-6 lg:self-start">
            <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible">
              {visibleSteps.map((s, idx) => {
                const active = idx === safeActiveStep;
                return (
                  <li key={s.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => goToStep(idx)}
                      className={`group relative flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-2 py-2 text-left text-sm transition-all duration-200 lg:whitespace-normal ${
                        active
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:translate-x-0.5'
                      }`}
                    >
                      {/* active marker — a quiet accent bar, not a pill */}
                      <span
                        className={`hidden h-5 w-px shrink-0 rounded-full transition-all duration-200 lg:block ${
                          active
                            ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px] shadow-emerald-500/40'
                            : 'bg-border group-hover:bg-foreground/40'
                        }`}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className={`font-medium tracking-tight transition-colors ${active ? '' : ''}`}>
                          {idx + 1}. {s.label}
                        </span>
                        {active && (
                          <span className="mt-0.5 hidden text-[11px] font-normal leading-snug text-muted-foreground lg:block">
                            {s.hint}
                          </span>
                        )}
                      </span>
                      {/* soft "done" dot */}
                      {s.done && !active && (
                        <span className="ml-auto hidden h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/60 lg:block" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* ── Right column: step panels ─────────────────────────────────── */}
          <div className="min-w-0">

          {/* Images Section — belongs to step 1 "Type & photos" */}
          <div hidden={!isStepActive('type')} className="w-full pb-2">
            <FormField control={form.control} name='image' render={() => (
              <FormItem className="hidden">
                <FormMessage />
              </FormItem>
            )} />

            {imagePreviews.length === 0 ? (
              // EMPTY STATE — big, inviting single drop target (fixed aspect)
              <div
                {...getRootProps()}
                className="relative mx-auto flex aspect-[4/5] w-full max-w-[380px] cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/80 bg-background/45 p-4 text-center transition-colors duration-150 hover:bg-muted/20"
              >
                <input {...getInputProps()} />
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border/70 bg-muted/35">
                  <FaFileUpload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm text-foreground">Drop images here or click to browse</div>
                  <div className="text-xs text-muted-foreground">Up to {MAX_IMAGES} images • PNG, JPG, WEBP</div>
                </div>
              </div>
            ) : (
              // FILLED STATE — auto-height responsive grid. Tiles are a fixed
              // fraction of the row, so adding images grows the grid downward
              // instead of overflowing a fixed-height box. The "+" tile is just
              // another grid cell and stays aligned with the thumbnails.
              <div className="mx-auto w-full max-w-[560px] pb-2">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {imagePreviews.length} of {MAX_IMAGES} images
                  </span>
                  <span className="text-[11px] text-muted-foreground/70">Drag to reorder — first is the cover</span>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {imagePreviews.map((preview, index) => {
                    const isDragging = dragImageIndex === index;
                    const isDropTarget = dragOverImageIndex === index && dragImageIndex !== index;
                    return (
                    <div
                      key={preview}
                      draggable
                      onDragStart={(e) => {
                        dragImageIndexRef.current = index;
                        setDragImageIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                        // Firefox requires data to be set for drag to initiate
                        try { e.dataTransfer.setData('text/plain', String(index)); } catch {}
                      }}
                      onDragEnter={(e) => { e.preventDefault(); setDragOverImageIndex(index); }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleImageReorder(index);
                        dragImageIndexRef.current = null;
                        setDragImageIndex(null);
                        setDragOverImageIndex(null);
                      }}
                      onDragEnd={() => {
                        dragImageIndexRef.current = null;
                        setDragImageIndex(null);
                        setDragOverImageIndex(null);
                      }}
                      className={`group/tile relative aspect-[4/5] cursor-grab overflow-hidden rounded-lg border bg-muted/30 transition-all duration-200 active:cursor-grabbing ${
                        isDragging
                          ? 'border-emerald-500/60 opacity-40'
                          : isDropTarget
                            ? 'border-emerald-500 ring-2 ring-emerald-500/40 -translate-y-0.5'
                            : 'border-border hover:-translate-y-0.5 hover:shadow-md'
                      }`}
                    >
                      <Image
                        src={preview}
                        alt={`preview-${index}`}
                        fill
                        sizes="(max-width: 640px) 30vw, 130px"
                        className="pointer-events-none object-cover"
                      />

                      {/* Remove button */}
                      <button
                        type="button"
                        className="group/remove absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover/tile:opacity-100"
                        onClick={(e) => removeImage(e, index)}
                        title="Remove image"
                      >
                        <RxCrossCircled className="h-4 w-4 text-white/90 transition-colors duration-150 group-hover/remove:text-red-400" />
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

                      {/* Cover badge (first tile) */}
                      {index === 0 && (
                        <div className="absolute left-1 top-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          Cover
                        </div>
                      )}
                    </div>
                    );
                  })}

                  {/* Add-more tile — same grid cell, opens the file picker */}
                  {imagePreviews.length < MAX_IMAGES && (
                    <div
                      {...getRootProps()}
                      className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-muted/20 hover:text-foreground"
                    >
                      <input {...getInputProps()} />
                      <span className="text-2xl leading-none">+</span>
                      <span className="text-[10px]">Add</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className='flex min-h-0 w-full flex-1 flex-col gap-8'>
            
            {/* Column 1: Basic info + Pricing */}
            <div className='contents'>
              {/* Basic info section */}
              <div hidden={!isStepActive('details')} className={`${customStyles.section} order-2`}>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">Describe your product</h3>
                  <p className="text-sm text-muted-foreground">
                    A clear title and a few honest details help the right buyers find you.
                  </p>
                </div>

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

              {/* Pricing - compact */}
              <div hidden={!isStepActive('pricing')} className={`${customStyles.sectionAlt} order-3`}>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">Set your price</h3>
                  <p className="text-sm text-muted-foreground">
                    Price in any currency. Decimals are fine — e.g. 0.1 ETH or 49.99 NOK.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,150px]">
                  <FormField control={form.control} name='price' render={({ field }) => (
                    <FormItem className={customStyles.item}>
                      <FormLabel className={customStyles.label}>Price</FormLabel>
                      <FormControl>
                        <div className='relative'>
                          <span className='pointer-events-none absolute left-3 top-1/2 max-w-[3rem] -translate-y-1/2 truncate text-sm font-medium text-muted-foreground'>
                            {isCryptoPriceUnit
                              ? (priceUnit === '__CUSTOM__' ? (customPriceToken.symbol || '◈') : priceUnit)
                              : priceCurrencyMeta.prefix}
                          </span>
                          <Input
                            {...field}
                            disabled={isSubmitting}
                            placeholder='0.00'
                            type='text'
                            inputMode='decimal'
                            className={`${customStyles.input} ${isCryptoPriceUnit ? 'pl-16' : 'pl-8'}`}
                            spellCheck='false'
                            onChange={e => {
                              // Allow decimals: keep digits + a single dot while typing.
                              const raw = e.target.value.replace(/[^0-9.]/g, '');
                              const cleaned = raw.replace(/(\..*)\./g, '$1'); // only first dot
                              e.target.value = cleaned;
                              form.setValue('price', cleaned ? parseFloat(cleaned) : 0, { shouldValidate: true });
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
                          value={priceUnit}
                          onValueChange={(value) => {
                            setPriceUnit(value);
                            // Keep the stored fiat currency valid for checkout. For a
                            // crypto/custom unit we settle/display in USD until the
                            // crypto-pricing pipeline is wired.
                            const fiat: FiatCurrencyType = (FiatCurrencyValues as readonly string[]).includes(value)
                              ? (value as FiatCurrencyType)
                              : 'USD';
                            field.onChange(fiat);
                            const currentAccepted = form.getValues('acceptedFiatCurrencies') ?? [];
                            if (!currentAccepted.includes(fiat)) {
                              form.setValue('acceptedFiatCurrencies', [...currentAccepted, fiat], { shouldValidate: true });
                            }
                          }}
                        >
                          <SelectTrigger className={customStyles.selectTrigger}>
                            <SelectValue placeholder="Currency" />
                          </SelectTrigger>
                          <SelectContent className={customStyles.selectContent}>
                            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Fiat</div>
                            {FiatCurrencyValues.map((code) => (
                              <SelectItem key={code} value={code} className={customStyles.selectItem}>
                                {code}
                              </SelectItem>
                            ))}
                            <div className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Crypto</div>
                            {CRYPTO_PRICE_UNITS.map((sym) => (
                              <SelectItem key={sym} value={sym} className={customStyles.selectItem}>
                                {sym}
                              </SelectItem>
                            ))}
                            <SelectItem value="__CUSTOM__" className={customStyles.selectItem}>
                              Custom token…
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Custom price-token picker — shown when "Custom token…" is chosen */}
                {priceUnit === '__CUSTOM__' && (
                  <div className="space-y-2 border-l-2 border-emerald-500/30 pl-4">
                    <p className="text-xs text-muted-foreground">Price in a token of your choice — pick its chain and paste the contract / mint address.</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input
                        value={customPriceToken.symbol}
                        onChange={(e) => setCustomPriceToken((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                        placeholder="Symbol (e.g. PEPE)"
                        className={`${customStyles.input} text-sm`}
                      />
                      <Select
                        value={customPriceToken.chain}
                        onValueChange={(v) => setCustomPriceToken((p) => ({ ...p, chain: v }))}
                      >
                        <SelectTrigger className={customStyles.selectTrigger}><SelectValue /></SelectTrigger>
                        <SelectContent className={customStyles.selectContent}>
                          <SelectItem value="EVM" className={customStyles.selectItem}>EVM (Ethereum, PulseChain, Base…)</SelectItem>
                          <SelectItem value="SOLANA" className={customStyles.selectItem}>Solana</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={customPriceToken.address}
                        onChange={(e) => setCustomPriceToken((p) => ({ ...p, address: e.target.value }))}
                        placeholder={customPriceToken.chain === 'EVM' ? 'Contract 0x…' : 'Mint address'}
                        className={`${customStyles.input} font-mono text-sm`}
                      />
                    </div>
                  </div>
                )}

                {/* Crypto-pricing note — keeps the seller informed while the
                    settlement pipeline is being wired (UI ships first). */}
                {isCryptoPriceUnit && (
                  <p className="border-l-2 border-sky-500/50 pl-3 text-xs text-muted-foreground">
                    Listed in <span className="font-medium text-foreground">{priceUnit === '__CUSTOM__' ? (customPriceToken.symbol || 'your token') : priceUnit}</span>.
                    Buyers are charged the equivalent at the live rate; settlement is shown in USD for now.
                  </p>
                )}

                <FormField control={form.control} name='acceptedFiatCurrencies' render={({ field }) => {
                  const selected = field.value ?? [];

                  return (
                    <FormItem className={customStyles.item}>
                      <FormLabel className={customStyles.label}>Accepted fiat currencies</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-2">
                          {FiatCurrencyValues.map((code) => {
                            const isSelected = selected.includes(code);
                            const isLocked = code === (form.getValues('priceCurrency') ?? 'USD');

                            return (
                              <button
                                key={code}
                                type="button"
                                disabled={isSubmitting}
                                title={isLocked ? `${code} is the listing currency and must stay enabled.` : undefined}
                                onClick={() => {
                                  if (isLocked) return;
                                  const next = isSelected
                                    ? selected.filter((value) => value !== code)
                                    : [...selected, code];
                                  field.onChange(next);
                                }}
                                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                  isSelected
                                    ? 'border-emerald-500/60 bg-emerald-500/10 text-foreground'
                                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                                } ${isLocked ? 'ring-1 ring-emerald-500/30' : ''}`}
                              >
                                {code}
                              </button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <div className="text-xs text-muted-foreground">
                        Buyers can pay in enabled fiat options during checkout; your listing currency stays required.
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }} />

                <div className="space-y-1 border-l-2 border-border pl-3 text-xs">
                  <div className="font-medium text-foreground">Payment readiness</div>
                  <div className="text-muted-foreground">
                    Environment: {isTestModeEnabled ? 'Test mode (sandbox)' : 'Live mode'}
                  </div>
                  <div className="text-muted-foreground">
                    {isPaymentMethodsLoading
                      ? 'Loading enabled checkout providers…'
                      : availableFiatMethods.length > 0
                        ? `Enabled fiat providers: ${availableFiatMethods.map((method) => method.displayName).join(', ')}`
                        : 'No fiat providers enabled here. Crypto checkout can still be used.'}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Seller Payment Status & Wallet Picker ─────────────────── */}
            <div hidden={!isStepActive('delivery')} className={`${customStyles.sectionAlt} order-4`}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receiving Payment Methods</h4>
              
              {/* PayPal status indicator */}
              <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                sellerPaypalEmail && sellerPaypalVerified
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : sellerPaypalEmail
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'border-zinc-200 dark:border-white/10 bg-muted/20 text-muted-foreground'
              }`}>
                <span className="shrink-0">{sellerPaypalEmail && sellerPaypalVerified ? '✅' : sellerPaypalEmail ? '⏳' : '—'}</span>
                <span>
                  <strong>PayPal:</strong>{' '}
                  {sellerPaypalEmail
                    ? sellerPaypalVerified
                      ? `${sellerPaypalEmail} (verified)`
                      : `${sellerPaypalEmail} (pending verification)`
                    : 'Not configured'}
                </span>
                {(!sellerPaypalEmail || (sellerPaypalEmail && !sellerPaypalVerified)) && (
                  <a href="/settings?section=payments" target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] font-medium hover:underline">
                    {sellerPaypalEmail ? 'Manage' : 'Set up'} →
                  </a>
                )}
              </div>

              {/* Receiver wallet picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Receiving wallet for this product
                  {' '}
                  <span className="text-muted-foreground font-normal">(optional override)</span>
                </label>
                {sellerWallets.length > 0 ? (
                  <select
                    value={selectedReceiverWalletId ?? ''}
                    onChange={(e) => setSelectedReceiverWalletId(e.target.value || null)}
                    disabled={isSubmitting}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Use default from settings</option>
                    {sellerWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label} — {w.address.slice(0, 6)}…{w.address.slice(-4)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-muted-foreground">
                    No verified wallet yet. You can verify one below without leaving this listing.
                  </div>
                )}
              </div>
            </div>

            {/* Crypto Token Acceptance */}
            <div hidden={!isStepActive('pricing')} className={`${customStyles.sectionAlt} order-5`}>
              <CryptoTokenSelector
                tokens={acceptedTokens}
                onChange={setAcceptedTokens}
                disabled={isSubmitting}
              />
              {/* Wallet verification warning — shown inline so user doesn't lose form state */}
              {showWalletWarning && acceptedTokens.length > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                  <span className="text-amber-500 shrink-0 mt-0.5">⚠️</span>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Add a receiving wallet before publishing crypto checkout
                    </p>
                    <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 leading-relaxed">
                      Crypto payments go directly to your verified EVM address. Signing is gasless and keeps this product form intact.
                    </p>
                    <a
                      href="/settings?section=wallet"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Open Wallet Settings ↗
                    </a>
                    <div className="mt-2 rounded-lg bg-black/10 p-2 dark:bg-black/20">
                      <EvmWalletVerify
                        enabled={true}
                        onVerified={() => {
                          void reloadSellerWallets();
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {acceptedTokens.length > 0
                  ? `${acceptedTokens.length} token${acceptedTokens.length !== 1 ? 's' : ''} selected. Buyers can still pay with fiat if enabled at checkout.`
                  : 'No tokens selected yet — buyers can still use whatever checkout methods are enabled (fiat and/or native crypto).'}
              </p>
            </div>

            <div hidden={!isStepActive('delivery')} className={`${customStyles.sectionAlt} order-7`}>
              <h3 className={customStyles.sectionTitle}>GitHub Repo Access</h3>
              <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
                Sell access to a private GitHub repository. After purchase, the buyer&apos;s GitHub account is automatically
                added as a collaborator or team member with the permission level you choose.
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={repoAccessEnabled}
                    disabled={isSubmitting || (productType !== 'DIGITAL' && productType !== 'HYBRID')}
                    onChange={(e) => setRepoAccessEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Enable automatic GitHub access grant after purchase
                </label>
                {productType !== 'DIGITAL' && productType !== 'HYBRID' && (
                  <p className="text-xs text-muted-foreground">
                    Switch product type to Digital or Hybrid to enable repo access.
                  </p>
                )}

                {repoAccessEnabled && (
                  <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                    {/* Repo identification */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Repository</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          value={repoAccessDraft.owner}
                          onChange={(e) => setRepoAccessDraft((prev) => ({ ...prev, owner: e.target.value }))}
                          placeholder="GitHub owner/org (e.g. v3gga)"
                          className={customStyles.input}
                        />
                        <Input
                          value={repoAccessDraft.repo}
                          onChange={(e) => setRepoAccessDraft((prev) => ({ ...prev, repo: e.target.value }))}
                          placeholder="Repository name (e.g. my-app)"
                          className={customStyles.input}
                        />
                      </div>
                    </div>

                    {/* Grant mode + permission */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Access Configuration</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Select
                          value={repoAccessDraft.mode}
                          onValueChange={(value) => setRepoAccessDraft((prev) => ({ ...prev, mode: value as RepoAccessMode }))}
                        >
                          <SelectTrigger className={customStyles.selectTrigger}>
                            <SelectValue placeholder="Grant mode" />
                          </SelectTrigger>
                          <SelectContent className={customStyles.selectContent}>
                            <SelectItem value="COLLABORATOR" className={customStyles.selectItem}>
                              Collaborator — direct repo access
                            </SelectItem>
                            <SelectItem value="TEAM" className={customStyles.selectItem}>
                              Team — add to org team
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={repoAccessDraft.permission}
                          onValueChange={(value) => setRepoAccessDraft((prev) => ({ ...prev, permission: value as RepoAccessPermission }))}
                        >
                          <SelectTrigger className={customStyles.selectTrigger}>
                            <SelectValue placeholder="Permission" />
                          </SelectTrigger>
                          <SelectContent className={customStyles.selectContent}>
                            <SelectItem value="pull" className={customStyles.selectItem}>
                              Pull — read-only (recommended for buyers)
                            </SelectItem>
                            <SelectItem value="push" className={customStyles.selectItem}>
                              Push — read + write
                            </SelectItem>
                            <SelectItem value="maintain" className={customStyles.selectItem}>
                              Maintain — push + manage issues/PRs
                            </SelectItem>
                            <SelectItem value="admin" className={customStyles.selectItem}>
                              Admin — full control (use carefully)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {repoAccessDraft.mode === 'TEAM' && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Team Details</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            value={repoAccessDraft.org}
                            onChange={(e) => setRepoAccessDraft((prev) => ({ ...prev, org: e.target.value }))}
                            placeholder="Org name (if different from owner)"
                            className={customStyles.input}
                          />
                          <Input
                            value={repoAccessDraft.teamSlug}
                            onChange={(e) => setRepoAccessDraft((prev) => ({ ...prev, teamSlug: e.target.value }))}
                            placeholder="Team slug (required)"
                            className={customStyles.input}
                          />
                        </div>
                      </div>
                    )}

                    {/* Branch metadata — optional context for buyers */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Branch Info (optional — shown to buyers)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input
                          value={repoAccessDraft.defaultBranch}
                          onChange={(e) => setRepoAccessDraft((prev) => ({ ...prev, defaultBranch: e.target.value }))}
                          placeholder="main"
                          className={customStyles.input}
                        />
                      <Input
                        value={repoAccessDraft.previewBranch}
                        onChange={(e) => setRepoAccessDraft((prev) => ({ ...prev, previewBranch: e.target.value }))}
                        placeholder="preview"
                        className={customStyles.input}
                      />
                      <Input
                        value={repoAccessDraft.devBranch}
                        onChange={(e) => setRepoAccessDraft((prev) => ({ ...prev, devBranch: e.target.value }))}
                        placeholder="dev"
                        className={customStyles.input}
                      />
                      </div>
                    </div>

                    {/* Internal notes */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Internal Notes</p>
                      <Textarea
                        value={repoAccessDraft.notes}
                        onChange={(e) => setRepoAccessDraft((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Private notes about this access policy (not shown to buyers)"
                        rows={2}
                        className={customStyles.textarea}
                      />
                    </div>

                    {/* Buyer experience preview */}
                    {repoAccessDraft.owner && repoAccessDraft.repo && (
                      <div className="rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2.5 text-xs">
                        <p className="font-semibold text-green-700 dark:text-green-400 mb-1">Buyer Experience Preview</p>
                        <p className="text-muted-foreground leading-relaxed">
                          After payment, the buyer will be prompted to enter their GitHub username.
                          They&apos;ll receive <strong>{repoAccessDraft.permission}</strong> access to{' '}
                          <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                            {repoAccessDraft.owner}/{repoAccessDraft.repo}
                          </code>
                          {repoAccessDraft.mode === 'TEAM' && repoAccessDraft.teamSlug
                            ? ` via the "${repoAccessDraft.teamSlug}" team`
                            : ' as a direct collaborator'}
                          . A confirmation email will be sent once access is granted.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Options + Specifications */}
            <div className='contents'>
              {/* Product Type Selection */}
              <div hidden={!isStepActive('type')} className={`${customStyles.section} order-1 mt-8 border-t border-border/70 pt-8`}>
                <h3 className={customStyles.sectionTitle}>Product Type</h3>

                {isDigitalOnlyLiteMode && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-medium">Lite mode: Digital listing only</p>
                    <p className="mt-1">
                      This company does not have a warehouse address yet. You can publish a digital product now, or add a warehouse to unlock physical and hybrid listings.
                    </p>
                    <div className="mt-2">
                      {canManageCompanyWarehouse ? (
                        <button
                          type="button"
                          onClick={() => router.push(companySettingsHref)}
                          className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
                        >
                          Add warehouse address in Company Settings
                        </button>
                      ) : (
                        <span>
                          You don&apos;t have permission to add a warehouse address for this company. Contact an owner/admin.
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {PRODUCT_TYPE_OPTIONS.map((option) => (
                    (() => {
                      const optionBlockedByWarehouse =
                        isDigitalOnlyLiteMode && (option.value === 'PHYSICAL' || option.value === 'HYBRID');

                      return (
                    <label
                      key={option.value}
                      title={optionBlockedByWarehouse ? 'Disabled: Add a warehouse address in Company Settings to list physical or hybrid products.' : undefined}
                      className={`group relative flex cursor-pointer flex-col items-start gap-1 rounded-lg px-4 py-3.5 text-left transition-all duration-200 ${
                        optionBlockedByWarehouse ? 'opacity-45 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:bg-muted/30'
                      } ${
                        productType === option.value
                          ? 'bg-emerald-500/[0.07] dark:bg-emerald-400/[0.06]'
                          : ''
                      }`}
                    >
                      {/* selected marker — a quiet accent rail, not a filled box */}
                      <span
                        className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full transition-all duration-200 ${
                          productType === option.value
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : 'bg-transparent group-hover:bg-border'
                        }`}
                      />
                      <input
                        type="radio"
                        name="productType"
                        value={option.value}
                        checked={productType === option.value}
                        disabled={optionBlockedByWarehouse}
                        onChange={(e) => {
                          const newType = e.target.value as ProductTypeType;
                          setProductType(newType);
                          // Auto-enable physical product mode for PHYSICAL and HYBRID
                          if (newType === 'PHYSICAL' || newType === 'HYBRID') {
                            setIsPhysicalProduct(true);
                            // Add shipping specs if not already present
                            if (specifications.length === 0 || !specifications.some(s => SHIPPING_SPEC_KEYS.includes(s.key))) {
                              const shippingSpecs: Specification[] = [
                                { key: 'Weight (g)', value: '', type: 'number' },
                                { key: 'Height (cm)', value: '', type: 'number' },
                                { key: 'Length (cm)', value: '', type: 'number' },
                                { key: 'Width (cm)', value: '', type: 'number' },
                              ];
                              setSpecifications([...shippingSpecs, ...specifications.filter(s => !SHIPPING_SPEC_KEYS.includes(s.key))]);
                            }
                          } else {
                            setIsPhysicalProduct(false);
                            // Remove shipping specs for digital-only
                            setSpecifications(specifications.filter(s => !SHIPPING_SPEC_KEYS.includes(s.key)));
                          }
                        }}
                        className="sr-only"
                      />
                      <span
                        className={`text-sm font-medium transition-colors ${
                          productType === option.value
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-foreground'
                        }`}
                      >
                        {option.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </label>
                      );
                    })()
                  ))}
                </div>
              </div>

              {/* Digital File Upload - shown for DIGITAL and HYBRID */}
              {(productType === 'DIGITAL' || productType === 'HYBRID') && (
                <div hidden={!isStepActive('digital')} className={`${customStyles.section} order-6`}>
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
                          <div className="shrink-0 w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
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
                          className="shrink-0 p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
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
              <div hidden={!isStepActive('delivery')} className={`${customStyles.section} order-8`}>
                <h3 className={customStyles.sectionTitle}>Additional Options</h3>
                
                {/* Company product toggle */}
                <div className="space-y-2">
                  {cameFromCompanyHub ? (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                      <div className="text-foreground font-medium">Posting on behalf of business</div>
                      <div className="text-muted-foreground mt-1">
                        {isPrefilledCompanyLoading
                          ? 'Loading company context...'
                          : `Selected company: ${prefilledCompanyContext?.name ?? prefilledCompanyId}`}
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}

                  {isCompanyProduct && !cameFromCompanyHub && !companyId && (
                    <p className="text-xs text-muted-foreground pl-1">
                      Select a company above to auto-load warehouse addresses, permissions, and company posting context.
                    </p>
                  )}
                </div>

                {/* Shipping options - shown for PHYSICAL and HYBRID */}
                {(productType === 'PHYSICAL' || productType === 'HYBRID') && !isDigitalOnlyLiteMode && (
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      Shipping Location
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

                    {/* Manual address entry - uses AddressInput with auto-detect + manual edit */}
                    {(isCompanyProduct === false || warehouseLocations.length === 0) && (
                      <div className="space-y-2">
                        <AddressInput
                          value={shipFromAddress}
                          onChange={(addr) => {
                            setShipFromAddress(addr);
                            // Keep postal code in sync for backwards compatibility
                            if (addr.postalCode) {
                              setPostalCodeInput(addr.postalCode);
                            }
                          }}
                          disabled={isSubmitting}
                          label="Ship from location"
                          placeholder="Start typing address..."
                          showAddressLine2={true}
                          hint="Auto-detect via Bring API or edit manually. Address details help with accurate shipping."
                        />
                      </div>
                    )}

                    {warehouseLocationError && (
                      <p className="text-amber-400/80 text-xs">{warehouseLocationError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Features - bullet-point highlights */}
              <div hidden={!isStepActive('details')} className={`${customStyles.sectionAlt} order-9`}>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">Highlights</h3>
                  <p className="text-sm text-muted-foreground">
                    Optional. Short selling points — e.g. &quot;6 card slots&quot;, &quot;Hand-stitched edges&quot;.
                  </p>
                </div>
                
                <div className="space-y-2">
                  {features.map((feature, index) => (
                    <div key={index} className="flex gap-2 items-start group/feature">
                      {/* Drag handle / bullet indicator */}
                      <div className="shrink-0 pt-2.5 text-muted-foreground/50 text-xs select-none">
                        •
                      </div>
                      
                      {/* Optional category tag */}
                      <Select
                        value={feature.key || '_none'}
                        onValueChange={(value) => updateFeature(index, 'key', value === '_none' ? '' : value)}
                      >
                        <SelectTrigger className={`${customStyles.selectTrigger} w-24 sm:w-28 shrink-0 text-xs`}>
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent className={customStyles.selectContent}>
                          <SelectItem value="_none" className={customStyles.selectItem}>
                            <span className="text-muted-foreground">No label</span>
                          </SelectItem>
                          {featureCategoryPresets.map((cat) => (
                            <SelectItem key={cat} value={cat} className={customStyles.selectItem}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Feature text input */}
                      <Input
                        value={feature.text}
                        onChange={(e) => updateFeature(index, 'text', e.target.value)}
                        placeholder="e.g. 6 card slots, Hand-stitched edges..."
                        className={`${customStyles.input} flex-1 text-sm`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addFeature();
                          }
                        }}
                      />
                      
                      {/* Move up */}
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => reorderFeatures(index, index - 1)}
                          className="shrink-0 p-1.5 text-muted-foreground/40 hover:text-foreground transition-colors opacity-0 group-hover/feature:opacity-100"
                          title="Move up"
                        >
                          <FiChevronLeft className="h-3.5 w-3.5 rotate-90" />
                        </button>
                      )}
                      {/* Move down */}
                      {index < features.length - 1 && (
                        <button
                          type="button"
                          onClick={() => reorderFeatures(index, index + 1)}
                          className="shrink-0 p-1.5 text-muted-foreground/40 hover:text-foreground transition-colors opacity-0 group-hover/feature:opacity-100"
                          title="Move down"
                        >
                          <FiChevronRight className="h-3.5 w-3.5 rotate-90" />
                        </button>
                      )}
                      
                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                        className="shrink-0 p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <RxCrossCircled className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Add buttons */}
                  <div className="flex gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => addFeature()}
                      className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors"
                    >
                      + Add feature
                    </button>
                    <span className="text-muted-foreground/40">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        // Quick-add: paste multiple bullet points at once
                        const text = prompt('Paste features (one per line):');
                        if (text) {
                          const lines = text.split('\n')
                            .map(l => l.replace(/^[\s•\-\*\d.)+]+/, '').trim())
                            .filter(l => l.length > 0);
                          setFeatures(prev => [...prev, ...lines.map(t => ({ text: t, key: '' }))]);
                        }
                      }}
                      className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors"
                    >
                      + Paste multiple
                    </button>
                  </div>
                  
                  {/* Feature count */}
                  {features.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/60 pt-1">
                      {features.filter(f => f.text.trim()).length} feature{features.filter(f => f.text.trim()).length !== 1 ? 's' : ''} added
                    </p>
                  )}
                </div>
              </div>

              {/* Specifications - compact */}
              <div hidden={!isStepActive('details')} className={`${customStyles.sectionAlt} order-10`}>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    Specifications
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(productType === 'PHYSICAL' || productType === 'HYBRID')
                      ? 'Weight in grams and dimensions in cm — required so we can calculate shipping.'
                      : 'Optional details like material, brand, or size.'}
                  </p>
                </div>
                
                <FormField control={form.control} name='specifications' render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="space-y-2">
                        {specifications.map((spec, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            {isPhysicalProduct && SHIPPING_SPEC_KEYS.includes(spec.key) ? (
                              <div className="w-28 shrink-0 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm font-medium text-foreground sm:w-32">
                                {spec.key}
                              </div>
                            ) : spec.key === 'Custom' || !examplePlaceholders.includes(spec.key) ? (
                              // Custom: editable text input for key
                              <Input
                                value={spec.key === 'Custom' ? '' : spec.key}
                                onChange={(e) => handleSpecificationChange(index, 'key', e.target.value || 'Custom')}
                                placeholder="Spec name"
                                className={`${customStyles.input} w-28 sm:w-32 shrink-0 text-sm`}
                              />
                            ) : (
                              // Preset: dropdown select
                              <Select
                                value={spec.key}
                                onValueChange={(value) => handleSpecificationChange(index, 'key', value)}
                              >
                                <SelectTrigger className={`${customStyles.selectTrigger} w-28 sm:w-32 shrink-0 text-sm`}>
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
                                const isNumberSpec = SHIPPING_SPEC_KEYS.includes(spec.key);
                                if (isNumberSpec) {
                                  const numericValue = e.target.value.replace(/[^0-9.]/g, '');
                                  handleSpecificationChange(index, 'value', numericValue);
                                } else {
                                  handleSpecificationChange(index, 'value', e.target.value);
                                }
                              }}
                              placeholder={SHIPPING_SPEC_KEYS.includes(spec.key) ? "Enter number" : "Value"}
                              type="text"
                              inputMode={SHIPPING_SPEC_KEYS.includes(spec.key) ? "numeric" : "text"}
                              className={`${customStyles.input} flex-1 text-sm`}
                            />
                            {/* Only show remove button for non-shipping specs when physical/hybrid */}
                            {!(isPhysicalProduct && SHIPPING_SPEC_KEYS.includes(spec.key)) && (
                              <button
                                type="button"
                                onClick={() => removeSpecification(index)}
                                className="shrink-0 p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                              >
                                <RxCrossCircled className="h-4 w-4" />
                              </button>
                            )}
                            {/* Show locked indicator for required shipping specs */}
                            {isPhysicalProduct && SHIPPING_SPEC_KEYS.includes(spec.key) && (
                              <div className="shrink-0 p-1.5 text-muted-foreground/50" title="Required for shipping">
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

          {/* ════════════ FINAL STEP — Review & publish ════════════ */}
          <div hidden={!isStepActive('review')} className={`${customStyles.section} border-t-0 pt-0`}>
            <h3 className={customStyles.sectionTitle}>Review &amp; Publish</h3>
            <p className="text-xs text-muted-foreground">
              A quick look at how your listing reads. Jump back to any step on the left to make changes.
            </p>

            {/* Listing preview — text-on-background, mirrors how buyers see it */}
            <div className="mt-4 flex flex-col gap-5 sm:flex-row">
              {/* Cover */}
              <div className="relative aspect-[4/5] w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30">
                {imagePreviews[0] ? (
                  <Image
                    src={imagePreviews[0]}
                    alt="Listing cover preview"
                    fill
                    sizes="220px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No image yet
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="text-xl font-semibold tracking-tight text-foreground">
                  {watchedTitle?.trim() || <span className="text-muted-foreground">Untitled listing</span>}
                </div>
                <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {Number(watchedPrice) > 0
                    ? `${priceCurrencyMeta.prefix}${Number(watchedPrice).toLocaleString()} ${priceCurrencyMeta.label}`
                    : <span className="text-muted-foreground text-base font-normal">No price set</span>}
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 pt-1 text-sm">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="text-foreground">{PRODUCT_TYPE_OPTIONS.find((o) => o.value === productType)?.label ?? productType}</dd>
                  <dt className="text-muted-foreground">Photos</dt>
                  <dd className="text-foreground">{imagePreviews.length}</dd>
                  {showShippingStep && (
                    <>
                      <dt className="text-muted-foreground">Ships from</dt>
                      <dd className="text-foreground">{postalCodes.length > 0 ? postalCodes.join(', ') : '—'}</dd>
                    </>
                  )}
                  {showDigitalStep && (
                    <>
                      <dt className="text-muted-foreground">Digital file</dt>
                      <dd className="text-foreground">{digitalFileName || (digitalAssetId ? 'Attached' : '—')}</dd>
                    </>
                  )}
                </dl>
              </div>
            </div>

            {/* Login prompt — quiet inline line */}
            {sessionStatus === 'unauthenticated' && (
              <p className="mt-5 text-sm text-muted-foreground">
                <ShieldCheck className="mr-1.5 inline h-4 w-4 text-sky-500 align-text-bottom" />
                You&apos;ll need to log in to publish — your draft is saved automatically.
              </p>
            )}

            {/* Validation summary — only on the final step, where it can be acted on */}
            {hasValidationIssues && !success && (
              <div className="mt-5 space-y-1.5 border-l-2 border-amber-500/50 pl-3 text-xs">
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  Before publishing, finish {missingItems.length} item{missingItems.length !== 1 ? 's' : ''}:
                </p>
                <ul className="space-y-0.5 text-amber-600/90 dark:text-amber-400/90">
                  {missingItems.map((item, index) => (
                    <li key={index}>— {item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 space-y-2">
              <MyFormError message={error} />
              <MyFormSuccess message={success} />
            </div>
          </div>

          {/* ── Step footer: Back / Continue / Publish ────────────────────── */}
          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => goToStep(safeActiveStep - 1)}
              disabled={safeActiveStep === 0}
              className="text-sm font-medium text-muted-foreground transition-all duration-200 hover:-translate-x-0.5 hover:text-foreground disabled:pointer-events-none disabled:opacity-0"
            >
              ← Back
            </button>

            <span className="hidden text-xs text-muted-foreground sm:block">
              Step {safeActiveStep + 1} of {visibleSteps.length}
            </span>

            {isStepActive('review') ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {isEditing && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleCancelEdit}
                    className='h-11 bg-transparent'
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type='submit'
                  disabled={isSubmitDisabled}
                  className='group h-11 px-6 text-sm font-medium bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 transition-all duration-200 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-500/30 disabled:opacity-60 disabled:hover:bg-emerald-600 disabled:hover:shadow-none'
                >
                  {submitLabel}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => goToStep(safeActiveStep + 1)}
                className="group inline-flex items-center gap-2 self-start rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all duration-200 hover:gap-3 hover:shadow-md sm:self-auto"
              >
                Continue
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </button>
            )}
          </div>

          </div>{/* /right column */}

        </form>
      </Form>
    </div>
  );
};
