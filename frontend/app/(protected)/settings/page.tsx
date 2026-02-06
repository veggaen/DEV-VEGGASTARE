'use client';

import * as z from 'zod';
import { Form, FormField, FormControl, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { toast } from 'sonner';

import { useRef, useState, useTransition, useEffect, useCallback, DragEvent, ClipboardEvent } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MyAuthSettingsSchema } from '@/schemas';
import { settings } from "@/actions/settings";
import { useCurrentUser } from '@/hooks/use-current-user';
import { MyFormError } from '@/components/uicustom/forms/form-error';
import { MyFormSuccess } from '@/components/uicustom/forms/form-sucess';
import { UserRole } from '@prisma/client';
import { useUiPreferences } from '@/components/providers/ui-preferences';
import { useEdgeStore } from '@/lib/edgestore';
import { FancyBackground } from '@/components/uicustom/fancy-background';
import { NotificationSettings as NotificationSettingsComponent } from '@/components/uicustom/notifications/notification-settings';
import type { NotificationSettings as NotificationSettingsType, NotificationMute } from '@/components/uicustom/notifications/types';
import { CurrencySelector, useCurrency, FIAT_CURRENCIES, CRYPTO_CURRENCIES } from '@/components/uicustom/currency-selector';
import { 
  FiUser, FiLock, FiMail, FiBell, FiShield, FiSave, 
  FiEdit2, FiX, FiCheck, FiImage, FiChevronRight, FiCamera, FiUpload,
  FiArrowRight, FiInfo, FiTrendingUp, FiEye, FiUsers, FiActivity, FiSliders, FiDollarSign
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

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function SettingsPage() {
  const reduceMotion = useReducedMotion();
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const { prefs, setPrefs, resetPrefs } = useUiPreferences();
  const formRef = useRef<HTMLFormElement>(null);
  const { update } = useSession();
  const { edgestore } = useEdgeStore();

  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [activeSection, setActiveSection] = useState<'profile' | 'account' | 'security' | 'notifications' | 'privacy' | 'appearance' | 'currency'>('profile');
  
  // Read section from URL params (e.g. /settings?section=notifications)
  useEffect(() => {
    const sectionParam = searchParams.get('section');
    if (sectionParam && ['profile', 'account', 'security', 'notifications', 'privacy', 'appearance', 'currency'].includes(sectionParam)) {
      setActiveSection(sectionParam as typeof activeSection);
    }
  }, [searchParams]);
  
  // Profile editing state - ORIGINAL values from server
  const [originalData, setOriginalData] = useState<{
    image: string | null;
    banner: string | null;
    bio: string | null;
    name: string | null;
    reach: { totalViews: number; uniqueViewers: number; engagementRate: number; postCount: number; followerCount: number } | null;
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
  const validateImageFile = (file: File): boolean => {
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
  };

  // Upload image and return URL (doesn't save to profile yet)
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const res = await edgestore.myPublicImages.upload({ file });
      return res.url;
    } catch (err) {
      console.error('Error uploading image:', err);
      toast.error('Failed to upload image');
      return null;
    }
  };

  // Handle banner file selection (from input, paste, or drop)
  const handleBannerFile = useCallback(async (file: File) => {
    if (!validateImageFile(file)) return;
    
    setIsUploadingBanner(true);
    const url = await uploadImage(file);
    if (url) {
      setPendingChanges(prev => ({ ...prev, banner: url }));
      toast.success('Banner preview ready! Click Save to apply.');
    }
    setIsUploadingBanner(false);
  }, []);

  // Handle avatar file selection (from input, paste, or drop)
  const handleAvatarFile = useCallback(async (file: File) => {
    if (!validateImageFile(file)) return;
    
    setIsUploadingAvatar(true);
    const url = await uploadImage(file);
    if (url) {
      setPendingChanges(prev => ({ ...prev, image: url }));
      toast.success('Avatar preview ready! Click Save to apply.');
    }
    setIsUploadingAvatar(false);
  }, []);

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
    }
  });

  const newPassword = useWatch({
    control: form.control,
    name: "newPassword",
  });

  const onSubmit = (values: z.infer<typeof MyAuthSettingsSchema>) => {
    startTransition(() => {
      settings(values).then((data) => {
        if ('error' in data) {
          setError(data.error);
        }
        if ('success' in data) {
          update();
          setSuccess(data.success);
          setIsEditing(false);
        }
      });
    });
  };

  const handleStartEdit = () => {
    setIsEditing(!isEditing);
    setError('');
    setSuccess('');
  };

  const handleCancelEdit = () => {
    form.reset();
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
        <div className="animate-pulse text-muted-foreground dark:text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-x-hidden">
      {/* Conditional fancy background */}
      <FancyBackground
        gradient
        gradientVariant="default"
        spheres={[{ position: "top-right", color: "blue", size: "lg" }]}
      />

      <div className="relative mx-auto w-full max-w-5xl px-6 py-10 lg:py-12">
        <motion.div
          initial={reduceMotion || prefs.pageAnimations === "none" ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion || prefs.pageAnimations === "none" ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-semibold text-foreground dark:text-white sm:text-4xl mb-2">Settings</h1>
            <p className="text-muted-foreground dark:text-white/60 text-sm">Manage your account settings and preferences</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            {/* Sidebar Navigation */}
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border-2 ${
                    activeSection === section.id
                      ? 'bg-emerald-50 border-emerald-500 text-foreground shadow-md shadow-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-500 dark:text-white'
                      : 'bg-white border-transparent text-muted-foreground hover:bg-zinc-50 hover:border-zinc-200 hover:text-foreground dark:bg-transparent dark:text-white/60 dark:hover:bg-white/5 dark:hover:border-white/10 dark:hover:text-white/80'
                  }`}
                >
                  <section.icon className={`h-5 w-5 ${activeSection === section.id ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{section.label}</div>
                    <div className="text-xs text-muted-foreground/70 dark:text-white/40">{section.description}</div>
                  </div>
                  <FiChevronRight className={`h-4 w-4 transition-transform ${activeSection === section.id ? 'rotate-90 text-emerald-600 dark:text-emerald-400' : ''}`} />
                </button>
              ))}
            </nav>

            {/* Main Content */}
            <div className="rounded-2xl border-2 border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-white/[0.02] p-6">
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border dark:border-white/10 pb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground dark:text-white">Profile</h2>
                      <p className="text-sm text-muted-foreground dark:text-white/50">Customize your avatar, banner, and bio</p>
                    </div>
                    {/* Save/Discard buttons - only show when there are changes */}
                    {hasUnsavedChanges && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDiscardChanges}
                          className="border-border text-foreground/80 hover:bg-zinc-100 dark:border-white/20 dark:text-white/80 dark:hover:bg-white/10"
                        >
                          <FiX className="h-4 w-4 mr-1" />
                          Discard
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
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
                      <FiInfo className="h-4 w-4 flex-shrink-0" />
                      <span>You have unsaved changes. Click &quot;Save Changes&quot; to apply them.</span>
                    </div>
                  )}

                  {/* Banner Upload - with drag & drop and paste */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground/80 dark:text-white/80">Banner Image</label>
                    
                    {/* Show comparison if there's a pending change */}
                    {'banner' in pendingChanges && originalData.banner !== pendingChanges.banner && (
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-white/70 border border-border dark:bg-white/5 dark:border-white/10">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground dark:text-white/40 mb-1">Current</div>
                          <div className="relative h-16 w-full rounded-lg overflow-hidden bg-zinc-200/60 dark:bg-white/5">
                            {originalData.banner ? (
                              <Image src={originalData.banner} alt="Current banner" fill className="object-cover opacity-60" />
                            ) : (
                              <div className="flex items-center justify-center h-full text-muted-foreground/70 dark:text-white/20 text-xs">No banner</div>
                            )}
                          </div>
                        </div>
                        <FiArrowRight className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-emerald-400 mb-1">New</div>
                          <div className="relative h-16 w-full rounded-lg overflow-hidden bg-emerald-500/10 border border-emerald-500/30">
                            {pendingChanges.banner ? (
                              <Image src={pendingChanges.banner} alt="New banner" fill className="object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full text-muted-foreground/70 dark:text-white/20 text-xs">No banner</div>
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
                      className={`relative h-32 w-full rounded-xl overflow-hidden border-2 border-dashed transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                        isDraggingBanner 
                          ? 'border-emerald-400 bg-emerald-500/10' 
                          : prefs.hoverEffects === 'colorful'
                            ? 'border-zinc-300/70 bg-zinc-50/80 hover:border-zinc-400 dark:border-white/20 dark:bg-gradient-to-br dark:from-indigo-500/20 dark:to-purple-600/20 dark:hover:border-white/40'
                            : 'border-zinc-300/70 bg-zinc-50/80 hover:border-zinc-400 dark:border-white/20 dark:bg-white/5 dark:hover:border-white/40'
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
                          <FiImage className="h-8 w-8 text-muted-foreground/60 dark:text-white/30" />
                          <span className="text-xs text-muted-foreground dark:text-white/40">Click, paste (Ctrl+V), or drag & drop</span>
                        </div>
                      )}
                      {isDraggingBanner && (
                        <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                          <div className="text-emerald-400 font-medium">Drop image here</div>
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
                            className="border-border text-foreground hover:bg-zinc-100 dark:border-white/30 dark:text-white dark:hover:bg-white/20"
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
                    <p className="text-xs text-muted-foreground dark:text-white/40">Recommended: 1500x500px, JPG/PNG/GIF/WebP, max 5MB. Paste from clipboard or drag & drop!</p>
                  </div>

                  {/* Avatar Upload - with drag & drop and paste */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground/80 dark:text-white/80">Profile Picture</label>
                    
                    {/* Show comparison if there's a pending change */}
                    {'image' in pendingChanges && originalData.image !== pendingChanges.image && (
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-white/70 border border-border dark:bg-white/5 dark:border-white/10">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground dark:text-white/40 mb-1">Current</div>
                          <div className="relative h-16 w-16 rounded-full overflow-hidden bg-zinc-200/60 dark:bg-white/5 mx-auto">
                            {originalData.image ? (
                              <Image src={originalData.image} alt="Current avatar" fill className="object-cover opacity-60" />
                            ) : (
                              <div className="flex items-center justify-center h-full"><FiUser className="h-6 w-6 text-muted-foreground/60 dark:text-white/20" /></div>
                            )}
                          </div>
                        </div>
                        <FiArrowRight className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                        <div className="text-center">
                          <div className="text-xs text-emerald-400 mb-1">New</div>
                          <div className="relative h-16 w-16 rounded-full overflow-hidden bg-emerald-500/10 border-2 border-emerald-500/30 mx-auto">
                            {pendingChanges.image ? (
                              <Image src={pendingChanges.image} alt="New avatar" fill className="object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full"><FiUser className="h-6 w-6 text-muted-foreground/60 dark:text-white/20" /></div>
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
                        className={`relative h-24 w-24 rounded-full overflow-hidden border-2 border-dashed transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                          isDraggingAvatar 
                            ? 'border-emerald-400 bg-emerald-500/10' 
                            : prefs.hoverEffects === 'colorful'
                              ? 'border-zinc-300/70 bg-zinc-50/80 hover:border-zinc-400 dark:border-white/20 dark:bg-gradient-to-br dark:from-indigo-500/30 dark:to-purple-600/30 dark:hover:border-white/40'
                              : 'border-zinc-300/70 bg-zinc-50/80 hover:border-zinc-400 dark:border-white/20 dark:bg-white/5 dark:hover:border-white/40'
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
                            <FiUser className="h-10 w-10 text-muted-foreground/60 dark:text-white/40" />
                          </div>
                        )}
                        {isDraggingAvatar && (
                          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                            <FiUpload className="h-6 w-6 text-emerald-400" />
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
                          className="border-border text-foreground/80 hover:bg-zinc-100 dark:border-white/20 dark:text-white/80 dark:hover:bg-white/10"
                        >
                          {isUploadingAvatar ? 'Uploading...' : 'Choose Image'}
                        </Button>
                        <p className="text-xs text-muted-foreground dark:text-white/40 mt-2">Click, paste (Ctrl+V), or drag & drop</p>
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
                    <label className="text-sm font-medium text-foreground/80 dark:text-white/80">Bio</label>
                    
                    {/* Show comparison if bio changed */}
                    {'bio' in pendingChanges && originalData.bio !== pendingChanges.bio && (
                      <div className="p-3 rounded-lg bg-white/70 border border-border dark:bg-white/5 dark:border-white/10 space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground dark:text-white/40 mb-1">Current</div>
                          <div className="text-sm text-muted-foreground dark:text-white/60 line-through">{originalData.bio || '(no bio)'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-emerald-400 mb-1">New</div>
                          <div className="text-sm text-foreground dark:text-white">{pendingChanges.bio || '(no bio)'}</div>
                        </div>
                      </div>
                    )}
                    
                    <Textarea
                      value={'bio' in pendingChanges ? (pendingChanges.bio || '') : (originalData.bio || '')}
                      onChange={(e) => setPendingChanges(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Tell others about yourself..."
                      className="bg-white/70 border-border text-foreground placeholder:text-muted-foreground focus:border-emerald-500/50 min-h-[100px] resize-none dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30"
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground dark:text-white/40">
                        {('bio' in pendingChanges ? pendingChanges.bio?.length : originalData.bio?.length) || 0}/500 characters
                      </p>
                    </div>
                  </div>

                  {/* Reach Stats Radar Chart with Calculation Breakdown */}
                  <div className="pt-4 border-t border-border dark:border-white/10 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground dark:text-white flex items-center gap-2">
                        <FiTrendingUp className="h-5 w-5 text-emerald-400" />
                        Your Reach Analytics
                      </h3>
                      <p className="text-sm text-muted-foreground dark:text-white/50">Real engagement metrics - not vanity follower counts</p>
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-white/70 border border-border p-4 dark:bg-white/5 dark:border-white/10">
                        <div className="max-w-[240px] mx-auto">
                          <Radar data={reachChartData} options={reachChartOptions} />
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Total Views */}
                        <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FiEye className="h-4 w-4 text-emerald-400" />
                              <span className="text-sm text-muted-foreground dark:text-white/70">Total Views</span>
                            </div>
                            <div className="text-lg font-bold text-emerald-400">
                              {(reach?.totalViews || 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground dark:text-white/40 mt-1">
                            Chart: {Math.min((reach?.totalViews || 0) / 10, 100).toFixed(0)}% (1000 views = 100%)
                          </div>
                        </div>
                        
                        {/* Unique Viewers */}
                        <div className="rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-600/5 border border-blue-500/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FiUsers className="h-4 w-4 text-blue-400" />
                              <span className="text-sm text-muted-foreground dark:text-white/70">Unique Viewers</span>
                            </div>
                            <div className="text-lg font-bold text-blue-400">
                              {(reach?.uniqueViewers || 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground dark:text-white/40 mt-1">
                            Chart: {Math.min((reach?.uniqueViewers || 0) / 5, 100).toFixed(0)}% (500 unique = 100%)
                          </div>
                        </div>
                        
                        {/* Engagement Rate */}
                        <div className="rounded-xl bg-gradient-to-r from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FiActivity className="h-4 w-4 text-purple-400" />
                              <span className="text-sm text-muted-foreground dark:text-white/70">Engagement Rate</span>
                            </div>
                            <div className="text-lg font-bold text-purple-400">
                              {(reach?.engagementRate || 0).toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground dark:text-white/40 mt-1">
                            Formula: (views ÷ followers) × 100 = ({reach?.totalViews || 0} ÷ {reach?.followerCount || 1}) × 100
                          </div>
                        </div>
                        
                        {/* Post Count */}
                        <div className="rounded-xl bg-white/70 border border-border p-3 dark:bg-white/5 dark:border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground dark:text-white/70">Posts</span>
                            <span className="font-bold text-foreground dark:text-white">{reach?.postCount || 0}</span>
                          </div>
                          <div className="text-xs text-muted-foreground dark:text-white/40 mt-1">
                            Chart: {Math.min((reach?.postCount || 0) * 10, 100)}% (10 posts = 100%)
                          </div>
                        </div>
                        
                        {/* Followers */}
                        <div className="rounded-xl bg-white/70 border border-border p-3 dark:bg-white/5 dark:border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground dark:text-white/70">Followers</span>
                            <span className="font-bold text-foreground dark:text-white">{reach?.followerCount || 0}</span>
                          </div>
                          <div className="text-xs text-muted-foreground dark:text-white/40 mt-1">
                            Chart: {Math.min(reach?.followerCount || 0, 100)}% (100 followers = 100%)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile Link */}
                  <div className="pt-4 border-t border-border dark:border-white/10">
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
                  <div className="flex items-center justify-between border-b border-border dark:border-white/10 pb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground dark:text-white">Account Settings</h2>
                      <p className="text-sm text-muted-foreground dark:text-white/50">Update your personal information</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEdit}
                      className="border-border text-foreground/80 hover:bg-zinc-100 dark:border-white/20 dark:text-white/80 dark:hover:bg-white/10"
                    >
                      {isEditing ? <FiX className="h-4 w-4 mr-2" /> : <FiEdit2 className="h-4 w-4 mr-2" />}
                      {isEditing ? 'Cancel' : 'Edit'}
                    </Button>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} ref={formRef} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground/80 dark:text-white/80">Display Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                disabled={isPending || !isEditing}
                                placeholder={user?.name || 'Enter your name'}
                                className="bg-white/70 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 disabled:opacity-50 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30"
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
                            <FormLabel className="text-foreground/80 dark:text-white/80">Email Address</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                disabled={isPending || !isEditing || user?.isOAuth}
                                placeholder={user?.email || 'Enter your email'}
                                className="bg-white/70 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 disabled:opacity-50 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30"
                              />
                            </FormControl>
                            <FormDescription className="text-muted-foreground dark:text-white/40">
                              {user?.isOAuth 
                                ? 'Email is managed by your sign-in provider (Google, etc.)'
                                : 'This is the email used for notifications and login'
                              }
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Profile Link */}
                      <div className="pt-4 border-t border-border dark:border-white/10">
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
                        <div className="flex items-center gap-3 pt-4">
                          <Button
                            type="submit"
                            disabled={isPending}
                            className="bg-blue-600 hover:bg-blue-500 text-white"
                          >
                            {isPending ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="border-border text-foreground/80 hover:bg-zinc-100 dark:border-white/20 dark:text-white/80 dark:hover:bg-white/10"
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
                  <div className="border-b border-border dark:border-white/10 pb-4">
                    <h2 className="text-xl font-semibold text-foreground dark:text-white">Security</h2>
                    <p className="text-sm text-muted-foreground dark:text-white/50">Manage your password and authentication</p>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground/80 dark:text-white/80">Current Password</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                disabled={isPending}
                                placeholder="Enter current password"
                                className="bg-white/70 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30"
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
                            <FormLabel className="text-foreground/80 dark:text-white/80">New Password</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                disabled={isPending}
                                placeholder="Enter new password"
                                className="bg-white/70 border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-white/30"
                              />
                            </FormControl>
                            <FormDescription className="text-muted-foreground dark:text-white/40">
                              Must be at least 8 characters
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="pt-4 border-t border-border dark:border-white/10">
                        <FormField
                          control={form.control}
                          name="isTwoFactorEnabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-xl bg-white/70 border border-border p-4 dark:bg-white/5 dark:border-white/10">
                              <div className="space-y-0.5">
                                <FormLabel className="text-foreground/80 dark:text-white/80">Two-Factor Authentication</FormLabel>
                                <FormDescription className="text-muted-foreground dark:text-white/40">
                                  Add an extra layer of security to your account
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={isPending}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={isPending}
                        className="bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        {isPending ? 'Updating...' : 'Update Security Settings'}
                      </Button>

                      <MyFormError message={error} />
                      <MyFormSuccess message={success} />
                    </form>
                  </Form>
                </div>
              )}

              {activeSection === 'notifications' && (
                <NotificationSettingsSection />
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
        </motion.div>
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
        <div className="border-b border-border dark:border-white/10 pb-4">
          <h2 className="text-xl font-semibold text-foreground dark:text-white">Privacy</h2>
          <p className="text-sm text-muted-foreground dark:text-white/50">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border dark:border-white/10 pb-4">
        <h2 className="text-xl font-semibold text-foreground dark:text-white">Privacy</h2>
        <p className="text-sm text-muted-foreground dark:text-white/50">Control who can see your information and activity</p>
      </div>

      {/* Heartbeat Privacy Settings */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">Heartbeat Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-white/70 border border-border p-4 dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Show Heartbeats Given</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Let others see what content you&apos;ve heartbeated</div>
            </div>
            <Switch 
              checked={settings.showPulsesGiven} 
              onCheckedChange={() => handleToggle('showPulsesGiven')}
              disabled={isSaving}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-white/70 border border-border p-4 dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Show Heartbeats Received</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Display heartbeat counts on your content</div>
            </div>
            <Switch 
              checked={settings.showPulsesReceived} 
              onCheckedChange={() => handleToggle('showPulsesReceived')}
              disabled={isSaving}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-white/70 border border-border p-4 dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Show Negative Heartbeats</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Display negative heartbeat counts publicly (hidden by default)</div>
            </div>
            <Switch 
              checked={settings.showNegativePulses} 
              onCheckedChange={() => handleToggle('showNegativePulses')}
              disabled={isSaving}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-white/70 border border-border p-4 dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Show Repulses</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Let others see your repulse activity</div>
            </div>
            <Switch 
              checked={settings.showRepulses} 
              onCheckedChange={() => handleToggle('showRepulses')}
              disabled={isSaving}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-white/70 border border-border p-4 dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Allow Negative Heartbeats</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Let others give negative heartbeats to your content</div>
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
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">General</h3>
        <div className="space-y-3">
          {[
            { id: 'profile', label: 'Public Profile', description: 'Allow others to view your profile' },
            { id: 'activity', label: 'Show Activity Status', description: "Let others see when you're online" },
            { id: 'analytics', label: 'Usage Analytics', description: 'Help us improve by sharing anonymous usage data' },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl bg-white/70 border border-border p-4 dark:bg-white/5 dark:border-white/10">
              <div>
                <div className="font-medium text-foreground dark:text-white/90">{item.label}</div>
                <div className="text-sm text-muted-foreground dark:text-white/40">{item.description}</div>
              </div>
              <Switch defaultChecked={item.id === 'profile'} />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-border dark:border-white/10">
        <Button variant="destructive" className="bg-red-600 hover:bg-red-500">
          Delete Account
        </Button>
        <p className="text-xs text-muted-foreground dark:text-white/40 mt-2">
          This action is irreversible. All your data will be permanently deleted.
        </p>
      </div>
    </div>
  );
}

// Appearance Settings Component
function AppearanceSettings() {
  const { prefs, setPrefs, resetPrefs } = useUiPreferences();
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="space-y-6">
      <div className="border-b border-border dark:border-white/10 pb-4">
        <h2 className="text-xl font-semibold text-foreground dark:text-white">Appearance</h2>
        <p className="text-sm text-muted-foreground dark:text-white/50">Customize the look and feel of your experience</p>
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'light', label: 'Light', description: 'Bright & clean', icon: '☀️' },
            { id: 'dark', label: 'Dark', description: 'Easy on eyes', icon: '🌙' },
            { id: 'system', label: 'System', description: 'Match device', icon: '💻' },
          ].map((themeOption) => (
            <button
              key={themeOption.id}
              onClick={() => setTheme(themeOption.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                theme === themeOption.id
                  ? 'border-emerald-500 bg-emerald-500/20 dark:bg-emerald-500/10 ring-2 ring-emerald-500/40 dark:ring-emerald-500/30 shadow-lg shadow-emerald-500/20'
                  : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-white dark:bg-white/5 shadow-sm'
              }`}
            >
              <div className="text-2xl mb-2">{themeOption.icon}</div>
              <div className="font-medium text-foreground dark:text-white/90">{themeOption.label}</div>
              <div className="text-xs text-muted-foreground dark:text-white/40">{themeOption.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Style Preset */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">Style Preset</h3>
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
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                prefs.stylePreset === preset.id
                  ? 'border-emerald-500 bg-emerald-500/20 dark:bg-emerald-500/10 ring-2 ring-emerald-500/40 dark:ring-emerald-500/30 shadow-lg shadow-emerald-500/20'
                  : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-white dark:bg-white/5 shadow-sm'
              }`}
            >
              <div className="text-2xl mb-2">{preset.icon}</div>
              <div className="font-medium text-foreground dark:text-white/90">{preset.label}</div>
              <div className="text-xs text-muted-foreground dark:text-white/40">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Visual Effects */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">Visual Effects</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-white border border-zinc-200 p-4 shadow-sm dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Gradient Backgrounds</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Colorful gradient backgrounds on pages and cards</div>
            </div>
            <Switch 
              checked={prefs.enableGradientBackgrounds} 
              onCheckedChange={(checked) => setPrefs({ enableGradientBackgrounds: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-white border border-zinc-200 p-4 shadow-sm dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Floating Spheres</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Animated gradient orbs in the background</div>
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
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">Animations</h3>
        <div className="space-y-3">
          <div className="rounded-xl bg-white border border-zinc-200 p-4 shadow-sm dark:bg-white/5 dark:border-white/10">
            <div className="font-medium text-foreground dark:text-white/90 mb-3">Page Transitions</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'none', label: 'None' },
                { id: 'subtle', label: 'Subtle' },
                { id: 'full', label: 'Full' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setPrefs({ pageAnimations: option.id as 'none' | 'subtle' | 'full' })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    prefs.pageAnimations === option.id
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                      : 'bg-zinc-100 text-foreground hover:bg-zinc-200 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-between rounded-xl bg-white border border-zinc-200 p-4 shadow-sm dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Colorful Hover Effects</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Fancy color transitions on hover (instead of simple highlights)</div>
            </div>
            <Switch 
              checked={prefs.hoverEffects === 'colorful'} 
              onCheckedChange={(checked) => setPrefs({ hoverEffects: checked ? 'colorful' : 'simple' })}
            />
          </div>
        </div>
      </div>

      {/* Advanced */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">Advanced</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-white border border-zinc-200 p-4 shadow-sm dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Web3 Mode</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Enable advanced wallet controls and crypto features</div>
            </div>
            <Web3ModeToggle />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white border border-zinc-200 p-4 shadow-sm dark:bg-white/5 dark:border-white/10">
            <div>
              <div className="font-medium text-foreground dark:text-white/90">Experimental Effects</div>
              <div className="text-sm text-muted-foreground dark:text-white/40">Enable bleeding-edge visual features (may be unstable)</div>
            </div>
            <Switch 
              checked={prefs.enableExperimentalEffects} 
              onCheckedChange={(checked) => setPrefs({ enableExperimentalEffects: checked })}
            />
          </div>
        </div>
      </div>

      {/* Reset */}
      <div className="pt-4 border-t border-border dark:border-white/10 flex gap-3">
        <Button 
          variant="outline" 
          onClick={resetPrefs}
          className="border-zinc-300 dark:border-white/20"
        >
          Reset to Defaults
        </Button>
        <p className="text-xs text-muted-foreground dark:text-white/40 self-center">
          Resets all appearance settings to minimal/clean defaults
        </p>
      </div>
    </div>
  );
}

// Web3 Mode Toggle Component
function Web3ModeToggle() {
  const user = useCurrentUser();
  const [web3ModeEnabled, setWeb3ModeEnabled] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("veggastare:web3ModeEnabled");
      if (raw === "true") setWeb3ModeEnabled(true);
    } catch {
      // ignore
    }
  }, []);

  // Sync with user's server-side setting if logged in
  useEffect(() => {
    if (user && (user as any).web3ModeEnabled !== undefined) {
      setWeb3ModeEnabled(!!(user as any).web3ModeEnabled);
    }
  }, [user]);

  const handleToggle = async (checked: boolean) => {
    if (user) {
      // Logged in: update server
      setIsRequesting(true);
      try {
        const { MyRequestWeb3ModeSecurityAction } = await import("@/actions/security-action");
        const data = await MyRequestWeb3ModeSecurityAction(checked);
        if (data?.error) {
          toast.error(data.error, { position: "top-center" });
          return;
        }
        if (data?.success) {
          toast.success(data.success, { position: "top-center" });
          setWeb3ModeEnabled(checked);
        }
      } catch {
        toast.error("Something went wrong!", { position: "top-center" });
      } finally {
        setIsRequesting(false);
      }
    } else {
      // Logged out: store locally
      setWeb3ModeEnabled(checked);
      try {
        window.localStorage.setItem("veggastare:web3ModeEnabled", String(checked));
      } catch {
        // ignore
      }
    }
  };

  return (
    <Switch
      checked={web3ModeEnabled}
      disabled={isRequesting}
      onCheckedChange={handleToggle}
      aria-label="Toggle Web3 mode"
    />
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
      <div className="border-b border-border dark:border-white/10 pb-4">
        <h2 className="text-xl font-semibold text-foreground dark:text-white">Notifications</h2>
        <p className="text-sm text-muted-foreground dark:text-white/50">
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
      <div className="border-b border-border dark:border-white/10 pb-4">
        <h2 className="text-xl font-semibold text-foreground dark:text-white">Currency</h2>
        <p className="text-sm text-muted-foreground dark:text-white/50">Choose how prices are displayed across the platform</p>
      </div>

      {/* Fiat Currency */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">Display Currency</h3>
        <p className="text-sm text-muted-foreground dark:text-white/40 mb-3">
          Primary currency for displaying prices
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FIAT_CURRENCIES.map((curr) => (
            <button
              key={curr.code}
              onClick={() => setCurrency(curr.code)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                currency === curr.code
                  ? 'border-emerald-500 bg-emerald-500/20 dark:bg-emerald-500/10 ring-2 ring-emerald-500/40 dark:ring-emerald-500/30 shadow-lg shadow-emerald-500/20'
                  : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-white dark:bg-white/5 shadow-sm'
              }`}
            >
              <div className="text-2xl mb-2">{curr.symbol}</div>
              <div className="font-medium text-foreground dark:text-white/90">{curr.code}</div>
              <div className="text-xs text-muted-foreground dark:text-white/40">{curr.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Crypto Currency */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider">Crypto Currency</h3>
        <p className="text-sm text-muted-foreground dark:text-white/40 mb-3">
          Secondary currency for crypto price display
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CRYPTO_CURRENCIES.map((curr) => (
            <button
              key={curr.code}
              onClick={() => setCryptoCurrency(curr.code)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                cryptoCurrency === curr.code
                  ? 'border-emerald-500 bg-emerald-500/20 dark:bg-emerald-500/10 ring-2 ring-emerald-500/40 dark:ring-emerald-500/30 shadow-lg shadow-emerald-500/20'
                  : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-white dark:bg-white/5 shadow-sm'
              }`}
            >
              <div className="text-2xl mb-2">{curr.symbol}</div>
              <div className="font-medium text-foreground dark:text-white/90">{curr.code}</div>
              <div className="text-xs text-muted-foreground dark:text-white/40">{curr.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Preview */}
      <div className="pt-4 border-t border-border dark:border-white/10">
        <h3 className="text-sm font-medium text-muted-foreground dark:text-white/70 uppercase tracking-wider mb-3">Preview</h3>
        <div className="rounded-xl bg-white/70 border border-border p-4 dark:bg-white/5 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground dark:text-white/60">Example price:</span>
            <div className="text-right">
              <div className="font-bold text-foreground dark:text-white">
                {FIAT_CURRENCIES.find(c => c.code === currency)?.symbol}99.99
              </div>
              <div className="text-sm text-muted-foreground dark:text-white/40">
                ≈ {CRYPTO_CURRENCIES.find(c => c.code === cryptoCurrency)?.symbol}0.025
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}