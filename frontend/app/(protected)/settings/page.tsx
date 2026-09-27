'use client';

import * as z from 'zod';
import { Form, FormField, FormControl, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';

import { useRef, useState, useTransition, useEffect, useCallback, DragEvent, ClipboardEvent } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MyAuthSettingsSchema } from '@/schemas';
import { settings } from "@/actions/settings";
import { useCurrentUser } from '@/hooks/use-current-user';
import { MyFormError } from '@/components/uicustom/forms/form-error';
import { MyFormSuccess } from '@/components/uicustom/forms/form-sucess';
import { UserRole } from '@/generated/prisma/browser';
import { useUiPreferences, ACCENT_PRESETS } from '@/components/providers/ui-preferences';
import { swapThemeWithReveal } from '@/components/uicustom/chrome/theme-toggle';
import { useEdgeStore } from '@/lib/edgestore';
import { FancyBackground } from '@/components/uicustom/fancy-background';
import ImagePositionAdjuster from '@/components/uicustom/image-position-adjuster';
import { NotificationSettings as NotificationSettingsComponent } from '@/components/uicustom/notifications/notification-settings';
import { exportMyData } from '@/actions/gdpr-data-export';
import { requestAccountDeletion, cancelAccountDeletion } from '@/actions/gdpr-account-deletion';
import type { NotificationSettings as NotificationSettingsType, NotificationMute } from '@/components/uicustom/notifications/types';
import { CurrencySelector, useCurrency, FIAT_CURRENCIES, CRYPTO_CURRENCIES } from '@/components/uicustom/currency-selector';
import { VerificationDashboard } from '@/components/uicustom/verification-dashboard';
import { SellerPaymentSettings } from '@/components/uicustom/settings/seller-payment-settings';
import { SettingsNavigation } from '@/components/uicustom/settings/settings-navigation';
import { isDemoUserId } from '@/lib/demo-policy';
import { useAddresses, type Address } from '@/hooks/use-addresses';
import type { AddressLabel } from '@/generated/prisma/browser';
import WalletConnectChooser from '@/components/crypto-related/WalletConnectChooser';
import EvmWalletVerify from '@/components/crypto-related/EvmWalletVerify';
import EvmWalletList from '@/components/crypto-related/EvmWalletList';
import { Web3ModeControl } from '@/components/uicustom/settings/web3-mode-control';
import { useWeb3Mode } from '@/hooks/use-web3-mode';
import { 
  FiUser, FiLock, FiMail, FiBell, FiShield, FiSave, 
  FiEdit2, FiX, FiCheck, FiImage, FiChevronRight, FiCamera, FiUpload,
  FiArrowRight, FiInfo, FiTrendingUp, FiEye, FiUsers, FiActivity, FiSliders, FiDollarSign, FiKey, FiMapPin,
  FiDownload, FiTrash2, FiAlertTriangle, FiFlag, FiCreditCard
} from 'react-icons/fi';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { PageHeader } from "@/components/uicustom/chrome/page-header";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const SECTION_IDS = ['profile', 'account', 'security', 'wallet', 'payments', 'notifications', 'privacy', 'appearance', 'currency', 'verification', 'ai', 'addresses'] as const;
type SectionId = typeof SECTION_IDS[number];

