'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFollowState } from '@/hooks/useFollowState';
import { CalendarDays, Users, ArrowLeftRight, RefreshCw, Shield } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useAccount, useChainId } from 'wagmi';
import { toast } from 'sonner';
import { VEGGA_SYSTEM } from '@/lib/vegga-system-constants';

interface UserHoverCardProps {
  userId: string;
  userName: string | null;
  userImage?: string | null;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

interface UserPreview {
  id: string;
  name: string | null;
  image: string | null;
  banner: string | null;
  bio: string | null;
  createdAt: string;
  _count: {
    followers: number;
    following: number;
  };
  isFollowing?: boolean;
}

export const UserHoverCard: React.FC<UserHoverCardProps> = ({
  userId,
  userName,
  userImage,
  children,
  side = 'bottom',
  align = 'start',
}) => {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const { isConnected: walletConnected } = useAccount();
  const chainId = useChainId();
  const followState = useFollowState();
  const [userPreview, setUserPreview] = useState<UserPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Get follow state from shared context, fallback to local preview data
  const globalFollowState = followState.isFollowing(userId);
  const isFollowing = globalFollowState !== undefined ? globalFollowState : (userPreview?.isFollowing ?? false);
  
  // Get follower count with adjustment from shared state
  const followerCountDelta = followState.getFollowerCountDelta(userId);
  const displayFollowerCount = (userPreview?._count?.followers ?? 0) + followerCountDelta;

  // Fetch user preview when hover card opens
  useEffect(() => {
    if (!isOpen || userPreview) return;

    const fetchUserPreview = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userId)}/preview`);
        if (res.ok) {
          const data = await res.json();
          setUserPreview(data);
          // Initialize follow state in shared context if not already set
          if (data.isFollowing !== undefined && globalFollowState === undefined) {
            followState.initializeFollowStates([{ id: userId, isFollowing: data.isFollowing }]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user preview:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPreview();
  }, [isOpen, userId, userPreview, followState, globalFollowState]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser || currentUser.id === userId) return;

    const newFollowState = !isFollowing;
    
    // Optimistic update via shared state
    followState.setFollowState(userId, newFollowState);

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST',
      });
      if (!res.ok) {
        // Revert on error
        followState.setFollowState(userId, isFollowing);
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
      // Revert on error
      followState.setFollowState(userId, isFollowing);
    }
  };

  const isOwnProfile = currentUser?.id === userId;

  return (
    <HoverCard openDelay={300} closeDelay={100} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Link
          href={`/profile/${userId}`}
          className="inline-flex items-center gap-2 hover:underline focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        className="w-80 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div>
            {/* Banner */}
            <div className="relative h-20 bg-linear-to-br from-primary/30 via-primary/20 to-muted">
              {userPreview?.banner && (
                <img
                  src={userPreview.banner}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </div>

            {/* Content with avatar overlapping banner */}
            <div className="relative px-4 pb-4">
              {/* Avatar + Follow button row */}
              <div className="flex items-end justify-between -mt-8 relative z-20">
                <Link href={`/profile/${userId}`} onClick={(e) => e.stopPropagation()} className="relative z-10">
                  <Avatar className="h-16 w-16 border-4 border-popover ring-0">
                    <AvatarImage src={userPreview?.image || userImage || undefined} />
                    <AvatarFallback className="text-xl">
                      {(userPreview?.name || userName)?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                {!isOwnProfile && currentUser && (
                  <div className="flex items-center gap-1.5 mb-1 relative z-30">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!walletConnected) {
                          toast.info('Connect your wallet to start a trade', {
                            description: 'Enable Web3 mode in settings and connect a wallet first.',
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
                          router.push(`/trade/${trade.id}`);
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : 'Trade failed');
                        }
                      }}
                      className="rounded-full h-8 px-2.5"
                      title="Start trade"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant={isFollowing ? 'outline' : 'default'}
                      onClick={handleFollow}
                      className="rounded-full"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFollowing ? '' : 'animate-none'}`} />
                      {isFollowing ? 'Synced' : 'Sync'}
                    </Button>
                  </div>
                )}

                {/* Take Control — OWNER only, for system account */}
                {currentUser?.role === 'OWNER' && !currentUser?.isImpersonating && userId === VEGGA_SYSTEM.id && (
                  <div className="flex justify-end -mt-1 mb-1 relative z-30">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                          const res = await fetch('/api/admin/impersonate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ targetUserId: VEGGA_SYSTEM.id, reason: 'Owner controlling system account' }),
                          });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            throw new Error(err.error ?? 'Failed to take control');
                          }
                          toast.success('Now controlling VeggaSystem. Refreshing…');
                          // Force full page reload to pick up new JWT
                          setTimeout(() => window.location.reload(), 500);
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : 'Take control failed');
                        }
                      }}
                      className="rounded-full h-7 px-2.5 text-[11px] border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      title="Take control of this system account"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Take Control
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-2 space-y-2">
                {/* Name */}
                <Link
                  href={`/profile/${userId}`}
                  className="font-semibold hover:underline block"
                  onClick={(e) => e.stopPropagation()}
                >
                  {userPreview?.name || userName || 'Anonymous'}
                </Link>

                {/* Bio */}
                {userPreview?.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {userPreview.bio}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{Math.max(0, displayFollowerCount)}</span>
                    <span className="text-muted-foreground">followers</span>
                  </div>
                  <div>
                    <span className="font-medium">{userPreview?._count?.following || 0}</span>
                    <span className="text-muted-foreground"> following</span>
                  </div>
                </div>

                {/* Joined date */}
                {userPreview?.createdAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    <span>
                      Joined {formatDistanceToNowStrict(new Date(userPreview.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};
