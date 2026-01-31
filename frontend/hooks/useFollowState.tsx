'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface FollowEvent {
  userId: string;
  isFollowing: boolean;
  followerCountDelta: number; // +1 or -1
}

interface FollowStateContextType {
  // Check if current user is following a specific user
  isFollowing: (userId: string) => boolean | undefined;
  // Get follower count adjustment for a user (for optimistic updates)
  getFollowerCountDelta: (userId: string) => number;
  // Update follow state (called after successful follow/unfollow)
  setFollowState: (userId: string, following: boolean) => void;
  // Subscribe to follow changes
  subscribeToChanges: (callback: (event: FollowEvent) => void) => () => void;
  // Initialize follow states from API response
  initializeFollowStates: (users: Array<{ id: string; isFollowing?: boolean }>) => void;
}

const FollowStateContext = createContext<FollowStateContextType | null>(null);

export function FollowStateProvider({ children }: { children: React.ReactNode }) {
  // Map of userId -> isFollowing
  const [followStates, setFollowStates] = useState<Map<string, boolean>>(new Map());
  // Map of userId -> follower count delta (adjustment from initial state)
  const [followerDeltas, setFollowerDeltas] = useState<Map<string, number>>(new Map());
  // Subscribers for follow changes
  const [subscribers] = useState<Set<(event: FollowEvent) => void>>(new Set());

  const isFollowing = useCallback((userId: string): boolean | undefined => {
    return followStates.get(userId);
  }, [followStates]);

  const getFollowerCountDelta = useCallback((userId: string): number => {
    return followerDeltas.get(userId) ?? 0;
  }, [followerDeltas]);

  const setFollowState = useCallback((userId: string, following: boolean) => {
    setFollowStates(prev => {
      const newMap = new Map(prev);
      const wasFollowing = prev.get(userId);
      newMap.set(userId, following);
      return newMap;
    });

    // Calculate delta change
    setFollowerDeltas(prev => {
      const newMap = new Map(prev);
      const currentDelta = prev.get(userId) ?? 0;
      const wasFollowing = followStates.get(userId);
      
      // Only adjust if state actually changed
      if (wasFollowing !== following) {
        const change = following ? 1 : -1;
        newMap.set(userId, currentDelta + change);
      }
      return newMap;
    });

    // Notify subscribers
    const event: FollowEvent = {
      userId,
      isFollowing: following,
      followerCountDelta: following ? 1 : -1,
    };
    subscribers.forEach(callback => callback(event));
  }, [followStates, subscribers]);

  const subscribeToChanges = useCallback((callback: (event: FollowEvent) => void) => {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  }, [subscribers]);

  const initializeFollowStates = useCallback((users: Array<{ id: string; isFollowing?: boolean }>) => {
    setFollowStates(prev => {
      const newMap = new Map(prev);
      users.forEach(user => {
        // Only set if not already set (don't override user actions)
        if (!newMap.has(user.id) && user.isFollowing !== undefined) {
          newMap.set(user.id, user.isFollowing);
        }
      });
      return newMap;
    });
  }, []);

  const value = useMemo(() => ({
    isFollowing,
    getFollowerCountDelta,
    setFollowState,
    subscribeToChanges,
    initializeFollowStates,
  }), [isFollowing, getFollowerCountDelta, setFollowState, subscribeToChanges, initializeFollowStates]);

  return (
    <FollowStateContext.Provider value={value}>
      {children}
    </FollowStateContext.Provider>
  );
}

export function useFollowState() {
  const context = useContext(FollowStateContext);
  if (!context) {
    throw new Error('useFollowState must be used within a FollowStateProvider');
  }
  return context;
}

// Optional hook that doesn't throw if used outside provider
export function useFollowStateOptional() {
  return useContext(FollowStateContext);
}
