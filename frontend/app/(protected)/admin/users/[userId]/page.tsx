'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  FiUser, FiArrowLeft, FiSave, FiMail, FiCalendar, FiShield,
  FiCheckCircle, FiImage, FiCamera, FiX, FiLoader, FiBriefcase,
  FiPhone, FiGlobe, FiStar, FiAlertTriangle, FiEye
} from 'react-icons/fi';
import { FaDiscord, FaGithub, FaGoogle } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useEdgeStore } from '@/lib/edgestore';

interface UserDetail {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: string | null;
  image: string | null;
  banner: string | null;
  bio: string | null;
  role: 'OWNER' | 'ADMIN' | 'USER';
  verificationTier: string;
  verificationScore: number;
  createdAt: string;
  updatedAt: string;
  phoneNumber: string | null;
  phoneVerified: string | null;
  hasDiscordAuth: boolean;
  hasGithubAuth: boolean;
  hasGoogleAuth: boolean;
  hasVerifiedWallet: boolean;
  isTwoFactorEnabled: boolean;
  _count: {
    Company_Company_ownerIdToUser: number;
    Company_Company_creatorIdToUser: number;
    Employee: number;
    Order: number;
    Conversation: number;
    followers: number;
    following: number;
  };
  Company_Company_ownerIdToUser: Array<{
    id: string;
    name: string;
    logo: string[];
  }>;
  Employee: Array<{
    id: string;
    role: string;
    jobTitle: string | null;
    Company: {
      id: string;
      name: string;
      logo: string[];
    };
  }>;
}

