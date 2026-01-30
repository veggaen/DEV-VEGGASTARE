'use client';

import React, { useEffect, useState, useRef } from 'react';
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
import { 
  FiUser, FiSettings, FiMessageCircle, FiCalendar, FiMapPin,
  FiLink, FiEdit2, FiGrid, FiActivity, FiUsers, FiCamera, FiUpload, FiX, FiTrendingUp
} from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
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
  // Reach stats - actual engagement metrics
  reach?: {
    totalViews: number; // All views across all posts
    uniqueViewers: number; // Unique users who viewed content
    engagementRate: number; // (views / followers) ratio
  };
}

interface FeedItem {
  id: string;
  title: string;
  type: string;
  tags: string[];
  createdAt: string;
  messageCount: number;
  viewCount?: number;
}

export default function ProfilePage() {
  const reduceMotion = useReducedMotion();
  const params = useParams();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { edgestore } = useEdgeStore();
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
  
  // Upload states
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Follow states
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  // Handle banner upload
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingBanner(true);
    try {
      // Upload to EdgeStore
      const res = await edgestore.myPublicImages.upload({ file });
      
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
    } catch (err) {
      console.error('Error uploading banner:', err);
      toast.error('Failed to upload banner');
    } finally {
      setIsUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingAvatar(true);
    try {
      const res = await edgestore.myPublicImages.upload({ file });
      
      const updateRes = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: res.url }),
      });

      if (!updateRes.ok) throw new Error('Failed to update profile');

      setProfile(prev => prev ? { ...prev, image: res.url } : null);
      toast.success('Profile picture updated successfully!');
    } catch (err) {
      console.error('Error uploading avatar:', err);
      toast.error('Failed to upload profile picture');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
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
        <FiUser className="h-16 w-16 text-white/20" />
        <h2 className="text-xl font-semibold text-white">User not found</h2>
        <p className="text-white/50">{error || 'This profile doesn\'t exist or has been removed'}</p>
        <Button onClick={() => router.back()} variant="outline" className="border-white/20 text-white/80">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="relative flex-1 flex flex-col min-h-0 pb-8"
      style={{
        ...themeStyles,
        backgroundColor: bannerColors?.bgTint || undefined,
      }}
    >
      {/* Subtle gradient glow from banner colors */}
      {bannerColors && (
        <div 
          className="fixed inset-0 pointer-events-none opacity-30"
          style={{
            background: `radial-gradient(ellipse at top, ${bannerColors.primary}15, transparent 50%), radial-gradient(ellipse at bottom right, ${bannerColors.secondary}10, transparent 40%)`,
          }}
        />
      )}
      {/* Hidden file inputs */}
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleBannerUpload}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      {/* Banner */}
      <div className="relative h-48 sm:h-64 lg:h-80 w-full overflow-hidden">
        {profile.banner ? (
          <Image
            src={profile.banner}
            alt="Profile banner"
            fill
            className="object-cover"
          />
        ) : (
          <div 
            className="absolute inset-0" 
            style={{
              background: bannerColors 
                ? `linear-gradient(135deg, ${bannerColors.primary}, ${bannerColors.secondary}, ${bannerColors.accent})`
                : 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)'
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
        
        {/* Edit banner button (own profile only) */}
        {isOwnProfile && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => bannerInputRef.current?.click()}
            disabled={isUploadingBanner}
            className="absolute bottom-4 right-4 border-white/30 bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm"
          >
            {isUploadingBanner ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <FiCamera className="h-4 w-4 mr-2" />
                Edit Banner
              </>
            )}
          </Button>
        )}
      </div>

      {/* Profile Content */}
      <div className="relative mx-auto w-full max-w-4xl px-6">
        {/* Avatar and basic info */}
        <div className="relative -mt-20 sm:-mt-24 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          <div className="relative">
            <Avatar className="h-32 w-32 sm:h-40 sm:w-40 ring-4 ring-slate-900 bg-slate-800">
              <AvatarImage src={profile.image || undefined} />
              <AvatarFallback className="text-4xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                {profile.name?.[0] || profile.email?.[0]?.toUpperCase() || profile.id?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            {isOwnProfile && (
              <button 
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute bottom-2 right-2 h-10 w-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-white/80 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {isUploadingAvatar ? (
                  <Spinner className="h-5 w-5" />
                ) : (
                  <FiCamera className="h-5 w-5" />
                )}
              </button>
            )}
          </div>

          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  {profile.name || 'Anonymous User'}
                </h1>
                <p className="text-white/50 text-sm">
                  @{profile.username || profile.email?.split('@')[0] || profile.name?.toLowerCase().replace(/\s+/g, '') || profile.id.slice(0, 8)}
                </p>
              </div>

              {isOwnProfile ? (
                <Link href="/settings">
                  <Button variant="outline" className="border-white/20 text-white/80 hover:bg-white/10">
                    <FiSettings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </Link>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    style={!isFollowing && bannerColors ? {
                      backgroundColor: bannerColors.primary,
                      borderColor: bannerColors.primary,
                    } : undefined}
                    className={isFollowing 
                      ? "bg-white/10 hover:bg-red-600/80 text-white border border-white/20" 
                      : "hover:opacity-90 text-white"
                    }
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
                    className="border-white/20 text-white/80 hover:bg-white/10"
                    style={bannerColors ? {
                      borderColor: `${bannerColors.primary}40`,
                    } : undefined}
                  >
                    <FiMessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bio and meta info */}
        <div className="mt-6 space-y-4">
          {profile.bio && (
            <p className="text-white/80 max-w-2xl">{profile.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
            {profile.location && (
              <span className="flex items-center gap-1">
                <FiMapPin className="h-4 w-4" />
                {profile.location}
              </span>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
              >
                <FiLink className="h-4 w-4" />
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <span className="flex items-center gap-1">
              <FiCalendar className="h-4 w-4" />
              Joined {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true })}
            </span>
          </div>

          {/* Stats - Now with Reach (actual engagement) alongside Followers */}
          <div className="flex flex-wrap gap-4 sm:gap-6 pt-2">
            <div className="text-center px-2">
              <div className="text-xl font-bold text-white">{posts.length}</div>
              <div className="text-xs text-white/50">Posts</div>
            </div>
            
            {/* Reach - The new metric that matters - uses CONTRAST color to pop */}
            {profile.reach && profile.reach.totalViews > 0 && (
              <div className="text-center px-2 relative group">
                <div 
                  className="text-xl font-bold drop-shadow-[0_0_8px_currentColor]"
                  style={{ color: bannerColors?.primaryContrast || '#10b981' }}
                >
                  {profile.reach.totalViews >= 1000 
                    ? `${(profile.reach.totalViews / 1000).toFixed(1)}k` 
                    : profile.reach.totalViews}
                </div>
                <div 
                  className="text-xs flex items-center gap-1"
                  style={{ color: bannerColors ? `${bannerColors.primaryContrast}cc` : '#10b981cc' }}
                >
                  <span className="relative flex h-2 w-2">
                    <span 
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: bannerColors?.primaryContrast || '#10b981' }}
                    ></span>
                    <span 
                      className="relative inline-flex rounded-full h-2 w-2"
                      style={{ backgroundColor: bannerColors?.primaryContrast || '#10b981' }}
                    ></span>
                  </span>
                  Reach
                </div>
                {/* Tooltip explaining reach */}
                <div 
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl border"
                  style={{ 
                    backgroundColor: bannerColors?.bgTint || '#1e293b',
                    borderColor: bannerColors ? `${bannerColors.primary}30` : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="font-medium mb-1" style={{ color: bannerColors?.primaryContrast || '#10b981' }}>Actual Views</div>
                  <div>Unlike followers, reach shows how many</div>
                  <div>people actually see the content</div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>
              </div>
            )}

            <button 
              onClick={() => setActiveTab('connections')}
              className="text-center px-3 py-1 rounded-lg transition-all duration-200 group"
              style={{
                '--hover-bg': bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.05)',
              } as React.CSSProperties}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div 
                className="text-xl font-bold text-white transition-colors group-hover:text-opacity-100"
                style={{ '--hover-color': bannerColors?.primary } as React.CSSProperties}
              >{followerCount}</div>
              <div className="text-xs text-white/50 group-hover:text-white/70 transition-colors">Followers</div>
            </button>
            <button 
              onClick={() => setActiveTab('connections')}
              className="text-center px-3 py-1 rounded-lg transition-all duration-200 group"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div className="text-xl font-bold text-white group-hover:text-opacity-100 transition-colors">{followingCount}</div>
              <div className="text-xs text-white/50 group-hover:text-white/70 transition-colors">Following</div>
            </button>

            {/* Engagement rate badge - shows if followers are actually seeing content */}
            {profile.reach && followerCount > 0 && profile.reach.engagementRate > 0 && (
              <div className="text-center px-2 relative group">
                <div 
                  className="text-xl font-bold"
                  style={{ 
                    color: profile.reach.engagementRate >= 100 
                      ? (bannerColors?.primary || '#10b981')
                      : profile.reach.engagementRate >= 50 
                        ? (bannerColors?.secondary || '#eab308')
                        : (bannerColors?.accent || '#f97316')
                  }}
                >
                  {profile.reach.engagementRate >= 100 ? '100%+' : `${profile.reach.engagementRate}%`}
                </div>
                <div className="text-xs text-white/50">Engagement</div>
                <div 
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl border"
                  style={{ 
                    backgroundColor: bannerColors?.bgTint || '#1e293b',
                    borderColor: bannerColors ? `${bannerColors.primary}30` : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="font-medium mb-1">Views / Followers Ratio</div>
                  <div style={{ color: bannerColors?.primaryContrast || '#10b981' }}>100%+ = Great reach</div>
                  <div style={{ color: bannerColors?.secondaryLight || '#eab308' }}>50-99% = Good</div>
                  <div style={{ color: '#f97316' }}>&lt;50% = Low visibility</div>
                  <div 
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                    style={{ backgroundColor: bannerColors?.bgTint || '#1e293b' }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div 
          className="mt-8 border-t pt-6"
          style={{ borderColor: bannerColors ? `${bannerColors.primary}20` : 'rgba(255,255,255,0.1)' }}
        >
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList 
              className="bg-white/5 border"
              style={{ borderColor: bannerColors ? `${bannerColors.primary}25` : 'rgba(255,255,255,0.1)' }}
            >
              <TabsTrigger 
                value="posts" 
                className="data-[state=active]:bg-white/10 transition-colors"
                style={activeTab === 'posts' && bannerColors ? { 
                  backgroundColor: `${bannerColors.primary}20`,
                  color: bannerColors.primaryLight,
                } : undefined}
              >
                <FiGrid className="h-4 w-4 mr-2" />
                Posts
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="data-[state=active]:bg-white/10 transition-colors"
                style={activeTab === 'activity' && bannerColors ? { 
                  backgroundColor: `${bannerColors.primary}20`,
                  color: bannerColors.primaryLight,
                } : undefined}
              >
                <FiActivity className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
              <TabsTrigger 
                value="reach" 
                className="data-[state=active]:bg-white/10 transition-colors"
                style={activeTab === 'reach' && bannerColors ? { 
                  backgroundColor: `${bannerColors.primaryContrast}20`,
                  color: bannerColors.primaryContrast,
                } : undefined}
              >
                <FiTrendingUp className="h-4 w-4 mr-2" />
                Reach
              </TabsTrigger>
              <TabsTrigger 
                value="connections" 
                className="data-[state=active]:bg-white/10 transition-colors"
                style={activeTab === 'connections' && bannerColors ? { 
                  backgroundColor: `${bannerColors.primary}20`,
                  color: bannerColors.primaryLight,
                } : undefined}
              >
                <FiUsers className="h-4 w-4 mr-2" />
                Connections
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-6">
              {posts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
                  <FiGrid className="h-12 w-12 text-white/20 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No posts yet</h3>
                  <p className="text-white/50 text-sm">
                    {isOwnProfile ? 'Share your first post on Pulse!' : 'This user hasn\'t posted anything yet'}
                  </p>
                  {isOwnProfile && (
                    <Link href="/pulse">
                      <Button className="mt-4 bg-indigo-600 hover:bg-indigo-500">
                        Go to Pulse
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {posts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.05 }}
                    >
                      <Link
                        href={`/conversations/${post.id}`}
                        className="block rounded-xl border bg-white/[0.02] p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg group"
                        style={{
                          borderColor: bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.1)',
                          '--hover-border': bannerColors?.primary,
                          '--hover-bg': bannerColors ? `${bannerColors.primary}10` : 'rgba(255,255,255,0.05)',
                        } as React.CSSProperties}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = bannerColors ? `${bannerColors.primary}40` : 'rgba(255,255,255,0.2)';
                          e.currentTarget.style.backgroundColor = bannerColors ? `${bannerColors.primary}08` : 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.boxShadow = bannerColors ? `0 4px 20px ${bannerColors.primary}15` : 'none';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.1)';
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <h4 
                          className="font-medium text-white mb-2 transition-colors"
                          style={{ '--hover-color': bannerColors?.primaryLight } as React.CSSProperties}
                        >
                          {post.title || 'Untitled post'}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span>{post.messageCount} messages</span>
                          {post.viewCount && (
                            <span style={{ color: bannerColors?.primaryContrast ? `${bannerColors.primaryContrast}80` : undefined }}>
                              {post.viewCount} views
                            </span>
                          )}
                          <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                        </div>
                        {post.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {post.tags.slice(0, 3).map((tag) => (
                              <Badge 
                                key={tag} 
                                variant="secondary" 
                                className="text-xs text-white/60 transition-colors"
                                style={{ 
                                  backgroundColor: bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.05)',
                                }}
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              {activityPosts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
                  <FiActivity className="h-12 w-12 text-white/20 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No activity yet</h3>
                  <p className="text-white/50 text-sm">
                    {isOwnProfile ? 'Posts you comment on or interact with will appear here' : 'This user hasn\'t interacted with any posts yet'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activityPosts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.05 }}
                    >
                      <Link
                        href={`/conversations/${post.id}`}
                        className="block rounded-xl border bg-white/[0.02] p-4 transition-all duration-200 hover:scale-[1.01]"
                        style={{
                          borderColor: bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.1)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = bannerColors ? `${bannerColors.primary}40` : 'rgba(255,255,255,0.2)';
                          e.currentTarget.style.backgroundColor = bannerColors ? `${bannerColors.primary}08` : 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.boxShadow = bannerColors ? `0 4px 20px ${bannerColors.primary}15` : 'none';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.1)';
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div 
                          className="flex items-center gap-2 text-xs mb-2"
                          style={{ color: bannerColors?.primaryLight || '#60a5fa' }}
                        >
                          <FiMessageCircle className="h-3 w-3" />
                          <span>Commented on</span>
                        </div>
                        <h4 className="font-medium text-white mb-2">
                          {post.title || 'Untitled post'}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span>{post.messageCount} messages</span>
                          <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                        </div>
                        {post.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {post.tags.slice(0, 3).map((tag) => (
                              <Badge 
                                key={tag} 
                                variant="secondary" 
                                className="text-xs text-white/60"
                                style={{ backgroundColor: bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.05)' }}
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reach" className="mt-6">
              <div 
                className="rounded-2xl border bg-white/[0.02] p-6"
                style={{ borderColor: bannerColors ? `${bannerColors.primaryContrast}20` : 'rgba(255,255,255,0.1)' }}
              >
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FiTrendingUp 
                      className="h-5 w-5" 
                      style={{ color: bannerColors?.primaryContrast || '#10b981' }}
                    />
                    {isOwnProfile ? 'Your Reach Analytics' : `${profile?.name || 'User'}'s Reach`}
                  </h3>
                  <p className="text-sm text-white/50 mt-1">
                    Real engagement metrics that matter - not vanity follower counts
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Radar Chart - themed with contrast color */}
                  <div 
                    className="rounded-xl p-6"
                    style={{ backgroundColor: bannerColors ? `${bannerColors.primary}10` : 'rgba(255,255,255,0.05)' }}
                  >
                    <div className="max-w-[280px] mx-auto">
                      <Radar 
                        data={{
                          labels: ['Views', 'Unique Viewers', 'Engagement', 'Post Activity', 'Interaction'],
                          datasets: [{
                            label: 'Reach Score',
                            data: [
                              Math.min((profile?.reach?.totalViews || 0) / 10, 100),
                              Math.min((profile?.reach?.uniqueViewers || 0) / 5, 100),
                              Math.min((profile?.reach?.engagementRate || 0), 100),
                              Math.min(posts.length * 10, 100),
                              Math.min(activityPosts.length * 5, 100),
                            ],
                            backgroundColor: bannerColors ? `${bannerColors.primaryContrast}30` : 'rgba(16, 185, 129, 0.2)',
                            borderColor: bannerColors?.primaryContrast || 'rgba(16, 185, 129, 1)',
                            borderWidth: 2,
                            pointBackgroundColor: bannerColors?.primaryContrast || 'rgba(16, 185, 129, 1)',
                            pointBorderColor: '#fff',
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: bannerColors?.primaryContrast || 'rgba(16, 185, 129, 1)',
                          }],
                        }}
                        options={{
                          scales: {
                            r: {
                              angleLines: { color: bannerColors ? `${bannerColors.primaryContrast}40` : 'rgba(249, 115, 22, 0.25)' },
                              grid: { color: bannerColors ? `${bannerColors.primaryContrast}35` : 'rgba(249, 115, 22, 0.2)' },
                              pointLabels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 11 } },
                              ticks: { display: false },
                              suggestedMin: 0,
                              suggestedMax: 100,
                            },
                          },
                          plugins: { legend: { display: false } },
                          maintainAspectRatio: true,
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats Cards - themed with contrast colors */}
                  <div className="space-y-4">
                    <div 
                      className="rounded-xl p-4 border transition-all duration-200 hover:scale-[1.01]"
                      style={{
                        background: bannerColors 
                          ? `linear-gradient(135deg, ${bannerColors.primaryContrast}15, ${bannerColors.primaryContrast}05)`
                          : 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
                        borderColor: bannerColors ? `${bannerColors.primaryContrast}30` : 'rgba(16,185,129,0.2)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div 
                            className="text-3xl font-bold"
                            style={{ color: bannerColors?.primaryContrast || '#10b981' }}
                          >
                            {(profile?.reach?.totalViews || 0).toLocaleString()}
                          </div>
                          <div className="text-sm text-white/60">Total Views</div>
                        </div>
                        <div style={{ color: bannerColors ? `${bannerColors.primaryContrast}50` : 'rgba(16,185,129,0.4)' }}>
                          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-xs text-white/40 mt-2">People who actually saw the content</p>
                    </div>

                    <div 
                      className="rounded-xl p-4 border transition-all duration-200 hover:scale-[1.01]"
                      style={{
                        background: bannerColors 
                          ? `linear-gradient(135deg, ${bannerColors.primary}15, ${bannerColors.primary}05)`
                          : 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.05))',
                        borderColor: bannerColors ? `${bannerColors.primary}30` : 'rgba(59,130,246,0.2)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div 
                            className="text-3xl font-bold"
                            style={{ color: bannerColors?.primaryLight || '#60a5fa' }}
                          >
                            {(profile?.reach?.uniqueViewers || 0).toLocaleString()}
                          </div>
                          <div className="text-sm text-white/60">Unique Viewers</div>
                        </div>
                        <div style={{ color: bannerColors ? `${bannerColors.primary}50` : 'rgba(59,130,246,0.4)' }}>
                          <FiUsers className="h-10 w-10" />
                        </div>
                      </div>
                      <p className="text-xs text-white/40 mt-2">Individual people reached</p>
                    </div>

                    <div 
                      className="rounded-xl p-4 border transition-all duration-200 hover:scale-[1.01]"
                      style={{
                        background: bannerColors 
                          ? `linear-gradient(135deg, ${bannerColors.secondary}15, ${bannerColors.secondary}05)`
                          : 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.05))',
                        borderColor: bannerColors ? `${bannerColors.secondary}30` : 'rgba(139,92,246,0.2)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div 
                            className="text-3xl font-bold"
                            style={{ 
                              color: (profile?.reach?.engagementRate || 0) >= 100 
                                ? (bannerColors?.primaryContrast || '#10b981')
                                : (profile?.reach?.engagementRate || 0) >= 50 
                                  ? (bannerColors?.secondaryLight || '#fbbf24')
                                  : '#f97316'
                            }}
                          >
                            {(profile?.reach?.engagementRate || 0).toFixed(1)}%
                          </div>
                          <div className="text-sm text-white/60">Engagement Rate</div>
                        </div>
                        <div style={{ color: bannerColors ? `${bannerColors.secondary}50` : 'rgba(139,92,246,0.4)' }}>
                          <FiTrendingUp className="h-10 w-10" />
                        </div>
                      </div>
                      <p className="text-xs text-white/40 mt-2">Views ÷ Followers - shows real influence</p>
                    </div>

                    {/* Insight Card */}
                    <div 
                      className="rounded-xl p-4 border"
                      style={{
                        backgroundColor: bannerColors ? `${bannerColors.primary}08` : 'rgba(255,255,255,0.05)',
                        borderColor: bannerColors ? `${bannerColors.primary}15` : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <div className="text-sm font-medium text-white/80 mb-2">💡 What is Reach?</div>
                      <p className="text-xs text-white/50 leading-relaxed">
                        Unlike follower counts that can be inflated, <span style={{ color: bannerColors?.primaryContrast || '#10b981' }}>Reach</span> shows 
                        how many people <em>actually</em> see and engage with content. A user with 100 followers 
                        and 80% engagement is more influential than one with 1M followers and 0.1% engagement.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="connections" className="mt-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
                <FiUsers className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Connections</h3>
                <p className="text-white/50 text-sm">
                  {isOwnProfile ? 'Your followers and people you follow' : 'This user\'s connections'}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
