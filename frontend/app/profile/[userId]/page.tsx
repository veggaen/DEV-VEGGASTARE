'use client';

import React, { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Spinner from '@/components/uicustom/spinner';
import { useCurrentUser } from '@/hooks/use-current-user';
import { isDemoUserId } from '@/lib/demo-policy';
import { profileRequest } from '@/lib/profile-request';
import { saveProfileImage } from '@/lib/profile-image-save';
import { FramerZoom, ImageFramer, type ImageFramerHandle } from '@/components/uicustom/image-framer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { IdentityImageSources, IdentitySource } from '@/lib/identity-display';
import { cn } from '@/lib/utils';
import ProfileLoading from '../loading';
import { useEdgeStore } from '@/lib/edgestore';
import { useBannerColors, generateColorStyles, readableTint } from '@/lib/color-extraction';
import { useProfileThemeFromBanner } from '@/components/providers/profile-theme-provider';
import {
  FiUser, FiSettings, FiMessageCircle, FiCalendar, FiMapPin,
  FiLink, FiEdit2, FiGrid, FiActivity, FiUsers, FiCamera, FiUpload, FiX, FiTrendingUp,
  FiRepeat, FiEye, FiBarChart2, FiZap, FiCheck, FiMove, FiTrash2, FiChevronDown, FiImage
} from 'react-icons/fi';
import { Pin, Shield, ArrowLeftRight } from 'lucide-react';
import { PulseHeart } from '@/components/uicustom/icons/PulseIcons';
import ReachBadgesComponent from '@/components/uicustom/reach/ReachBadges';
import { formatDistanceToNow } from 'date-fns';
import { VEGGA_SYSTEM } from '@/lib/vegga-system-constants';
import { toast } from 'sonner';
import { useAccount, useChainId } from 'wagmi';
import dynamic from 'next/dynamic';
const Radar = dynamic(() => import('@/components/profile/profile-radar'), { ssr: false, loading: () => <div role="status" aria-label="Loading reach chart" className="aspect-square rounded-xl bg-muted motion-safe:animate-pulse" /> });
const ProfileConnections = dynamic(() => import('@/components/profile/profile-connections'), { loading: () => <PostsLoading /> });
const MomentumTimeline = dynamic(() => import('@/components/uicustom/reach/MomentumTimeline'), { ssr: false });
const TrueReachCard = dynamic(() => import('@/components/uicustom/reach/TrueReachCard'), { ssr: false });

interface UserProfile {
  id: string;
  name: string | null;
  email?: string | null; // Optional - only visible for own profile or admin
  username?: string | null; // Display username
  image: string | null;
  banner?: string | null;
  bio?: string | null;
  /** Own profile only: which linked picture is shown, and every picture the account can show. */
  imageSource?: IdentitySource;
  imageSources?: IdentityImageSources;
  location?: string | null;
  website?: string | null;
  createdAt: string;
  isPrivate?: boolean; // Whether user has set profile to private
  _count?: {
    posts?: number;
    followers?: number;
    following?: number;
  };
  // True Reach - 7 Pillar Analytics System
  reach?: {
    // Core metrics
    totalViews: number;
    uniqueViewers: number;
    engagementRate: number;
    // Dual scoring
    reachLifetime?: number;
    reachMomentum?: number;
    // 7 Pillars (normalized 0-100)
    visibility: number;       // 18% - Unique exposures deduped
    engagementDepth: number;  // 25% - Quality interactions (saves/comments/dwell)
    conversionImpact: number; // 18% - Marketplace actions driven
    loyalty: number;          // 14% - Repeat engagers
    growth: number;           // 10% - Organic expansion
    recall: number;           // 5%  - Return rate/stickiness
    velocity: number;         // 10% - Trending speed
    // Computed overall score
    trueReachScore: number;
  };
}

// Pillar metadata for UI rendering
interface ReachPillar {
  key: keyof NonNullable<UserProfile['reach']>;
  label: string;
  shortLabel: string;
  weight: number;
  icon: string;
  color: string;
  description: string;
  tip: string;
  antiGaming: string;
}

const REACH_PILLARS: ReachPillar[] = [
  {
    key: 'visibility',
    label: 'Visibility',
    shortLabel: 'Views',
    weight: 18,
    icon: '👁️',
    color: '#10b981',
    description: 'Unique exposures deduped across sessions',
    tip: 'Shows actual distribution, not potential followers',
    antiGaming: 'Requires ≥500ms on-screen; dedupe per post/user/24h',
  },
  {
    key: 'engagementDepth',
    label: 'Engagement Depth',
    shortLabel: 'Engage',
    weight: 25,
    icon: '💬',
    color: '#3b82f6',
    description: 'Quality interactions beyond likes (saves, comments, dwell)',
    tip: 'Prioritizes meaningful signals that boost algo push',
    antiGaming: 'Weight meaningful actions; flag unnatural bursts',
  },
  {
    key: 'conversionImpact',
    label: 'Conversion Impact',
    shortLabel: 'Convert',
    weight: 18,
    icon: '🛒',
    color: '#f59e0b',
    description: 'Marketplace actions driven (clicks, purchases)',
    tip: 'Ties social reach to business value',
    antiGaming: 'Attribute only via tracked referrals; timeout short sessions',
  },
  {
    key: 'loyalty',
    label: 'Loyalty',
    shortLabel: 'Loyalty',
    weight: 14,
    icon: '❤️',
    color: '#ec4899',
    description: 'Repeat engagers who interact consistently',
    tip: 'Measures true advocates in your audience',
    antiGaming: 'Dedupe bots; require varied interaction types',
  },
  {
    key: 'growth',
    label: 'Growth',
    shortLabel: 'Growth',
    weight: 10,
    icon: '📈',
    color: '#8b5cf6',
    description: 'Organic expansion from posts (new follows/visits)',
    tip: 'Quantifies how posts escape the follower graph',
    antiGaming: 'Attribute via timestamps; exclude self-visits',
  },
  {
    key: 'recall',
    label: 'Recall',
    shortLabel: 'Recall',
    weight: 5,
    icon: '🔄',
    color: '#06b6d4',
    description: 'Predicted return rate and content stickiness',
    tip: 'Forward-looking: Estimates future distribution',
    antiGaming: 'Use server beacons for dwell; dedupe returns',
  },
  {
    key: 'velocity',
    label: 'Velocity',
    shortLabel: 'Speed',
    weight: 10,
    icon: '⚡',
    color: '#f97316',
    description: 'Trending speed — how fast engagement is building',
    tip: 'Breadth-weighted momentum delta over 1h and 24h windows',
    antiGaming: 'Breadth clamp prevents single-source velocity spikes',
  },
];

interface FeedItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  tags: string[];
  createdAt: string;
  messageCount: number;
  viewCount?: number;
  positivePulseCount?: number;
  repostCount?: number;
  uniqueViewCount?: number;
  hasPoll?: boolean;
  pinnedToProfile?: boolean;
  user?: {
    id: string;
    name: string | null;
    image?: string | null;
  };
}