export default function AdminUserEditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const { edgestore } = useEdgeStore();
  
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    role: 'USER' as 'OWNER' | 'ADMIN' | 'USER',
    verificationTier: 'ANONYMOUS',
    verificationScore: 0,
    image: '',
    banner: '',
  });
  const [reason, setReason] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  // Image upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Check auth
  useEffect(() => {
    if (status === 'loading') return;
    if (!session || (session.user?.role !== 'OWNER' && session.user?.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [session, status, router]);

  // Fetch user
  useEffect(() => {
    if (!userId || !session) return;
    
    async function fetchUser() {
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        if (!res.ok) throw new Error('Failed to fetch user');
        
        const data = await res.json();
        setUser(data.user);
        setFormData({
          name: data.user.name || '',
          email: data.user.email || '',
          bio: data.user.bio || '',
          role: data.user.role,
          verificationTier: data.user.verificationTier,
          verificationScore: data.user.verificationScore,
          image: data.user.image || '',
          banner: data.user.banner || '',
        });
      } catch (error) {
        toast.error('Failed to load user');
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUser();
  }, [userId, session]);

  // Track changes
  useEffect(() => {
    if (!user) return;
    const changed = 
      formData.name !== (user.name || '') ||
      formData.email !== (user.email || '') ||
      formData.bio !== (user.bio || '') ||
      formData.role !== user.role ||
      formData.verificationTier !== user.verificationTier ||
      formData.verificationScore !== user.verificationScore ||
      formData.image !== (user.image || '') ||
      formData.banner !== (user.banner || '');
    setHasChanges(changed);
  }, [formData, user]);

  const handleImageUpload = async (file: File, type: 'image' | 'banner') => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    if (type === 'image') setUploadingImage(true);
    else setUploadingBanner(true);

    try {
      const res = await edgestore.myPublicImages.upload({ file });
      setFormData(prev => ({ ...prev, [type]: res.url }));
      toast.success(`${type === 'image' ? 'Profile picture' : 'Banner'} uploaded successfully`);
    } catch (error) {
      toast.error(`Failed to upload ${type === 'image' ? 'profile picture' : 'banner'}`);
      console.error(error);
    } finally {
      if (type === 'image') setUploadingImage(false);
      else setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update user');
      }

      const data = await res.json();
      toast.success('User updated successfully');
      
      // Update local state
      setUser(prev => prev ? { ...prev, ...data.user } : null);
      setHasChanges(false);
      setReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleImpersonate = async () => {
    if (!confirm(`Swap to ${user?.name || user?.email}'s account? Your session will switch to view the site as this user. All actions are logged.`)) {
      return;
    }

    setImpersonating(true);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: userId,
          reason: `Admin swap from user detail page`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to start impersonation');
        return;
      }

      toast.success(data.message || 'Session swapped');

      // Navigate to home so the impersonated session takes effect
      router.push('/');
      router.refresh();
    } catch (error) {
      toast.error('Failed to start impersonation');
      console.error(error);
    } finally {
      setImpersonating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'ADMIN': return 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30';
      default: return 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/30';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <FiUser className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">User not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            <FiArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const isOwnProfile = session?.user?.id === userId;
  const canChangeRole = session?.user?.role === 'OWNER' && !isOwnProfile;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <FiArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Edit User
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {user.email || user.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Impersonate button — OWNER only, not on own profile */}
            {session?.user?.role === 'OWNER' && !isOwnProfile && (
              <Button
                onClick={handleImpersonate}
                disabled={impersonating}
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                title="View the site as this user"
              >
                {impersonating ? (
                  <FiLoader className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FiEye className="h-4 w-4 mr-2" />
                )}
                Swap Account
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
            {saving ? (
              <FiLoader className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FiSave className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
          </div>
        </div>

        {/* Banner & Avatar Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-6"
        >
          {/* Banner */}
          <div className="relative h-48 bg-linear-to-r from-emerald-500 to-teal-600">
            {formData.banner && (
              <img
                src={formData.banner}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/20" />
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file, 'banner');
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-4 right-4"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
            >
              {uploadingBanner ? (
                <FiLoader className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FiCamera className="h-4 w-4 mr-2" />
              )}
              Change Banner
            </Button>
            {formData.banner && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-4 right-36 h-8 w-8"
                onClick={() => setFormData(prev => ({ ...prev, banner: '' }))}
              >
                <FiX className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Avatar */}
          <div className="px-6 pb-6">
            <div className="flex items-end -mt-12 mb-6">
              <div className="relative">
                <Avatar className="h-24 w-24 ring-4 ring-white dark:ring-zinc-900">
                  <AvatarImage src={formData.image || undefined} />
                  <AvatarFallback className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-2xl">
                    {formData.name?.charAt(0) || user.email?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'image');
                  }}
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors"
                >
                  {uploadingImage ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <FiCamera className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", getRoleBadgeColor(user.role))}>
                    {user.role === 'OWNER' && <FiStar className="h-3 w-3 mr-1" />}
                    {user.role === 'ADMIN' && <FiShield className="h-3 w-3 mr-1" />}
                    {user.role}
                  </Badge>
                  {user.emailVerified && (
                    <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                      <FiCheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {user._count.followers}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Followers</div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {user._count.following}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Following</div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {user._count.Conversation}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Posts</div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {user._count.Order}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Orders</div>
              </div>
            </div>

            {/* Social Auth Indicators */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Connected:</span>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  user.hasGoogleAuth 
                    ? "bg-red-500/20 text-red-600" 
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                )}>
                  <FaGoogle className="h-4 w-4" />
                </div>
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  user.hasGithubAuth 
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" 
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                )}>
                  <FaGithub className="h-4 w-4" />
                </div>
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  user.hasDiscordAuth 
                    ? "bg-indigo-500/20 text-indigo-600" 
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                )}>
                  <FaDiscord className="h-4 w-4" />
                </div>
              </div>
              {user.hasVerifiedWallet && (
                <Badge variant="outline" className="text-xs">
                  <FiGlobe className="h-3 w-3 mr-1" />
                  Web3 Wallet
                </Badge>
              )}
              {user.isTwoFactorEnabled && (
                <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                  <FiShield className="h-3 w-3 mr-1" />
                  2FA Enabled
                </Badge>
              )}
            </div>
          </div>
        </motion.div>

        {/* Edit Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FiUser className="h-5 w-5" />
            User Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter email"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="User bio..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as 'OWNER' | 'ADMIN' | 'USER' }))}
                disabled={!canChangeRole}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                </SelectContent>
              </Select>
              {!canChangeRole && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isOwnProfile ? "Can't change your own role" : "Only OWNER can change roles"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="verificationTier">Verification Tier</Label>
              <Select
                value={formData.verificationTier}
                onValueChange={(value) => setFormData(prev => ({ ...prev, verificationTier: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANONYMOUS">Anonymous</SelectItem>
                  <SelectItem value="WEB2_BASIC">Web2 Basic</SelectItem>
                  <SelectItem value="WEB3_BASIC">Web3 Basic</SelectItem>
                  <SelectItem value="SOCIAL_BASIC">Social Basic</SelectItem>
                  <SelectItem value="SOCIAL_VERIFIED">Social Verified</SelectItem>
                  <SelectItem value="MULTI_SOCIAL">Multi Social</SelectItem>
                  <SelectItem value="PHONE_VERIFIED">Phone Verified</SelectItem>
                  <SelectItem value="FULLY_VERIFIED">Fully Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verificationScore">Verification Score</Label>
              <Input
                id="verificationScore"
                type="number"
                min={0}
                max={100}
                value={formData.verificationScore}
                onChange={(e) => setFormData(prev => ({ ...prev, verificationScore: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Profile Image URL</Label>
              <Input
                id="image"
                value={formData.image}
                onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Audit Reason */}
          {hasChanges && (
            <div className="space-y-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <Label htmlFor="reason" className="flex items-center gap-2">
                <FiAlertTriangle className="h-4 w-4 text-amber-500" />
                Reason for Changes (Optional)
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe why you're making these changes..."
                rows={2}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                This will be logged in the audit trail for accountability.
              </p>
            </div>
          )}

          {/* Meta Info */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Created:</span>
              <span className="ml-2 text-zinc-900 dark:text-zinc-100">
                {formatDate(user.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Last Updated:</span>
              <span className="ml-2 text-zinc-900 dark:text-zinc-100">
                {formatDate(user.updatedAt)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">User ID:</span>
              <code className="ml-2 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                {user.id}
              </code>
            </div>
            {user.phoneNumber && (
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Phone:</span>
                <span className="ml-2 text-zinc-900 dark:text-zinc-100">
                  {user.phoneNumber}
                  {user.phoneVerified && (
                    <FiCheckCircle className="inline h-3 w-3 ml-1 text-emerald-500" />
                  )}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Companies & Employments */}
        {(user.Company_Company_ownerIdToUser.length > 0 || user.Employee.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mt-6"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
              <FiBriefcase className="h-5 w-5" />
              Companies & Employments
            </h2>

            {user.Company_Company_ownerIdToUser.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Owns {user.Company_Company_ownerIdToUser.length} company(s)
                </h3>
                <div className="space-y-2">
                  {user.Company_Company_ownerIdToUser.map((company) => (
                    <div
                      key={company.id}
                      className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={company.logo?.[0]} />
                        <AvatarFallback>{company.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {company.name}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/companies/${company.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user.Employee.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Employee at {user.Employee.length} company(s)
                </h3>
                <div className="space-y-2">
                  {user.Employee.map((employment) => (
                    <div
                      key={employment.id}
                      className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={employment.Company.logo?.[0]} />
                        <AvatarFallback>{employment.Company.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {employment.Company.name}
                        </div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">
                          {employment.jobTitle || employment.role}
                        </div>
                      </div>
                      <Badge variant="outline">{employment.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
