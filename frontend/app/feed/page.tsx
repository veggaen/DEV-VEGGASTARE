'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { useViewTracking } from '@/hooks/useViewTracking';
import { FiSend, FiBarChart2, FiTrendingUp, FiMessageCircle, FiPlus, FiX, FiHash, FiGlobe, FiUsers, FiLock, FiChevronDown, FiRepeat, FiEdit3, FiEyeOff, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { PulsePositive, PulseFlat } from '@/components/uicustom/icons/PulseIcons';
import { formatDistanceToNowStrict } from 'date-fns';
import { PollDisplay } from '@/components/uicustom/chats/poll-display';
import { DiscoverPeople } from '@/components/uicustom/social/DiscoverPeople';
import { PulseDetailModal } from '@/components/uicustom/pulse/PulseDetailModal';
import { UserHoverCard } from '@/components/uicustom/UserHoverCard';

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
  lastMessage?: { content: string; createdAt: string } | null;
}

type FilterType = 'all' | 'polls' | 'trending';
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

// Sort options for feed
type SortType = 'reach' | 'recent' | 'popular' | 'discussed';
const SORT_OPTIONS: { value: SortType; label: string; description: string }[] = [
  { value: 'reach', label: 'Top Reach', description: 'Most viewed & engaged' },
  { value: 'recent', label: 'Latest', description: 'Newest first' },
  { value: 'popular', label: 'Most Pulsed', description: 'Most positive pulses' },
  { value: 'discussed', label: 'Most Discussed', description: 'Most comments' },
];

const FeedPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useCurrentUser();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Feed state
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('reach');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Modal state - read from URL for shareable links
  const [selectedPulseId, setSelectedPulseId] = useState<string | null>(null);

  // Sync modal state with URL
  useEffect(() => {
    const pulseParam = searchParams.get('pulse');
    setSelectedPulseId(pulseParam);
  }, [searchParams]);

  // Open pulse modal
  const openPulse = (pulseId: string) => {
    setSelectedPulseId(pulseId);
    // Update URL without navigation for shareable links
    const url = new URL(window.location.href);
    url.searchParams.set('pulse', pulseId);
    window.history.pushState({}, '', url.toString());
  };

  // Close pulse modal
  const closePulse = () => {
    setSelectedPulseId(null);
    // Remove pulse param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('pulse');
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

  // Fetch feed items
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/conversations?filter=public&sort=${sortBy}&limit=50`;
      if (tagFilter) {
        url += `&tag=${encodeURIComponent(tagFilter)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      let feedItems = (data.conversations || []) as FeedItem[];
      
      // Client-side filter for polls
      if (filter === 'polls') {
        feedItems = feedItems.filter(item => item.hasPoll);
      }
      
      // Client-side sorting for consistency
      if (sortBy === 'popular') {
        feedItems = [...feedItems].sort((a, b) => (b.positivePulseCount || 0) - (a.positivePulseCount || 0));
      } else if (sortBy === 'discussed') {
        feedItems = [...feedItems].sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));
      }
      
      setItems(feedItems);
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, sortBy, tagFilter]);

  useEffect(() => {
    fetchFeed();
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

        const aMsgs = a.messageCount || 0;
        const bMsgs = b.messageCount || 0;
        return bMsgs - aMsgs;
      })
      .slice(0, 5);
  }, [items]);

  // Handle post submission
  const handlePost = async () => {
    if (!composeText.trim() && !pollQuestion.trim()) return;

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
          initialMessage: composeText.trim() || undefined,
          pollQuestion: includePoll && pollQuestion.trim() ? pollQuestion.trim() : undefined,
          tags,
        }),
      });

      if (!res.ok) throw new Error('Failed to create post');
      
      const data = await res.json();
      const conversationId = data.id;

      // Create poll if included
      if (includePoll && pollQuestion.trim()) {
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

      // Reset form
      setComposeText('');
      setIncludePoll(false);
      setPollQuestion('');
      setPollOptions(['', '']);
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
      {/* ─── Pulse Sub-navbar ─── */}
      <div className="border-b border-border/50 mb-5">
        <div className="flex items-center gap-3 h-11">
          <span className="text-sm font-semibold text-foreground/80 shrink-0">Pulse</span>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-1">
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
              className="h-8"
            >
              All
            </Button>
            <Button
              variant={filter === 'polls' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('polls')}
              className="h-8"
            >
              <FiBarChart2 className="h-4 w-4 mr-1" /> Polls
            </Button>
            <Button
              variant={filter === 'trending' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('trending')}
              className="h-8"
            >
              <FiTrendingUp className="h-4 w-4 mr-1" /> Trending
            </Button>
          </div>

          <div className="h-4 w-px bg-border/60" />
          
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1">
                {SORT_OPTIONS.find(s => s.value === sortBy)?.label || 'Sort'}
                <FiChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={sortBy === option.value ? 'bg-accent' : ''}
                >
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {tagFilter && (
            <Badge variant="outline" className="ml-auto flex items-center gap-1">
              #{tagFilter}
              <button onClick={() => setTagFilter(null)}>
                <FiX className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="min-w-0 space-y-4">
          {/* Compose Box */}
          {currentUser && (
            <div className="rounded-2xl border border-border/60 bg-card">
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
                      placeholder="What's happening?"
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
                    <Button
                      type="button"
                      variant={includePoll ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setIncludePoll(!includePoll)}
                      className="text-muted-foreground"
                    >
                      <FiBarChart2 className="h-4 w-4" />
                    </Button>
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
                      {isSubmitting ? <Spinner /> : <><FiSend className="h-4 w-4 mr-1" /> Post</>}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feed */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No posts yet. Be the first to share something!</p>
              </div>
            ) : (
              items.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  onTagClick={(tag) => setTagFilter(tag)}
                  onClick={() => openPulse(item.id)}
                  onRefresh={fetchFeed}
                />
              ))
            )}
          </div>

          {/* Pulse Detail Modal */}
          <PulseDetailModal
            pulseId={selectedPulseId}
            onClose={closePulse}
            onTagClick={(tag) => setTagFilter(tag)}
          />
        </div>

        {/* Explore sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--app-header-offset,0px)+16px)] space-y-4">
            {!currentUser && (
              <div className="rounded-2xl border border-border/60 bg-transparent p-4 transition-colors hover:bg-card/30">
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

            <div className="rounded-2xl border border-border/60 bg-transparent p-4 transition-colors hover:bg-card/30">
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
                      type="button"
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

            <div className="rounded-2xl border border-border/60 bg-transparent p-4 transition-colors hover:bg-card/30">
              <div className="font-semibold">Top pulses</div>
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
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => openPulse(post.id)}
                        className="w-full rounded-xl border border-border/50 bg-background/20 px-3 py-2 text-left transition hover:bg-background/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{post.user?.name || 'Anonymous'}</div>
                            <div className="text-xs text-muted-foreground truncate">{headline}</div>
                          </div>
                          <div className="shrink-0 text-xs text-muted-foreground">
                            {(post.uniqueViewCount || 0) > 0 ? `${post.uniqueViewCount} views` : `${post.messageCount} msgs`}
                          </div>
                        </div>
                      </button>
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
}

const FeedCard: React.FC<FeedCardProps> = ({ item, onTagClick, onClick, onRefresh }) => {
  const timeAgo = formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true });

  const currentUser = useCurrentUser();
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
  
  const isOwner = currentUser?.id === item.userId;

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

  // Handle pulse (like/dislike)
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
        throw new Error(t || 'Failed to pulse');
      }
      const data = await res.json();
      setLocalPulse(data.currentPulse);
      setLocalPositiveCount(data.positivePulseCount || 0);
    } catch (e) {
      console.error('Pulse failed:', e);
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
    if (!isOwner || isEditing) return;
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
      // Reload feed to show updated content
      window.location.reload();
    } catch (e) {
      console.error('Edit failed:', e);
    } finally {
      setIsEditing(false);
    }
  };

  // Handle delete pulse
  const handleDelete = async () => {
    if (!isOwner || isDeleting) return;
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
      // Reload feed to remove deleted item
      window.location.reload();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setIsDeleting(false);
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

  return (
    <article
      ref={viewTrackingRef}
      className="group relative cursor-pointer rounded-2xl border border-border/60 bg-card/30 p-4 sm:p-5 shadow-sm transition hover:bg-card/50 hover:shadow-md"
      onClick={onClick}
    >
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

                  {/* Owner-only actions */}
                  {isOwner && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Manage</DropdownMenuLabel>
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

          {/* Content preview */}
          {previewText && (
            <div className="mt-2 space-y-1">
              {/* Keep title as a subtle label if it differs from the preview source */}
              {item.title && item.title.trim() && item.title.trim() !== rawPreviewText && (
                <h3 className="text-sm text-foreground/80 font-medium leading-snug">
                  {item.title}
                </h3>
              )}

              <p
                className="text-[15px] leading-relaxed text-foreground/90"
                style={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 10,
                  overflow: 'hidden',
                }}
              >
                {previewText}
              </p>

              {showReadMore && (
                <div className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  Read more
                </div>
              )}
            </div>
          )}

          {/* Poll preview */}
          {item.hasPoll && (
            <div
              className="mt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <PollDisplay conversationId={item.id} />
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
            {/* Pulse button (positive) - uses pulse wave icon */}
            <button
              type="button"
              disabled={!currentUser || isPulsing}
              onClick={() => void handlePulse('POSITIVE')}
              className={`flex items-center gap-1.5 transition-all hover:text-emerald-500 group ${
                localPulse === 'POSITIVE' ? 'text-emerald-500' : ''
              }`}
              title="Pulse this"
            >
              <PulsePositive 
                size={18} 
                filled={localPulse === 'POSITIVE'}
                className={`transition-transform ${localPulse === 'POSITIVE' ? 'scale-110' : 'group-hover:scale-105'}`}
              />
              {localPositiveCount > 0 && <span className="tabular-nums">{localPositiveCount}</span>}
            </button>
            
            <span className="flex items-center gap-1">
              <FiMessageCircle className="h-4 w-4" />
              {item.messageCount}
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
                placeholder="What's on your mind?"
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