export default function SettingsPage() {
  const { data: accountSession, status: accountStatus, update } = useSession();
  // A session refresh temporarily has loading status but retains the same user.
  // Keep this form mounted instead of erasing its draft and save confirmation.
  const user = accountStatus === 'unauthenticated' ? null : accountSession?.user ?? null;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { prefs, setPrefs, resetPrefs } = useUiPreferences();
  const formRef = useRef<HTMLFormElement>(null);
  const { edgestore } = useEdgeStore();

  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>(() => {
    const section = searchParams.get('section') as SectionId;
    return SECTION_IDS.includes(section) ? section : 'profile';
  });
  
  // Read section from URL params (e.g. /settings?section=notifications)
  useEffect(() => {
    const sectionParam = searchParams.get('section');
    if (sectionParam && SECTION_IDS.includes(sectionParam as SectionId)) {
      setActiveSection(sectionParam as SectionId);
    }
  }, [searchParams]);

  const handleSectionChange = useCallback((section: SectionId) => {
    setActiveSection(section);
    document.querySelector('[data-site-scroll]')?.scrollTo({ top: 0, behavior: 'instant' });
    const next = `/settings?section=${section}`;
    if (window.location.pathname + window.location.search !== next) {
      router.replace(next, { scroll: false });
    }
  }, [router]);
  
  // Profile editing state - ORIGINAL values from server
  const [originalData, setOriginalData] = useState<{
    image: string | null;
    banner: string | null;
    bio: string | null;
    name: string | null;
    reach: { totalViews: number; uniqueViewers: number; totalReplies: number; engagementRate: number; postCount: number; followerCount: number } | null;
  }>({ image: null, banner: null, bio: null, name: null, reach: null });
  
  // PENDING changes (preview before save)
  const [pendingChanges, setPendingChanges] = useState<{
    image?: string | null;
    banner?: string | null;
    bio?: string;
    name?: string;
  }>({});
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  // Image position adjuster (drag-to-frame before save)
  const [adjustingImage, setAdjustingImage] = useState<{ file: File; target: 'banner' | 'avatar' } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bannerDropRef = useRef<HTMLDivElement>(null);
  const avatarDropRef = useRef<HTMLDivElement>(null);
  
  // Drag state for visual feedback
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);

  // Check if there are unsaved changes
  const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

  // Fetch profile data on mount
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/users/${user.id}`)
        .then(res => res.json())
        .then(data => {
          const userData = data.user || data;
          setOriginalData({
            image: userData.image || null,
            banner: userData.banner || null,
            bio: userData.bio || null,
            name: userData.name || null,
            reach: userData.reach ? {
              totalViews: userData.reach.totalViews || 0,
              uniqueViewers: userData.reach.uniqueViewers || 0,
              totalReplies: userData.reach.totalReplies || 0,
              engagementRate: userData.reach.engagementRate || 0,
              postCount: userData._count?.posts || 0,
              followerCount: userData._count?.followers || 0,
            } : null,
          });
        })
        .catch(err => console.error('Failed to fetch profile:', err));
    }
  }, [user?.id]);

  // Image validation helper
  const validateImageFile = useCallback((file: File): boolean => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return false;
    }
    return true;
  }, []);

  // Upload image and return URL (doesn't save to profile yet)
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const res = await edgestore.myPublicImages.upload({ file });
      return res.url;
    } catch (err) {
      console.error('Error uploading image:', err);
      toast.error('Failed to upload image');
      return null;
    }
  }, [edgestore]);

  // Upload a framed blob produced by the position adjuster
  const uploadAdjusted = useCallback(async (blob: Blob, target: 'banner' | 'avatar') => {
    const setBusy = target === 'banner' ? setIsUploadingBanner : setIsUploadingAvatar;
    setBusy(true);
    const framed = new File([blob], `${target}-framed.webp`, { type: 'image/webp' });
    const url = await uploadImage(framed);
    if (url) {
      setPendingChanges(prev => target === 'banner' ? { ...prev, banner: url } : { ...prev, image: url });
      toast.success(`${target === 'banner' ? 'Banner' : 'Avatar'} framed! Click Save to apply.`);
    }
    setBusy(false);
  }, [uploadImage]);

  // Handle banner file selection (from input, paste, or drop).
  // Static images open the position adjuster first (drag to frame before
  // saving); animated GIFs skip it so the animation isn't flattened.
  const handleBannerFile = useCallback(async (file: File) => {
    if (!validateImageFile(file)) return;
    if (file.type !== 'image/gif') {
      setAdjustingImage({ file, target: 'banner' });
      return;
    }
    setIsUploadingBanner(true);
    const url = await uploadImage(file);
    if (url) {
      setPendingChanges(prev => ({ ...prev, banner: url }));
      toast.success('Banner preview ready! Click Save to apply.');
    }
    setIsUploadingBanner(false);
  }, [uploadImage, validateImageFile]);

  // Handle avatar file selection (from input, paste, or drop)
  const handleAvatarFile = useCallback(async (file: File) => {
    if (!validateImageFile(file)) return;
    if (file.type !== 'image/gif') {
      setAdjustingImage({ file, target: 'avatar' });
      return;
    }
    setIsUploadingAvatar(true);
    const url = await uploadImage(file);
    if (url) {
      setPendingChanges(prev => ({ ...prev, image: url }));
      toast.success('Avatar preview ready! Click Save to apply.');
    }
    setIsUploadingAvatar(false);
  }, [uploadImage, validateImageFile]);

  // Handle file input change
  const handleAvatarInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAvatarFile(file);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleBannerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleBannerFile(file);
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  };

  // Handle paste (Ctrl+V) for images
  const handlePaste = useCallback((e: ClipboardEvent, target: 'banner' | 'avatar') => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (target === 'banner') {
            handleBannerFile(file);
          } else {
            handleAvatarFile(file);
          }
        }
        break;
      }
    }
  }, [handleBannerFile, handleAvatarFile]);

  // Handle drag and drop
  const handleDragOver = (e: DragEvent, target: 'banner' | 'avatar') => {
    e.preventDefault();
    e.stopPropagation();
    if (target === 'banner') setIsDraggingBanner(true);
    else setIsDraggingAvatar(true);
  };

  const handleDragLeave = (e: DragEvent, target: 'banner' | 'avatar') => {
    e.preventDefault();
    e.stopPropagation();
    if (target === 'banner') setIsDraggingBanner(false);
    else setIsDraggingAvatar(false);
  };

  const handleDrop = useCallback((e: DragEvent, target: 'banner' | 'avatar') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBanner(false);
    setIsDraggingAvatar(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        if (target === 'banner') {
          handleBannerFile(file);
        } else {
          handleAvatarFile(file);
        }
      } else {
        toast.error('Please drop an image file');
      }
    }
  }, [handleBannerFile, handleAvatarFile]);

  // Save all pending changes
  const handleSaveProfile = async () => {
    if (!hasUnsavedChanges || !user?.id) return;
    
    setIsSavingProfile(true);
    try {
      const updateRes = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingChanges),
      });

      if (!updateRes.ok) throw new Error('Failed to update profile');

      // Update original data with saved changes
      setOriginalData(prev => ({
        ...prev,
        ...pendingChanges,
      }));
      
      // Clear pending changes
      setPendingChanges({});
      
      // Update session if name/image changed
      if (pendingChanges.image || pendingChanges.name) {
        update();
      }
      
      toast.success('Profile saved successfully!');
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Discard all pending changes
  const handleDiscardChanges = () => {
    setPendingChanges({});
    toast.info('Changes discarded');
  };

  // Get current display value (pending or original)
  const getCurrentValue = <K extends keyof typeof pendingChanges>(key: K) => {
    return key in pendingChanges ? pendingChanges[key] : originalData[key as keyof typeof originalData];
  };
  
  const form = useForm<z.infer<typeof MyAuthSettingsSchema>>({
    resolver: zodResolver(MyAuthSettingsSchema),
    defaultValues: {
      name: user?.name || undefined,
      email: user?.email || undefined,
      password: undefined,
      newPassword: undefined,
      role: user?.role || undefined,
      isTwoFactorEnabled: user?.isTwoFactorEnabled || undefined,
      expectedTwoFactorEnabled: user?.isTwoFactorEnabled ?? false,
      identityNameSource: user?.identityNameSource || 'AUTO',
      identityImageSource: user?.identityImageSource || 'AUTO',
      emailDisplayMode: user?.emailDisplayMode || 'PRIMARY',
    }
  });

  const newPassword = useWatch({
    control: form.control,
    name: "newPassword",
  });

  const [needsSecurityCode, setNeedsSecurityCode] = useState(false);
  const settingsActor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (accountStatus === 'loading') return;
    if (settingsActor.current === user?.id) return;
    settingsActor.current = user?.id;
    form.reset({ name: user?.name || undefined, email: user?.email || undefined,
      isTwoFactorEnabled: user?.isTwoFactorEnabled ?? false, expectedTwoFactorEnabled: user?.isTwoFactorEnabled ?? false,
      identityNameSource: user?.identityNameSource ?? 'AUTO', identityImageSource: user?.identityImageSource ?? 'AUTO',
      emailDisplayMode: user?.emailDisplayMode ?? 'PRIMARY', password: '', newPassword: '', securityCode: '' });
    setNeedsSecurityCode(false); setError(''); setSuccess(''); setIsEditing(false);
  }, [user, form, accountStatus]);
  const onSubmit = (values: z.infer<typeof MyAuthSettingsSchema>) => {
    setError(''); setSuccess('');
    // Account and Security are separate changes; never submit an old security
    // toggle or a hidden password with a display-name edit.
    const input = activeSection === 'security' ? {
      password: values.password, newPassword: values.newPassword,
      isTwoFactorEnabled: values.isTwoFactorEnabled ?? false,
      expectedTwoFactorEnabled: values.expectedTwoFactorEnabled,
      securityCode: values.securityCode,
    } : {
      name: values.name, email: values.email, identityNameSource: values.identityNameSource,
      identityImageSource: values.identityImageSource, emailDisplayMode: values.emailDisplayMode,
    };
    startTransition(async () => {
      try {
        const data = await settings(input);
        if ('error' in data) {
          setError(data.error);
        }
        if ('twoFactor' in data) {
          setNeedsSecurityCode(true);
          setSuccess('Enter the code sent to your account email. Nothing has changed yet.');
          requestAnimationFrame(() => form.setFocus('securityCode'));
        }
        if ('success' in data) {
          form.setValue('password', ''); form.setValue('newPassword', ''); form.setValue('securityCode', '');
          setNeedsSecurityCode(false);
          setSuccess(data.success);
          setIsEditing(false);
          if (data.signInRequired) await signOut({ callbackUrl: '/auth/login?callbackUrl=%2Fsettings%3Fsection%3Dsecurity' });
          else await update();
        }
      } catch {
        setError('The save could not be confirmed. Reload Settings before trying again.');
      }
    });
  };

  const handleStartEdit = () => {
    if (!isEditing) {
      form.reset({
        name: user?.name || undefined,
        email: user?.email || undefined,
        password: undefined,
        newPassword: undefined,
        role: user?.role || undefined,
        isTwoFactorEnabled: user?.isTwoFactorEnabled || undefined,
        expectedTwoFactorEnabled: user?.isTwoFactorEnabled ?? false,
        identityNameSource: user?.identityNameSource || 'AUTO',
        identityImageSource: user?.identityImageSource || 'AUTO',
        emailDisplayMode: user?.emailDisplayMode || 'PRIMARY',
      });
    }
    setIsEditing(!isEditing);
    setError('');
    setSuccess('');
  };

  const handleCancelEdit = () => {
    form.reset({
      name: user?.name || undefined,
      email: user?.email || undefined,
      password: undefined,
      newPassword: undefined,
      role: user?.role || undefined,
      isTwoFactorEnabled: user?.isTwoFactorEnabled || undefined,
      expectedTwoFactorEnabled: user?.isTwoFactorEnabled ?? false,
      identityNameSource: user?.identityNameSource || 'AUTO',
      identityImageSource: user?.identityImageSource || 'AUTO',
      emailDisplayMode: user?.emailDisplayMode || 'PRIMARY',
    });
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: FiImage, description: 'Avatar, banner & bio' },
    { id: 'account', label: 'Account', icon: FiUser, description: 'Manage your account details' },
    { id: 'appearance', label: 'Appearance', icon: FiSliders, description: 'Theme, effects & animations' },
    { id: 'currency', label: 'Currency', icon: FiDollarSign, description: 'Display currency & crypto' },
    { id: 'security', label: 'Security', icon: FiShield, description: 'Password and authentication' },
    { id: 'wallet', label: 'Web3 & Wallet', icon: FiKey, description: 'Connect wallets & crypto' },
    { id: 'payments', label: 'Payments', icon: FiCreditCard, description: 'PayPal & receiving wallet' },
    { id: 'verification', label: 'Verification', icon: FiTrendingUp, description: 'Trust level & Reach multiplier' },
    { id: 'ai', label: 'AI Keys', icon: FiKey, description: 'Bring your own AI key' },
    { id: 'addresses', label: 'Addresses', icon: FiMapPin, description: 'Saved shipping addresses' },
    { id: 'notifications', label: 'Notifications', icon: FiBell, description: 'Email and push notifications' },
    { id: 'privacy', label: 'Privacy', icon: FiLock, description: 'Control your data and visibility' },
  ] as const;

  // Calculate reach radar chart data - consistent with profile page
  const reach = originalData.reach;
  const reachChartData = {
    labels: ['Views', 'Unique Viewers', 'Engagement', 'Post Count', 'Followers'],
    datasets: [
      {
        label: 'Your Reach',
        data: [
          // Views: normalized to 100 (1000 views = 100%)
          Math.min((reach?.totalViews || 0) / 10, 100),
          // Unique viewers: normalized to 100 (500 unique = 100%)
          Math.min((reach?.uniqueViewers || 0) / 5, 100),
          // Engagement rate: already a percentage, cap at 100
          Math.min(reach?.engagementRate || 0, 100),
          // Post count: 10 posts = 100%
          Math.min((reach?.postCount || 0) * 10, 100),
          // Followers: 100 followers = 100%
          Math.min(reach?.followerCount || 0, 100),
        ],
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(16, 185, 129, 1)',
      },
    ],
  };

  const reachChartOptions = {
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        pointLabels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 11 } },
        ticks: { display: false },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
    plugins: {
      legend: { display: false },
    },
    maintainAspectRatio: true,
  };

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-x-clip">
      {/* Conditional fancy background */}
      <FancyBackground
        gradient
        gradientVariant="default"
        spheres={[{ position: "top-right", color: "blue", size: "lg" }]}
      />

      <div className="relative mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div>
          {/* Header */}
          <PageHeader
            eyebrow="Account"
            title="Settings"
            description="Manage your account settings and preferences."
            className="mb-6"
          />

          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
            <SettingsNavigation sections={sections} active={activeSection} onSelect={handleSectionChange} />

            {/* Main Content */}
            <div data-settings-content className={`min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6 ${activeSection === 'account' || activeSection === 'security' ? 'w-full max-w-[38rem]' : ''}`}>
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Profile</h2>
                      <p className="text-sm text-muted-foreground">Customize your avatar, banner, and bio</p>
                    </div>
                    {/* Save/Discard buttons - only show when there are changes */}
                    {hasUnsavedChanges && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDiscardChanges}
                          className="border-border text-foreground/80 hover:bg-muted dark:hover:bg-foreground/[0.05]"
                        >
                          <FiX className="h-4 w-4 mr-1" />
                          Discard
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile}
                          className="bg-brand-accent-hover hover:bg-brand-accent text-brand-accent-foreground"
                        >
                          {isSavingProfile ? (
                            <span className="animate-spin mr-2">⏳</span>
                          ) : (
                            <FiSave className="h-4 w-4 mr-1" />
                          )}
                          {isSavingProfile ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Unsaved Changes Alert */}
                  {hasUnsavedChanges && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                      <FiInfo className="h-4 w-4 shrink-0" />
                      <span>You have unsaved changes. Click &quot;Save Changes&quot; to apply them.</span>
                    </div>
                  )}

                  {/* Banner Upload - with drag & drop and paste */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground/80">Banner Image</label>
                    
                    {/* Show comparison if there's a pending change */}
                    {'banner' in pendingChanges && originalData.banner !== pendingChanges.banner && (
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-surface-1/70 border border-border dark:bg-foreground/[0.05]">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-1">Current</div>
                          <div className="relative h-16 w-full rounded-lg overflow-hidden bg-foreground/[0.07]">
                            {originalData.banner ? (
                              <Image src={originalData.banner} alt="Current banner" fill className="object-cover opacity-60" />
                            ) : (
                              <div className="flex items-center justify-center h-full text-muted-foreground/70 text-xs">No banner</div>
                            )}
                          </div>
                        </div>
                        <FiArrowRight className="h-5 w-5 text-brand-accent shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-brand-accent mb-1">New</div>
                          <div className="relative h-16 w-full rounded-lg overflow-hidden bg-brand-accent/10 border border-brand-accent/30">
                            {pendingChanges.banner ? (
                              <Image src={pendingChanges.banner} alt="New banner" fill className="object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full text-muted-foreground/70 text-xs">No banner</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div 
                      ref={bannerDropRef}
                      onDragOver={(e) => handleDragOver(e, 'banner')}
                      onDragLeave={(e) => handleDragLeave(e, 'banner')}
                      onDrop={(e) => handleDrop(e, 'banner')}
                      onPaste={(e) => handlePaste(e, 'banner')}
                      tabIndex={0}
                      className={`relative h-32 w-full rounded-xl overflow-hidden border-2 border-dashed transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent/50 ${
                        isDraggingBanner 
                          ? 'border-brand-accent bg-brand-accent/10' 
                          : prefs.hoverEffects === 'colorful'
                            ? 'border-border/70 bg-foreground/[0.05] hover:border-border dark:bg-linear-to-br dark:from-indigo-500/20 dark:to-purple-600/20 dark:hover:border-foreground/20'
                            : 'border-border/70 bg-foreground/[0.05] hover:border-border dark:hover:border-foreground/20'
                      }`}
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      {(getCurrentValue('banner') as string | null) ? (
                        <Image
                          src={getCurrentValue('banner') as string}
                          alt="Banner"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <FiImage className="h-8 w-8 text-muted-foreground/60" />
                          <span className="text-xs text-muted-foreground">Click, paste (Ctrl+V), or drag & drop</span>
                        </div>
                      )}
                      {isDraggingBanner && (
                        <div className="absolute inset-0 bg-brand-accent/20 flex items-center justify-center">
                          <div className="text-brand-accent font-medium">Drop image here</div>
                        </div>
                      )}
                      {isUploadingBanner && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="animate-spin text-2xl">⏳</div>
                        </div>
                      )}
                      {!isDraggingBanner && !isUploadingBanner && (getCurrentValue('banner') as string | null) && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-border text-foreground hover:bg-muted dark:border-foreground/20 dark:hover:bg-foreground/[0.07]"
                          >
                            <FiUpload className="h-4 w-4 mr-2" />
                            Change Banner
                          </Button>
                        </div>
                      )}
                    </div>
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBannerInputChange}
                      className="hidden"
                    />
                    <p className="text-xs text-muted-foreground">Recommended: 1500x500px, JPG/PNG/GIF/WebP, max 5MB. Paste from clipboard or drag & drop — you can drag to reframe before saving!</p>

                    {/* Drag-to-frame dialog for banner & avatar (portal-rendered) */}
                    <ImagePositionAdjuster
                      file={adjustingImage?.file ?? null}
                      aspect={adjustingImage?.target === 'avatar' ? 1 : 3}
                      round={adjustingImage?.target === 'avatar'}
                      outputWidth={adjustingImage?.target === 'avatar' ? 512 : 1500}
                      outputHeight={adjustingImage?.target === 'avatar' ? 512 : 500}
                      title={adjustingImage?.target === 'avatar' ? 'Position your profile picture' : 'Position your banner'}
                      onCancel={() => setAdjustingImage(null)}
                      onConfirm={(blob) => {
                        const target = adjustingImage?.target ?? 'banner';
                        setAdjustingImage(null);
                        void uploadAdjusted(blob, target);
                      }}
                    />
                  </div>

                  {/* Avatar Upload - with drag & drop and paste */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground/80">Profile Picture</label>
                    
                    {/* Show comparison if there's a pending change */}
                    {'image' in pendingChanges && originalData.image !== pendingChanges.image && (
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-surface-1/70 border border-border dark:bg-foreground/[0.05]">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Current</div>
                          <div className="relative h-16 w-16 rounded-full overflow-hidden bg-foreground/[0.07] mx-auto">
                            {originalData.image ? (
                              <Image src={originalData.image} alt="Current avatar" fill className="object-cover opacity-60" />
                            ) : (
                              <div className="flex items-center justify-center h-full"><FiUser className="h-6 w-6 text-muted-foreground/60" /></div>
                            )}
                          </div>
                        </div>
                        <FiArrowRight className="h-5 w-5 text-brand-accent shrink-0" />
                        <div className="text-center">
                          <div className="text-xs text-brand-accent mb-1">New</div>
                          <div className="relative h-16 w-16 rounded-full overflow-hidden bg-brand-accent/10 border-2 border-brand-accent/30 mx-auto">
                            {pendingChanges.image ? (
                              <Image src={pendingChanges.image} alt="New avatar" fill className="object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full"><FiUser className="h-6 w-6 text-muted-foreground/60" /></div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4">
                      <div 
                        ref={avatarDropRef}
                        onDragOver={(e) => handleDragOver(e, 'avatar')}
                        onDragLeave={(e) => handleDragLeave(e, 'avatar')}
                        onDrop={(e) => handleDrop(e, 'avatar')}
                        onPaste={(e) => handlePaste(e, 'avatar')}
                        tabIndex={0}
                        className={`relative h-24 w-24 rounded-full overflow-hidden border-2 border-dashed transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent/50 ${
                          isDraggingAvatar 
                            ? 'border-brand-accent bg-brand-accent/10' 
                            : prefs.hoverEffects === 'colorful'
                              ? 'border-border/70 bg-foreground/[0.05] hover:border-border dark:bg-linear-to-br dark:from-indigo-500/30 dark:to-purple-600/30 dark:hover:border-foreground/20'
                              : 'border-border/70 bg-foreground/[0.05] hover:border-border dark:hover:border-foreground/20'
                        }`}
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {(getCurrentValue('image') as string | null) ? (
                          <Image
                            src={getCurrentValue('image') as string}
                            alt="Avatar"
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <FiUser className="h-10 w-10 text-muted-foreground/60" />
                          </div>
                        )}
                        {isDraggingAvatar && (
                          <div className="absolute inset-0 bg-brand-accent/20 flex items-center justify-center">
                            <FiUpload className="h-6 w-6 text-brand-accent" />
                          </div>
                        )}
                        {isUploadingAvatar && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="animate-spin">⏳</span>
                          </div>
                        )}
                        {!isDraggingAvatar && !isUploadingAvatar && (getCurrentValue('image') as string | null) && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <FiCamera className="h-5 w-5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="border-border text-foreground/80 hover:bg-muted dark:hover:bg-foreground/[0.05]"
                        >
                          {isUploadingAvatar ? 'Uploading...' : 'Choose Image'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">Click, paste (Ctrl+V), or drag & drop</p>
                      </div>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarInputChange}
                      className="hidden"
                    />
                  </div>

                  {/* Bio */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground/80">Bio</label>
                    
                    {/* Show comparison if bio changed */}
                    {'bio' in pendingChanges && originalData.bio !== pendingChanges.bio && (
                      <div className="p-3 rounded-lg bg-surface-1/70 border border-border dark:bg-foreground/[0.05] space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Current</div>
                          <div className="text-sm text-muted-foreground line-through">{originalData.bio || '(no bio)'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-brand-accent mb-1">New</div>
                          <div className="text-sm text-foreground">{pendingChanges.bio || '(no bio)'}</div>
                        </div>
                      </div>
                    )}
                    
                    <Textarea
                      value={'bio' in pendingChanges ? (pendingChanges.bio || '') : (originalData.bio || '')}
                      onChange={(e) => setPendingChanges(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Tell others about yourself..."
                      className="bg-surface-1/70 border-border text-foreground placeholder:text-muted-foreground focus:border-brand-accent/50 min-h-[100px] resize-none dark:bg-foreground/[0.05] dark:placeholder:text-muted-foreground/70"
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {('bio' in pendingChanges ? pendingChanges.bio?.length : originalData.bio?.length) || 0}/500 characters
                      </p>
                    </div>
                  </div>

                  {/* Reach Stats Radar Chart with Calculation Breakdown */}
                  <div className="pt-4 border-t border-border space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <FiTrendingUp className="h-5 w-5 text-brand-accent" />
                        Your Reach Analytics
                      </h3>
                      <p className="text-sm text-muted-foreground">Real engagement metrics - not vanity follower counts</p>
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
                        <div className="max-w-[240px] mx-auto">
                          <Radar data={reachChartData} options={reachChartOptions} />
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Total Views */}
                        <div className="rounded-xl bg-linear-to-r from-brand-accent/10 to-brand-accent/5 border border-brand-accent/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FiEye className="h-4 w-4 text-brand-accent" />
                              <span className="text-sm text-muted-foreground dark:text-foreground/70">Total Views</span>
                            </div>
                            <div className="text-lg font-bold text-brand-accent">
                              {(reach?.totalViews || 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Chart: {Math.min((reach?.totalViews || 0) / 10, 100).toFixed(0)}% (1000 views = 100%)
                          </div>
                        </div>
                        
                        {/* Unique Viewers */}
                        <div className="rounded-xl bg-linear-to-r from-blue-500/10 to-blue-600/5 border border-blue-500/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FiUsers className="h-4 w-4 text-blue-400" />
                              <span className="text-sm text-muted-foreground dark:text-foreground/70">Unique Viewers</span>
                            </div>
                            <div className="text-lg font-bold text-blue-400">
                              {(reach?.uniqueViewers || 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Chart: {Math.min((reach?.uniqueViewers || 0) / 5, 100).toFixed(0)}% (500 unique = 100%)
                          </div>
                        </div>
                        
                        {/* Engagement Rate */}
                        <div className="rounded-xl bg-linear-to-r from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FiActivity className="h-4 w-4 text-purple-400" />
                              <span className="text-sm text-muted-foreground dark:text-foreground/70">Engagement Rate</span>
                            </div>
                            <div className="text-lg font-bold text-purple-400">
                              {(reach?.engagementRate || 0).toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Formula: (replies ÷ unique viewers) × 100 = ({reach?.totalReplies || 0} ÷ {Math.max(reach?.uniqueViewers || 0, 1)}) × 100
                          </div>
                        </div>
                        
                        {/* Post Count */}
                        <div className="rounded-xl bg-surface-1/70 border border-border p-3 dark:bg-foreground/[0.05]">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground dark:text-foreground/70">Posts</span>
                            <span className="font-bold text-foreground">{reach?.postCount || 0}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Chart: {Math.min((reach?.postCount || 0) * 10, 100)}% (10 posts = 100%)
                          </div>
                        </div>
                        
                        {/* Followers */}
                        <div className="rounded-xl bg-surface-1/70 border border-border p-3 dark:bg-foreground/[0.05]">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground dark:text-foreground/70">Followers</span>
                            <span className="font-bold text-foreground">{reach?.followerCount || 0}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Chart: {Math.min(reach?.followerCount || 0, 100)}% (100 followers = 100%)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile Link */}
                  <div className="pt-4 border-t border-border">
                    <Link
                      href={`/profile/${user.id}`}
                      className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <FiUser className="h-4 w-4" />
                      View your public profile
                      <FiChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              )}

              {activeSection === 'account' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Account Settings</h2>
                      <p className="text-sm text-muted-foreground">Update your personal information</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEdit}
                      className="border-border text-foreground/80 hover:bg-muted dark:hover:bg-foreground/[0.05]"
                    >
                      {isEditing ? <FiX className="h-4 w-4 mr-2" /> : <FiEdit2 className="h-4 w-4 mr-2" />}
                      {isEditing ? 'Cancel' : 'Edit'}
                    </Button>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} ref={formRef} aria-label="Account details" className="space-y-6 [&_input]:min-h-12 [&_input]:text-base [&_button:not([role=switch])]:min-h-11">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground/80">Display Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                disabled={isPending || !isEditing}
                                placeholder={user?.name || 'Enter your name'}
                                className="bg-surface-1/70 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 disabled:opacity-50 dark:bg-foreground/[0.05] dark:placeholder:text-muted-foreground/70"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground/80">Email Address</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                readOnly
                                autoComplete="email"
                                spellCheck={false}
                                placeholder={user?.email || 'Enter your email'}
                                className="bg-surface-1/70 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 disabled:opacity-50 dark:bg-foreground/[0.05] dark:placeholder:text-muted-foreground/70"
                              />
                            </FormControl>
                            <FormDescription className="text-muted-foreground">
                              Your sign-in email. Verified email changes are not yet available here.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="identityNameSource"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground/80">Name Source</FormLabel>
                              <Select
                                disabled={isPending || !isEditing}
                                onValueChange={field.onChange}
                                value={field.value ?? 'AUTO'}
                              >
                                <FormControl>
                                  <SelectTrigger className="bg-surface-1/70 border-border text-foreground focus:border-blue-500/50 disabled:opacity-50 dark:bg-foreground/[0.05]">
                                    <SelectValue placeholder="Choose name source" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="AUTO">Auto (active login provider)</SelectItem>
                                  <SelectItem value="MANUAL">Manual (profile name)</SelectItem>
                                  <SelectItem value="GOOGLE">Google</SelectItem>
                                  <SelectItem value="GITHUB">GitHub</SelectItem>
                                  <SelectItem value="DISCORD">Discord</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription className="text-muted-foreground">
                                Controls which linked identity name is used by default.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="identityImageSource"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground/80">Profile picture</FormLabel>
                              <Select
                                disabled={isPending || !isEditing}
                                onValueChange={field.onChange}
                                value={field.value ?? 'AUTO'}
                              >
                                <FormControl>
                                  <SelectTrigger className="bg-surface-1/70 border-border text-foreground focus:border-blue-500/50 disabled:opacity-50 dark:bg-foreground/[0.05]">
                                    <SelectValue placeholder="Choose avatar source" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="AUTO">Auto (active login provider)</SelectItem>
                                  <SelectItem value="MANUAL">Manual (profile avatar)</SelectItem>
                                  <SelectItem value="GOOGLE">Google</SelectItem>
                                  <SelectItem value="GITHUB">GitHub</SelectItem>
                                  <SelectItem value="DISCORD">Discord</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription className="text-muted-foreground">
                                Controls which linked identity avatar is shown by default.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="emailDisplayMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground/80">Email Visibility</FormLabel>
                            <Select
                              disabled={isPending || !isEditing}
                              onValueChange={field.onChange}
                              value={field.value ?? 'PRIMARY'}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-surface-1/70 border-border text-foreground focus:border-blue-500/50 disabled:opacity-50 dark:bg-foreground/[0.05]">
                                  <SelectValue placeholder="Choose email visibility" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="PRIMARY">Show primary email</SelectItem>
                                <SelectItem value="HIDE">Hide email publicly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-muted-foreground">
                              Controls public email visibility for your profile and linked identity surfaces.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Profile Link */}
                      <div className="pt-4 border-t border-border">
                        <Link
                          href={`/profile/${user.id}`}
                          className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <FiUser className="h-4 w-4" />
                          View your public profile
                          <FiChevronRight className="h-4 w-4" />
                        </Link>
                      </div>

                      {isEditing && (
                        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 bg-card py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                          <Button
                            type="submit"
                            disabled={isPending}
                            variant="vegaEmeraldBtn"
                          >
                            {isPending ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="border-border text-foreground/80 hover:bg-muted dark:hover:bg-foreground/[0.05]"
                          >
                            Cancel
                          </Button>
                        </div>
                      )}

                      <MyFormError message={error} />
                      <MyFormSuccess message={success} />
                    </form>
                  </Form>
                </div>
              )}

              {activeSection === 'security' && (
                <div className="space-y-6">
                  <div className="border-b border-border pb-4">
                    <h2 className="text-xl font-semibold text-foreground">Security</h2>
                    <p className="text-sm text-muted-foreground">Manage your password and authentication</p>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} aria-label="Account security" className="space-y-6 [&_input]:min-h-12 [&_input]:text-base [&_button:not([role=switch])]:min-h-11">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground/80">Current Password</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                autoComplete="current-password"
                                disabled={isPending}
                                placeholder="Enter current password"
                                className="bg-surface-1/70 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 dark:bg-foreground/[0.05] dark:placeholder:text-muted-foreground/70"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground/80">New Password</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                autoComplete="new-password"
                                disabled={isPending}
                                placeholder="Enter new password"
                                className="bg-surface-1/70 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 dark:bg-foreground/[0.05] dark:placeholder:text-muted-foreground/70"
                              />
                            </FormControl>
                            <FormDescription className="text-muted-foreground">
                              Must be at least 8 characters
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="pt-4 border-t border-border">
                        <FormField
                          control={form.control}
                          name="isTwoFactorEnabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
                              <div className="space-y-0.5">
                                <FormLabel className="text-foreground/80">Two-Factor Authentication</FormLabel>
                                <FormDescription className="text-muted-foreground">
                                  Email code for password sign-in. Security changes require confirmation.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={isPending}
                                  className="relative after:absolute after:inset-x-0 after:-inset-y-2.5"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {needsSecurityCode && (
                        <FormField control={form.control} name="securityCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Security code</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={isPending} className="h-12 text-base tracking-widest" /></FormControl>
                            <FormDescription>Six digits from your account email. Expires in 5 minutes.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                      <p className="text-sm text-muted-foreground">Changing security settings signs out existing sessions. Enter your current password if this account has one.</p>
                      <div className="sticky bottom-0 z-10 flex flex-wrap gap-2 bg-card py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                      <Button
                        type="submit"
                        disabled={isPending}
                        variant="vegaEmeraldBtn"
                      >
                        {isPending ? 'Updating…' : needsSecurityCode ? 'Confirm Security Change' : 'Update Security Settings'}
                      </Button>
                      {needsSecurityCode && <Button type="button" variant="outline" disabled={isPending} onClick={() => { form.setValue('securityCode', ''); void form.handleSubmit(onSubmit)(); }}>Resend Code</Button>}
                      </div>

                      <MyFormError message={error} />
                      <MyFormSuccess message={success} />
                    </form>
                  </Form>
                </div>
              )}

              {activeSection === 'notifications' && (
                <NotificationSettingsSection />
              )}

              {activeSection === 'wallet' && (
                <Web3WalletSettings />
              )}

              {activeSection === 'payments' && (
                <SellerPaymentSettings />
              )}

              {activeSection === 'verification' && (
                <VerificationDashboard />
              )}

              {activeSection === 'ai' && (
                <AiKeysSettings />
              )}

              {activeSection === 'addresses' && (
                <AddressesSettings />
              )}

              {activeSection === 'privacy' && (
                <PrivacySettings />
              )}

              {activeSection === 'appearance' && (
                <AppearanceSettings />
              )}

              {activeSection === 'currency' && (
                <CurrencySettings />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiKeysSettings() {
  const [provider, setProvider] = useState<'OPENAI' | 'OPENROUTER' | 'ANTHROPIC'>('OPENAI');
  const [apiKey, setApiKey] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [keys, setKeys] = useState<Array<{
    provider: 'OPENAI' | 'OPENROUTER' | 'ANTHROPIC';
    isDefault: boolean;
    maskedKey: string;
    keyFingerprint: string;
    updatedAt: string;
  }>>([]);

  const providerLabels = {
    OPENAI: 'OpenAI',
    OPENROUTER: 'OpenRouter',
    ANTHROPIC: 'Claude (Anthropic)',
  } as const;

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users/ai-keys', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load saved keys');
      }

      const nextKeys = Array.isArray(data?.keys) ? data.keys : [];
      setKeys(nextKeys);

      const defaultKey = nextKeys.find((k: any) => k.isDefault) || nextKeys[0];
      if (defaultKey?.provider) {
        setProvider(defaultKey.provider);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load AI keys');
      setKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Please paste an API key first');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/users/ai-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: apiKey.trim(), setDefault: setAsDefault }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save API key');
      }

      toast.success('AI key saved securely');
      setApiKey('');
      await loadKeys();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (keyProvider: 'OPENAI' | 'OPENROUTER' | 'ANTHROPIC') => {
    try {
      const res = await fetch('/api/users/ai-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: keyProvider }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete API key');
      }

      toast.success(`${providerLabels[keyProvider]} key deleted`);
      await loadKeys();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete API key');
    }
  };

  const handleSetDefault = async (keyProvider: 'OPENAI' | 'OPENROUTER' | 'ANTHROPIC') => {
    try {
      const res = await fetch('/api/users/ai-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: keyProvider }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to set default provider');
      }

      toast.success(`${providerLabels[keyProvider]} is now your default provider`);
      await loadKeys();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to set default provider');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold text-foreground">AI Keys</h2>
        <p className="text-sm text-muted-foreground">Bring your own API key. Keys are encrypted, scoped to your account, and can be removed anytime.</p>
      </div>

      <div className="rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-foreground/80">Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as 'OPENAI' | 'OPENROUTER' | 'ANTHROPIC')}>
              <SelectTrigger className="bg-surface-1/70 border-border dark:bg-foreground/[0.05]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-surface-1 dark:border-border">
                <SelectItem value="OPENAI">OpenAI</SelectItem>
                <SelectItem value="OPENROUTER">OpenRouter</SelectItem>
                <SelectItem value="ANTHROPIC">Claude (Anthropic)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/80">API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key"
              className="bg-surface-1/70 border-border text-foreground dark:bg-foreground/[0.05]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-foreground/[0.08] border border-border p-3 dark:bg-foreground/[0.05]">
          <div>
            <div className="font-medium text-foreground">Set as default provider</div>
            <div className="text-sm text-muted-foreground">This key/provider will be used when you choose saved-key generation.</div>
          </div>
          <Switch checked={setAsDefault} onCheckedChange={setSetAsDefault} />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving} className="bg-brand-accent-hover hover:bg-brand-accent text-brand-accent-foreground">
            {isSaving ? 'Saving...' : 'Save API Key'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Your full key is never shown again after save.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Saved Keys</h3>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No saved AI keys yet.
          </div>
        ) : (
          keys.map((entry) => (
            <div key={entry.provider} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
              <div>
                <div className="font-medium text-foreground flex items-center gap-2">
                  {providerLabels[entry.provider]}
                  {entry.isDefault && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent-hover dark:text-brand-accent-light">DEFAULT</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {entry.maskedKey} · Updated {new Date(entry.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!entry.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefault(entry.provider)}
                    className="border-border text-foreground/80 hover:bg-muted dark:hover:bg-foreground/[0.05]"
                  >
                    Set default
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(entry.provider)}
                  className="bg-red-600 hover:bg-red-500"
                >
                  Delete key
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Privacy Settings Component
function PrivacySettings() {
  const [settings, setSettings] = useState({
    showPulsesGiven: true,
    showPulsesReceived: true,
    showNegativePulses: false,
    showRepulses: true,
    allowNegativePulses: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch privacy settings on mount
  useEffect(() => {
    fetch('/api/users/privacy-settings')
      .then(res => res.json())
      .then(data => {
        if (!data.message) {
          setSettings(data);
        }
      })
      .catch(err => console.error('Failed to fetch privacy settings:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleToggle = async (key: keyof typeof settings) => {
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    setIsSaving(true);
    
    try {
      const res = await fetch('/api/users/privacy-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });
      
      if (!res.ok) {
        // Revert on error
        setSettings(prev => ({ ...prev, [key]: !newValue }));
        toast.error('Failed to update setting');
      } else {
        toast.success('Privacy setting updated');
      }
    } catch (err) {
      setSettings(prev => ({ ...prev, [key]: !newValue }));
      toast.error('Failed to update setting');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4">
          <h2 className="text-xl font-semibold text-foreground">Privacy</h2>
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold text-foreground">Privacy</h2>
        <p className="text-sm text-muted-foreground">Control who can see your information and activity</p>
      </div>

      {/* Heartbeat Privacy Settings */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Heartbeat Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Show Heartbeats Given</div>
              <div className="text-sm text-muted-foreground">Let others see what content you&apos;ve heartbeated</div>
            </div>
            <Switch 
              checked={settings.showPulsesGiven} 
              onCheckedChange={() => handleToggle('showPulsesGiven')}
              disabled={isSaving}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Show Heartbeats Received</div>
              <div className="text-sm text-muted-foreground">Display heartbeat counts on your content</div>
            </div>
            <Switch 
              checked={settings.showPulsesReceived} 
              onCheckedChange={() => handleToggle('showPulsesReceived')}
              disabled={isSaving}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Show Negative Heartbeats</div>
              <div className="text-sm text-muted-foreground">Display negative heartbeat counts publicly (hidden by default)</div>
            </div>
            <Switch 
              checked={settings.showNegativePulses} 
              onCheckedChange={() => handleToggle('showNegativePulses')}
              disabled={isSaving}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Show Repulses</div>
              <div className="text-sm text-muted-foreground">Let others see your repulse activity</div>
            </div>
            <Switch 
              checked={settings.showRepulses} 
              onCheckedChange={() => handleToggle('showRepulses')}
              disabled={isSaving}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Allow Negative Heartbeats</div>
              <div className="text-sm text-muted-foreground">Let others give negative heartbeats to your content</div>
            </div>
            <Switch 
              checked={settings.allowNegativePulses} 
              onCheckedChange={() => handleToggle('allowNegativePulses')}
              disabled={isSaving}
            />
          </div>
        </div>
      </div>

      {/* General Privacy Settings */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">General</h3>
        <div className="space-y-3">
          {[
            { id: 'profile', label: 'Public Profile', description: 'Allow others to view your profile' },
            { id: 'activity', label: 'Show Activity Status', description: "Let others see when you're online" },
            { id: 'analytics', label: 'Usage Analytics', description: 'Help us improve by sharing anonymous usage data' },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
              <div>
                <div className="font-medium text-foreground">{item.label}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
              </div>
              <Switch defaultChecked={item.id === 'profile'} />
            </div>
          ))}
        </div>
      </div>

      {/* GDPR — Data Export */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Dine data (GDPR)</h3>
        <DataExportCard />
      </div>

      {/* GDPR — Account Deletion */}
      <div className="pt-4 border-t border-border">
        <AccountDeletionCard />
      </div>

      {/* My Reports */}
      <div className="pt-4 border-t border-border space-y-2">
        <MyReportsCard />
      </div>
    </div>
  );
}

/** GDPR data export card */
function DataExportCard() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMyData();
      if (!result.success) {
        toast.error(result.error || 'Feil ved eksport.');
        return;
      }
      // Download as JSON file
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veggat-mine-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data eksportert og lastet ned.');
    } catch {
      toast.error('Noe gikk galt.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05] space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
          <FiDownload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-foreground">Last ned dine data</div>
          <div className="text-sm text-muted-foreground">
            Eksporter all personlig informasjon vi har om deg som JSON-fil (GDPR Art. 15/20).
          </div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
        className="gap-2"
      >
        <FiDownload className="h-4 w-4" />
        {isExporting ? 'Eksporterer...' : 'Last ned mine data'}
      </Button>
    </div>
  );
}

/** GDPR account deletion card with grace period */
function AccountDeletionCard() {
  const [pendingDeletion, setPendingDeletion] = useState<{ scheduledFor: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Check for pending deletion on mount
  useEffect(() => {
    fetch('/api/users/deletion-status')
      .then(res => res.json())
      .then(data => {
        if (data.pending) setPendingDeletion({ scheduledFor: data.scheduledFor });
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleRequest = async () => {
    if (confirmText !== 'SLETT') return;
    setIsRequesting(true);
    try {
      const result = await requestAccountDeletion();
      if (result.success && result.scheduledFor) {
        toast.success('Slettingsforespørsel registrert. Du har 30 dager til å angre.');
        setPendingDeletion({ scheduledFor: result.scheduledFor });
        setShowConfirm(false);
        setConfirmText('');
      } else {
        toast.error(result.error || 'Feil.');
      }
    } catch {
      toast.error('Noe gikk galt.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const result = await cancelAccountDeletion();
      if (result.success) {
        toast.success('Slettingsforespørsel kansellert.');
        setPendingDeletion(null);
      } else {
        toast.error(result.error || 'Feil.');
      }
    } catch {
      toast.error('Noe gikk galt.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) return null;

  if (pendingDeletion) {
    const scheduledDate = new Date(pendingDeletion.scheduledFor);
    return (
      <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 dark:bg-red-500/10 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 dark:bg-red-500/20">
            <FiAlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-red-600 dark:text-red-400">Slettingsforespørsel registrert</div>
            <div className="text-sm text-muted-foreground">
              Forespørselen er satt til gjennomgang fra{' '}
              <strong className="text-foreground">{scheduledDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              Du kan avbryte så lenge den venter på behandling.
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isCancelling}
          className="gap-2"
        >
          {isCancelling ? 'Kansellerer...' : 'Avbryt sletting'}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05] space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-red-500/10 dark:bg-red-500/20">
          <FiTrash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-foreground">Slett konto</div>
          <div className="text-sm text-muted-foreground">
            Be om sletting av kontoen. Vi gjennomgår forespørselen og hvilke opplysninger som må beholdes. Ingen data slettes når du sender forespørselen.
          </div>
        </div>
      </div>
      
      {showConfirm ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Skriv <code className="bg-red-500/10 px-1.5 py-0.5 rounded">SLETT</code> for å bekrefte:
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="SLETT"
              className="max-w-[120px]"
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRequest}
              disabled={confirmText !== 'SLETT' || isRequesting}
            >
              {isRequesting ? 'Sender...' : 'Bekreft sletting'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowConfirm(false); setConfirmText(''); }}>
              Avbryt
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowConfirm(true)}
          className="gap-2"
        >
          <FiTrash2 className="h-4 w-4" />
          Slett min konto
        </Button>
      )}
    </div>
  );
}

/** My content reports card */
function MyReportsCard() {
  const [reports, setReports] = useState<{ id: string; contentType: string; reason: string; status: string; createdAt: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users/my-reports')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReports(data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const statusLabels: Record<string, { label: string; class: string }> = {
    PENDING: { label: 'Venter', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    IN_REVIEW: { label: 'Under vurdering', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    RESOLVED: { label: 'Behandlet', class: 'bg-brand-accent/10 text-brand-accent-hover dark:text-brand-accent-light' },
    DISMISSED: { label: 'Avvist', class: 'bg-muted/10 text-muted-foreground' },
  };

  const reasonLabels: Record<string, string> = {
    ILLEGAL_CONTENT: 'Ulovlig innhold',
    HATE_SPEECH: 'Hatefulle ytringer',
    HARASSMENT: 'Trakassering',
    VIOLENCE: 'Vold/trusler',
    SEXUAL_CONTENT: 'Seksuelt innhold',
    CHILD_EXPLOITATION: 'Overgrep mot barn',
    SPAM: 'Spam',
    SCAM: 'Svindel',
    IMPERSONATION: 'Etterligning',
    COPYRIGHT_INFRINGEMENT: 'Opphavsrett',
    MISINFORMATION: 'Villedende info',
    PLATFORM_MANIPULATION: 'Manipulering',
    OTHER: 'Annet',
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Mine rapporter</h3>
      
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laster...</p>
      ) : reports.length === 0 ? (
        <div className="rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
          <div className="flex items-center gap-3">
            <FiFlag className="h-5 w-5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Du har ikke rapportert noe innhold ennå.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => {
            const status = statusLabels[report.status] || statusLabels.PENDING;
            return (
              <div key={report.id} className="rounded-xl bg-surface-1/70 border border-border p-3 dark:bg-foreground/[0.05] flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{reasonLabels[report.reason] || report.reason}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground capitalize">{report.contentType.toLowerCase()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(report.createdAt).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.class}`}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Appearance Settings Component
