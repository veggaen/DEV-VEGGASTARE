'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import Spinner from '@/components/uicustom/spinner';
import { useCurrentUser } from '@/hooks/use-current-user';
import { UseCurrentRole } from '@/hooks/use-current-role';
import { useViewTracking } from '@/hooks/useViewTracking';
import usePusher from '@/hooks/usePusher';
import { FiSend, FiBarChart2, FiTrendingUp, FiMessageCircle, FiPlus, FiX, FiHash, FiGlobe, FiUsers, FiLock, FiChevronDown, FiRepeat, FiEdit3, FiEyeOff, FiEdit2, FiTrash2, FiRefreshCw, FiFilter } from 'react-icons/fi';
import { Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PulseHeart, PulseFlat, PulsePositive } from '@/components/uicustom/icons/PulseIcons';
import { pulseLabels } from '@/lib/pulse-labels';
import { formatDistanceToNowStrict } from 'date-fns';
import { PollDisplay } from '@/components/uicustom/chats/poll-display';
import { DiscoverPeople } from '@/components/uicustom/social/DiscoverPeople';
import { PulseDetailModal } from '@/components/uicustom/pulse/PulseDetailModal';
import RichTextContent from '@/components/uicustom/pulse/RichTextContent';
import { UserHoverCard } from '@/components/uicustom/UserHoverCard';
import { PollBuilder } from '@/components/uicustom/polls/PollBuilder';
import { PulsePollCard, type PulsePollData } from '@/components/uicustom/polls/PulsePollCard';
import { PollTakerModal } from '@/components/uicustom/polls/PollTakerModal';
import { ReachPollV3 } from '@/components/uicustom/polls/ReachPollV3';
import { Zap, Target, Rocket, PlayCircle, Copy, FileUp, Download, Sparkles, Check } from 'lucide-react';
import { PollImportModal } from '@/components/uicustom/polls/PollImportModal';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

interface FeedItem {
  id: string;
  title: string;
  description?: string;
  type: 'PUBLIC_THREAD';
  tags: string[];
  user: User;
  userId: string;
  createdAt: string;
  editedAt?: string | null;
  viewCount?: number;
  uniqueViewCount?: number;
  replyCount?: number;
  messageCount: number;
  repostCount?: number;
  quoteRepostCount?: number;
  hasReposted?: boolean;
  positivePulseCount?: number;
  negativePulseCount?: number;
  userPulse?: 'POSITIVE' | 'NEGATIVE' | null;
  repostOfConversation?: {
    id: string;
    title: string | null;
    createdAt: string;
    user: { id: string; name: string | null; image?: string | null };
  } | null;
  repostOfLastMessage?: { content: string; createdAt: string } | null;
  hasPoll?: boolean;
  poll?: { id: string; question?: string } | null;
  advancedPoll?: {
    id: string;
    title: string;
    description?: string | null;
    type: string;
    totalResponses: number;
    avgCompletionPct: number;
  } | null;
  lastMessage?: { content: string; createdAt: string } | null;
  // Pin status
  pinnedToFeed?: boolean;
  pinnedToProfile?: boolean;
}

const getReplyCount = (messageCount?: number | null) => Math.max(0, (messageCount || 0) - 1);

// ─────────────────────────────────────────────────────────────────────────────
// FILTER & SORT TYPES
// Filter: what TYPE of content to show (can be combined!)
// Sort: how to ORDER that content
// ─────────────────────────────────────────────────────────────────────────────

// Main content type filter
type ContentFilter = 'all' | 'pulses' | 'polls' | 'trending';
type PostVisibility = 'PUBLIC' | 'PARTICIPANTS' | 'ROLE_BASED';
type ReplyPermission = 'EVERYONE' | 'PARTICIPANTS' | 'MENTIONED' | 'MODS_ONLY' | 'CREATOR_ONLY';

// Visibility options for the feed (simplified for quick posting)
const VISIBILITY_OPTIONS: { value: PostVisibility; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'PUBLIC', label: 'Public', icon: <FiGlobe className="h-4 w-4" />, description: 'Anyone can see this post' },
  { value: 'PARTICIPANTS', label: 'Friends Only', icon: <FiUsers className="h-4 w-4" />, description: 'Only your friends can see' },
  { value: 'ROLE_BASED', label: 'Restricted', icon: <FiLock className="h-4 w-4" />, description: 'Only specific roles can see' },
];

// Reply permission options
const REPLY_OPTIONS: { value: ReplyPermission; label: string; description: string }[] = [
  { value: 'EVERYONE', label: 'Everyone', description: 'Anyone who can see can reply' },
  { value: 'PARTICIPANTS', label: 'Friends Only', description: 'Only friends can reply' },
  { value: 'MENTIONED', label: 'Tagged Only', description: 'Only tagged/mentioned users can reply' },
  { value: 'MODS_ONLY', label: 'Mods Only', description: 'Only moderators can reply' },
  { value: 'CREATOR_ONLY', label: 'No Comments', description: 'Only you can post (announcement)' },
];

// Sort options for feed - how to order content
type SortType = 'recent' | 'popular' | 'discussed' | 'reach';
const SORT_OPTIONS: { value: SortType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'recent', label: 'Latest', icon: <FiRefreshCw className="h-4 w-4" />, description: 'Newest first' },
  { value: 'popular', label: 'Most Heartbeats', icon: <PulseHeart className="h-4 w-4" />, description: 'Most loved' },
  { value: 'discussed', label: 'Most Discussed', icon: <FiMessageCircle className="h-4 w-4" />, description: 'Most comments' },
  { value: 'reach', label: 'Top Reach', icon: <Target className="h-4 w-4" />, description: 'Highest reach score' },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING ALGORITHM
// Calculates a "trending score" based on:
// - Engagement velocity (engagement per hour since creation)
// - Recency boost (newer content gets a boost)
// - Engagement diversity (comments + heartbeats + repulses)
// ─────────────────────────────────────────────────────────────────────────────

function calculateTrendingScore(item: FeedItem): number {
  const now = Date.now();
  const createdAt = new Date(item.createdAt).getTime();
  const ageHours = Math.max(0.5, (now - createdAt) / (1000 * 60 * 60));
  
  // Engagement signals
  const views = item.uniqueViewCount || 0;
  const comments = getReplyCount(item.messageCount);
  const heartbeats = item.positivePulseCount || 0;
  const repulses = item.repostCount || 0;
  
  // ─────────────────────────────────────────────────────────────────────────
  // WEIGHTED ENGAGEMENT SCORE (user-specified weights)
  // Views: 40%, Comments: 30%, Heartbeats: 20%, Repulses: 10%
  // ─────────────────────────────────────────────────────────────────────────
  const normalizedViews = Math.min(views, 1000) / 100;       // Cap at 1000, scale to 0-10
  const normalizedComments = Math.min(comments, 100) / 10;   // Cap at 100, scale to 0-10
  const normalizedHeartbeats = Math.min(heartbeats, 500) / 50; // Cap at 500, scale to 0-10
  const normalizedRepulses = Math.min(repulses, 100) / 10;   // Cap at 100, scale to 0-10
  
  const engagementScore = 
    (normalizedViews * 0.40) +      // 40% weight
    (normalizedComments * 0.30) +   // 30% weight
    (normalizedHeartbeats * 0.20) + // 20% weight
    (normalizedRepulses * 0.10);    // 10% weight
  
  // Velocity = engagement per hour (how fast it's gaining traction)
  const velocity = engagementScore / Math.sqrt(ageHours); // Use sqrt for gentler decay
  
  // Recency boost (newer content gets prioritized)
  const recencyBoost = 
    ageHours < 1 ? 2.0 :
    ageHours < 3 ? 1.7 :
    ageHours < 6 ? 1.4 :
    ageHours < 12 ? 1.2 :
    ageHours < 24 ? 1.0 :
    ageHours < 48 ? 0.8 :
    0.6;
  
  // Base score for any content (ensures even 0-engagement content has a score)
  const baseScore = 0.1;
  
  // Final trending score
  return baseScore + (velocity * recencyBoost);
}

const FeedPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useCurrentUser();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Feed state
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContentFilter>('all');
  const [sortBy, setSortBy] = useState<SortType>('recent');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  
  // Cursor-based pagination state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 25;
  
  // Real-time new pulses state
  const [newPulsesCount, setNewPulsesCount] = useState(0);
  const [isLoadingNew, setIsLoadingNew] = useState(false);
  const latestPulseId = useRef<string | null>(null);

  // Modal state - read from URL for shareable links
  const [selectedPulseId, setSelectedPulseId] = useState<string | null>(null);

  // Sync filter and modal state with URL for shareable links
  useEffect(() => {
    const pulseParam = searchParams.get('pulse');
    setSelectedPulseId(pulseParam);
    
    // Check for filter param (?filter=polls or ?filter=pulses makes link shareable)
    const filterParam = searchParams.get('filter') as ContentFilter | null;
    if (filterParam && ['all', 'pulses', 'polls', 'trending'].includes(filterParam)) {
      setFilter(filterParam);
    }
    
    // Check for sort param
    const sortParam = searchParams.get('sort') as SortType | null;
    if (sortParam && ['recent', 'popular', 'discussed', 'reach'].includes(sortParam)) {
      setSortBy(sortParam);
    }
    
    // Check for poll param (?poll=ID opens poll taker modal)
    // But don't reopen if we just closed (prevents race with close action)
    const pollParam = searchParams.get('poll');
    if (pollParam && !justClosedPoll.current) {
      setSelectedAdvancedPollId(pollParam);
      lastOpenedPollId.current = pollParam; // Track for mouse nav
      // Don't change filter - user should stay on whatever feed they were viewing
    }
  }, [searchParams]);

  // Handle browser back/forward navigation (popstate) to sync filter state with URL
  // This is needed because searchParams doesn't react to pushState/popstate
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);
      
      // Sync filter
      const filterParam = url.searchParams.get('filter') as ContentFilter | null;
      if (filterParam && ['all', 'pulses', 'polls', 'trending'].includes(filterParam)) {
        setFilter(filterParam);
      } else {
        setFilter('all'); // Default to 'all' if no filter param
      }
      
      // Sync sort
      const sortParam = url.searchParams.get('sort') as SortType | null;
      if (sortParam && ['recent', 'popular', 'discussed', 'reach'].includes(sortParam)) {
        setSortBy(sortParam);
      } else {
        setSortBy('recent'); // Default to 'recent' if no sort param
      }
      
      // Sync pulse modal
      const pulseParam = url.searchParams.get('pulse');
      setSelectedPulseId(pulseParam);
      
      // Sync poll modal (but respect justClosedPoll flag)
      const pollParam = url.searchParams.get('poll');
      if (pollParam && !justClosedPoll.current) {
        setSelectedAdvancedPollId(pollParam);
      } else if (!pollParam) {
        setSelectedAdvancedPollId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Change filter with URL update for shareable links
  const changeFilter = (newFilter: ContentFilter) => {
    setFilter(newFilter);
    
    // Clear poll composer state when navigating away from polls filter
    // This ensures the poll being composed doesn't persist across filter changes
    setIncludePoll(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollBuilder(false);
    
    // Update URL for shareable links (e.g. /pulse?filter=polls)
    const url = new URL(window.location.href);
    if (newFilter === 'all') {
      url.searchParams.delete('filter');
    } else {
      url.searchParams.set('filter', newFilter);
    }
    window.history.pushState({}, '', url.toString());
  };

  const changeSort = (newSort: SortType) => {
    setSortBy(newSort);
    // Update URL for shareable links (e.g. /pulse?sort=trending)
    const url = new URL(window.location.href);
    if (newSort === 'recent') {
      url.searchParams.delete('sort');
    } else {
      url.searchParams.set('sort', newSort);
    }
    window.history.pushState({}, '', url.toString());
  };

  // Compose state
  const [composeText, setComposeText] = useState('');
  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Visibility & permissions state
  const [visibility, setVisibility] = useState<PostVisibility>('PUBLIC');
  const [replyPermission, setReplyPermission] = useState<ReplyPermission>('EVERYONE');

  // Poll builder modal state
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [showPollImport, setShowPollImport] = useState(false);
  const [pollJsonPreview, setPollJsonPreview] = useState<string | null>(null);
  
  // Pending advanced poll (created but not yet pulsed)
  const [pendingAdvancedPoll, setPendingAdvancedPoll] = useState<{
    id: string;
    title: string;
    description?: string;
    type: string;
    questionCount: number;
  } | null>(null);

  // Advanced polls state (for "Polls" filter)
  const [advancedPolls, setAdvancedPolls] = useState<PulsePollData[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [selectedAdvancedPollId, setSelectedAdvancedPollId] = useState<string | null>(null);
  
  // Track last opened pulse/poll for mouse navigation
  const lastOpenedPulseId = useRef<string | null>(null);
  const lastOpenedPollId = useRef<string | null>(null);
  // Flag to prevent immediate reopen after closing
  const justClosedPoll = useRef(false);

  // Open pulse modal
  const openPulse = useCallback((pulseId: string) => {
    setSelectedPulseId(pulseId);
    lastOpenedPulseId.current = pulseId;
    const url = new URL(window.location.href);
    url.searchParams.set('pulse', pulseId);
    window.history.pushState({}, '', url.toString());
  }, []);

  // Close pulse modal
  const closePulse = useCallback(() => {
    setSelectedPulseId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('pulse');
    window.history.pushState({}, '', url.toString());
  }, []);

  // Open poll modal
  const openPoll = useCallback((pollId: string) => {
    setSelectedAdvancedPollId(pollId);
    lastOpenedPollId.current = pollId;
    const url = new URL(window.location.href);
    url.searchParams.set('poll', pollId);
    window.history.pushState({}, '', url.toString());
  }, []);

  // Close poll modal
  const closePoll = useCallback(() => {
    setSelectedAdvancedPollId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('poll');
    window.history.replaceState({}, '', url.toString());
    // Prevent immediate reopen from mouse handler
    justClosedPoll.current = true;
    setTimeout(() => {
      justClosedPoll.current = false;
    }, 200);
  }, []);

  // ─── Mouse Button Navigation (Mouse 3 = Back, Mouse 4 = Forward) ────────────
  useEffect(() => {
    const handleMouseButton = (event: MouseEvent) => {
      // Only handle if no poll modal is open (poll has its own mouse handling)
      // Also skip if we just closed a poll (prevents race conditions)
      if (selectedAdvancedPollId || justClosedPoll.current) return;
      
      // Back button (button 3) - close any open modal
      if (event.button === 3) {
        if (selectedPulseId) {
          event.preventDefault();
          event.stopPropagation();
          closePulse();
        }
      }
      // Forward button (button 4) - reopen last closed modal
      else if (event.button === 4) {
        // If nothing is open, try to reopen last opened
        if (!selectedPulseId && !selectedAdvancedPollId) {
          event.preventDefault();
          event.stopPropagation();
          
          // Prefer reopening poll if it was last opened, otherwise pulse
          if (lastOpenedPollId.current) {
            openPoll(lastOpenedPollId.current);
          } else if (lastOpenedPulseId.current) {
            openPulse(lastOpenedPulseId.current);
          }
        }
      }
    };

    window.addEventListener("mousedown", handleMouseButton);
    
    return () => {
      window.removeEventListener("mousedown", handleMouseButton);
    };
  }, [selectedPulseId, selectedAdvancedPollId, closePulse, openPoll, openPulse]);
  
  // Check if selected poll is REACH Assessment (use V2 UI)
  // First try to find in advancedPolls, then check feed items
  const selectedPoll = advancedPolls.find(p => p.id === selectedAdvancedPollId);
  const selectedItemPoll = items.find(i => i.advancedPoll?.id === selectedAdvancedPollId)?.advancedPoll;
  const isReachAuditPoll = selectedPoll?.type === 'REACH_ASSESSMENT' || 
    selectedPoll?.title?.toLowerCase().includes('reach') ||
    selectedItemPoll?.type === 'REACH_ASSESSMENT' ||
    selectedItemPoll?.title?.toLowerCase().includes('reach');

  // Fetch advanced polls when filter is 'polls'
  useEffect(() => {
    if (filter === 'polls') {
      const fetchPolls = async () => {
        setLoadingPolls(true);
        try {
          const res = await fetch('/api/advanced-polls?pageSize=20');
          const data = await res.json();
          setAdvancedPolls(data.polls?.map((p: any) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            type: p.type,
            creator: p.Creator || { id: p.creatorId, name: 'Unknown', image: null },
            questionCount: p.questions?.length || 0,
            totalResponses: p.totalResponses || 0,
            avgCompletionPct: p.avgCompletionPct || 0,
            publishedAt: p.publishedAt,
            expiresAt: p.expiresAt,
            conversationId: p.conversationId,
          })) || []);
        } catch (err) {
          console.error('Failed to fetch polls:', err);
        } finally {
          setLoadingPolls(false);
        }
      };
      fetchPolls();
    }
  }, [filter]);

  // Fetch feed items (supports cursor pagination)
  const fetchFeed = useCallback(async (resetNewCount = true, cursor?: string) => {
    const isFirstPage = !cursor;
    if (isFirstPage) {
      setLoading(true);
    } else {
      setIsFetchingMore(true);
    }
    
    try {
      // Map client sort to API sort param (server handles sorting)
      const apiSort = sortBy === 'popular' ? 'popular'
        : sortBy === 'discussed' ? 'discussed'
        : sortBy === 'reach' ? 'reach'
        : 'recent';
      
      let url = `/api/conversations?filter=public&sort=${apiSort}&limit=${PAGE_SIZE}`;
      if (tagFilter) {
        url += `&tag=${encodeURIComponent(tagFilter)}`;
      }
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      let feedItems = (data.conversations || []) as FeedItem[];
      const serverCursor = data.nextCursor || null;
      
      // ─────────────────────────────────────────────────────────────────────────
      // CLIENT-SIDE CONTENT TYPE FILTER (poll vs pulse distinction is client-side)
      // ─────────────────────────────────────────────────────────────────────────
      if (filter === 'polls') {
        feedItems = feedItems.filter(item => item.hasPoll);
      } else if (filter === 'pulses') {
        feedItems = feedItems.filter(item => !item.hasPoll);
      } else if (filter === 'trending') {
        feedItems = [...feedItems].sort((a, b) => calculateTrendingScore(b) - calculateTrendingScore(a));
      }
      // 'all' shows everything — server already sorted
      
      if (isFirstPage) {
        setItems(feedItems);
      } else {
        setItems(prev => [...prev, ...feedItems]);
      }
      
      // Update pagination state
      setNextCursor(serverCursor);
      setHasMore(serverCursor !== null);
      
      // Track latest pulse ID for new pulse detection
      if (isFirstPage && feedItems.length > 0) {
        latestPulseId.current = feedItems[0].id;
      }
      
      // Reset new pulses count
      if (resetNewCount) {
        setNewPulsesCount(0);
      }
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
      setIsLoadingNew(false);
    }
  }, [filter, sortBy, tagFilter]);

  // Load more items (next page)
  const loadMore = useCallback(() => {
    if (isFetchingMore || !hasMore || !nextCursor) return;
    fetchFeed(false, nextCursor);
  }, [fetchFeed, isFetchingMore, hasMore, nextCursor]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '400px' } // Pre-fetch 400px before visible
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);
  
  // Subscribe to real-time new pulse events
  usePusher<{ conversationId: string; userId: string }>(
    'public-pulse-feed',
    'new-pulse',
    useCallback((data) => {
      // Only count if it's a new pulse (not from current user)
      if (data.conversationId !== latestPulseId.current) {
        setNewPulsesCount(prev => prev + 1);
      }
    }, [])
  );
  
  // Load new pulses handler
  const loadNewPulses = useCallback(async () => {
    setIsLoadingNew(true);
    setNextCursor(null);
    setHasMore(true);
    await fetchFeed(true);
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchFeed]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }, [items]);

  const topPosts = useMemo(() => {
    return [...items]
      .sort((a, b) => {
        const aViews = a.uniqueViewCount || 0;
        const bViews = b.uniqueViewCount || 0;
        if (bViews !== aViews) return bViews - aViews;

        const aReplies = getReplyCount(a.messageCount);
        const bReplies = getReplyCount(b.messageCount);
        return bReplies - aReplies;
      })
      .slice(0, 5);
  }, [items]);

  // Handle post submission
  const handlePost = async () => {
    // Allow submission with pending advanced poll even without text
    if (!composeText.trim() && !pollQuestion.trim() && !pendingAdvancedPoll) return;

    setIsSubmitting(true);
    try {
      // Create conversation
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PUBLIC_THREAD',
          visibility,
          replyPermission,
          initialMessage: composeText.trim() || (pendingAdvancedPoll ? `📊 ${pendingAdvancedPoll.title}` : undefined),
          pollQuestion: includePoll && pollQuestion.trim() ? pollQuestion.trim() : undefined,
          advancedPollId: pendingAdvancedPoll?.id, // Link the pending advanced poll
          tags,
        }),
      });

      if (!res.ok) throw new Error('Failed to create post');
      
      const data = await res.json();
      const conversationId = data.id;

      // Create quick poll if included (not for advanced polls)
      if (includePoll && pollQuestion.trim() && !pendingAdvancedPoll) {
        const validOptions = pollOptions.filter(opt => opt.trim());
        if (validOptions.length >= 2) {
          await fetch('/api/polls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId,
              question: pollQuestion.trim(),
              options: validOptions,
              allowMultiple: false,
              isAnonymous: false,
            }),
          });
        }
      }

      // Link the advanced poll to this conversation if pending
      if (pendingAdvancedPoll) {
        await fetch(`/api/advanced-polls/${pendingAdvancedPoll.id}/link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId }),
        });
      }

      // Reset form
      setComposeText('');
      setIncludePoll(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPendingAdvancedPoll(null);
      setTags([]);
      setShowTagInput(false);
      setVisibility('PUBLIC');
      setReplyPermission('EVERYONE');

      // Refresh feed
      fetchFeed();
    } catch (error) {
      console.error('Failed to post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 sm:px-6 lg:px-8">
      {/* ─── Flow Sub-navbar ─── */}
      <div className="border-b border-border/50 mb-5">
        <div className="flex items-center gap-3 h-11">
          {/* Brand link - "Flow" goes to /pulse (shows all content) */}
          <Link
            href="/pulse"
            onClick={() => {
              changeFilter('all');
              changeSort('recent');
            }}
            className="text-sm font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent hover:from-emerald-400 hover:to-cyan-400 transition-all shrink-0 flex items-center gap-1.5"
          >
            <Zap className="h-4 w-4 text-emerald-500" />
            Flow
          </Link>
          
          <div className="h-4 w-px bg-border/60" />
          
          {/* Content Type Filters */}
          <div className="flex items-center gap-1">
            <Button
              variant={filter === 'pulses' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => changeFilter('pulses')}
              className="h-8"
              title="Only regular pulses (no polls)"
            >
              <PulseHeart className="h-4 w-4 mr-1" /> Pulse
            </Button>
            <Button
              variant={filter === 'polls' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => changeFilter('polls')}
              className="h-8"
              title="Only polls and surveys"
            >
              <FiBarChart2 className="h-4 w-4 mr-1" /> Polls
            </Button>
            <Button
              variant={filter === 'trending' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => changeFilter('trending')}
              className="h-8"
              title="Trending content"
            >
              <FiTrendingUp className="h-4 w-4 mr-1" /> Trending
            </Button>
          </div>

          <div className="h-4 w-px bg-border/60" />
          
          {/* Filters dropdown with sort and additional options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                <FiFilter className="h-4 w-4" />
                <span className="hidden sm:inline">Filters</span>
                {sortBy !== 'recent' && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
                  </Badge>
                )}
                <FiChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {/* Sort options */}
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
                Sort by
              </DropdownMenuLabel>
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => changeSort(option.value)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    sortBy === option.value && 'bg-accent'
                  )}
                >
                  {option.icon}
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </div>
                  {sortBy === option.value && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
              
              <DropdownMenuSeparator />
              
              {/* Content type quick filters */}
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
                Content Type
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => changeFilter('all')}
                className={cn("cursor-pointer", filter === 'all' && 'bg-accent')}
              >
                <FiGlobe className="h-4 w-4 mr-2" />
                <span>All Content</span>
                {filter === 'all' && <Check className="h-4 w-4 ml-auto text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => changeFilter('pulses')}
                className={cn("cursor-pointer", filter === 'pulses' && 'bg-accent')}
              >
                <PulseHeart className="h-4 w-4 mr-2" />
                <span>Pulses Only</span>
                {filter === 'pulses' && <Check className="h-4 w-4 ml-auto text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => changeFilter('polls')}
                className={cn("cursor-pointer", filter === 'polls' && 'bg-accent')}
              >
                <FiBarChart2 className="h-4 w-4 mr-2" />
                <span>Polls Only</span>
                {filter === 'polls' && <Check className="h-4 w-4 ml-auto text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => changeFilter('trending')}
                className={cn("cursor-pointer", filter === 'trending' && 'bg-accent')}
              >
                <FiTrendingUp className="h-4 w-4 mr-2" />
                <span>Trending Only</span>
                {filter === 'trending' && <Check className="h-4 w-4 ml-auto text-primary" />}
              </DropdownMenuItem>
              
              {/* Clear all filters */}
              {(filter !== 'all' || sortBy !== 'recent' || tagFilter) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      changeFilter('all');
                      changeSort('recent');
                      setTagFilter(null);
                    }}
                    className="text-muted-foreground cursor-pointer"
                  >
                    <FiX className="h-4 w-4 mr-2" />
                    <span>Clear All Filters</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Active filter badges */}
          <div className="flex items-center gap-2 ml-auto">
            {filter !== 'all' && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                {filter === 'pulses' && <><PulseHeart className="h-3 w-3" /> Pulses</>}
                {filter === 'polls' && <><FiBarChart2 className="h-3 w-3" /> Polls</>}
                {filter === 'trending' && <><FiTrendingUp className="h-3 w-3" /> Trending</>}
                <button onClick={() => changeFilter('all')} className="ml-1 hover:text-destructive">
                  <FiX className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {sortBy !== 'recent' && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                {SORT_OPTIONS.find(s => s.value === sortBy)?.icon}
                <span className="ml-1">{SORT_OPTIONS.find(s => s.value === sortBy)?.label}</span>
                <button onClick={() => changeSort('recent')} className="ml-1 hover:text-destructive">
                  <FiX className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {tagFilter && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                #{tagFilter}
                <button onClick={() => setTagFilter(null)} className="ml-1 hover:text-destructive">
                  <FiX className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* New pulses banner */}
      <AnimatePresence>
        {newPulsesCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
          >
            <Button
              onClick={loadNewPulses}
              disabled={isLoadingNew}
              className="rounded-full shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 flex items-center gap-2"
            >
              {isLoadingNew ? (
                <FiRefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FiRefreshCw className="h-4 w-4" />
              )}
              {newPulsesCount} new pulse{newPulsesCount > 1 ? 's' : ''} — click to load
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="min-w-0 space-y-4">
          {/* Compose Box - changes based on filter */}
          {currentUser && (
            <div className="rounded-2xl border border-border/60 bg-zinc-200/80 dark:bg-card">
              {filter === 'polls' ? (
                // Poll-focused compose
                <div className="p-4 space-y-4">
                  {pendingAdvancedPoll ? (
                    // Advanced poll composer preview (Quick Poll-style)
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <h3 className="font-semibold">Advanced Poll</h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingAdvancedPoll(null)}
                          title="Remove pending poll"
                        >
                          <FiX className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={currentUser.image || undefined} />
                            <AvatarFallback>{currentUser.name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-2">
                            <Textarea
                              value={composeText}
                              onChange={(e) => setComposeText(e.target.value)}
                              placeholder="Add a message with your advanced poll (optional)..."
                              className="min-h-[50px] resize-none border-0 bg-transparent focus-visible:ring-0 p-0 text-base"
                              rows={1}
                            />
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-amber-500/20">
                                <Zap className="h-5 w-5 text-amber-500" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm">{pendingAdvancedPoll.title}</h4>
                                {pendingAdvancedPoll.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">{pendingAdvancedPoll.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {pendingAdvancedPoll.type}
                                  </Badge>
                                  <span>{pendingAdvancedPoll.questionCount} questions</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            onClick={handlePost}
                            disabled={isSubmitting}
                            className="rounded-full px-4"
                          >
                            {isSubmitting ? <Spinner /> : <><PulsePositive className="h-4 w-4 mr-1" /> Pulse</>}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : !includePoll ? (
                    // Show poll type selection
                    <>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                          <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Create a Poll</h3>
                          <p className="text-sm text-muted-foreground">Pulse a survey, quiz, or feedback form to everyone</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setIncludePoll(true)}
                          className="h-auto py-4 flex flex-col gap-2"
                        >
                          <FiBarChart2 className="h-6 w-6" />
                          <span className="font-medium">Quick Poll</span>
                          <span className="text-xs text-muted-foreground">Simple yes/no or options</span>
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => setShowPollBuilder(true)}
                          className="h-auto py-4 flex flex-col gap-2 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/5"
                        >
                          <Zap className="h-6 w-6 text-amber-500" />
                          <span className="font-medium">Advanced Poll</span>
                          <span className="text-xs text-muted-foreground">Surveys, quizzes, assessments</span>
                        </Button>
                      </div>
                    </>
                  ) : (
                    // Show inline quick poll composer
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/20">
                            <FiBarChart2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <h3 className="font-semibold">Quick Poll</h3>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIncludePoll(false)}>
                          <FiX className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={currentUser.image || undefined} />
                            <AvatarFallback>{currentUser.name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-2">
                            <Textarea
                              value={composeText}
                              onChange={(e) => setComposeText(e.target.value)}
                              placeholder="Add a message with your poll (optional)..."
                              className="min-h-[50px] resize-none border-0 bg-transparent focus-visible:ring-0 p-0 text-base"
                              rows={1}
                            />
                          </div>
                        </div>
                        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                          <Input
                            value={pollQuestion}
                            onChange={(e) => setPollQuestion(e.target.value)}
                            placeholder="Ask a question..."
                            className="font-medium"
                          />
                          {pollOptions.map((opt, i) => (
                            <div key={i} className="flex gap-2">
                              <Input
                                value={opt}
                                onChange={(e) => updatePollOption(i, e.target.value)}
                                placeholder={`Option ${i + 1}`}
                                className="flex-1"
                              />
                              {pollOptions.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePollOption(i)}
                                  className="shrink-0"
                                >
                                  <FiX className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {pollOptions.length < 6 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={addPollOption}
                              className="text-muted-foreground"
                            >
                              <FiPlus className="h-4 w-4 mr-1" /> Add option
                            </Button>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            onClick={handlePost}
                            disabled={isSubmitting || !pollQuestion.trim()}
                            className="rounded-full px-4"
                          >
                            {isSubmitting ? <Spinner /> : <><PulsePositive className="h-4 w-4 mr-1" /> Pulse Poll</>}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                // Regular compose
                <div className="p-4 space-y-3">
                  {/* User avatar + textarea */}
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={currentUser.image || undefined} />
                      <AvatarFallback>{currentUser.name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        ref={textareaRef}
                        value={composeText}
                        onChange={(e) => setComposeText(e.target.value)}
                        placeholder={pendingAdvancedPoll ? "Add a message with your advanced poll (optional)..." : "Pulse your thoughts..."}
                        className="min-h-[60px] resize-none border-0 bg-transparent focus-visible:ring-0 p-0 text-base"
                        rows={2}
                      />

                      {/* Poll input (if enabled) */}
                      {includePoll && (
                        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                          <Input
                            value={pollQuestion}
                            onChange={(e) => setPollQuestion(e.target.value)}
                            placeholder="Ask a question..."
                            className="font-medium"
                          />
                          {pollOptions.map((opt, i) => (
                            <div key={i} className="flex gap-2">
                              <Input
                                value={opt}
                              onChange={(e) => updatePollOption(i, e.target.value)}
                              placeholder={`Option ${i + 1}`}
                              className="flex-1"
                            />
                            {pollOptions.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removePollOption(i)}
                                className="shrink-0"
                              >
                                <FiX className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {pollOptions.length < 6 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addPollOption}
                            className="text-muted-foreground"
                          >
                            <FiPlus className="h-4 w-4 mr-1" /> Add option
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Advanced Poll Preview (if pending) */}
                    {pendingAdvancedPoll && (
                      <div className="p-3 rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/20">
                              <Zap className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm">{pendingAdvancedPoll.title}</h4>
                              {pendingAdvancedPoll.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{pendingAdvancedPoll.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {pendingAdvancedPoll.type}
                                </Badge>
                                <span>{pendingAdvancedPoll.questionCount} questions</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingAdvancedPoll(null)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <FiX className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            #{tag}
                            <button onClick={() => removeTag(tag)} className="ml-1">
                              <FiX className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    {showTagInput && (
                      <div className="flex gap-2">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                          placeholder="Add tag..."
                          className="flex-1 h-8 text-sm"
                        />
                        <Button type="button" size="sm" variant="ghost" onClick={addTag}>
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action bar */}
                <div className="flex items-center justify-between pl-13">
                  <div className="flex items-center gap-1">
                    {/* Poll Options Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant={includePoll ? 'secondary' : 'ghost'}
                          size="sm"
                          className="text-muted-foreground gap-1"
                        >
                          <FiBarChart2 className="h-4 w-4" />
                          <FiChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Add a Poll</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setIncludePoll(!includePoll);
                          }}
                          className="flex items-center gap-2"
                        >
                          <FiBarChart2 className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium">Quick Poll</div>
                            <div className="text-xs text-muted-foreground">Simple yes/no or multiple choice</div>
                          </div>
                          {includePoll && <span className="text-primary">✓</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setShowPollBuilder(true)}
                          className="flex items-center gap-2"
                        >
                          <Zap className="h-4 w-4 text-amber-500" />
                          <div className="flex-1">
                            <div className="font-medium">Advanced Poll Builder</div>
                            <div className="text-xs text-muted-foreground">Surveys, quizzes, assessments</div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setShowPollImport(true)}
                          className="flex items-center gap-2"
                        >
                          <FileUp className="h-4 w-4 text-cyan-500" />
                          <div className="flex-1">
                            <div className="font-medium">Import from JSON</div>
                            <div className="text-xs text-muted-foreground">Paste JSON or use templates</div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Export</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={async () => {
                            // Find the REACH poll and export it
                            const reachPoll = advancedPolls.find(p => 
                              p.type === 'REACH_ASSESSMENT' || p.title?.toLowerCase().includes('reach')
                            );
                            if (reachPoll) {
                              try {
                                const res = await fetch(`/api/polls/export?pollId=${reachPoll.id}`);
                                const data = await res.json();
                                if (data.success) {
                                  const jsonStr = JSON.stringify(data.poll, null, 2);
                                  await navigator.clipboard.writeText(jsonStr);
                                  toast.success('Poll JSON copied to clipboard!', {
                                    description: 'You can now paste it in the import dialog'
                                  });
                                } else {
                                  toast.error('Failed to export poll');
                                }
                              } catch {
                                toast.error('Failed to export poll');
                              }
                            } else {
                              toast.info('No REACH poll found to export');
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          <Copy className="h-4 w-4 text-emerald-500" />
                          <div className="flex-1">
                            <div className="font-medium">Copy REACH Poll JSON</div>
                            <div className="text-xs text-muted-foreground">Copy to clipboard for editing</div>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      variant={showTagInput ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setShowTagInput(!showTagInput)}
                      className="text-muted-foreground"
                    >
                      <FiHash className="h-4 w-4" />
                    </Button>

                    {/* Visibility & Reply Permissions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground gap-1"
                        >
                          {VISIBILITY_OPTIONS.find(v => v.value === visibility)?.icon}
                          <FiChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Who can see this?</DropdownMenuLabel>
                        {VISIBILITY_OPTIONS.map(opt => (
                          <DropdownMenuItem
                            key={opt.value}
                            onClick={() => setVisibility(opt.value)}
                            className="flex items-center gap-2"
                          >
                            <span className={visibility === opt.value ? 'text-primary' : 'text-muted-foreground'}>
                              {opt.icon}
                            </span>
                            <div className="flex-1">
                              <div className={visibility === opt.value ? 'font-medium' : ''}>{opt.label}</div>
                              <div className="text-xs text-muted-foreground">{opt.description}</div>
                            </div>
                            {visibility === opt.value && <span className="text-primary">✓</span>}
                          </DropdownMenuItem>
                        ))}

                        <DropdownMenuSeparator />

                        <DropdownMenuLabel className="text-xs text-muted-foreground">Who can reply?</DropdownMenuLabel>
                        {REPLY_OPTIONS.map(opt => (
                          <DropdownMenuItem
                            key={opt.value}
                            onClick={() => setReplyPermission(opt.value)}
                            className="flex items-center gap-2"
                          >
                            <div className="flex-1">
                              <div className={replyPermission === opt.value ? 'font-medium' : ''}>{opt.label}</div>
                              <div className="text-xs text-muted-foreground">{opt.description}</div>
                            </div>
                            {replyPermission === opt.value && <span className="text-primary">✓</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Show current settings as badges if not default */}
                    {(visibility !== 'PUBLIC' || replyPermission !== 'EVERYONE') && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {visibility !== 'PUBLIC' && (
                          <Badge variant="outline" className="text-xs py-0">
                            {VISIBILITY_OPTIONS.find(v => v.value === visibility)?.label}
                          </Badge>
                        )}
                        {replyPermission !== 'EVERYONE' && (
                          <Badge variant="outline" className="text-xs py-0">
                            {REPLY_OPTIONS.find(r => r.value === replyPermission)?.label} replies
                          </Badge>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={handlePost}
                      disabled={isSubmitting || (!composeText.trim() && !pollQuestion.trim())}
                      size="sm"
                      className="rounded-full px-4"
                    >
                      {isSubmitting ? <Spinner /> : <><PulsePositive className="h-4 w-4 mr-1" /> {pulseLabels.post}</>}
                    </Button>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {/* Feed - unified feed for all content types */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                {filter === 'polls' ? (
                  <>
                    <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="font-semibold text-lg mb-2">No polls yet</h3>
                    <p className="text-muted-foreground mb-4">Be the first to create a poll and pulse it to everyone!</p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" onClick={() => setIncludePoll(true)} className="gap-2">
                        <FiBarChart2 className="h-4 w-4" />
                        Quick Poll
                      </Button>
                      <Button onClick={() => setShowPollBuilder(true)} className="gap-2">
                        <Zap className="h-4 w-4" />
                        Advanced Poll
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No pulses yet. Be the first to start the vibe!</p>
                )}
              </div>
            ) : (
              <>
                {items.map((item) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    onTagClick={(tag) => setTagFilter(tag)}
                    onClick={() => openPulse(item.id)}
                    onRefresh={fetchFeed}
                    onOpenPoll={openPoll}
                  />
                ))}

                {/* Infinite scroll sentinel */}
                <div ref={loadMoreRef} className="h-1" />
                {isFetchingMore && (
                  <div className="flex justify-center py-6">
                    <Spinner />
                  </div>
                )}
                {!hasMore && items.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    You&apos;ve reached the end of the feed
                  </p>
                )}
              </>
            )}
          </div>

          {/* Pulse Detail Modal */}
          <PulseDetailModal
            pulseId={selectedPulseId}
            onClose={closePulse}
            onTagClick={(tag) => setTagFilter(tag)}
            advancedPoll={items.find(i => i.id === selectedPulseId)?.advancedPoll}
            onOpenPoll={(pollId) => {
              closePulse();
              openPoll(pollId);
            }}
          />

          {/* Advanced Poll Builder Modal */}
          <Dialog open={showPollBuilder} onOpenChange={setShowPollBuilder}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  Create Advanced Poll
                </DialogTitle>
                <DialogDescription>
                  Build a survey, quiz, or assessment and pulse it to your followers
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <PollBuilder
                  onSave={async (data) => {
                    try {
                      // Transform PollBuilder data to AdvancedPollCreate format
                      const advancedPollData = {
                        title: data.title,
                        description: data.description || undefined,
                        type: data.type || 'SURVEY',
                        isAnonymous: false,
                        allowPartial: data.allowPartialSubmission ?? true,
                        requiresAuth: true,
                        expiresAt: data.expiresAt || undefined,
                        questions: data.questions.map((q, idx) => ({
                          text: q.questionText,
                          description: q.description || undefined,
                          type: q.type,
                          order: q.order ?? idx,
                          isRequired: q.required ?? true,
                          allowImages: q.allowImages ?? false,
                          allowComments: false,
                          sliderConfig: q.sliderConfig ? {
                            min: q.sliderConfig.minValue,
                            max: q.sliderConfig.maxValue,
                            steps: (() => {
                              const labelSteps = (q.sliderConfig as any).stepLabels?.length
                              if (labelSteps && labelSteps >= 2) return Math.min(20, labelSteps)
                              const stepValue = typeof q.sliderConfig.step === 'number' && q.sliderConfig.step > 0 ? q.sliderConfig.step : 1
                              const rawSteps = Math.floor((q.sliderConfig.maxValue - q.sliderConfig.minValue) / stepValue) + 1
                              return Math.min(20, Math.max(2, rawSteps))
                            })(),
                            labels:
                              (q.sliderConfig as any).stepLabels && (q.sliderConfig as any).stepLabels.length >= 2
                                ? (q.sliderConfig as any).stepLabels.slice(0, 20)
                                : undefined,
                            showValue: true,
                          } : undefined,
                          options: (q.options || []).map((opt, optIdx) => ({
                            text: opt.text,
                            order: optIdx,
                            value: opt.value,
                            imageUrl: opt.imageUrl,
                          })),
                        })),
                      };

                      // Create the advanced poll
                      const res = await fetch('/api/advanced-polls', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(advancedPollData),
                      });

                      if (!res.ok) {
                        const errorData = await res.json().catch(() => ({}));
                        console.error('API Error:', errorData);
                        throw new Error(errorData.message || 'Failed to create poll');
                      }

                      const createdPoll = await res.json();
                      
                      // Store as pending poll for preview in composer
                      setPendingAdvancedPoll({
                        id: createdPoll.poll?.id || createdPoll.id,
                        title: data.title,
                        description: data.description,
                        type: data.type || 'SURVEY',
                        questionCount: data.questions.length,
                      });
                      
                      // Close modal - poll will show in composer for user to add message and pulse
                      setShowPollBuilder(false);

                      // Reset quick poll composer state so the advanced preview is unambiguous
                      setIncludePoll(false);
                      setPollQuestion('');
                      setPollOptions(['', '']);

                      // Stay in the Polls composer view
                      setFilter('polls');
                    } catch (error) {
                      console.error('Failed to create advanced poll:', error);
                      alert(error instanceof Error ? error.message : 'Failed to create poll');
                    }
                  }}
                  onPreview={(data) => {
                    console.log('Preview poll:', data);
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* Poll Taker Modal - for taking advanced polls */}
          {/* Use ReachPollV3 for REACH Assessment polls (interactive drag/drop experience), regular modal for others */}
          {isReachAuditPoll ? (
            <ReachPollV3
              pollId={selectedAdvancedPollId}
              onClose={closePoll}
              onComplete={(responseId) => {
                console.log('Poll completed:', responseId);
                // Refresh polls list
                if (filter === 'polls') {
                  const fetchPolls = async () => {
                    const res = await fetch('/api/advanced-polls?pageSize=20');
                    const data = await res.json();
                    setAdvancedPolls(data.polls?.map((p: any) => ({
                      id: p.id,
                      title: p.title,
                      description: p.description,
                      type: p.type,
                      creator: p.Creator || { id: p.creatorId, name: 'Unknown', image: null },
                      questionCount: p.questions?.length || 0,
                      totalResponses: p.totalResponses || 0,
                      avgCompletionPct: p.avgCompletionPct || 0,
                      publishedAt: p.publishedAt,
                      expiresAt: p.expiresAt,
                      conversationId: p.conversationId,
                    })) || []);
                  };
                  fetchPolls();
                }
              }}
            />
          ) : (
            <PollTakerModal
              pollId={selectedAdvancedPollId}
              onClose={closePoll}
              onComplete={(responseId) => {
                console.log('Poll completed:', responseId);
                // Refresh polls list
                if (filter === 'polls') {
                  const fetchPolls = async () => {
                    const res = await fetch('/api/advanced-polls?pageSize=20');
                    const data = await res.json();
                    setAdvancedPolls(data.polls?.map((p: any) => ({
                      id: p.id,
                      title: p.title,
                      description: p.description,
                      type: p.type,
                      creator: p.Creator || { id: p.creatorId, name: 'Unknown', image: null },
                      questionCount: p.questions?.length || 0,
                      totalResponses: p.totalResponses || 0,
                      avgCompletionPct: p.avgCompletionPct || 0,
                      publishedAt: p.publishedAt,
                      expiresAt: p.expiresAt,
                      conversationId: p.conversationId,
                    })) || []);
                  };
                  fetchPolls();
                }
              }}
            />
          )}

          {/* Poll Import Modal */}
          <PollImportModal
            open={showPollImport}
            onOpenChange={setShowPollImport}
            onImport={async (importedPoll) => {
              try {
                // Transform imported poll to our API format
                const res = await fetch('/api/polls/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    pollData: {
                      title: importedPoll.title,
                      description: importedPoll.description,
                      type: importedPoll.type || 'CUSTOM',
                      questions: importedPoll.questions.map((q, i) => ({
                        orderIndex: i + 1,
                        text: q.text,
                        description: q.description,
                        type: q.type === 'choice' ? 'SINGLE_CHOICE' : 
                              q.type === 'multi-choice' ? 'MULTI_CHOICE' :
                              q.type === 'slider' ? 'SLIDER' :
                              q.type === 'scale' ? 'SCALE' :
                              q.type === 'ranking' ? 'RANKING' : 'TEXT',
                        isRequired: q.required ?? true,
                        sliderConfig: q.sliderConfig || q.scaleConfig,
                        options: q.options?.map((opt, j) => ({
                          orderIndex: j + 1,
                          text: opt.text,
                          value: opt.value,
                        })),
                      })),
                    },
                    draft: false,
                    pulseOptions: {
                      createPulse: true,
                      pulseTitle: importedPoll.title,
                      tags: ['poll', 'imported'],
                    },
                  }),
                });

                if (!res.ok) {
                  const data = await res.json();
                  throw new Error(data.error || 'Failed to import poll');
                }

                const result = await res.json();
                toast.success('Poll imported successfully!', {
                  description: `Created poll with ${importedPoll.questions.length} questions`
                });
                
                setShowPollImport(false);
                fetchFeed();
                
                if (result.pulseId) {
                  openPulse(result.pulseId);
                }
              } catch (error) {
                console.error('Import failed:', error);
                toast.error('Failed to import poll', {
                  description: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }}
          />
        </div>

        {/* Explore sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--app-header-offset,0px)+16px)] space-y-4">
            {!currentUser && (
              <div className="rounded-2xl border border-border/60 bg-zinc-100/80 dark:bg-card/20 p-4 transition-colors hover:bg-zinc-200/80 dark:hover:bg-card/30">
                <div className="font-semibold">Welcome</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse public posts, polls, and updates. Sign in to post and join the conversation.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => router.push('/auth/login')}>Sign in</Button>
                  <Button size="sm" variant="secondary" onClick={() => router.push('/auth/register')}>Create account</Button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border/60 bg-zinc-100/80 dark:bg-card/20 p-4 transition-colors hover:bg-zinc-200/80 dark:hover:bg-card/30">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Trending tags</div>
                {tagFilter && (
                  <Button size="sm" variant="ghost" onClick={() => setTagFilter(null)}>
                    Clear
                  </Button>
                )}
              </div>
              {trendingTags.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No tags yet.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {trendingTags.map(({ tag, count }) => (
                    <button
                      key={tag}
                      onClick={() => setTagFilter(tag)}
                      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/30 px-3 py-1 text-sm text-foreground/90 transition hover:bg-background/50"
                    >
                      <span className="font-medium">#{tag}</span>
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-zinc-100/80 dark:bg-card/20 p-4 transition-colors hover:bg-zinc-200/80 dark:hover:bg-card/30">
              <div className="font-semibold">Top heartbeats</div>
              <div className="mt-3 space-y-2">
                {topPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing yet.</p>
                ) : (
                  topPosts.map((post) => {
                    const headline =
                      post.description?.trim() ||
                      post.lastMessage?.content?.trim() ||
                      post.poll?.question?.trim() ||
                      post.title?.trim() ||
                      'Post';

                    return (
                      <div
                        key={post.id}
                        className="w-full rounded-xl border border-border/50 bg-background/20 px-3 py-2 text-left transition hover:bg-background/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            {/* Username with HoverCard - clicking navigates to profile */}
                            <UserHoverCard
                              userId={post.userId}
                              userName={post.user?.name}
                              userImage={post.user?.image}
                              side="left"
                              align="start"
                            >
                              <span className="text-sm font-medium truncate block cursor-pointer hover:underline">
                                {post.user?.name || 'Anonymous'}
                              </span>
                            </UserHoverCard>
                            {/* Content preview - clicking opens the pulse */}
                            <button
                              type="button"
                              onClick={() => openPulse(post.id)}
                              className="text-xs text-muted-foreground truncate block hover:text-foreground/80 cursor-pointer text-left w-full"
                            >
                              {headline}
                            </button>
                          </div>
                          <div className="shrink-0 text-xs text-muted-foreground">
                            {(post.viewCount || 0) > 0 ? `${post.viewCount} views` : `${post.messageCount} msgs`}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Discover People - Find and follow users */}
            {currentUser && <DiscoverPeople />}
          </div>
        </aside>
      </div>
    </div>
  );
};

// Feed Card Component
interface FeedCardProps {
  item: FeedItem;
  onTagClick: (tag: string) => void;
  onClick: () => void;
  onRefresh: () => void;
  onOpenPoll?: (pollId: string) => void;
}

const FeedCard: React.FC<FeedCardProps> = ({ item, onTagClick, onClick, onRefresh, onOpenPoll }) => {
  const timeAgo = formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true });
  const pathname = usePathname();
  const isPulsePage = pathname === '/pulse';

  const currentUser = useCurrentUser();
  const userRole = UseCurrentRole();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [isReposting, setIsReposting] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [localPulse, setLocalPulse] = useState<'POSITIVE' | 'NEGATIVE' | null>(item.userPulse || null);
  const [localPositiveCount, setLocalPositiveCount] = useState(item.positivePulseCount || 0);
  const [localViewCount, setLocalViewCount] = useState(item.viewCount || 0);
  
  // Edit/Delete state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title || '');
  const [editDescription, setEditDescription] = useState(item.description || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Pin state
  const [isPinnedToFeed, setIsPinnedToFeed] = useState(item.pinnedToFeed || false);
  const [isPinnedToProfile, setIsPinnedToProfile] = useState(item.pinnedToProfile || false);
  const [isPinning, setIsPinning] = useState(false);
  
  // Permission checks - owner of post OR platform owner/admin can manage
  const isPostOwner = currentUser?.id === item.userId;
  const isPlatformAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  const canManage = isPostOwner || isPlatformAdmin;

  // View tracking - tracks when this post becomes visible in viewport
  const { ref: viewTrackingRef, hasTracked } = useViewTracking(item.id, {
    threshold: 0.5, // 50% of card must be visible
    minViewTime: 1500, // Must be visible for 1.5 seconds
    debounceMs: 10000, // Don't re-track within 10 seconds
    onViewTracked: (result) => {
      if (result.success && result.isFirstView) {
        // Increment local view count on first view
        setLocalViewCount(c => c + 1);
      }
    },
  });

  const isQuote = Boolean(item.repostOfConversation);

  const originalPreview = useMemo(() => {
    const raw = item.repostOfLastMessage?.content?.trim() || item.repostOfConversation?.title?.trim() || '';
    const max = 220;
    if (!raw) return '';
    return raw.length > max ? `${raw.slice(0, max).trimEnd()}…` : raw;
  }, [item.repostOfConversation, item.repostOfLastMessage]);

  // Handle heartbeat (like/dislike)
  const handlePulse = async (type: 'POSITIVE' | 'NEGATIVE') => {
    if (!currentUser || isPulsing) return;
    setIsPulsing(true);
    
    // Optimistic update
    const wasActive = localPulse === type;
    const previousPulse = localPulse;
    const previousCount = localPositiveCount;
    
    if (wasActive) {
      setLocalPulse(null);
      if (type === 'POSITIVE') setLocalPositiveCount(c => Math.max(0, c - 1));
    } else {
      if (type === 'POSITIVE' && localPulse === 'NEGATIVE') {
        setLocalPositiveCount(c => c + 1);
      } else if (type === 'NEGATIVE' && localPulse === 'POSITIVE') {
        setLocalPositiveCount(c => Math.max(0, c - 1));
      } else if (type === 'POSITIVE') {
        setLocalPositiveCount(c => c + 1);
      }
      setLocalPulse(type);
    }
    
    try {
      const url = `/api/conversations/${encodeURIComponent(item.id)}/pulse`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        // Revert on error
        setLocalPulse(previousPulse);
        setLocalPositiveCount(previousCount);
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to heartbeat');
      }
      const data = await res.json();
      setLocalPulse(data.currentPulse);
      setLocalPositiveCount(data.positivePulseCount || 0);
    } catch (e) {
      console.error('Heartbeat failed:', e);
    } finally {
      setIsPulsing(false);
    }
  };

  // Handle repulse (formerly repost)
  const handleRepulse = async () => {
    if (!currentUser) return;
    setIsReposting(true);
    try {
      const url = `/api/conversations/${encodeURIComponent(item.id)}/repost`;
      const res = await fetch(url, {
        method: item.hasReposted ? 'DELETE' : 'POST',
        headers: item.hasReposted ? undefined : { 'Content-Type': 'application/json' },
        body: item.hasReposted ? undefined : JSON.stringify({ mode: 'repost' }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to repulse');
      }

      onRefresh();
    } catch (e) {
      console.error('Repulse failed:', e);
    } finally {
      setIsReposting(false);
    }
  };

  const handleQuoteRepulse = async () => {
    if (!currentUser) return;
    const text = quoteText.trim();
    if (!text) return;
    setIsReposting(true);
    try {
      const url = `/api/conversations/${encodeURIComponent(item.id)}/repost`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'quote', text }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to quote repulse');
      }
      const data = await res.json();
      setQuoteOpen(false);
      setQuoteText('');
      if (data?.conversationId) {
        // Navigate to the new quote thread
        window.location.href = `/conversations/${data.conversationId}`;
      }
    } catch (e) {
      console.error('Quote repost failed:', e);
    } finally {
      setIsReposting(false);
    }
  };

  // Handle edit pulse
  const handleEdit = async () => {
    if (!canManage || isEditing) return;
    setIsEditing(true);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim() || null,
          description: editDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to update pulse');
      }
      setEditOpen(false);
      toast.success('Pulse updated');
      // Refresh feed to show updated content
      onRefresh();
    } catch (e) {
      console.error('Edit failed:', e);
      toast.error('Failed to update pulse');
    } finally {
      setIsEditing(false);
    }
  };

  // Handle delete pulse
  const handleDelete = async () => {
    if (!canManage || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to delete pulse');
      }
      setDeleteConfirmOpen(false);
      toast.success('Pulse deleted');
      // Refresh feed to remove deleted item
      onRefresh();
    } catch (e) {
      console.error('Delete failed:', e);
      toast.error('Failed to delete pulse');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle pin/unpin to main feed (admin only)
  const handlePinToFeed = async () => {
    if (!isPlatformAdmin || isPinning) return;
    setIsPinning(true);
    try {
      const method = isPinnedToFeed ? 'DELETE' : 'POST';
      const res = await fetch(`/api/conversations/${encodeURIComponent(item.id)}/pin?target=feed`, {
        method,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to update pin');
      }
      setIsPinnedToFeed(!isPinnedToFeed);
      toast.success(isPinnedToFeed ? 'Unpinned from feed' : 'Pinned to main feed');
      onRefresh();
    } catch (e) {
      console.error('Pin to feed failed:', e);
      toast.error('Failed to update pin');
    } finally {
      setIsPinning(false);
    }
  };

  // Handle pin/unpin to user's profile
  const handlePinToProfile = async () => {
    if (!currentUser || isPinning) return;
    setIsPinning(true);
    try {
      const method = isPinnedToProfile ? 'DELETE' : 'POST';
      const res = await fetch(`/api/conversations/${encodeURIComponent(item.id)}/pin?target=profile`, {
        method,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Failed to update pin');
      }
      setIsPinnedToProfile(!isPinnedToProfile);
      toast.success(isPinnedToProfile ? 'Unpinned from your profile' : 'Pinned to your profile');
    } catch (e) {
      console.error('Pin to profile failed:', e);
      toast.error('Failed to update pin');
    } finally {
      setIsPinning(false);
    }
  };

  const MAX_PREVIEW_CHARS = 500;
  const rawPreviewText =
    item.description?.trim() ||
    item.lastMessage?.content?.trim() ||
    item.poll?.question?.trim() ||
    item.title?.trim() ||
    '';
  const previewText =
    rawPreviewText.length > MAX_PREVIEW_CHARS
      ? `${rawPreviewText.slice(0, MAX_PREVIEW_CHARS).trimEnd()}…`
      : rawPreviewText;
  const showReadMore = rawPreviewText.length > MAX_PREVIEW_CHARS;

  const replyCount = getReplyCount(item.messageCount);

  const titleText = (item.title || '').trim();
  const descriptionText = (item.description || '').trim();
  const shouldShowTitle =
    !isPulsePage &&
    Boolean(
      titleText &&
        (!descriptionText ||
          (titleText !== descriptionText && !descriptionText.startsWith(titleText)))
    );

  // Handle click - ignore if user is selecting text
  const handleCardClick = (e: React.MouseEvent) => {
    // Check if user has selected any text
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      // User is selecting text, don't open modal
      return;
    }
    onClick();
  };

  return (
    <article
      ref={viewTrackingRef}
      className={cn(
        "group relative cursor-pointer rounded-2xl border p-4 sm:p-5 shadow-sm transition hover:shadow-md",
        isPinnedToFeed 
          ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30" 
          : "border-border/60 bg-zinc-100/80 dark:bg-card/30 hover:bg-zinc-200/80 dark:hover:bg-card/50"
      )}
      onClick={handleCardClick}
    >
      {/* Pinned indicator */}
      {isPinnedToFeed && (
        <div className="absolute -top-2 left-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-medium shadow-sm">
          <Pin className="h-3 w-3" />
          Pinned
        </div>
      )}
      <div className="flex gap-3 items-start">
        {/* User Avatar with HoverCard */}
        <UserHoverCard
          userId={item.userId}
          userName={item.user?.name}
          userImage={item.user?.image}
          side="right"
          align="start"
        >
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-transparent hover:ring-primary/30 transition-all">
            <AvatarImage src={item.user?.image || undefined} />
            <AvatarFallback>{item.user?.name?.[0] || '?'}</AvatarFallback>
          </Avatar>
        </UserHoverCard>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm">
            {/* User Name with HoverCard */}
            <UserHoverCard
              userId={item.userId}
              userName={item.user?.name}
              userImage={item.user?.image}
              side="bottom"
              align="start"
            >
              <span className="font-semibold truncate hover:underline">
                {item.user?.name || 'Anonymous'}
              </span>
            </UserHoverCard>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{timeAgo}</span>
            {item.editedAt && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground/70 text-xs italic">edited</span>
              </>
            )}

            <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <FiChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Share</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!currentUser || isReposting}
                    onClick={(e) => {
                      e.preventDefault();
                      void handleRepulse();
                    }}
                  >
                    <FiRepeat className="h-4 w-4 mr-2" />
                    {item.hasReposted ? 'Undo repulse' : 'Repulse'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!currentUser}
                    onClick={(e) => {
                      e.preventDefault();
                      setQuoteOpen(true);
                    }}
                  >
                    <FiEdit3 className="h-4 w-4 mr-2" />
                    Quote repulse
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Feedback</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={!currentUser || isPulsing}
                    onClick={(e) => {
                      e.preventDefault();
                      void handlePulse('NEGATIVE');
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <FiEyeOff className="h-4 w-4 mr-2" />
                    Not interested
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!currentUser}
                    onClick={(e) => {
                      e.preventDefault();
                      // TODO: Implement mute user functionality
                      console.log('User muted from your feed');
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <PulseFlat className="h-4 w-4 mr-2" />
                    Don&apos;t show from this user
                  </DropdownMenuItem>

                  {/* Pin options */}
                  {currentUser && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Pin</DropdownMenuLabel>
                      <DropdownMenuItem
                        disabled={isPinning}
                        onClick={(e) => {
                          e.preventDefault();
                          void handlePinToProfile();
                        }}
                      >
                        {isPinnedToProfile ? (
                          <>
                            <PinOff className="h-4 w-4 mr-2" />
                            Unpin from profile
                          </>
                        ) : (
                          <>
                            <Pin className="h-4 w-4 mr-2" />
                            Pin to my profile
                          </>
                        )}
                      </DropdownMenuItem>
                      {isPlatformAdmin && (
                        <DropdownMenuItem
                          disabled={isPinning}
                          onClick={(e) => {
                            e.preventDefault();
                            void handlePinToFeed();
                          }}
                          className={isPinnedToFeed ? 'text-amber-500' : ''}
                        >
                          {isPinnedToFeed ? (
                            <>
                              <PinOff className="h-4 w-4 mr-2" />
                              Unpin from main feed
                              <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">Admin</Badge>
                            </>
                          ) : (
                            <>
                              <Pin className="h-4 w-4 mr-2" />
                              Pin to main feed
                              <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">Admin</Badge>
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                    </>
                  )}

                  {/* Owner/Admin actions */}
                  {canManage && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        {isPlatformAdmin && !isPostOwner ? 'Admin Actions' : 'Manage'}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          setEditTitle(item.title || '');
                          setEditDescription(item.description || '');
                          setEditOpen(true);
                        }}
                      >
                        <FiEdit2 className="h-4 w-4 mr-2" />
                        Edit pulse
                        {isPlatformAdmin && !isPostOwner && (
                          <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">Admin</Badge>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          setDeleteConfirmOpen(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <FiTrash2 className="h-4 w-4 mr-2" />
                        Delete pulse
                        {isPlatformAdmin && !isPostOwner && (
                          <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">Admin</Badge>
                        )}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Quote embed */}
          {isQuote && item.repostOfConversation && (
            <div
              className="mt-2 rounded-xl border border-border/60 bg-background/30 p-3 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/conversations/${item.repostOfConversation?.id}`;
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    Quoting {item.repostOfConversation.user?.name || 'Anonymous'}
                  </div>
                  {originalPreview && (
                    <div className="mt-1 text-[13px] text-foreground/85 leading-snug line-clamp-3">
                      {originalPreview}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">Open</div>
              </div>
            </div>
          )}

          {/* Content */}
          {rawPreviewText && (
            <div className="mt-2 space-y-1">
              {shouldShowTitle && (
                <h3 className="text-sm text-foreground/80 font-medium leading-snug">
                  {titleText}
                </h3>
              )}

              {isPulsePage ? (
                <RichTextContent
                  content={rawPreviewText}
                  className="text-[15px] leading-relaxed text-foreground/90"
                  onTagClick={onTagClick}
                  embedYouTube={true}
                  maxYouTubeEmbeds={2}
                />
              ) : (
                <>
                  <RichTextContent
                    content={previewText}
                    className="text-[15px] leading-relaxed text-foreground/90"
                    onTagClick={onTagClick}
                    embedYouTube={true}
                    maxYouTubeEmbeds={1}
                  />

                  {showReadMore && (
                    <div className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
                      Read more
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Poll preview */}
          {item.hasPoll && (
            <div className="mt-3">
              {item.advancedPoll ? (
                // Advanced Poll - clickable card opens poll directly
                <button
                  className="w-full p-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary/50 hover:from-primary/10 hover:to-primary/20 transition-all text-left group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPoll?.(item.advancedPoll!.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <FiBarChart2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary group-hover:text-primary/80 transition-colors">
                          {item.advancedPoll.type === 'REACH_ASSESSMENT' ? '🎯 ' : '📊 '}
                          {item.advancedPoll.title}
                        </span>
                      </div>
                      {item.advancedPoll.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {item.advancedPoll.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FiUsers className="h-3 w-3" />
                          {item.advancedPoll.totalResponses} responses
                        </span>
                        <span className="text-primary font-medium group-hover:underline">
                          Take this poll →
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ) : (
                // Regular Poll - use PollDisplay (clicking opens pulse modal)
                <div onClick={(e) => e.stopPropagation()}>
                  <PollDisplay conversationId={item.id} />
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-primary/20"
                  onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats & Actions */}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground" onClick={(e) => e.stopPropagation()}>
            {/* Heartbeat button (positive) */}
            <button
              type="button"
              disabled={!currentUser || isPulsing}
              onClick={() => void handlePulse('POSITIVE')}
              className={`flex items-center gap-1.5 transition-all hover:text-emerald-500 group ${
                localPulse === 'POSITIVE' ? 'text-emerald-500' : ''
              }`}
              title={pulseLabels.heartbeatVerb}
            >
              <PulseHeart 
                size={18} 
                filled={localPulse === 'POSITIVE'}
                className={`transition-transform ${localPulse === 'POSITIVE' ? 'scale-110' : 'group-hover:scale-105'}`}
              />
              {localPositiveCount > 0 && <span className="tabular-nums">{localPositiveCount}</span>}
            </button>
            
            <span className="flex items-center gap-1">
              <FiMessageCircle className="h-4 w-4" />
              {replyCount}
            </span>
            <span className={`flex items-center gap-1 ${item.hasReposted ? 'text-cyan-500' : ''}`}>
              <FiRepeat className="h-4 w-4" />
              {item.repostCount || 0}
            </span>
            {(localViewCount > 0 || (item.uniqueViewCount !== undefined && item.uniqueViewCount > 0)) && (
              <span className="flex items-center gap-1" title={hasTracked ? 'View tracked' : 'Views'}>
                <FiTrendingUp className="h-4 w-4" />
                {Math.max(localViewCount, item.uniqueViewCount || 0)}
              </span>
            )}
          </div>
        </div>
      </div>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Quote repulse</DialogTitle>
            <DialogDescription>Add your comment, then repulse.</DialogDescription>
          </DialogHeader>

          <Textarea
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
            placeholder="Add a comment…"
            className="min-h-[120px]"
          />

          <div className="rounded-xl border border-border/60 bg-background/30 p-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Original by {item.user?.name || 'Anonymous'}
            </div>
            <div className="mt-1 text-[13px] text-foreground/85 leading-snug line-clamp-4">
              {(
                item.lastMessage?.content?.trim() ||
                item.description?.trim() ||
                item.poll?.question?.trim() ||
                item.title?.trim() ||
                ''
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setQuoteOpen(false);
                setQuoteText('');
              }}
              disabled={isReposting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleQuoteRepulse()} disabled={isReposting || !quoteText.trim()}>
              Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pulse Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit pulse</DialogTitle>
            <DialogDescription>Make changes to your pulse.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Pulse title (optional)"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Pulse your thoughts..."
                className="min-h-[120px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setEditOpen(false)}
              disabled={isEditing}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleEdit()} disabled={isEditing}>
              {isEditing ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete pulse</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this pulse? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
};

// Wrap with Suspense for useSearchParams
function FeedPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <FeedPage />
    </Suspense>
  );
}

export default FeedPageWrapper;