function useProfileFeed(userId: string, viewerId: string | undefined, enabled: boolean, filter: 'created' | 'participated') {
  return useSWRInfinite<{ conversations: FeedItem[]; nextCursor: string | null }>(
    (index, previous) => !viewerId || !enabled || (index > 0 && !previous?.nextCursor) ? null : [`/api/conversations?filter=${filter}&creatorId=${encodeURIComponent(userId)}&sort=recent&limit=20${index ? '&cursor=' + encodeURIComponent(previous!.nextCursor!) : ''}`, viewerId],
    async ([url]: [string, string]) => { const data = await profileRequest(url); if (!Array.isArray(data.conversations)) throw new Error('Could not load posts. Please try again.'); return data; },
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
}
function SectionError({ retry }: { retry: () => void }) {
  return <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>This section could not load. Your profile is still available.</p><Button variant="outline" className="mt-3 h-11" onClick={retry}>Try again</Button></div>;
}
function PostsLoading() {
  return <div role="status" aria-label="Loading profile posts" className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-36 rounded-xl border border-border bg-foreground/[0.04] motion-safe:animate-pulse" />)}</div>;
}

/** Controls that sit on the banner photo: a dark scrim so they read on any image, in both themes. */
const onImageButton = 'inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3.5 text-sm font-medium text-white backdrop-blur-md transition-[background-color,border-color] duration-200 hover:border-white/30 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const accentButton = 'inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-4 text-sm font-semibold text-brand-accent-foreground shadow-e1 transition-[background-color,box-shadow] duration-200 hover:bg-brand-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const avatarRoundButton = 'absolute flex size-11 items-center justify-center rounded-full border-2 border-background bg-card text-foreground shadow-e1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [@media(hover:hover)]:hover:bg-muted';
const menuClass = 'z-90 w-72 rounded-2xl border-border/70 bg-popover/95 p-1.5 shadow-e3 backdrop-blur-xl';
const menuItem = 'min-h-11 gap-3 rounded-lg px-3 text-sm';
const toolbarChip = 'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/60 bg-foreground/[0.04] px-2.5 text-xs font-medium text-foreground transition-[background-color,border-color] duration-200 hover:border-border hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export default function ProfilePage() {
  const reduceMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const params = useParams();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { update: refreshSession, status: sessionStatus } = useSession();
  const { edgestore, state: storageState, reset: resetStorage } = useEdgeStore();
  const { isConnected: walletConnected } = useAccount();
  const chainId = useChainId();
  const userId = params.userId as string;

  const query = useSearchParams();
  type ProfileTab = 'posts' | 'activity' | 'reach' | 'connections';
  const selectedTab = query.get('tab');
  const activeTab: ProfileTab = selectedTab === 'activity' || selectedTab === 'reach' || selectedTab === 'connections' ? selectedTab : 'posts';
  const setActiveTab = (tab: ProfileTab, connection?: 'followers' | 'following') => {
    const params = new URLSearchParams(query);
    if (tab === 'posts') params.delete('tab'); else params.set('tab', tab);
    if (connection) params.set('connections', connection);
    window.history.pushState(null, '', '/profile/' + encodeURIComponent(userId) + (params.size ? '?' + params : ''));
  };
  const profileQuery = useSWR<UserProfile>(currentUser?.id ? ['/api/users/' + encodeURIComponent(userId), currentUser.id] : null, async ([url]: [string, string]) => (await profileRequest(url)).user, { revalidateOnFocus: false, shouldRetryOnError: false });
  const profile = profileQuery.data ?? null;
  const setProfile = (update: (current: UserProfile | null) => UserProfile | null) => { void profileQuery.mutate(current => update(current ?? null) ?? undefined, { revalidate: false }); };
  const loading = sessionStatus === 'loading' || profileQuery.isLoading;
  const error = profileQuery.error;
  const postsQuery = useProfileFeed(userId, currentUser?.id, activeTab === 'posts', 'created');
  const activityQuery = useProfileFeed(userId, currentUser?.id, activeTab === 'activity', 'participated');
  const posts = postsQuery.data?.flatMap(page => page.conversations) ?? [];
  const activityPosts = activityQuery.data?.flatMap(page => page.conversations) ?? [];

  // Extract colors from banner for dynamic theming
  const { colors: bannerColors } = useBannerColors(profile?.banner);
  const themeStyles = generateColorStyles(bannerColors);
  // Banner-derived text tint, lightness-clamped per theme so it reads on the page surface in both.
  const tintText = bannerColors ? readableTint(bannerColors.primary, isDark ? 'dark' : 'light') : undefined;

  // Apply global page-level theme tinting from banner
  useProfileThemeFromBanner(profile?.banner);

  // Upload states
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const bannerSaveLock = useRef(false), avatarSaveLock = useRef(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [bannerProgress, setBannerProgress] = useState(0), [avatarProgress, setAvatarProgress] = useState(0);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // In-place edit mode: the banner/avatar becomes a framing surface where it sits.
  // `file` is what is being framed (the current image, fetched, or a fresh pick);
  // `uploadedUrl` remembers a finished upload so a failed save retries without re-uploading.
  type ImageEdit = { file: File; uploadedUrl?: string };
  const [bannerEdit, setBannerEdit] = useState<ImageEdit | null>(null);
  const [avatarEdit, setAvatarEdit] = useState<ImageEdit | null>(null);
  const [bannerZoom, setBannerZoom] = useState(1);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const bannerFramer = useRef<ImageFramerHandle>(null);
  const avatarFramer = useRef<ImageFramerHandle>(null);
  const [openingEdit, setOpeningEdit] = useState<'banner' | 'avatar' | null>(null);
  const [imageSourceBusy, setImageSourceBusy] = useState(false);
  const [removingBanner, setRemovingBanner] = useState(false);

  // Follow states
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Reach analytics states
  const reachQuery = useSWR<{ momentumTrend: { date: string; momentum: number; views?: number }[]; badges: { id: string; label: string; icon: string; tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'; description: string; earned: boolean; progress: number }[]; trueReach: import('@/components/uicustom/reach/TrueReachCard').TrueReachData | null }>(currentUser?.id && activeTab === 'reach' ? ['/api/users/' + encodeURIComponent(userId) + '/reach', currentUser.id] : null, ([url]: [string, string]) => profileRequest(url), { revalidateOnFocus: false, shouldRetryOnError: false });
  const momentumTrend = reachQuery.data?.momentumTrend ?? [], userBadges = reachQuery.data?.badges ?? [], trueReach = reachQuery.data?.trueReach ?? null;

  const isOwnProfile = currentUser?.id === userId;
  const readOnly = isDemoUserId(currentUser?.id);
  const canEditProfile = isOwnProfile && !readOnly;
  const followQuery = useSWR<{ isFollowing: boolean; followerCount: number; followingCount: number }>(currentUser?.id && !isOwnProfile ? ['/api/users/' + encodeURIComponent(userId) + '/follow', currentUser.id] : null, ([url]: [string, string]) => profileRequest(url), { revalidateOnFocus: false, shouldRetryOnError: false });
  const isFollowing = followQuery.data?.isFollowing ?? false, followerCount = followQuery.data?.followerCount ?? profile?._count?.followers ?? 0, followingCount = followQuery.data?.followingCount ?? profile?._count?.following ?? 0;
  useEffect(() => { setBannerEdit(null); setAvatarEdit(null); setBannerUploadError(null); setAvatarUploadError(null); }, [userId]);

  const validImage = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) { toast.error('Please upload a valid image file (JPG, PNG, GIF, or WebP)'); return false; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return false; }
    return true;
  };
  type ImageTarget = 'banner' | 'avatar';
  const setEditFor = (target: ImageTarget, edit: ImageEdit | null) => (target === 'banner' ? setBannerEdit : setAvatarEdit)(edit);

  type SavedProfile = { image: string | null; banner: string | null; imageSource?: IdentitySource; imageSources?: IdentityImageSources };
  const patchProfile = async (body: Record<string, unknown>): Promise<SavedProfile> => {
    const response = await fetch(`/api/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Profile save failed');
    return (await response.json()).user as SavedProfile;
  };

  // Export the framing (or a GIF as-is), upload it, persist it. Stays in edit
  // mode on failure so Save can be tried again with the same framing.
  const saveImage = async (target: ImageTarget, gif?: File) => {
    const lock = target === 'banner' ? bannerSaveLock : avatarSaveLock;
    const edit = target === 'banner' ? bannerEdit : avatarEdit;
    if (!canEditProfile || lock.current || storageState.loading || (!gif && !edit)) return;
    const framer = target === 'banner' ? bannerFramer : avatarFramer;
    const setBusy = target === 'banner' ? setIsUploadingBanner : setIsUploadingAvatar;
    const setErr = target === 'banner' ? setBannerUploadError : setAvatarUploadError;
    const setProgress = target === 'banner' ? setBannerProgress : setAvatarProgress;
    const label = target === 'banner' ? 'banner' : 'picture';
    lock.current = true;
    setBusy(true);
    setErr(null);
    setProgress(edit?.uploadedUrl ? 100 : 0);
    let uploadedUrl = gif ? undefined : edit?.uploadedUrl;
    const saved: { user?: SavedProfile } = {};
    try {
      let file = gif;
      if (!file) {
        if (!framer.current) throw new Error('Framer not ready');
        const blob = await framer.current.export(target === 'banner' ? 1500 : 512, target === 'banner' ? 500 : 512);
        file = new File([blob], `${target}-framed.webp`, { type: 'image/webp' });
      }
      const upload = file;
      if (!uploadedUrl && !storageState.initialized) await resetStorage();
      const url = await saveProfileImage({
        uploadedUrl,
        upload: () => edgestore.myPublicImages.upload({ file: upload, onProgressChange: progress => setProgress(Math.floor(progress / 10) * 10) }),
        remember: url => { uploadedUrl = url; if (edit) setEditFor(target, { ...edit, uploadedUrl: url }); },
        persist: async url => { saved.user = await patchProfile(target === 'banner' ? { banner: url } : { image: url }); },
      });
      if (target === 'banner') {
        setProfile(prev => prev ? { ...prev, banner: url } : null);
      } else {
        // Uploading a picture also makes it the one shown (the server switches the source to MANUAL).
        setProfile(prev => prev ? { ...prev, image: saved.user?.image ?? url, imageSource: saved.user?.imageSource ?? 'MANUAL', imageSources: saved.user?.imageSources ?? prev.imageSources } : null);
        void refreshSession();
      }
      toast.success(target === 'banner' ? 'Banner updated' : 'Profile picture updated');
      setEditFor(target, null);
    } catch {
      setErr(uploadedUrl ? `The ${label} uploaded, but your profile could not save. Try Save again; the uploaded file will be reused.` : `The ${label} could not upload. Check your connection and try Save again.`);
      toast.error(`Failed to save ${label}`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  // A picked file goes straight into in-place edit mode. GIFs are saved as
  // they are: framing would flatten the animation to one frame.
  const pickImage = (target: ImageTarget, file: File) => {
    const lock = target === 'banner' ? bannerSaveLock : avatarSaveLock;
    if (!canEditProfile || lock.current || !validImage(file)) return;
    (target === 'banner' ? setBannerUploadError : setAvatarUploadError)(null);
    (target === 'banner' ? setBannerZoom : setAvatarZoom)(1);
    if (file.type === 'image/gif') { void saveImage(target, file); return; }
    setEditFor(target, { file });
  };
  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (bannerInputRef.current) bannerInputRef.current.value = '';
    if (file) pickImage('banner', file);
  };
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    if (file) pickImage('avatar', file);
  };

  // Edit starts from what is already there: the saved image is fetched and
  // framed where it sits (EdgeStore, Google, GitHub and Discord allow
  // cross-origin reads). Nothing saved yet → pick a file first.
  const startEdit = async (target: ImageTarget) => {
    if (!canEditProfile || openingEdit) return;
    const src = target === 'banner' ? profile?.banner : profile?.image;
    if (!src) { (target === 'banner' ? bannerInputRef : avatarInputRef).current?.click(); return; }
    setOpeningEdit(target);
    try {
      const response = await fetch(src, { mode: 'cors', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error(blob.type);
      const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      (target === 'banner' ? setBannerZoom : setAvatarZoom)(1);
      (target === 'banner' ? setBannerUploadError : setAvatarUploadError)(null);
      setEditFor(target, { file: new File([blob], `${target}-current.${ext}`, { type: blob.type }) });
    } catch {
      toast.error('That image could not be loaded for editing. Upload a new one instead.');
    } finally {
      setOpeningEdit(null);
    }
  };
  const cancelEdit = (target: ImageTarget) => {
    if ((target === 'banner' ? bannerSaveLock : avatarSaveLock).current) return;
    (target === 'banner' ? setBannerUploadError : setAvatarUploadError)(null);
    setEditFor(target, null);
  };

  const removeBanner = async () => {
    if (!canEditProfile || removingBanner || !profile?.banner) return;
    setRemovingBanner(true);
    try {
      await patchProfile({ banner: null });
      setProfile(prev => prev ? { ...prev, banner: null } : null);
      setBannerEdit(null);
      toast.success('Banner removed');
    } catch {
      toast.error('The banner could not be removed. Try again.');
    } finally {
      setRemovingBanner(false);
    }
  };

  // Show the picture from another linked sign-in method (or the uploaded one).
  // One account: the choice applies everywhere the avatar appears.
  const chooseImageSource = async (source: IdentitySource) => {
    if (!canEditProfile || imageSourceBusy || source === profile?.imageSource) return;
    setImageSourceBusy(true);
    try {
      const saved = await patchProfile({ imageSource: source });
      setProfile(prev => prev ? { ...prev, image: saved.image, imageSource: saved.imageSource ?? source, imageSources: saved.imageSources ?? prev.imageSources } : null);
      setAvatarEdit(null);
      void refreshSession();
      toast.success('Profile picture updated');
    } catch {
      toast.error('The picture could not be changed. Try again.');
    } finally {
      setImageSourceBusy(false);
    }
  };

  // Every picture this account can show. A manual copy of a provider picture
  // (linking backfills it) is not offered twice.
  const imageChoices = (() => {
    const sources = profile?.imageSources;
    if (!sources) return [] as { source: IdentitySource; label: string; image: string; active: boolean }[];
    const providers = [sources.google, sources.github, sources.discord];
    const raw: { source: IdentitySource; label: string; image: string | null }[] = [
      { source: 'MANUAL', label: 'Uploaded picture', image: sources.manual && providers.includes(sources.manual) ? null : sources.manual },
      { source: 'GOOGLE', label: 'Google', image: sources.google },
      { source: 'GITHUB', label: 'GitHub', image: sources.github },
      { source: 'DISCORD', label: 'Discord', image: sources.discord },
    ];
    const active = profile?.imageSource ?? 'AUTO';
    let matched = false;
    return raw.flatMap(choice => {
      if (!choice.image) return [];
      const isActive = active === choice.source || (active === 'AUTO' && !matched && choice.image === profile?.image);
      if (isActive) matched = true;
      return [{ source: choice.source, label: choice.label, image: choice.image, active: isActive }];
    });
  })();

  // Handle paste for avatar (Ctrl+V)
  const handleAvatarPaste = (e: React.ClipboardEvent) => {
    if (!canEditProfile) return;
    const file = e.clipboardData?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Create a fake event to reuse handleAvatarSelect logic
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fakeEvent = { target: { files: dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>;
      handleAvatarSelect(fakeEvent);
    }
  };

  // Handle drag and drop for avatar
  const handleAvatarDrop = (e: React.DragEvent) => {
    if (!canEditProfile) return;
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fakeEvent = { target: { files: dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>;
      handleAvatarSelect(fakeEvent);
    }
  };

  // Handle message - find or create DM conversation with this user
  const [isStartingChat, setIsStartingChat] = useState(false);
  const handleMessage = async () => {
    if (readOnly || isStartingChat) return;
    if (!currentUser) {
      toast.error('Please sign in to send messages');
      return;
    }

    // Guard against messaging system accounts
    if (userId.startsWith('system-') || profile?.name?.toLowerCase().includes('system')) {
      toast.error('System accounts cannot receive messages');
      return;
    }

    setIsStartingChat(true);
    try {
      // The server resolves an existing two-person DM before creating one.
      // `filter=dm` was not a supported list query and always returned 400.
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PRIVATE_DM',
          visibility: 'PARTICIPANTS',
          participants: [userId],
          title: `Chat with ${profile?.name || 'User'}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to start conversation');
      }

      const conversation = await res.json();
      router.push(`/conversations/${conversation.id}`);
    } catch (err) {
      console.error('Failed to start conversation:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to start conversation');
    } finally {
      setIsStartingChat(false);
    }
  };

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (readOnly || isFollowLoading || !followQuery.data) return;
    if (!currentUser) {
      toast.error('Please sign in to follow users');
      return;
    }

    setIsFollowLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch(`/api/users/${userId}/follow`, { method });
      const data = await res.json();

      if (res.ok) {
        await followQuery.mutate(data, { revalidate: false });
        toast.success(isFollowing ? 'Unfollowed' : 'Following!');
      } else {
        toast.error(data.error || 'Failed to update follow status');
      }
    } catch (err) {
      toast.error('Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
      void followQuery.mutate();
    }
  };

  if (sessionStatus === 'unauthenticated') return <section className="mx-auto max-w-lg px-4 py-12 text-center"><h1 className="text-2xl font-semibold">Sign in to view profiles</h1><Button asChild className="mt-5 h-11"><Link href={'/auth/login?callbackUrl=' + encodeURIComponent('/profile/' + userId)}>Sign in</Link></Button></section>;
  if (loading) {
    return <ProfileLoading />;
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
        <FiUser className="h-16 w-16 text-muted-foreground/40" />
        <h1 className="text-xl font-semibold text-foreground">{error?.status === 404 ? 'Profile not found' : 'Could not load this profile'}</h1>
        <p className="text-muted-foreground">{error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Please try again or return to your profile.'}</p>
        <Button className="h-11" onClick={() => void profileQuery.mutate()} variant="outline">Try again</Button>
        <Button asChild className="h-11" variant="outline"><Link href="/profile">Your profile</Link></Button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="profile-name"
      className="relative mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      style={{
        ...themeStyles,
      }}
    >
      <div className="relative mx-auto w-full min-w-0 max-w-4xl">
      {/* Subtle gradient glow from banner colors - more subtle */}
      {bannerColors && (
        <div
          className="absolute inset-x-0 top-0 h-[600px] pointer-events-none opacity-20"
          style={{
            background: `radial-gradient(ellipse 100% 100% at 50% 0%, ${bannerColors.primary}25, transparent 70%)`,
          }}
        />
      )}
      {/* Hidden file inputs */}
      <input ref={bannerInputRef} aria-label="Choose banner image" type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleBannerSelect} />
      <input ref={avatarInputRef} aria-label="Choose profile picture" type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarSelect} />

      {/* Banner: a 3:1 frame at every width. In edit mode it IS the framing surface: drag, scroll or slide to zoom, then Save. */}
      <div
        className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-foreground/[0.04]"
        onDragOver={(e) => { if (canEditProfile) e.preventDefault(); }}
        onDrop={(e) => {
          if (!canEditProfile) return;
          e.preventDefault();
          const file = e.dataTransfer?.files?.[0];
          if (file && file.type.startsWith('image/')) pickImage('banner', file);
        }}
      >
        {bannerEdit ? (
          <ImageFramer ref={bannerFramer} fill file={bannerEdit.file} aspect={3} zoom={bannerZoom} onZoomChange={setBannerZoom} className="rounded-2xl" />
        ) : profile.banner ? (
          <Image src={profile.banner} alt="Profile banner" fill sizes="(min-width: 1024px) 896px, calc(100vw - 32px)" className="object-cover" priority />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: bannerColors
                ? `linear-gradient(135deg, ${bannerColors.primary}90, ${bannerColors.secondary}90, ${bannerColors.accent}90)`
                : 'linear-gradient(135deg, hsl(var(--brand-accent) / 0.45), hsl(var(--brand-accent) / 0.12) 55%, hsl(var(--muted)))'
            }}
          />
        )}
        {/* Fades into the page so the avatar and name sit on it; hidden while editing so the framing is honest. */}
        {!bannerEdit && <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />}

        {canEditProfile && (
          <div className="absolute right-3 top-3 flex items-center gap-2 sm:right-4 sm:top-4">
            {bannerEdit ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" disabled={isUploadingBanner} className={onImageButton} aria-label="Change banner image">
                      <FiImage className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Change</span><FiChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={menuClass}>
                    <DropdownMenuItem className={menuItem} onSelect={() => bannerInputRef.current?.click()}>
                      <FiUpload className="size-4 text-muted-foreground" aria-hidden="true" />Upload from device…
                    </DropdownMenuItem>
                    {profile.banner && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className={cn(menuItem, 'text-destructive focus:text-destructive')} onSelect={() => void removeBanner()}>
                          <FiTrash2 className="size-4" aria-hidden="true" />Remove banner
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <button type="button" onClick={() => cancelEdit('banner')} disabled={isUploadingBanner} className={onImageButton}>
                  <FiX className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Cancel</span><span className="sr-only sm:hidden">Cancel editing</span>
                </button>
                <button type="button" onClick={() => void saveImage('banner')} disabled={isUploadingBanner || storageState.loading} className={accentButton}>
                  {isUploadingBanner ? <Spinner className="size-4" /> : <FiCheck className="size-4" aria-hidden="true" />}
                  {isUploadingBanner ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => void startEdit('banner')} disabled={isUploadingBanner || removingBanner || openingEdit === 'banner'} aria-label="Edit banner" className={onImageButton}>
                {openingEdit === 'banner' || removingBanner ? <Spinner className="size-4" /> : <FiCamera className="size-4" aria-hidden="true" />}<span className="hidden sm:inline">Edit banner</span>
              </button>
            )}
          </div>
        )}
        {/* Zoom pill bottom-right: the avatar overlaps the banner's bottom-left corner. */}
        {bannerEdit && (
          <div className="absolute bottom-3 right-3 flex w-56 items-center gap-3 sm:bottom-4 sm:right-4 sm:w-72">
            <span className={cn(onImageButton, 'w-full gap-2 px-3')}>
              <FiMove className="size-4 shrink-0" aria-hidden="true" />
              <FramerZoom zoom={bannerZoom} onZoomChange={setBannerZoom} className="flex-1 [&_input]:bg-white/25" />
            </span>
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className="relative mx-auto w-full min-w-0 px-0 pb-2 sm:px-4">
        {/* Avatar and basic info */}
        <div className="relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          {/* Avatar with paste/drag support. In edit mode the circle is the framing surface. */}
          <div
            className="relative w-fit shrink-0 self-start"
            onPaste={handleAvatarPaste}
            onDragOver={(e) => { if (canEditProfile) e.preventDefault(); }}
            onDrop={handleAvatarDrop}
            tabIndex={canEditProfile ? 0 : undefined}
            aria-label={canEditProfile ? 'Profile picture: paste or drop an image, or use Edit profile picture' : undefined}
          >
            {avatarEdit ? (
              <div className="relative h-28 w-28 overflow-hidden rounded-full shadow-2xl ring-4 ring-background sm:h-36 sm:w-36">
                <ImageFramer ref={avatarFramer} fill round file={avatarEdit.file} aspect={1} zoom={avatarZoom} onZoomChange={setAvatarZoom} className="rounded-full" />
              </div>
            ) : (
              <Avatar className="h-28 w-28 sm:h-36 sm:w-36 ring-4 ring-background shadow-2xl">
                <AvatarImage src={profile.image || undefined} alt={`${profile.name || 'User'} profile picture`} className="object-cover" />
                <AvatarFallback
                  className="text-3xl sm:text-4xl text-foreground font-medium"
                  style={{
                    background: bannerColors
                      ? `linear-gradient(135deg, ${bannerColors.primary}, ${bannerColors.secondary})`
                      : 'linear-gradient(135deg, hsl(var(--brand-accent) / 0.5), hsl(var(--muted)))'
                  }}
                >
                  {profile.name?.[0] || profile.email?.[0]?.toUpperCase() || profile.id?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
            )}

            {/* Camera enters edit mode on the current picture (or asks for one when there is none). */}
            {canEditProfile && !avatarEdit && (
              <button
                type="button"
                onClick={() => void startEdit('avatar')}
                disabled={isUploadingAvatar || imageSourceBusy || openingEdit === 'avatar'}
                title="Edit profile picture, or drag & drop / paste an image"
                aria-label="Edit profile picture"
                className={cn(avatarRoundButton, 'bottom-0 right-0')}
              >
                {isUploadingAvatar || imageSourceBusy || openingEdit === 'avatar' ? <Spinner className="size-4" /> : <FiCamera className="size-4" aria-hidden="true" />}
              </button>
            )}

            {/* Edit toolbar floats under the avatar: zoom, change (upload or a linked picture), cancel, save. */}
            {canEditProfile && avatarEdit && (
              <div className="absolute left-0 top-full z-10 mt-2 w-72 rounded-2xl border border-border/70 bg-popover/95 p-2 shadow-e3 backdrop-blur-xl">
                <FramerZoom zoom={avatarZoom} onZoomChange={setAvatarZoom} className="px-1 pb-2" onReset={() => avatarFramer.current?.reset()} />
                <div className="flex items-center gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" disabled={isUploadingAvatar} className={toolbarChip} aria-label="Change profile picture">
                        <FiImage className="size-3.5" aria-hidden="true" />Change<FiChevronDown className="size-3 opacity-70" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className={menuClass}>
                      <DropdownMenuItem className={menuItem} onSelect={() => avatarInputRef.current?.click()}>
                        <FiUpload className="size-4 text-muted-foreground" aria-hidden="true" />Upload from device…
                      </DropdownMenuItem>
                      {imageChoices.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Show the picture from</DropdownMenuLabel>
                          {imageChoices.map(choice => (
                            <DropdownMenuItem
                              key={choice.source}
                              aria-current={choice.active ? 'true' : undefined}
                              className={cn(menuItem, choice.active && 'bg-brand-accent/[0.08]')}
                              onSelect={() => void chooseImageSource(choice.source)}
                            >
                              <Avatar className="size-7 shrink-0">
                                <AvatarImage src={choice.image} alt="" className="object-cover" />
                                <AvatarFallback className="text-[10px]">{choice.label[0]}</AvatarFallback>
                              </Avatar>
                              <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                              {choice.active && <FiCheck className="size-4 text-brand-accent-hover dark:text-brand-accent-light" aria-hidden="true" />}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button type="button" onClick={() => cancelEdit('avatar')} disabled={isUploadingAvatar} className={toolbarChip} aria-label="Cancel editing profile picture">
                    <FiX className="size-3.5" aria-hidden="true" />Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveImage('avatar')}
                    disabled={isUploadingAvatar || storageState.loading}
                    aria-label="Save profile picture"
                    className={cn(toolbarChip, 'ml-auto border-transparent bg-brand-accent text-brand-accent-foreground hover:border-transparent hover:bg-brand-accent-hover')}
                  >
                    {isUploadingAvatar ? <Spinner className="size-3.5" /> : <FiCheck className="size-3.5" aria-hidden="true" />}Save
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <h1 id="profile-name" className="break-words text-xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">
                  {profile.name || 'Anonymous User'}
                </h1>
                <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  @{profile.username || profile.email?.split('@')[0] || profile.name?.toLowerCase().replace(/\s+/g, '') || profile.id.slice(0, 8)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 sm:max-w-[50%]">
                {isOwnProfile ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-11 rounded-lg"
                    >
                    <Link href="/settings">
                      <FiSettings className="h-4 w-4 mr-2" />
                      {readOnly ? 'View settings' : 'Edit profile'}
                    </Link>
                    </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant={isFollowing ? 'secondary' : 'default'}
                      onClick={handleFollowToggle}
                      disabled={readOnly || isFollowLoading || !followQuery.data}
                      className="h-11 rounded-lg"
                    >
                      {isFollowLoading ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <>
                          <FiUsers className="h-4 w-4 mr-2" />
                          {isFollowing ? 'Following' : 'Follow'}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMessage}
                      disabled={readOnly || isStartingChat}
                      aria-label={`Message ${profile.name || 'this user'}`}
                      className="h-11 w-11 rounded-lg p-0"
                      title={`Message ${profile.name || 'this user'}`}
                    >
                      {isStartingChat ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <FiMessageCircle className="h-4 w-4" />
                      )}
                    </Button>

                    {/* Request Trade */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={readOnly}
                      aria-label={`Experimental trade with ${profile.name || 'this user'}`}
                      onClick={async () => {
                        if (!walletConnected) {
                          toast.info('Connect your wallet to start a trade', {
                            description: 'Enable Web3 in settings and connect a wallet first.',
                            action: {
                              label: 'Open Settings',
                              onClick: () => router.push('/settings?section=wallet'),
                            },
                          });
                          return;
                        }
                        try {
                          const res = await fetch('/api/trades', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ responderId: userId, chainId }),
                          });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            throw new Error(err.error ?? 'Failed to create trade');
                          }
                          const trade = await res.json();
                          router.push(`/dashboard/trading?trade=${trade.id}&partner=${userId}`);
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : 'Trade request failed');
                        }
                      }}
                      className="h-11 w-11 rounded-lg border-brand-accent/30 bg-brand-accent/5 p-0 text-brand-accent-hover dark:text-brand-accent-light hover:bg-brand-accent/15 dark:text-brand-accent"
                      title={`Trade with ${profile.name || 'this user'}`}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </Button>

                    {/* Take Control — OWNER only, for system account */}
                    {currentUser?.role === 'OWNER' && !currentUser?.isImpersonating && userId === VEGGA_SYSTEM.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/admin/impersonate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ targetUserId: VEGGA_SYSTEM.id, reason: 'Owner controlling system account from profile' }),
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              throw new Error(err.error ?? 'Failed');
                            }
                            toast.success('Now controlling VeggaSystem. Refreshing…');
                            setTimeout(() => window.location.reload(), 500);
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : 'Take control failed');
                          }
                        }}
                        className="rounded-lg border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        title="Take control of this system account"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Take Control
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bio and meta info */}
        <div className="mt-5 space-y-4">
          {error && <SectionError retry={() => void profileQuery.mutate()} />}
          {canEditProfile && (isUploadingBanner || isUploadingAvatar || bannerUploadError || avatarUploadError || ((bannerEdit || avatarEdit) && storageState.loading)) && <div className="space-y-2 text-sm">
            {(bannerEdit || avatarEdit) && storageState.loading && <p role="status" className="text-muted-foreground">Preparing secure upload…</p>}
            {isUploadingBanner && <p role="status" className="text-muted-foreground">{bannerProgress >= 100 ? 'Saving banner…' : `Uploading banner… ${bannerProgress}%`}</p>}
            {isUploadingAvatar && <p role="status" className="text-muted-foreground">{avatarProgress >= 100 ? 'Saving profile picture…' : `Uploading profile picture… ${avatarProgress}%`}</p>}
            {bannerUploadError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">{bannerUploadError}</p>}
            {avatarUploadError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">{avatarUploadError}</p>}
          </div>}
          {readOnly && <p className="rounded-xl border border-border bg-foreground/[0.04] p-4 text-sm text-muted-foreground">Demo profiles are read-only. Explore posts and connections; sign in to your own account to edit, follow or send messages.</p>}
          {followQuery.error && <SectionError retry={() => void followQuery.mutate()} />}
          {profile.bio && (
            <p className="max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80 [overflow-wrap:anywhere] sm:text-base">{profile.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {profile.location && (
              <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <FiMapPin className="h-3.5 w-3.5" />
                {profile.location}
              </span>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors"
                style={{ color: tintText || 'hsl(var(--brand-accent))' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <FiLink className="h-3.5 w-3.5" />
                {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
            <span className="flex items-center gap-1.5">
              <FiCalendar className="h-3.5 w-3.5" />
              Joined {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true })}
            </span>
          </div>

          {/* Stats Row - Cleaner horizontal layout */}
          <div
            className="flex flex-wrap items-center gap-1 pt-3"
          >
            {/* Posts */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-foreground/[0.06] transition-colors cursor-default">
              <span className="text-base font-semibold text-foreground tabular-nums">{profile._count?.posts ?? 0}</span>
              <span className="text-sm text-muted-foreground">Pulses</span>
            </div>

            <span className="text-muted-foreground/30">·</span>

            {/* Synced (Followers) */}
            <button
              onClick={() => setActiveTab('connections', 'followers')}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-foreground/[0.06]"
            >
              <span className="text-base font-semibold text-foreground tabular-nums">{followerCount}</span>
              <span className="text-sm text-muted-foreground">Followers</span>
            </button>

            <span className="text-muted-foreground/30">·</span>

            {/* Syncs (Following) */}
            <button
              onClick={() => setActiveTab('connections', 'following')}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-foreground/[0.06]"
            >
              <span className="text-base font-semibold text-foreground tabular-nums">{followingCount}</span>
              <span className="text-sm text-muted-foreground">Following</span>
            </button>

            {/* Reach Badge - Prominent when available */}
            {profile.reach && profile.reach.totalViews > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <button
                  onClick={() => setActiveTab('reach')}
                  className="group relative flex min-h-11 items-center gap-2 rounded-lg px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Open reach analytics: ${profile.reach.totalViews} views`}
                  style={{
                    backgroundColor: `${bannerColors?.primaryContrast || '#10b981'}10`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${bannerColors?.primaryContrast || '#10b981'}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `${bannerColors?.primaryContrast || '#10b981'}10`;
                  }}
                >
                  <span
                    className="text-base font-semibold tabular-nums"
                    style={{ color: bannerColors?.primaryContrast || '#10b981' }}
                  >
                    {profile.reach.totalViews >= 1000
                      ? `${(profile.reach.totalViews / 1000).toFixed(1)}k`
                      : profile.reach.totalViews}
                  </span>
                  <span
                    className="text-sm flex items-center gap-1"
                    style={{ color: `${bannerColors?.primaryContrast || '#10b981'}cc` }}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className="absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: bannerColors?.primaryContrast || '#10b981' }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-1.5 w-1.5"
                        style={{ backgroundColor: bannerColors?.primaryContrast || '#10b981' }}
                      />
                    </span>
                    Reach
                  </span>

                  {/* Tooltip */}
                  <div
                    aria-hidden
                    className="sr-only"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.85)',
                      borderColor: `${bannerColors?.primaryContrast || '#10b981'}30`,
                    }}
                  >
                    <div className="font-medium mb-1" style={{ color: bannerColors?.primaryContrast || '#10b981' }}>
                      True Reach Analytics
                    </div>
                    <div className="text-muted-foreground">Click to see detailed metrics</div>
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
                    />
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList
              aria-label="Profile sections"
              className="grid h-auto w-full grid-cols-4 gap-1 rounded-xl border border-border/50 bg-foreground/[0.04] p-1 sm:inline-flex sm:w-auto"
            >
              <TabsTrigger
                value="posts"
                className="min-h-12 min-w-0 flex-col gap-1 rounded-lg px-1 text-[11px] transition-colors duration-200 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:min-h-11 sm:flex-row sm:px-3 sm:text-sm"
                style={activeTab === 'posts' ? {
                  backgroundColor: bannerColors ? `${bannerColors.primary}15` : 'hsl(var(--background))',
                  color: tintText,
                } : undefined}
              >
                <FiGrid aria-hidden="true" className="h-4 w-4 shrink-0 sm:mr-1.5" />
                Posts
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="min-h-12 min-w-0 flex-col gap-1 rounded-lg px-1 text-[11px] transition-colors duration-200 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:min-h-11 sm:flex-row sm:px-3 sm:text-sm"
                style={activeTab === 'activity' ? {
                  backgroundColor: bannerColors ? `${bannerColors.primary}15` : 'hsl(var(--background))',
                  color: tintText,
                } : undefined}
              >
                <FiActivity aria-hidden="true" className="h-4 w-4 shrink-0 sm:mr-1.5" />
                Activity
              </TabsTrigger>
              <TabsTrigger
                value="reach"
                className="min-h-12 min-w-0 flex-col gap-1 rounded-lg px-1 text-[11px] transition-colors duration-200 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:min-h-11 sm:flex-row sm:px-3 sm:text-sm"
                style={activeTab === 'reach' ? {
                  backgroundColor: `${bannerColors?.primaryContrast || '#10b981'}20`,
                  color: bannerColors?.primaryContrast || '#10b981',
                } : undefined}
              >
                <FiTrendingUp aria-hidden="true" className="h-4 w-4 shrink-0 sm:mr-1.5" />
                Reach
              </TabsTrigger>
              <TabsTrigger
                value="connections"
                className="min-h-12 min-w-0 flex-col gap-1 rounded-lg px-1 text-[11px] transition-colors duration-200 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:min-h-11 sm:flex-row sm:px-3 sm:text-sm"
                style={activeTab === 'connections' ? {
                  backgroundColor: bannerColors ? `${bannerColors.primary}15` : 'hsl(var(--background))',
                  color: tintText,
                } : undefined}
              >
                <FiUsers aria-hidden="true" className="h-4 w-4 shrink-0 sm:mr-1.5" />
                Connections
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-6">
              {postsQuery.error && <SectionError retry={() => void postsQuery.mutate()} />}
              {postsQuery.isLoading ? <PostsLoading /> : postsQuery.error && !posts.length ? null : posts.length === 0 ? (
                <div
                  className="rounded-2xl border p-12 text-center"
                  style={{
                    borderColor: 'hsl(var(--border) / 0.5)',
                    backgroundColor: 'hsl(var(--muted) / 0.3)',
                  }}
                >
                  <FiGrid className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No pulses yet</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    {readOnly ? 'This demo does not publish posts. You can explore the public feed.' : isOwnProfile ? 'Share your first update with the community.' : 'This user has not shared a public post yet.'}
                  </p>
                  {isOwnProfile && (
                      <Button
                        asChild
                        className="mt-4 h-11"
                        style={{
                          backgroundColor: bannerColors?.primary || '#3b82f6',
                        }}
                      >
                        <Link href="/pulse">{readOnly ? 'Explore Pulse' : 'Create a post'}</Link>
                      </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Sort pinned posts first */}
                  {[...posts]
                    .sort((a, b) => {
                      // Pinned posts first
                      if (a.pinnedToProfile && !b.pinnedToProfile) return -1;
                      if (!a.pinnedToProfile && b.pinnedToProfile) return 1;
                      // Then by date
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    })
                    .map(post => (
                    <motion.article
                      key={post.id}
                      initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="relative"
                    >
                      <Link
                        href={`/pulse/${post.id}`}
                        className="group block min-w-0 rounded-2xl border p-4 [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                        style={{
                          borderColor: post.pinnedToProfile 
                            ? (bannerColors ? `${bannerColors.primary}50` : 'hsl(var(--primary) / 0.3)')
                            : 'hsl(var(--border) / 0.5)',
                          backgroundColor: post.pinnedToProfile
                            ? (bannerColors ? `${bannerColors.primary}08` : 'hsl(var(--primary) / 0.05)')
                            : 'hsl(var(--muted) / 0.2)',
                        }}
                        onMouseEnter={(e) => {
                          if (!window.matchMedia('(hover: hover)').matches) return;
                          e.currentTarget.style.borderColor = bannerColors ? `${bannerColors.primary}50` : 'hsl(var(--border))';
                          e.currentTarget.style.backgroundColor = bannerColors ? `${bannerColors.primary}12` : 'hsl(var(--muted) / 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = post.pinnedToProfile 
                            ? (bannerColors ? `${bannerColors.primary}50` : 'hsl(var(--primary) / 0.3)')
                            : 'hsl(var(--border) / 0.5)';
                          e.currentTarget.style.backgroundColor = post.pinnedToProfile
                            ? (bannerColors ? `${bannerColors.primary}08` : 'hsl(var(--primary) / 0.05)')
                            : 'hsl(var(--muted) / 0.2)';
                        }}
                      >
                        {/* Pinned indicator */}
                        {post.pinnedToProfile && (
                          <div 
                            className="absolute -top-2 left-4 flex items-center gap-1 px-2 py-0.5 rounded-full text-foreground text-[10px] font-medium shadow-sm"
                            style={{ backgroundColor: bannerColors?.primary || '#3b82f6' }}
                          >
                            <Pin className="h-3 w-3" />
                            Pinned
                          </div>
                        )}

                        {/* Header with time */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                          {post.hasPoll && (
                            <Badge variant="secondary" className="text-[10px] gap-1" style={{ backgroundColor: bannerColors ? `${bannerColors.primary}15` : undefined }}>
                              <FiBarChart2 className="h-3 w-3" />
                              Poll
                            </Badge>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="font-medium text-foreground mb-2 group-hover:text-foreground/90 transition-colors line-clamp-2 text-[15px] leading-relaxed">
                          {post.title || post.description || 'Untitled post'}
                        </h4>

                        {/* Description preview if different from title */}
                        {post.description && post.description !== post.title && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {post.description}
                          </p>
                        )}

                        {/* Tags */}
                        {post.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {post.tags.slice(0, 4).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-[10px] text-muted-foreground px-2 py-0.5"
                                style={{
                                  backgroundColor: bannerColors ? `${bannerColors.primary}10` : 'hsl(var(--muted))',
                                }}
                              >
                                #{tag}
                              </Badge>
                            ))}
                            {post.tags.length > 4 && (
                              <span className="text-[10px] text-muted-foreground">+{post.tags.length - 4}</span>
                            )}
                          </div>
                        )}

                        {/* Stats row - like /pulse feed */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border/30">
                          {/* Heartbeats */}
                          <span className="flex items-center gap-1.5 hover:text-brand-accent transition-colors">
                            <PulseHeart size={16} filled={(post.positivePulseCount || 0) > 0} />
                            <span className="tabular-nums">{post.positivePulseCount || 0}</span>
                          </span>

                          {/* Comments */}
                          <span className="flex items-center gap-1.5">
                            <FiMessageCircle className="h-4 w-4" />
                            <span className="tabular-nums">{Math.max(0, (post.messageCount || 0) - 1)}</span>
                          </span>

                          {/* Repulses */}
                          {(post.repostCount || 0) > 0 && (
                            <span className="flex items-center gap-1.5">
                              <FiRepeat className="h-4 w-4" />
                              <span className="tabular-nums">{post.repostCount}</span>
                            </span>
                          )}

                          {/* Views */}
                          {(post.viewCount || 0) > 0 && (
                            <span 
                              className="flex items-center gap-1.5 ml-auto"
                              style={{ color: bannerColors?.primaryContrast || '#10b981' }}
                            >
                              <FiEye className="h-4 w-4" />
                              <span className="tabular-nums">{post.viewCount}</span>
                            </span>
                          )}
                        </div>
                      </Link>
                    </motion.article>
                  ))}
                </div>
              )}
              {postsQuery.data?.at(-1)?.nextCursor && <Button className="mt-4 h-11" variant="outline" disabled={postsQuery.isValidating} onClick={() => void postsQuery.setSize(size => size + 1)}>{postsQuery.isValidating ? 'Loading…' : 'Load more posts'}</Button>}
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              {activityQuery.error && <SectionError retry={() => void activityQuery.mutate()} />}
              {activityQuery.isLoading ? <PostsLoading /> : activityQuery.error && !activityPosts.length ? null : activityPosts.length === 0 ? (
                <div
                  className="rounded-2xl border p-12 text-center"
                  style={{
                    borderColor: 'hsl(var(--border) / 0.5)',
                    backgroundColor: 'hsl(var(--muted) / 0.3)',
                  }}
                >
                  <FiActivity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No activity yet</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    {isOwnProfile ? 'Posts you comment on or interact with will appear here' : 'This user hasn\'t interacted with any posts yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityPosts.map(post => (
                    <motion.article
                      key={post.id}
                      initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <Link
                        href={`/pulse/${post.id}`}
                        className="group block min-w-0 rounded-2xl border p-4 [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                        style={{
                          borderColor: 'hsl(var(--border) / 0.5)',
                          backgroundColor: 'hsl(var(--muted) / 0.2)',
                        }}
                        onMouseEnter={(e) => {
                          if (!window.matchMedia('(hover: hover)').matches) return;
                          e.currentTarget.style.borderColor = bannerColors ? `${bannerColors.primary}50` : 'hsl(var(--border))';
                          e.currentTarget.style.backgroundColor = bannerColors ? `${bannerColors.primary}12` : 'hsl(var(--muted) / 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'hsl(var(--border) / 0.5)';
                          e.currentTarget.style.backgroundColor = 'hsl(var(--muted) / 0.2)';
                        }}
                      >
                        {/* Header - engaged indicator */}
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className="flex items-center gap-2 text-xs"
                            style={{ color: tintText || 'hsl(var(--primary))' }}
                          >
                            <FiMessageCircle className="h-3 w-3" />
                            <span>Engaged with</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="font-medium text-foreground mb-2 group-hover:text-foreground/90 transition-colors line-clamp-2 text-[15px] leading-relaxed">
                          {post.title || post.description || 'Untitled post'}
                        </h4>

                        {/* Tags */}
                        {post.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {post.tags.slice(0, 4).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-[10px] text-muted-foreground px-2 py-0.5"
                                style={{ backgroundColor: bannerColors ? `${bannerColors.primary}10` : 'hsl(var(--muted))' }}
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Stats row */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border/30">
                          <span className="flex items-center gap-1.5">
                            <PulseHeart size={16} filled={(post.positivePulseCount || 0) > 0} />
                            <span className="tabular-nums">{post.positivePulseCount || 0}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <FiMessageCircle className="h-4 w-4" />
                            <span className="tabular-nums">{Math.max(0, (post.messageCount || 0) - 1)}</span>
                          </span>
                          {(post.viewCount || 0) > 0 && (
                            <span className="flex items-center gap-1.5 ml-auto" style={{ color: bannerColors?.primaryContrast || '#10b981' }}>
                              <FiEye className="h-4 w-4" />
                              <span className="tabular-nums">{post.viewCount}</span>
                            </span>
                          )}
                        </div>
                      </Link>
                    </motion.article>
                  ))}
                </div>
              )}
              {activityQuery.data?.at(-1)?.nextCursor && <Button className="mt-4 h-11" variant="outline" disabled={activityQuery.isValidating} onClick={() => void activityQuery.setSize(size => size + 1)}>{activityQuery.isValidating ? 'Loading…' : 'Load more activity'}</Button>}
            </TabsContent>

            <TabsContent value="reach" className="mt-6">
              <p className="mb-4 rounded-xl border border-border bg-foreground/[0.04] p-4 text-sm text-muted-foreground">Experimental analytics · engagement estimates, not a measure of personal worth or verified financial results.</p>
              {reachQuery.error && <SectionError retry={() => void reachQuery.mutate()} />}
              {reachQuery.isLoading && <p role="status" className="mb-4 text-sm text-muted-foreground">Loading reach details…</p>}
              {/* True Reach Analytics - 7 Pillar System */}
              <div className="space-y-6">
                {/* Empty state for users with no engagement data yet */}
                {(profile?.reach?.trueReachScore === 0 || !profile?.reach?.trueReachScore) &&
                  (profile?.reach?.totalViews ?? 0) === 0 && (
                  <div
                    className="rounded-2xl border-2 p-8 text-center"
                    style={{
                      borderColor: isDark
                        ? `${bannerColors?.primaryContrast || '#10b981'}20`
                        : `${bannerColors?.primaryContrast || '#10b981'}30`,
                      backgroundColor: isDark
                        ? `${bannerColors?.primaryContrast || '#10b981'}06`
                        : `${bannerColors?.primaryContrast || '#10b981'}04`,
                    }}
                  >
                    <div
                      className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                      style={{ backgroundColor: `${bannerColors?.primaryContrast || '#10b981'}15` }}
                    >
                      📊
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-1">No reach data yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      {isOwnProfile
                        ? 'Start posting pulses and engaging with others — your 7-pillar reach score will build up here.'
                        : 'This user hasn\'t built any reach data yet.'}
                    </p>
                    {canEditProfile && (
                        <Button asChild
                          className="mt-4 inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ backgroundColor: bannerColors?.primaryContrast || '#10b981' }}
                        >
                          <Link href="/pulse">Create a pulse</Link>
                        </Button>
                    )}
                  </div>
                )}

                {/* Header with Overall Score + Dual Metrics */}
                <div
                  className="rounded-2xl border-2 p-6 bg-surface-1/50 shadow-sm"
                  style={{
                    borderColor: isDark
                      ? (bannerColors ? `${bannerColors.primaryContrast}35` : 'rgba(16,185,129,0.25)')
                      : (bannerColors ? `${bannerColors.primaryContrast}50` : 'rgba(16,185,129,0.35)'),
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                          style={{
                            backgroundColor: `${bannerColors?.primaryContrast || '#10b981'}20`,
                          }}
                        >
                          📊
                        </span>
                        True Reach Analytics
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                        Real engagement metrics that matter — not vanity follower counts.
                        Based on 7 pillars measuring actual impact.
                      </p>
                    </div>

                    {/* Overall True Reach Score */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                          Overall Score
                        </div>
                        <div
                          className="text-4xl font-bold tabular-nums"
                          style={{ color: bannerColors?.primaryContrast || '#10b981' }}
                        >
                          {profile?.reach?.trueReachScore?.toFixed(0) ||
                            // Calculate fallback score from pillars
                            Math.round(
                              ((profile?.reach?.visibility || 0) * 0.18) +
                              ((profile?.reach?.engagementDepth || 0) * 0.25) +
                              ((profile?.reach?.conversionImpact || 0) * 0.18) +
                              ((profile?.reach?.loyalty || 0) * 0.14) +
                              ((profile?.reach?.growth || 0) * 0.10) +
                              ((profile?.reach?.recall || 0) * 0.05) +
                              ((profile?.reach?.velocity || 0) * 0.10)
                            ) || 0
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">/ 100</div>
                      </div>
                      <div
                        className="h-16 w-16 rounded-full flex items-center justify-center"
                        style={{
                          background: `conic-gradient(
                            ${bannerColors?.primaryContrast || '#10b981'} ${(profile?.reach?.trueReachScore || 0) * 3.6}deg,
                            ${bannerColors?.primaryContrast || '#10b981'}20 0deg
                          )`,
                        }}
                      >
                        <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center">
                          <FiTrendingUp
                            className="h-5 w-5"
                            style={{ color: bannerColors?.primaryContrast || '#10b981' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* True Reach — honest identity-trust + risk breakdown (live from
                    engine). The hero of the tab: real verified-identity score
                    sits above the behavioral pillars. */}
                {trueReach && (
                  <TrueReachCard data={trueReach} />
                )}

                {/* Main Content Grid */}
                <div className="grid gap-6 lg:grid-cols-5">
                  {/* Radar Chart - 2 columns */}
                  <div
                    className="lg:col-span-2 rounded-2xl border-2 p-6 bg-surface-1/50 dark:bg-surface-1/30 shadow-sm"
                    style={{
                      borderColor: isDark
                        ? (bannerColors ? `${bannerColors.primary}30` : 'rgba(255,255,255,0.1)')
                        : (bannerColors ? `${bannerColors.primary}45` : 'rgba(0,0,0,0.1)'),
                    }}
                  >
                    <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bannerColors?.primaryContrast || '#10b981' }} />
                      Pillar Distribution
                    </h4>
                    <div className="aspect-square max-w-[320px] mx-auto">
                      <Radar
                        data={{
                          labels: REACH_PILLARS.map(p => p.shortLabel),
                          datasets: [{
                            label: 'Your Score',
                            data: REACH_PILLARS.map(p => {
                              const val = profile?.reach?.[p.key as keyof typeof profile.reach];
                              return typeof val === 'number' ? val : 0;
                            }),
                            backgroundColor: bannerColors ? `${bannerColors.primaryContrast}25` : 'rgba(16, 185, 129, 0.15)',
                            borderColor: bannerColors?.primaryContrast || '#10b981',
                            borderWidth: 2,
                            pointBackgroundColor: REACH_PILLARS.map(p => p.color),
                            pointBorderColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,1)',
                            pointBorderWidth: 2,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                          }],
                        }}
                        options={{
                          animation: reduceMotion ? false : { duration: 180 },
                          scales: {
                            r: {
                              angleLines: {
                                color: isDark
                                  ? (bannerColors ? `${bannerColors.primaryContrast}20` : 'rgba(255,255,255,0.1)')
                                  : (bannerColors ? `${bannerColors.primaryContrast}30` : 'rgba(0,0,0,0.1)'),
                              },
                              grid: {
                                color: isDark
                                  ? (bannerColors ? `${bannerColors.primaryContrast}15` : 'rgba(255,255,255,0.08)')
                                  : (bannerColors ? `${bannerColors.primaryContrast}20` : 'rgba(0,0,0,0.08)'),
                                circular: true,
                              },
                              pointLabels: {
                                color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                                font: { size: 11, weight: 500 },
                                padding: 12,
                              },
                              ticks: {
                                display: false,
                                stepSize: 20,
                              },
                              suggestedMin: 0,
                              suggestedMax: 100,
                            },
                          },
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
                              titleColor: isDark ? '#fff' : '#000',
                              bodyColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              borderWidth: 1,
                              titleFont: { size: 13, weight: 'bold' },
                              bodyFont: { size: 12 },
                              padding: 12,
                              cornerRadius: 8,
                              callbacks: {
                                title: (items) => {
                                  const pillar = REACH_PILLARS[items[0].dataIndex];
                                  return `${pillar.icon} ${pillar.label}`;
                                },
                                label: (item) => {
                                  const pillar = REACH_PILLARS[item.dataIndex];
                                  return [
                                    `Score: ${item.raw}/100 (${pillar.weight}% weight)`,
                                    '',
                                    pillar.description,
                                  ];
                                },
                                afterLabel: (item) => {
                                  const pillar = REACH_PILLARS[item.dataIndex];
                                  return `💡 ${pillar.tip}`;
                                },
                              },
                            },
                          },
                          maintainAspectRatio: true,
                          interaction: {
                            intersect: false,
                            mode: 'nearest',
                          },
                        }}
                      />
                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {REACH_PILLARS.map((pillar) => (
                        <div
                          key={pillar.key}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: pillar.color }}
                          />
                          {pillar.shortLabel}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pillar Cards - 3 columns */}
                  <div className="lg:col-span-3 grid gap-3 sm:grid-cols-2">
                    {REACH_PILLARS.map(pillar => {
                      const value = profile?.reach?.[pillar.key as keyof typeof profile.reach];
                      const score = typeof value === 'number' ? value : 0;
                      const isGood = score >= 70;
                      const isMedium = score >= 40 && score < 70;

                      return (
                        <motion.div
                          key={pillar.key}
                          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
                          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                          transition={{ duration: 0.18 }}
                          className="relative min-w-0 rounded-xl border-2 p-4 shadow-sm"
                          style={{
                            borderColor: isDark ? `${pillar.color}35` : `${pillar.color}50`,
                            background: isDark
                              ? `linear-gradient(135deg, ${pillar.color}08, transparent)`
                              : `linear-gradient(135deg, ${pillar.color}12, ${pillar.color}05)`,
                          }}
                        >
                          {/* Weight badge */}
                          <div
                            className="absolute top-3 right-3 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: isDark ? `${pillar.color}25` : `${pillar.color}35`,
                              color: isDark ? pillar.color : pillar.color,
                            }}
                          >
                            {pillar.weight}%
                          </div>

                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                              style={{ backgroundColor: isDark ? `${pillar.color}15` : `${pillar.color}25` }}
                            >
                              {pillar.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span
                                  className="text-2xl font-bold tabular-nums"
                                  style={{ color: pillar.color }}
                                >
                                  {score}
                                </span>
                                <span className="text-xs text-muted-foreground">/100</span>
                              </div>
                              <div className="text-sm font-medium text-foreground truncate">
                                {pillar.label}
                              </div>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3 h-1.5 rounded-full bg-foreground/[0.04] dark:bg-foreground/[0.05] overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: pillar.color, transformOrigin: 'left' }}
                              initial={reduceMotion ? false : { scaleX: 0 }}
                              animate={{ scaleX: Math.max(0, Math.min(1, score / 100)) }}
                              transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                            />
                          </div>

                          {/* Description on hover */}
                          <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            {pillar.description}
                          </div>

                          {/* Tip badge */}
                          <div
                            className="mt-2 rounded-md px-2 py-1 text-xs"
                            style={{
                              backgroundColor: `${pillar.color}10`,
                              color: pillar.color,
                            }}
                          >
                            💡 {pillar.tip}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary Stats Row */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div
                    className="min-w-0 rounded-xl border-2 bg-surface-1/30 p-5 shadow-sm"
                    style={{
                      borderColor: isDark
                        ? `${bannerColors?.primaryContrast || '#10b981'}35`
                        : `${bannerColors?.primaryContrast || '#10b981'}50`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div
                          className="text-3xl font-bold tabular-nums"
                          style={{ color: bannerColors?.primaryContrast || '#10b981' }}
                        >
                          {(profile?.reach?.totalViews || 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Total Views</div>
                        <p className="text-[11px] text-muted-foreground/70 mt-2">
                          People who actually saw the content
                        </p>
                      </div>
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: isDark ? `${bannerColors?.primaryContrast || '#10b981'}15` : `${bannerColors?.primaryContrast || '#10b981'}20` }}
                      >
                        <svg className="h-6 w-6" style={{ color: bannerColors?.primaryContrast || '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div
                    className="min-w-0 rounded-xl border-2 bg-surface-1/30 p-5 shadow-sm"
                    style={{
                      borderColor: isDark
                        ? `${bannerColors?.primary || '#3b82f6'}35`
                        : `${bannerColors?.primary || '#3b82f6'}50`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div
                          className="text-3xl font-bold tabular-nums"
                          style={{ color: tintText || 'hsl(var(--brand-accent))' }}
                        >
                          {(profile?.reach?.uniqueViewers || 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Unique Viewers</div>
                        <p className="text-[11px] text-muted-foreground/70 mt-2">
                          Individual people reached
                        </p>
                      </div>
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: isDark ? `${bannerColors?.primary || '#3b82f6'}15` : `${bannerColors?.primary || '#3b82f6'}20` }}
                      >
                        <FiUsers className="h-6 w-6" style={{ color: tintText || 'hsl(var(--brand-accent))' }} />
                      </div>
                    </div>
                  </div>

                  <div
                    className="min-w-0 rounded-xl border-2 bg-surface-1/30 p-5 shadow-sm"
                    style={{
                      borderColor: isDark
                        ? `${bannerColors?.secondary || '#8b5cf6'}35`
                        : `${bannerColors?.secondary || '#8b5cf6'}50`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div
                          className="text-3xl font-bold tabular-nums"
                          style={{
                            color: (profile?.reach?.engagementRate || 0) >= 100
                              ? (bannerColors?.primaryContrast || '#10b981')
                              : (profile?.reach?.engagementRate || 0) >= 50
                                ? '#eab308'
                                : '#ea580c'
                          }}
                        >
                          {(profile?.reach?.engagementRate || 0).toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Engagement Rate</div>
                        <p className="text-[11px] text-muted-foreground/70 mt-2">
                          Replies ÷ unique viewers (capped at 100%)
                        </p>
                      </div>
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${bannerColors?.secondary || '#8b5cf6'}15` }}
                      >
                        <FiTrendingUp className="h-6 w-6" style={{ color: bannerColors?.secondaryLight || '#a78bfa' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dual Score Cards: Momentum + Lifetime */}
                {(profile?.reach?.reachMomentum !== undefined || profile?.reach?.reachLifetime !== undefined) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div
                      className="rounded-xl border-2 p-5 bg-surface-1/30 shadow-sm"
                      style={{ borderColor: `${bannerColors?.primaryContrast || '#10b981'}40` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FiZap className="h-5 w-5" style={{ color: bannerColors?.primaryContrast || '#10b981' }} />
                        <span className="text-sm font-semibold text-foreground">Active Momentum</span>
                      </div>
                      <div className="text-3xl font-bold tabular-nums" style={{ color: bannerColors?.primaryContrast || '#10b981' }}>
                        {(profile?.reach?.reachMomentum || 0).toFixed(0)}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Current trending power — decays daily without engagement
                      </p>
                    </div>
                    <div
                      className="rounded-xl border-2 p-5 bg-surface-1/30 shadow-sm"
                      style={{ borderColor: tintText ? `${tintText}40` : 'hsl(var(--brand-accent) / 0.25)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FiBarChart2 className="h-5 w-5" style={{ color: tintText || 'hsl(var(--brand-accent))' }} />
                        <span className="text-sm font-semibold text-foreground">Lifetime Reach</span>
                      </div>
                      <div className="text-3xl font-bold tabular-nums" style={{ color: tintText || 'hsl(var(--brand-accent))' }}>
                        {(profile?.reach?.reachLifetime || 0).toFixed(0)}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Total historical impact — never decays, always growing
                      </p>
                    </div>
                  </div>
                )}

                {/* Momentum Timeline (30d) */}
                {momentumTrend.length > 0 && (
                  <div
                    className="rounded-2xl border-2 p-5 bg-surface-1/50 shadow-sm"
                    style={{
                      borderColor: isDark
                        ? `${bannerColors?.primaryContrast || '#10b981'}25`
                        : `${bannerColors?.primaryContrast || '#10b981'}35`,
                    }}
                  >
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bannerColors?.primaryContrast || '#10b981' }} />
                      Momentum Over Time
                    </h4>
                    <MomentumTimeline
                      data={momentumTrend}
                      accentColor={bannerColors?.primaryContrast || '#10b981'}
                      showViews
                      height={200}
                    />
                  </div>
                )}

                {/* Reach Badges */}
                {userBadges.length > 0 && (
                  <div
                    className="rounded-2xl border-2 p-5 bg-surface-1/50 shadow-sm"
                    style={{
                      borderColor: isDark
                        ? `${bannerColors?.primary || '#3b82f6'}25`
                        : `${bannerColors?.primary || '#3b82f6'}35`,
                    }}
                  >
                    <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                      🏆 Achievements
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Milestones you&apos;ve reached — and the ones within reach.
                    </p>
                    <ReachBadgesComponent badges={userBadges} />
                  </div>
                )}

                {/* What is True Reach? Explainer */}
                <div
                  className="rounded-2xl border-2 p-6 bg-surface-1/30 shadow-sm"
                  style={{
                    borderColor: isDark
                      ? (bannerColors ? `${bannerColors.primary}30` : 'rgba(255,255,255,0.1)')
                      : (bannerColors ? `${bannerColors.primary}45` : 'rgba(0,0,0,0.1)'),
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ backgroundColor: isDark ? `${bannerColors?.primaryContrast || '#10b981'}15` : `${bannerColors?.primaryContrast || '#10b981'}20` }}
                    >
                      💡
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground mb-2">
                        What is True Reach?
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        Unlike sync counts that can be inflated, <span className="font-medium" style={{ color: bannerColors?.primaryContrast || '#10b981' }}>True Reach</span> shows
                        how many people <em>actually</em> see and engage with content. A user with 100 synced
                        and 80% engagement is more influential than one with 1M synced and 0.1% engagement.
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                        <div className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: `${bannerColors?.primaryContrast || '#10b981'}08` }}>
                          <span className="text-sm">🎯</span>
                          <div>
                            <div className="font-medium text-foreground">Anti-Gaming</div>
                            <div className="text-muted-foreground">Deduped views, bot detection, quality signals</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: `${bannerColors?.primary || '#3b82f6'}08` }}>
                          <span className="text-sm">📈</span>
                          <div>
                            <div className="font-medium text-foreground">Outcome-Focused</div>
                            <div className="text-muted-foreground">Tied to marketplace conversions & real impact</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: `${bannerColors?.secondary || '#8b5cf6'}08` }}>
                          <span className="text-sm">⚖️</span>
                          <div>
                            <div className="font-medium text-foreground">7-Pillar Scoring</div>
                            <div className="text-muted-foreground">Seven pillars with different importance levels</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="connections" className="mt-6">
              <ProfileConnections userId={userId} viewerId={currentUser?.id} kind={query.get('connections') === 'following' ? 'following' : 'followers'} onKindChange={kind => setActiveTab('connections', kind)} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </div>
    </section>
  );
}
