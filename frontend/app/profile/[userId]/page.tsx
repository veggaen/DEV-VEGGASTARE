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
import ProfileLoading from '../loading';
import { useEdgeStore } from '@/lib/edgestore';
import { useBannerColors, generateColorStyles } from '@/lib/color-extraction';
import { useProfileThemeFromBanner } from '@/components/providers/profile-theme-provider';
import {
  FiUser, FiSettings, FiMessageCircle, FiCalendar, FiMapPin,
  FiLink, FiEdit2, FiGrid, FiActivity, FiUsers, FiCamera, FiUpload, FiX, FiTrendingUp,
  FiRepeat, FiEye, FiBarChart2, FiZap
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
  return <div role="status" aria-label="Loading profile posts" className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-36 rounded-xl border border-border bg-muted/30 motion-safe:animate-pulse" />)}</div>;
}

export default function ProfilePage() {
  const reduceMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const params = useParams();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { update: refreshSession, status: sessionStatus } = useSession();
  const { edgestore } = useEdgeStore();
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

  // Apply global page-level theme tinting from banner
  useProfileThemeFromBanner(profile?.banner);

  // Upload states
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Preview states for save/confirm workflow
  const [bannerPreview, setBannerPreview] = useState<{ file: File; url: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<{ file: File; url: string } | null>(null);

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
  useEffect(() => () => { if (bannerPreview) URL.revokeObjectURL(bannerPreview.url); }, [bannerPreview]);
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview.url); }, [avatarPreview]);
  useEffect(() => { setBannerPreview(null); setAvatarPreview(null); }, [userId]);

  // Handle banner file selection - show preview, don't upload yet
  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditProfile) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setBannerPreview({ file, url });
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  };

  // Confirm and upload banner
  const confirmBannerUpload = async () => {
    if (!canEditProfile || !bannerPreview || isUploadingBanner) return;

    setIsUploadingBanner(true);
    try {
      // Upload to EdgeStore
      const res = await edgestore.myPublicImages.upload({ file: bannerPreview.file });

      // Update user profile with new banner URL
      const updateRes = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner: res.url }),
      });

      if (!updateRes.ok) throw new Error('Failed to update profile');

      // Update local state
      setProfile(prev => prev ? { ...prev, banner: res.url } : null);
      toast.success('Banner updated successfully!');

      // Cleanup preview
      URL.revokeObjectURL(bannerPreview.url);
      setBannerPreview(null);
    } catch (err) {
      console.error('Error uploading banner:', err);
      toast.error('Failed to upload banner');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  // Cancel banner preview
  const cancelBannerPreview = () => {
    if (bannerPreview) {
      URL.revokeObjectURL(bannerPreview.url);
      setBannerPreview(null);
    }
  };

  // Handle avatar file selection - show preview, don't upload yet
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditProfile) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setAvatarPreview({ file, url });
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  // Confirm and upload avatar
  const confirmAvatarUpload = async () => {
    if (!canEditProfile || !avatarPreview || isUploadingAvatar) return;

    setIsUploadingAvatar(true);
    try {
      const res = await edgestore.myPublicImages.upload({ file: avatarPreview.file });

      const updateRes = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: res.url }),
      });

      if (!updateRes.ok) throw new Error('Failed to update profile');

      setProfile(prev => prev ? { ...prev, image: res.url } : null);
      void refreshSession();
      toast.success('Profile picture updated successfully!');

      // Cleanup preview
      URL.revokeObjectURL(avatarPreview.url);
      setAvatarPreview(null);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      toast.error('Failed to upload profile picture');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Cancel avatar preview
  const cancelAvatarPreview = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview.url);
      setAvatarPreview(null);
    }
  };

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
      <input
        ref={bannerInputRef}
        aria-label="Choose banner image"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleBannerSelect}
      />
      <input
        ref={avatarInputRef}
        aria-label="Choose profile picture"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleAvatarSelect}
      />

      {/* Banner */}
      <div 
        className="relative h-44 sm:h-56 lg:h-64 w-full overflow-hidden rounded-2xl"
        onDragOver={(e) => { if (canEditProfile) e.preventDefault(); }}
        onDrop={(e) => {
          if (!canEditProfile) return;
          e.preventDefault();
          const file = e.dataTransfer?.files?.[0];
          if (file && file.type.startsWith('image/')) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            const fakeEvent = { target: { files: dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>;
            handleBannerSelect(fakeEvent);
          }
        }}
      >
        {/* Show preview if available, otherwise show current banner */}
        {bannerPreview ? (
          <Image
            src={bannerPreview.url}
            alt="Banner preview"
            fill
            sizes="(min-width: 1024px) 896px, calc(100vw - 32px)"
            className="object-cover"
            priority
          />
        ) : profile.banner ? (
          <Image
            src={profile.banner}
            alt="Profile banner"
            fill
            sizes="(min-width: 1024px) 896px, calc(100vw - 32px)"
            className="object-cover"
            priority
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: bannerColors
                ? `linear-gradient(135deg, ${bannerColors.primary}90, ${bannerColors.secondary}90, ${bannerColors.accent}90)`
                : 'linear-gradient(135deg, #18181b, #27272a, #3f3f46)'
            }}
          />
        )}
        {/* Cleaner gradient overlay - fades to page background */}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />

        {/* Banner edit/confirm buttons (own profile only) */}
        {canEditProfile && (
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {bannerPreview ? (
              <>
                {/* Cancel preview */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelBannerPreview}
                  disabled={isUploadingBanner}
                  className="h-11 border-white/20 bg-black/70 text-white hover:bg-black/80 rounded-lg"
                >
                  <FiX className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                {/* Confirm/Save */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={confirmBannerUpload}
                  disabled={isUploadingBanner}
                  className="h-11 border-emerald-400/30 bg-emerald-700 text-white hover:bg-emerald-600 rounded-lg"
                >
                  {isUploadingBanner ? (
                    <>
                      <Spinner className="h-4 w-4 mr-2" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <FiUpload className="h-4 w-4 mr-2" />
                      Save Banner
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
                className="h-11 border-white/20 bg-black/70 text-white hover:bg-black/80 rounded-lg"
              >
                <FiCamera className="h-4 w-4 mr-2" />
                Edit Banner
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className="relative mx-auto w-full min-w-0 px-0 pb-2 sm:px-4">
        {/* Avatar and basic info */}
        <div className="relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          {/* Avatar with paste/drag support */}
          <div 
            className="relative w-fit shrink-0 self-start"
            onPaste={handleAvatarPaste}
            onDragOver={(e) => { if (canEditProfile) e.preventDefault(); }}
            onDrop={handleAvatarDrop}
            tabIndex={canEditProfile ? 0 : undefined}
            aria-label={canEditProfile ? 'Profile picture: paste or drop an image, or use Change profile picture' : undefined}
          >
            <Avatar className="h-28 w-28 sm:h-36 sm:w-36 ring-4 ring-background shadow-2xl">
              {/* Show preview if available, otherwise current image */}
              <AvatarImage src={avatarPreview?.url || profile.image || undefined} alt={`${profile.name || 'User'} profile picture`} className="object-cover" />
              <AvatarFallback
                className="text-3xl sm:text-4xl text-white font-medium"
                style={{
                  background: bannerColors
                    ? `linear-gradient(135deg, ${bannerColors.primary}, ${bannerColors.secondary})`
                    : 'linear-gradient(135deg, #3f3f46, #52525b)'
                }}
              >
                {profile.name?.[0] || profile.email?.[0]?.toUpperCase() || profile.id?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            
            {/* Camera button (always visible for own profile) */}
            {canEditProfile && !avatarPreview && (
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="Click to change avatar, or drag & drop / paste an image"
                aria-label="Change profile picture"
                className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full border-2 border-background bg-background text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [@media(hover:hover)]:hover:bg-muted"
              >
                {isUploadingAvatar ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <FiCamera className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Green checkmark confirm button (appears when preview is set) */}
            {canEditProfile && avatarPreview && (
              <button
                onClick={confirmAvatarUpload}
                disabled={isUploadingAvatar}
                title="Save new profile picture"
                aria-label="Save profile picture"
                className="absolute -bottom-2 right-0 flex h-11 w-11 items-center justify-center rounded-full border-2 border-background bg-emerald-700 text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [@media(hover:hover)]:hover:bg-emerald-600"
              >
                {isUploadingAvatar ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )}

            {/* Cancel button (appears when preview is set) */}
            {canEditProfile && avatarPreview && (
              <button
                onClick={cancelAvatarPreview}
                title="Cancel"
                aria-label="Cancel profile picture"
                disabled={isUploadingAvatar}
                className="absolute -bottom-2 left-0 flex h-11 w-11 items-center justify-center rounded-full border-2 border-background bg-background text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [@media(hover:hover)]:hover:bg-muted"
              >
                <FiX className="h-3.5 w-3.5" />
              </button>
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
                      className="h-11 w-11 rounded-lg border-emerald-500/30 bg-emerald-500/5 p-0 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
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
          {readOnly && <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">Demo profiles are read-only. Explore posts and connections; sign in to your own account to edit, follow or send messages.</p>}
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
                style={{ color: bannerColors?.primaryLight || '#60a5fa' }}
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
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-default">
              <span className="text-base font-semibold text-foreground tabular-nums">{profile._count?.posts ?? 0}</span>
              <span className="text-sm text-muted-foreground">Pulses</span>
            </div>

            <span className="text-muted-foreground/30">·</span>

            {/* Synced (Followers) */}
            <button
              onClick={() => setActiveTab('connections', 'followers')}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted/50"
            >
              <span className="text-base font-semibold text-foreground tabular-nums">{followerCount}</span>
              <span className="text-sm text-muted-foreground">Followers</span>
            </button>

            <span className="text-muted-foreground/30">·</span>

            {/* Syncs (Following) */}
            <button
              onClick={() => setActiveTab('connections', 'following')}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted/50"
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
              className="grid h-auto w-full grid-cols-4 gap-1 rounded-xl border border-border/50 bg-muted/30 p-1 sm:inline-flex sm:w-auto"
            >
              <TabsTrigger
                value="posts"
                className="min-h-12 min-w-0 flex-col gap-1 rounded-lg px-1 text-[11px] transition-colors duration-200 text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:min-h-11 sm:flex-row sm:px-3 sm:text-sm"
                style={activeTab === 'posts' ? {
                  backgroundColor: bannerColors ? `${bannerColors.primary}15` : 'hsl(var(--background))',
                  color: bannerColors?.primaryLight,
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
                  color: bannerColors?.primaryLight,
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
                  color: bannerColors?.primaryLight,
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
                            className="absolute -top-2 left-4 flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-medium shadow-sm"
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
                          <span className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors">
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
                            style={{ color: bannerColors?.primaryLight || 'hsl(var(--primary))' }}
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
              <p className="mb-4 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">Experimental analytics · engagement estimates, not a measure of personal worth or verified financial results.</p>
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
                          className="mt-4 inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                          <div className="mt-3 h-1.5 rounded-full bg-muted/30 dark:bg-white/5 overflow-hidden">
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
                          style={{ color: bannerColors?.primaryLight || '#3b82f6' }}
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
                        <FiUsers className="h-6 w-6" style={{ color: bannerColors?.primaryLight || '#60a5fa' }} />
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
                      style={{ borderColor: `${bannerColors?.primaryLight || '#3b82f6'}40` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FiBarChart2 className="h-5 w-5" style={{ color: bannerColors?.primaryLight || '#3b82f6' }} />
                        <span className="text-sm font-semibold text-foreground">Lifetime Reach</span>
                      </div>
                      <div className="text-3xl font-bold tabular-nums" style={{ color: bannerColors?.primaryLight || '#3b82f6' }}>
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
