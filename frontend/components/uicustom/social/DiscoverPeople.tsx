'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Spinner from '@/components/uicustom/spinner';
import { FiSearch, FiUserPlus, FiUserCheck, FiUsers, FiTrendingUp } from 'react-icons/fi';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFollowState } from '@/hooks/useFollowState';
import { toast } from 'sonner';
import { UserHoverCard } from '@/components/uicustom/UserHoverCard';

interface SearchUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  bio: string | null;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  // "Reach" metrics - actual engagement, not vanity metrics
  reachScore?: number;
  totalViews?: number;
}

interface SuggestedUser extends SearchUser {
  reason?: string;
  priority?: number;
}

export function DiscoverPeople() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const followState = useFollowState();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const hasFetchedSuggestions = useRef(false);

  // Fetch suggested users on mount (only once)
  useEffect(() => {
    // Prevent multiple fetches
    if (hasFetchedSuggestions.current) return;
    
    const fetchSuggestions = async () => {
      if (!currentUser) {
        setIsLoadingSuggestions(false);
        return;
      }

      hasFetchedSuggestions.current = true;
      
      try {
        // Get user suggestions based on activity
        const res = await fetch('/api/users/suggestions?limit=5');
        if (res.ok) {
          const data = await res.json();
          const suggestions = data.suggestions || [];
          setSuggestedUsers(suggestions);
          
          // Initialize following state in shared context
          followState.initializeFollowStates(suggestions);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        hasFetchedSuggestions.current = false; // Allow retry on error
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]); // Only depend on user ID, not followState object

  // Search users with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          const users = (data.users || data || []).filter(
            (u: SearchUser) => u.id !== currentUser?.id
          );
          setSearchResults(users);
          
          // Initialize following state in shared context
          followState.initializeFollowStates(users);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, currentUser?.id]); // Don't include followState to prevent loops

  // Handle follow/unfollow - uses shared state
  const handleFollow = useCallback(async (userId: string, isCurrentlyFollowing: boolean) => {
    if (!currentUser) {
      toast.error('Please sign in to follow users');
      return;
    }

    const method = isCurrentlyFollowing ? 'DELETE' : 'POST';
    const newFollowState = !isCurrentlyFollowing;
    
    // Optimistic update via shared state
    followState.setFollowState(userId, newFollowState);

    try {
      const res = await fetch(`/api/users/${userId}/follow`, { method });
      if (!res.ok) {
        // Revert on error via shared state
        followState.setFollowState(userId, isCurrentlyFollowing);
        const data = await res.json();
        toast.error(data.error || 'Failed to update follow status');
      } else {
        toast.success(isCurrentlyFollowing ? 'Unfollowed' : 'Following!');
      }
    } catch (error) {
      // Revert on error via shared state
      followState.setFollowState(userId, isCurrentlyFollowing);
      toast.error('Failed to update follow status');
    }
  }, [currentUser, followState]);

  const displayUsers = searchQuery.length >= 2 ? searchResults : suggestedUsers;
  const isLoading = searchQuery.length >= 2 ? isSearching : isLoadingSuggestions;

  return (
    <div className="rounded-2xl border border-border/60 bg-slate-100/80 dark:bg-card/20 p-4 transition-colors hover:bg-slate-200/80 dark:hover:bg-card/30">
      <div className="font-semibold flex items-center gap-2 mb-3">
        <FiUsers className="h-4 w-4" />
        Discover People
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users..."
          className="pl-9 h-9 text-sm bg-background/30"
        />
      </div>

      {/* User List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="h-5 w-5" />
          </div>
        ) : displayUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            {searchQuery.length >= 2 ? 'No users found' : 'No suggestions yet'}
          </p>
        ) : (
          displayUsers.map((user) => {
            // Use shared follow state, falling back to API response
            const isFollowing = followState.isFollowing(user.id) ?? user.isFollowing;
            
            return (
              <div
                key={user.id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-background/40 transition-colors group"
              >
                {/* Avatar with HoverCard */}
                <UserHoverCard
                  userId={user.id}
                  userName={user.name}
                  userImage={user.image}
                  side="left"
                  align="start"
                >
                  <Avatar className="h-10 w-10 ring-2 ring-border/30 cursor-pointer">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-sm bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                      {user.name?.[0] || user.email?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                </UserHoverCard>
                
                <div className="flex-1 min-w-0">
                  {/* Name with HoverCard */}
                  <UserHoverCard
                    userId={user.id}
                    userName={user.name}
                    userImage={user.image}
                    side="left"
                    align="start"
                  >
                    <span className="font-medium text-sm truncate block cursor-pointer hover:underline">
                      {user.name || 'Anonymous'}
                    </span>
                  </UserHoverCard>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {/* Show reach/views instead of just followers - "reach over followers" philosophy */}
                    {user.totalViews !== undefined && user.totalViews > 0 ? (
                      <span className="flex items-center gap-1" title="Total post views">
                        <FiTrendingUp className="h-3 w-3" />
                        {user.totalViews.toLocaleString()} reach
                      </span>
                    ) : user.followerCount !== undefined ? (
                      <span>{user.followerCount} followers</span>
                    ) : null}
                  </div>
                </div>

                {currentUser && user.id !== currentUser.id && (
                  <Button
                    size="sm"
                    variant={isFollowing ? 'outline' : 'default'}
                    className="h-8 px-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFollow(user.id, !!isFollowing);
                    }}
                  >
                    {isFollowing ? (
                      <FiUserCheck className="h-4 w-4" />
                    ) : (
                      <FiUserPlus className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* View All Link */}
      {displayUsers.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-muted-foreground"
          onClick={() => router.push('/users')}
        >
          View all users
        </Button>
      )}
    </div>
  );
}
