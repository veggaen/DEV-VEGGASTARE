'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Spinner from '@/components/uicustom/spinner';
import { useCurrentUser } from '@/hooks/use-current-user';
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
import { formatDistanceToNow } from 'date-fns';
import { VEGGA_SYSTEM } from '@/lib/vegga-system-constants';
import { toast } from 'sonner';
import { useAccount, useChainId } from 'wagmi';
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

import dynamic from 'next/dynamic';
const MomentumTimeline = dynamic(() => import('@/components/uicustom/reach/MomentumTimeline'), { ssr: false });
const ReachBadgesComponent = dynamic(() => import('@/components/uicustom/reach/ReachBadges'), { ssr: false });
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

export default function ProfilePage() {
  const reduceMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const params = useParams();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { edgestore } = useEdgeStore();
  const { isConnected: walletConnected } = useAccount();
  const chainId = useChainId();
  const userId = params.userId as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [activityPosts, setActivityPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'activity' | 'reach' | 'connections'>('posts');

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
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Reach analytics states
  const [momentumTrend, setMomentumTrend] = useState<{ date: string; momentum: number; views?: number }[]>([]);
  const [userBadges, setUserBadges] = useState<{ id: string; label: string; icon: string; tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'; description: string; earned: boolean; progress: number }[]>([]);
  const [trueReach, setTrueReach] = useState<import('@/components/uicustom/reach/TrueReachCard').TrueReachData | null>(null);

  const isOwnProfile = currentUser?.id === userId;

  // Handle banner file selection - show preview, don't upload yet
  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!bannerPreview) return;

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
    if (!avatarPreview) return;

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
    if (!isOwnProfile) return;
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
    if (!isOwnProfile) return;
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
      // Try to find existing DM conversation first
      const existingRes = await fetch(`/api/conversations?filter=dm&participantId=${encodeURIComponent(userId)}`);
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        const existingDm = (existingData.conversations || []).find(
          (c: { type: string }) => c.type === 'PRIVATE_DM'
        );
        if (existingDm) {
          router.push(`/conversations/${existingDm.id}`);
          return;
        }
      }

      // No existing DM — create a new one
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PRIVATE_DM',
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
        setIsFollowing(data.isFollowing);
        setFollowerCount(data.followerCount);
        setFollowingCount(data.followingCount);
        toast.success(isFollowing ? 'Unfollowed' : 'Following!');
      } else {
        toast.error(data.error || 'Failed to update follow status');
      }
    } catch (err) {
      toast.error('Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch profile and follow status in parallel
        const [profileRes, followRes] = await Promise.all([
          fetch(`/api/users/${userId}`),
          fetch(`/api/users/${userId}/follow`),
        ]);

        if (!profileRes.ok) {
          throw new Error('User not found');
        }

        const profileData = await profileRes.json();
        setProfile(profileData.user || profileData);

        // Set follow status
        if (followRes.ok) {
          const followData = await followRes.json();
          setIsFollowing(followData.isFollowing);
          setFollowerCount(followData.followerCount);
          setFollowingCount(followData.followingCount);
        }

        // Fetch user's created posts (only posts they authored)
        const postsRes = await fetch(`/api/conversations?filter=created&creatorId=${userId}&sort=recent`);
        const postsData = await postsRes.json();
        setPosts(postsData.conversations || []);

        // Fetch user's activity (posts they commented on / interacted with)
        const activityRes = await fetch(`/api/conversations?filter=participated&creatorId=${userId}&sort=recent`);
        const activityData = await activityRes.json();
        setActivityPosts(activityData.conversations || []);

        // Fetch reach analytics (momentum trend + badges)
        try {
          const reachRes = await fetch(`/api/users/${userId}/reach`);
          if (reachRes.ok) {
            const reachData = await reachRes.json();
            setMomentumTrend(reachData.momentumTrend || []);
            setUserBadges(reachData.badges || []);
            setTrueReach(reachData.trueReach || null);
          }
        } catch {
          // Non-critical — reach data is supplementary
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <FiUser className="h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-foreground">User not found</h2>
        <p className="text-muted-foreground">{error || 'This profile doesn\'t exist or has been removed'}</p>
        <Button onClick={() => router.back()} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div
      className="relative w-full"
      style={{
        ...themeStyles,
      }}
    >
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
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleBannerSelect}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleAvatarSelect}
      />

      {/* Banner */}
      <div 
        className="relative h-44 sm:h-56 lg:h-72 w-full overflow-hidden"
        onDragOver={(e) => { if (isOwnProfile) e.preventDefault(); }}
        onDrop={(e) => {
          if (!isOwnProfile) return;
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
            className="object-cover"
            priority
          />
        ) : profile.banner ? (
          <Image
            src={profile.banner}
            alt="Profile banner"
            fill
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
        {isOwnProfile && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            {bannerPreview ? (
              <>
                {/* Cancel preview */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelBannerPreview}
                  className="border-white/20 bg-black/40 text-white/90 hover:bg-red-600/80 hover:text-white backdrop-blur-md rounded-lg transition-all"
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
                  className="border-emerald-400/30 bg-emerald-600/80 text-white hover:bg-emerald-500 backdrop-blur-md rounded-lg transition-all"
                >
                  {isUploadingBanner ? (
                    <>
                      <Spinner className="h-4 w-4 mr-2" />
                      Saving...
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
                className="border-white/20 bg-black/40 text-white/90 hover:bg-black/60 hover:text-white backdrop-blur-md rounded-lg transition-all"
              >
                <FiCamera className="h-4 w-4 mr-2" />
                Edit Banner
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className="relative mx-auto w-full max-w-4xl px-4 sm:px-6 pb-8">
        {/* Avatar and basic info */}
        <div className="relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          {/* Avatar with paste/drag support */}
          <div 
            className="relative"
            onPaste={handleAvatarPaste}
            onDragOver={(e) => { if (isOwnProfile) e.preventDefault(); }}
            onDrop={handleAvatarDrop}
            tabIndex={isOwnProfile ? 0 : undefined}
          >
            <Avatar className="h-28 w-28 sm:h-36 sm:w-36 ring-4 ring-background shadow-2xl">
              {/* Show preview if available, otherwise current image */}
              <AvatarImage src={avatarPreview?.url || profile.image || undefined} className="object-cover" />
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
            {isOwnProfile && (
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="Click to change avatar, or drag & drop / paste an image"
                className="absolute bottom-1 right-1 h-9 w-9 rounded-full bg-background border-2 border-background shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-50"
              >
                {isUploadingAvatar ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <FiCamera className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Green checkmark confirm button (appears when preview is set) */}
            {isOwnProfile && avatarPreview && (
              <button
                onClick={confirmAvatarUpload}
                disabled={isUploadingAvatar}
                title="Save new profile picture"
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-emerald-500 border-2 border-background shadow-lg flex items-center justify-center text-white hover:bg-emerald-400 transition-all disabled:opacity-50 animate-in fade-in zoom-in duration-200"
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
            {isOwnProfile && avatarPreview && (
              <button
                onClick={cancelAvatarPreview}
                title="Cancel"
                className="absolute -bottom-2 left-0 h-7 w-7 rounded-full bg-zinc-600 border-2 border-background shadow-lg flex items-center justify-center text-white hover:bg-red-500 transition-all animate-in fade-in zoom-in duration-200"
              >
                <FiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                  {profile.name || 'Anonymous User'}
                </h1>
                <p className="text-muted-foreground text-sm">
                  @{profile.username || profile.email?.split('@')[0] || profile.name?.toLowerCase().replace(/\s+/g, '') || profile.id.slice(0, 8)}
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                {isOwnProfile ? (
                  <Link href="/settings">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg border-border/50 bg-background/50 backdrop-blur-sm hover:bg-muted"
                    >
                      <FiSettings className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={handleFollowToggle}
                      disabled={isFollowLoading}
                      className={`rounded-lg transition-all ${isFollowing
                          ? "bg-muted hover:bg-destructive/80 text-foreground border border-border hover:text-white hover:border-destructive"
                          : "hover:opacity-90 text-white shadow-lg"
                        }`}
                      style={!isFollowing && bannerColors ? {
                        backgroundColor: bannerColors.primary,
                        boxShadow: `0 4px 14px ${bannerColors.primary}40`,
                      } : undefined}
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
                      disabled={isStartingChat}
                      className="rounded-lg border-border/50 bg-background/50 backdrop-blur-sm hover:bg-muted"
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
                      className="rounded-lg border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
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
          {profile.bio && (
            <p className="text-foreground/80 text-sm sm:text-base max-w-2xl leading-relaxed">{profile.bio}</p>
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
              <span className="text-base font-semibold text-foreground tabular-nums">{posts.length}</span>
              <span className="text-sm text-muted-foreground">Pulses</span>
            </div>

            <span className="text-muted-foreground/30">·</span>

            {/* Synced (Followers) */}
            <button
              onClick={() => setActiveTab('connections')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <span className="text-base font-semibold text-foreground tabular-nums">{followerCount}</span>
              <span className="text-sm text-muted-foreground">Synced</span>
            </button>

            <span className="text-muted-foreground/30">·</span>

            {/* Syncs (Following) */}
            <button
              onClick={() => setActiveTab('connections')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <span className="text-base font-semibold text-foreground tabular-nums">{followingCount}</span>
              <span className="text-sm text-muted-foreground">Syncs</span>
            </button>

            {/* Reach Badge - Prominent when available */}
            {profile.reach && profile.reach.totalViews > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <button
                  onClick={() => setActiveTab('reach')}
                  className="group relative flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
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
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
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
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-xl text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl border backdrop-blur-md"
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
              className="w-full sm:w-auto bg-muted/30 border border-border/50 p-1 rounded-xl gap-1"
            >
              <TabsTrigger
                value="posts"
                className="rounded-lg data-[state=active]:shadow-sm transition-all duration-200 text-muted-foreground data-[state=active]:text-foreground"
                style={activeTab === 'posts' ? {
                  backgroundColor: bannerColors ? `${bannerColors.primary}15` : 'hsl(var(--background))',
                  color: bannerColors?.primaryLight,
                } : undefined}
              >
                <FiGrid className="h-4 w-4 mr-1.5" />
                Posts
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="rounded-lg data-[state=active]:shadow-sm transition-all duration-200 text-muted-foreground data-[state=active]:text-foreground"
                style={activeTab === 'activity' ? {
                  backgroundColor: bannerColors ? `${bannerColors.primary}15` : 'hsl(var(--background))',
                  color: bannerColors?.primaryLight,
                } : undefined}
              >
                <FiActivity className="h-4 w-4 mr-1.5" />
                Activity
              </TabsTrigger>
              <TabsTrigger
                value="reach"
                className="rounded-lg data-[state=active]:shadow-sm transition-all duration-200 text-muted-foreground data-[state=active]:text-foreground"
                style={activeTab === 'reach' ? {
                  backgroundColor: `${bannerColors?.primaryContrast || '#10b981'}20`,
                  color: bannerColors?.primaryContrast || '#10b981',
                } : undefined}
              >
                <FiTrendingUp className="h-4 w-4 mr-1.5" />
                Reach
              </TabsTrigger>
              <TabsTrigger
                value="connections"
                className="rounded-lg data-[state=active]:shadow-sm transition-all duration-200 text-muted-foreground data-[state=active]:text-foreground"
                style={activeTab === 'connections' ? {
                  backgroundColor: bannerColors ? `${bannerColors.primary}15` : 'hsl(var(--background))',
                  color: bannerColors?.primaryLight,
                } : undefined}
              >
                <FiUsers className="h-4 w-4 mr-1.5" />
                Connections
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-6">
              {posts.length === 0 ? (
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
                    {isOwnProfile ? 'Send your first pulse — let the world feel the beat!' : 'This user hasn\'t pulsed anything yet'}
                  </p>
                  {isOwnProfile && (
                    <Link href="/pulse">
                      <Button
                        className="mt-4"
                        style={{
                          backgroundColor: bannerColors?.primary || '#3b82f6',
                        }}
                      >
                        Start pulsing
                      </Button>
                    </Link>
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
                    .map((post, index) => (
                    <motion.article
                      key={post.id}
                      initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="relative"
                    >
                      <Link
                        href={`/conversations/${post.id}`}
                        className="group block rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md"
                        style={{
                          borderColor: post.pinnedToProfile 
                            ? (bannerColors ? `${bannerColors.primary}50` : 'hsl(var(--primary) / 0.3)')
                            : 'hsl(var(--border) / 0.5)',
                          backgroundColor: post.pinnedToProfile
                            ? (bannerColors ? `${bannerColors.primary}08` : 'hsl(var(--primary) / 0.05)')
                            : 'hsl(var(--muted) / 0.2)',
                        }}
                        onMouseEnter={(e) => {
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
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              {activityPosts.length === 0 ? (
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
                  {activityPosts.map((post, index) => (
                    <motion.article
                      key={post.id}
                      initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                    >
                      <Link
                        href={`/conversations/${post.id}`}
                        className="group block rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md"
                        style={{
                          borderColor: 'hsl(var(--border) / 0.5)',
                          backgroundColor: 'hsl(var(--muted) / 0.2)',
                        }}
                        onMouseEnter={(e) => {
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
            </TabsContent>

            <TabsContent value="reach" className="mt-6">
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
                    {isOwnProfile && (
                      <Link href="/pulse">
                        <button
                          className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: bannerColors?.primaryContrast || '#10b981' }}
                        >
                          Create a pulse
                        </button>
                      </Link>
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
                    {REACH_PILLARS.map((pillar, index) => {
                      const value = profile?.reach?.[pillar.key as keyof typeof profile.reach];
                      const score = typeof value === 'number' ? value : 0;
                      const isGood = score >= 70;
                      const isMedium = score >= 40 && score < 70;

                      return (
                        <motion.div
                          key={pillar.key}
                          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
                          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="group relative rounded-xl border-2 p-4 transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow-md"
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
                              style={{ backgroundColor: pillar.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                              transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                            />
                          </div>

                          {/* Description on hover */}
                          <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                            {pillar.description}
                          </div>

                          {/* Tip badge */}
                          <div
                            className="mt-2 text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
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
                    className="rounded-xl border-2 p-5 transition-all duration-200 hover:scale-[1.01] bg-surface-1/30 shadow-sm hover:shadow-md"
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
                    className="rounded-xl border-2 p-5 transition-all duration-200 hover:scale-[1.01] bg-surface-1/30 shadow-sm hover:shadow-md"
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
                    className="rounded-xl border-2 p-5 transition-all duration-200 hover:scale-[1.01] bg-surface-1/30 shadow-sm hover:shadow-md"
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
                          Views ÷ Synced ratio
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
              <div
                className="rounded-2xl border p-12 text-center"
                style={{
                  borderColor: 'hsl(var(--border) / 0.5)',
                  backgroundColor: 'hsl(var(--muted) / 0.3)',
                }}
              >
                <FiUsers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Synced Rhythms</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  {isOwnProfile ? 'People synced to your rhythm and rhythms you follow' : 'This user\'s synced community'}
                </p>
                <p className="text-muted-foreground/70 text-xs mt-4">
                  Full sync list coming soon
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