function AppearanceSettings() {
  const { prefs, setPrefs, resetPrefs } = useUiPreferences();
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
        <p className="text-sm text-muted-foreground">Customize the look and feel of your experience</p>
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'light', label: 'Light', description: 'Bright & clean', icon: '☀️' },
            { id: 'dark', label: 'Dark', description: 'Easy on eyes', icon: '🌙' },
            { id: 'system', label: 'System', description: 'Match device', icon: '💻' },
          ].map((themeOption) => (
            <button
              key={themeOption.id}
              onClick={(event) => swapThemeWithReveal(() => setTheme(themeOption.id), { x: event.clientX, y: event.clientY })}
              className={`p-4 rounded-xl border-2 text-left transition ${
                theme === themeOption.id
                  ? 'border-brand-accent bg-brand-accent/20 ring-2 ring-brand-accent/40 shadow-lg shadow-brand-accent/20'
                  : 'border-border hover:border-border bg-surface-1 shadow-sm'
              }`}
            >
              <div className="text-2xl mb-2">{themeOption.icon}</div>
              <div className="font-medium text-foreground">{themeOption.label}</div>
              <div className="text-xs text-muted-foreground">{themeOption.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Accent colour — pins one hue for both themes (default: sky by day, emerald by night) */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Accent colour</h3>
        <p className="text-xs text-muted-foreground">Buttons, links, the rail and the Veggat™ mark follow this in both themes.</p>
        <div role="radiogroup" aria-label="Accent colour" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {ACCENT_PRESETS.map((preset) => {
            const selected = prefs.accent === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                title={preset.hint}
                onClick={() => setPrefs({ accent: preset.id })}
                className={`group flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition-[border-color,background-color,box-shadow,transform] duration-200 motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  selected ? 'border-brand-accent bg-brand-accent/10 text-foreground shadow-e1' : 'border-border bg-surface-1 text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="relative size-7 rounded-full ring-2 ring-background shadow-e1"
                  style={{ background: `linear-gradient(135deg, ${preset.swatch.light} 50%, ${preset.swatch.dark} 50%)` }}
                >
                  {selected && <span className="absolute inset-0 rounded-full ring-2 ring-brand-accent ring-offset-2 ring-offset-background" />}
                </span>
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Style Preset */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Style Preset</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'minimal', label: 'Minimal', description: 'Clean & simple', icon: '○' },
            { id: 'modern', label: 'Modern', description: 'Balanced look', icon: '◐' },
            { id: 'vibrant', label: 'Vibrant', description: 'Full effects', icon: '●' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setPrefs({ 
                stylePreset: preset.id as 'minimal' | 'modern' | 'vibrant',
                // Auto-enable effects for vibrant preset
                ...(preset.id === 'vibrant' ? {
                  enableGradientBackgrounds: true,
                  enableGradientSpheres: true,
                  pageAnimations: 'full' as const,
                  hoverEffects: 'colorful' as const,
                } : {}),
                // Auto-disable for minimal
                ...(preset.id === 'minimal' ? {
                  enableGradientBackgrounds: false,
                  enableGradientSpheres: false,
                  pageAnimations: 'subtle' as const,
                  hoverEffects: 'simple' as const,
                } : {}),
              })}
              className={`p-4 rounded-xl border-2 text-left transition ${
                prefs.stylePreset === preset.id
                  ? 'border-brand-accent bg-brand-accent/20 ring-2 ring-brand-accent/40 shadow-lg shadow-brand-accent/20'
                  : 'border-border hover:border-border bg-surface-1 shadow-sm'
              }`}
            >
              <div className="text-2xl mb-2">{preset.icon}</div>
              <div className="font-medium text-foreground">{preset.label}</div>
              <div className="text-xs text-muted-foreground">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Visual Effects */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Visual Effects</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Gradient Backgrounds</div>
              <div className="text-sm text-muted-foreground">Colorful gradient backgrounds on pages and cards</div>
            </div>
            <Switch 
              checked={prefs.enableGradientBackgrounds} 
              onCheckedChange={(checked) => setPrefs({ enableGradientBackgrounds: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Floating Spheres</div>
              <div className="text-sm text-muted-foreground">Animated gradient orbs in the background</div>
            </div>
            <Switch 
              checked={prefs.enableGradientSpheres} 
              onCheckedChange={(checked) => setPrefs({ enableGradientSpheres: checked })}
            />
          </div>
        </div>
      </div>

      {/* Animations */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Animations</h3>
        <div className="space-y-3">
          <div className="rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05]">
            <div className="font-medium text-foreground mb-3">Page Transitions</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'none', label: 'None' },
                { id: 'subtle', label: 'Subtle' },
                { id: 'full', label: 'Full' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setPrefs({ pageAnimations: option.id as 'none' | 'subtle' | 'full' })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    prefs.pageAnimations === option.id
                      ? 'bg-brand-accent text-brand-accent-foreground shadow-md shadow-brand-accent/30'
                      : 'bg-muted text-foreground hover:bg-muted dark:hover:bg-foreground/[0.07]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Colorful Hover Effects</div>
              <div className="text-sm text-muted-foreground">Fancy color transitions on hover (instead of simple highlights)</div>
            </div>
            <Switch 
              checked={prefs.hoverEffects === 'colorful'} 
              onCheckedChange={(checked) => setPrefs({ hoverEffects: checked ? 'colorful' : 'simple' })}
            />
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Chat</h3>
        <div className="rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05]">
          <div className="font-medium text-foreground mb-1">AI chat layout</div>
          <div className="text-sm text-muted-foreground mb-3">
            How the conversation list sits next to the chat on the AI page.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'persistent', label: 'Sidebar', desc: 'List always docked left' },
              { id: 'overlay', label: 'Overlay', desc: 'Chat full-width, list slides in' },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setPrefs({ aiChatLayout: option.id as 'persistent' | 'overlay' })}
                className={`flex flex-col items-start gap-0.5 py-2.5 px-3 rounded-lg text-left transition ${
                  prefs.aiChatLayout === option.id
                    ? 'bg-brand-accent text-brand-accent-foreground shadow-md shadow-brand-accent/30'
                    : 'bg-muted text-foreground hover:bg-muted dark:hover:bg-foreground/[0.07]'
                }`}
              >
                <span className="text-sm font-medium">{option.label}</span>
                <span className={`text-[11px] ${prefs.aiChatLayout === option.id ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                  {option.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Advanced</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Web3 Mode</div>
              <div className="text-sm text-muted-foreground">Enable advanced wallet controls and crypto features</div>
            </div>
            <Web3ModeControl />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05]">
            <div>
              <div className="font-medium text-foreground">Experimental Effects</div>
              <div className="text-sm text-muted-foreground">Enable bleeding-edge visual features (may be unstable)</div>
            </div>
            <Switch 
              checked={prefs.enableExperimentalEffects} 
              onCheckedChange={(checked) => setPrefs({ enableExperimentalEffects: checked })}
            />
          </div>
        </div>
      </div>

      {/* Reset */}
      <div className="pt-4 border-t border-border flex gap-3">
        <Button 
          variant="outline" 
          onClick={resetPrefs}
          className="border-border"
        >
          Reset to Defaults
        </Button>
        <p className="text-xs text-muted-foreground self-center">
          Resets all appearance settings to minimal/clean defaults
        </p>
      </div>
    </div>
  );
}

// ─── Web3 & Wallet Settings ─────────────────────────────────────────────────

function Web3WalletSettings() {
  const user = useCurrentUser();
  const demo = isDemoUserId(user?.id);
  const web3State = useWeb3Mode();
  const web3Enabled = web3State.data === true;
  const [walletRefresh, setWalletRefresh] = useState(0);
  const [linkingGuide, setLinkingGuide] = useState(false);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold text-foreground">Web3 & Wallet</h2>
        <p className="text-sm text-muted-foreground">
          Experimental wallet connections and verified payout addresses. Not required for shopping.
        </p>
      </div>

      {/* How It Works */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
        <button
          type="button" aria-expanded={linkingGuide} aria-controls="wallet-linking-guide"
          onClick={() => setLinkingGuide(prev => !prev)}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-2">
            <FiInfo className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              How wallet linking works
            </span>
          </div>
          <FiChevronRight className={`h-4 w-4 text-blue-500 transition-transform ${linkingGuide ? 'rotate-90' : ''}`} />
        </button>
        {linkingGuide && (
          <div id="wallet-linking-guide" className="mt-3 space-y-2 text-sm text-blue-600 dark:text-blue-300/80">
            <p>1. <strong>Enable Web3 Mode</strong> below to unlock wallet features</p>
            <p>2. <strong>Connect</strong> with a browser extension directly, or use AppKit for WalletConnect/social wallets</p>
            <p>3. <strong>Verify ownership</strong> by signing a challenge message — this links the wallet to your account</p>
            <p>4. Each verified wallet <strong>increases your trust level</strong> and unlocks features like crypto payments</p>
            <p className="mt-2 text-xs text-blue-500 dark:text-blue-400/60">
              A confirmation email is sent every time you link or unlink a wallet for security.
            </p>
          </div>
        )}
      </div>

      {/* Web3 Mode Toggle */}
      {demo && <p className="rounded-xl border border-border bg-foreground/[0.04] p-4 text-sm text-muted-foreground">
        Demo preview: you can inspect wallet connection options. Saving a wallet link, changing payout settings and on-chain transactions are disabled. No signature is requested here.
      </p>}
      <div className="flex items-center justify-between gap-4 rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05]">
        <div className="min-w-0">
          <div className="font-medium text-foreground">Web3 Mode</div>
          <div className="text-sm text-muted-foreground">
            Wallet sign-in and experimental tools. Saved payout addresses are separate.
          </div>
        </div>
        <Web3ModeControl />
      </div>

      {/* Wallet Connection */}
      {(web3Enabled || demo) && (
        <div className="space-y-4">
          {/* Connect Wallet */}
          <div className="rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05] space-y-3">
            <div>
              <div className="font-medium text-foreground">Connect Wallet</div>
              <div className="text-sm text-muted-foreground">
                Choose browser extension for MetaMask/Coinbase/Rabby, or AppKit for WalletConnect and social wallets
              </div>
            </div>
            <WalletConnectChooser authenticateDirect={false}>
              <Button type="button" className="min-h-11 h-auto w-full whitespace-normal justify-center bg-brand-accent-hover px-3 py-3 text-brand-accent-foreground hover:bg-brand-accent">
                Choose wallet connection method
              </Button>
            </WalletConnectChooser>
            <WalletSessionDisconnectButton />
          </div>

          {/* Verify & Link */}
          {!demo && <div className="rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05] space-y-3">
            <div>
              <div className="font-medium text-foreground">Verify & Link Wallet</div>
              <div className="text-sm text-muted-foreground">
                Sign a message to prove ownership and link this wallet to your account
              </div>
            </div>
            <EvmWalletVerify
              enabled={web3Enabled}
              onVerified={() => setWalletRefresh(prev => prev + 1)}
            />
          </div>}

          {/* Linked Wallets */}
          {!demo && <div className="rounded-xl bg-card border border-border p-4 shadow-sm dark:bg-foreground/[0.05] space-y-3">
            <div>
              <div className="font-medium text-foreground">Verified Wallet Links</div>
              <div className="text-sm text-muted-foreground">
                Manage saved payout addresses. Removing a link is separate from disconnecting the current wallet session.
              </div>
            </div>
            <EvmWalletList
              enabled={web3Enabled}
              refreshToken={walletRefresh}
            />
          </div>}

          {/* Auth Level Info */}
          <div className="rounded-xl border border-brand-accent bg-brand-accent/50 p-4 dark:border-brand-accent/20 dark:bg-brand-accent/5">
            <div className="flex items-center gap-2 mb-2">
              <FiShield className="h-4 w-4 text-brand-accent" />
              <span className="text-sm font-semibold text-brand-accent-hover dark:text-brand-accent-light">
                Boost Your Trust Level
              </span>
            </div>
            <p className="text-sm text-brand-accent-hover dark:text-brand-accent-light">
              Linking wallets increases your verification tier and Reach multiplier.
              Check your current level in the{' '}
              <Link href="/settings?section=verification" className="font-medium underline underline-offset-2 hover:text-brand-accent">
                Verification tab
              </Link>.
            </p>
          </div>
        </div>
      )}

      {web3State.data === undefined && !demo && <div role="status" className="min-h-40 rounded-xl border border-border bg-foreground/[0.03] p-4 text-sm text-muted-foreground">{web3State.isError ? 'Wallet settings unavailable. Retry above.' : 'Loading wallet settings…'}</div>}
      {web3State.data === false && !demo && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <FiLock className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Enable Web3 Mode above to connect and manage wallets
          </p>
        </div>
      )}
    </div>
  );
}

function WalletSessionDisconnectButton() {
  const { address, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [busy, setBusy] = useState(false);

  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  const disconnectSession = async () => {
    setBusy(true);
    try {
      await disconnectAsync();
      toast.success("Wallet session disconnected. Your verified wallet link is still saved.");
    } catch {
      toast.error("Could not disconnect the wallet session.");
    } finally {
      setBusy(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        No live wallet session. Verified wallets below can still stay linked for seller payouts.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-accent/20 bg-brand-accent/10 px-3 py-2">
      <div>
        <div className="text-xs font-semibold text-brand-accent-hover dark:text-brand-accent-light">
          Current wallet session
        </div>
        <div className="text-xs text-brand-accent-hover/80">
          {shortAddress} is connected in this browser. Disconnecting does not unlink it from your account.
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={disconnectSession}
        className="min-h-11 border-brand-accent/30 bg-foreground/[0.05] text-brand-accent-hover dark:text-brand-accent-light hover:bg-brand-accent/15"
      >
        {busy ? "Disconnecting..." : "Disconnect session"}
      </Button>
    </div>
  );
}


// Notification Settings Section Component
function NotificationSettingsSection() {
  const [settings, setSettings] = useState<NotificationSettingsType>({
    id: "",
    userId: "",
    heartbeatEnabled: true,
    vibeEnabled: true,
    repulseEnabled: true,
    replyEnabled: true,
    syncEnabled: true,
    dmEnabled: true,
    groupMessageEnabled: true,
    mentionEnabled: true,
    hotPulseEnabled: true,
    milestoneEnabled: true,
    vibeCheckEnabled: false,
    pushEnabled: true,
    emailDigestEnabled: false,
    inAppEnabled: true,
    condenseNotifications: true,
    condenseThreshold: 5,
    showPreviews: true,
    showTypingIndicators: true,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [mutes, setMutes] = useState<NotificationMute[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notification settings on mount
  useEffect(() => {
    fetch('/api/notifications/settings')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      })
      .catch(err => console.error('Failed to fetch notification settings:', err))
      .finally(() => setIsLoading(false));
    
    // Fetch mutes
    fetch('/api/notifications/mutes')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMutes(data);
        }
      })
      .catch(err => console.error('Failed to fetch mutes:', err));
  }, []);

  const handleSettingsChange = async (changes: Partial<NotificationSettingsType>) => {
    // Optimistic update
    setSettings(prev => ({ ...prev, ...changes }));
    
    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      
      if (!res.ok) {
        toast.error('Failed to update notification settings');
      } else {
        toast.success('Notification settings updated');
      }
    } catch (err) {
      toast.error('Failed to update notification settings');
    }
  };

  const handleRemoveMute = async (muteId: string) => {
    // Optimistic update
    setMutes(prev => prev.filter(m => m.id !== muteId));
    
    try {
      const res = await fetch(`/api/notifications/mutes/${muteId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        toast.error('Failed to remove mute');
        // Refetch mutes on error
        const data = await fetch('/api/notifications/mutes').then(r => r.json());
        if (Array.isArray(data)) setMutes(data);
      } else {
        toast.success('Mute removed');
      }
    } catch (err) {
      toast.error('Failed to remove mute');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Customize your pulse, heartbeat, and vibe notifications
        </p>
      </div>

      <NotificationSettingsComponent
        settings={settings}
        mutes={mutes}
        onSettingsChange={handleSettingsChange}
        onRemoveMute={handleRemoveMute}
        isLoading={isLoading}
      />
    </div>
  );
}

// Currency Settings Component
function CurrencySettings() {
  const { currency, setCurrency, cryptoCurrency, setCryptoCurrency } = useCurrency();
  
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold text-foreground">Currency</h2>
        <p className="text-sm text-muted-foreground">Choose how prices are displayed across the platform</p>
      </div>

      {/* Fiat Currency */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Display Currency</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Primary currency for displaying prices
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FIAT_CURRENCIES.map((curr) => (
            <button
              key={curr.code}
              onClick={() => setCurrency(curr.code)}
              className={`p-4 rounded-xl border-2 text-left transition ${
                currency === curr.code
                  ? 'border-brand-accent bg-brand-accent/20 ring-2 ring-brand-accent/40 shadow-lg shadow-brand-accent/20'
                  : 'border-border hover:border-border bg-surface-1 shadow-sm'
              }`}
            >
              <div className="text-2xl mb-2">{curr.symbol}</div>
              <div className="font-medium text-foreground">{curr.code}</div>
              <div className="text-xs text-muted-foreground">{curr.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Crypto Currency */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider">Crypto Currency</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Secondary currency for crypto price display
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CRYPTO_CURRENCIES.map((curr) => (
            <button
              key={curr.code}
              onClick={() => setCryptoCurrency(curr.code)}
              className={`p-4 rounded-xl border-2 text-left transition ${
                cryptoCurrency === curr.code
                  ? 'border-brand-accent bg-brand-accent/20 ring-2 ring-brand-accent/40 shadow-lg shadow-brand-accent/20'
                  : 'border-border hover:border-border bg-surface-1 shadow-sm'
              }`}
            >
              <div className="text-2xl mb-2">{curr.symbol}</div>
              <div className="font-medium text-foreground">{curr.code}</div>
              <div className="text-xs text-muted-foreground">{curr.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Preview */}
      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-foreground/70 uppercase tracking-wider mb-3">Preview</h3>
        <div className="rounded-xl bg-surface-1/70 border border-border p-4 dark:bg-foreground/[0.05]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Example price:</span>
            <div className="text-right">
              <div className="font-bold text-foreground">
                {FIAT_CURRENCIES.find(c => c.code === currency)?.symbol}99.99
              </div>
              <div className="text-sm text-muted-foreground">
                ≈ {CRYPTO_CURRENCIES.find(c => c.code === cryptoCurrency)?.symbol}0.025
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ADDRESS BOOK SETTINGS
// =============================================================================

function AddressesSettings() {
  const {
    addresses,
    isLoading,
    isCreating,
    isDeleting,
    error,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddresses();

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const emptyForm = {
    label: 'HOME' as AddressLabel,
    customLabel: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    municipality: '',
    county: '',
    country: 'NO',
    isDefault: false,
  };
  const [form, setForm] = useState(emptyForm);

  const startEdit = (addr: Address) => {
    setEditId(addr.id);
    setForm({
      label: addr.label,
      customLabel: addr.customLabel || '',
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      postalCode: addr.postalCode,
      city: addr.city,
      municipality: addr.municipality || '',
      county: addr.county || '',
      country: addr.country,
      isDefault: addr.isDefault,
    });
    setShowAdd(false);
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(emptyForm);
  };

  const startAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.addressLine1 || !form.postalCode || !form.city) return;
    const data = {
      label: form.label,
      customLabel: form.label === 'OTHER' ? form.customLabel : undefined,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2 || undefined,
      postalCode: form.postalCode,
      city: form.city,
      municipality: form.municipality || undefined,
      county: form.county || undefined,
      country: form.country,
      isDefault: form.isDefault,
    };

    if (editId) {
      const res = await updateAddress(editId, data);
      if (res) { cancelEdit(); toast.success('Address updated'); }
    } else {
      const res = await createAddress(data);
      if (res) { setShowAdd(false); setForm(emptyForm); toast.success('Address saved'); }
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteAddress(id);
    if (ok) { setDeleteConfirmId(null); toast.success('Address deleted'); }
  };

  const labelIcon = (l: AddressLabel) => {
    const map: Record<AddressLabel, string> = { HOME: '🏠', WORK: '🏢', WAREHOUSE: '📦', PICKUP_POINT: '📍', OTHER: '📌' };
    return map[l] || '📌';
  };
  const labelText = (l: AddressLabel, c?: string | null) => {
    const map: Record<AddressLabel, string> = { HOME: 'Home', WORK: 'Work', WAREHOUSE: 'Warehouse', PICKUP_POINT: 'Pickup', OTHER: c || 'Other' };
    return map[l] || c || 'Address';
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-foreground/[0.06]" />
        ))}
      </div>
    );
  }

  const renderAddressForm = () => (
    <div className="space-y-4 p-4 border border-border rounded-lg bg-surface-1/50">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <Label className="text-sm text-muted-foreground mb-1 block">Type</Label>
          <Select value={form.label} onValueChange={(v) => setForm({ ...form, label: v as AddressLabel })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HOME">🏠 Home</SelectItem>
              <SelectItem value="WORK">🏢 Work</SelectItem>
              <SelectItem value="WAREHOUSE">📦 Warehouse</SelectItem>
              <SelectItem value="PICKUP_POINT">📍 Pickup Point</SelectItem>
              <SelectItem value="OTHER">📌 Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.label === 'OTHER' && (
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-sm text-muted-foreground mb-1 block">Custom label</Label>
            <Input value={form.customLabel} onChange={(e) => setForm({ ...form, customLabel: e.target.value })} placeholder="e.g., Mom's house" />
          </div>
        )}
        <div className="col-span-2">
          <Label className="text-sm text-muted-foreground mb-1 block">Street address *</Label>
          <Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} placeholder="Karl Johans gate 1" />
        </div>
        <div className="col-span-2">
          <Label className="text-sm text-muted-foreground mb-1 block">Apartment / floor</Label>
          <Input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} placeholder="H0301" />
        </div>
        <div>
          <Label className="text-sm text-muted-foreground mb-1 block">Postal code *</Label>
          <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="0154" maxLength={4} />
        </div>
        <div>
          <Label className="text-sm text-muted-foreground mb-1 block">City *</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Oslo" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} id="addr-default" />
        <Label htmlFor="addr-default" className="text-sm cursor-pointer">Default shipping address</Label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={isCreating || !form.addressLine1 || !form.postalCode || !form.city} size="sm">
          <FiSave className="h-4 w-4 mr-1.5" />
          {editId ? 'Update' : 'Save'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); cancelEdit(); }}>
          <FiX className="h-4 w-4 mr-1.5" />
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Addresses</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage saved addresses for faster checkout. Max 10 addresses.
          </p>
        </div>
        {!showAdd && !editId && (
          <Button onClick={startAdd} size="sm" disabled={addresses.length >= 10}>
            <FiEdit2 className="h-4 w-4 mr-1.5" />
            Add address
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {showAdd && renderAddressForm()}

      {addresses.length === 0 && !showAdd && (
        <div className="text-center py-8 text-muted-foreground">
          <FiMapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No saved addresses yet.</p>
          <p className="text-xs mt-1">Add an address for faster checkout.</p>
        </div>
      )}

      {addresses.map((addr) => (
        <div
          key={addr.id}
          className="flex items-start justify-between p-4 border border-border rounded-lg bg-surface-1/50"
        >
          {editId === addr.id ? (
            <div className="w-full">
              {renderAddressForm()}
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{labelIcon(addr.label)}</span>
                  <span className="font-medium text-foreground">
                    {labelText(addr.label, addr.customLabel)}
                  </span>
                  {addr.isDefault && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {addr.addressLine1}
                  {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {addr.postalCode} {addr.city}, {addr.country}
                </p>
              </div>

              <div className="flex items-center gap-1 ml-3 shrink-0">
                {!addr.isDefault && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDefaultAddress(addr.id)} title="Set as default">
                    ⭐
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(addr)} title="Edit">
                  <FiEdit2 className="h-4 w-4" />
                </Button>

                {deleteConfirmId === addr.id ? (
                  <div className="flex items-center gap-1">
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(addr.id)} disabled={isDeleting}>
                      <FiCheck className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirmId(null)}>
                      <FiX className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(addr.id)} title="Delete">
                    🗑️
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
