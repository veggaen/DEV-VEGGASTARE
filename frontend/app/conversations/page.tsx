'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Spinner from '@/components/uicustom/spinner';
import { useCurrentUser } from '@/hooks/use-current-user';
import { FiPlus, FiMessageCircle, FiGlobe, FiUsers, FiLock, FiTrendingUp, FiClock, FiMessageSquare, FiTrash2, FiMoreVertical, FiEdit, FiShare2, FiEye, FiEyeOff, FiX, FiBarChart2 } from 'react-icons/fi';
import { BsPin } from 'react-icons/bs';
import { formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';

interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

interface ConversationMessage {
  id: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  description?: string;
  participants: string[];
  participantDetails: User[];
  type: 'PUBLIC_THREAD' | 'PRIVATE_DM' | 'GROUP' | 'RESTRICTED';
  visibility: string;
  isPinned: boolean;
  isLocked: boolean;
  tags: string[];
  lastMessage: ConversationMessage | null;
  messageCount: number;
  user: User;
  userId: string; // Creator ID for permission checks
  createdAt: string;
  updatedAt: string;
  // Engagement metrics for "reach over followers" sorting
  viewCount?: number;
  uniqueViewCount?: number;
  replyCount?: number;
  uniqueRepliers?: number;
  // Poll indicator
  hasPoll?: boolean;
  // Deletion system
  deletionRequestedAt?: string;
  deletionScheduledFor?: string;
  deletionVisibility?: 'PUBLIC' | 'PRIVATE';
  isAnonymized?: boolean;
  originalUserId?: string;
}

type FilterType = 'mine' | 'public' | 'all';
type SortType = 'recent' | 'reach' | 'active' | 'replies';
type ExpandedTagsMap = Record<string, boolean>; // conversationId -> expanded

// Sort options with icons and descriptions
// Philosophy: "Reach over followers" - Richard's insight that actual views matter more than vanity metrics
const SORT_OPTIONS: { value: SortType; label: string; description: string }[] = [
  { value: 'reach', label: 'Top Reach', description: 'Most viewed and engaged' },
  { value: 'active', label: 'Most Active', description: 'Recently active' },
  { value: 'replies', label: 'Most Replies', description: 'Most discussed' },
  { value: 'recent', label: 'Newest', description: 'Recently created' },
];

const TYPE_ICONS: Record<Conversation['type'], React.ReactNode> = {
  PUBLIC_THREAD: <FiGlobe className="h-6 w-6 text-blue-500" />,
  PRIVATE_DM: <FiMessageCircle className="h-6 w-6 text-gray-500" />,
  GROUP: <FiUsers className="h-6 w-6 text-green-500" />,
  RESTRICTED: <FiLock className="h-6 w-6 text-orange-500" />,
};

const ConversationsPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterType>('mine');
  const [sort, setSort] = useState<SortType>('reach'); // Default to reach-based sorting
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Track which action is in progress
  const [expandedTags, setExpandedTags] = useState<ExpandedTagsMap>({}); // Track which cards have expanded tags
  const [tagFilter, setTagFilter] = useState<string | null>(null); // Filter by a specific tag
  const router = useRouter();
  const currentUser = useCurrentUser();

  // Toggle expanded tags for a conversation card
  const toggleExpandedTags = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card navigation
    setExpandedTags(prev => ({ ...prev, [conversationId]: !prev[conversationId] }));
  };

  // Handle tag click - filter by this tag
  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card navigation
    setTagFilter(tag === tagFilter ? null : tag); // Toggle filter
  };

  // Clear tag filter
  const clearTagFilter = () => setTagFilter(null);

  // Delete a conversation
  const handleDelete = async (conversationId: string, visibility: 'PUBLIC' | 'PRIVATE' = 'PRIVATE', e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    setActionLoading(conversationId);
    try {
      const response = await fetch(`/api/conversations/${conversationId}?visibility=${visibility}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        // Refresh the list
        fetchConversations(activeTab, sort);
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to delete conversation');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel pending deletion
  const handleCancelDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(conversationId);
    try {
      const response = await fetch(`/api/conversations/${conversationId}?cancel=true`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchConversations(activeTab, sort);
      }
    } catch (error) {
      console.error('Error cancelling deletion:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // Check if current user can manage a conversation
  const canManage = (conversation: Conversation) => {
    if (!currentUser) return false;
    return (
      currentUser.id === conversation.userId ||
      currentUser.id === conversation.originalUserId ||
      (currentUser as any).role === 'ADMIN' ||
      (currentUser as any).role === 'OWNER'
    );
  };

  const fetchConversations = useCallback(async (filter: FilterType, sortBy: SortType) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations?filter=${filter}&sort=${sortBy}`);
      const data = await response.json();

      if (data.conversations && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      } else if (Array.isArray(data)) {
        // Backwards compatibility
        setConversations(data);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations(activeTab, sort);
  }, [activeTab, sort, fetchConversations]);

  const handleConversationClick = (id: string) => {
    setIsNavigating(id);
    router.push(`/conversations/${id}`);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as FilterType);
  };

  const handleSortChange = (value: string) => {
    setSort(value as SortType);
  };

  const renderConversationCard = (conversation: Conversation) => {
    const participants = conversation.participantDetails || [];
    const otherDmParticipant =
      conversation.type === 'PRIVATE_DM' && currentUser?.id
        ? participants.find((p) => p.id !== currentUser.id) || participants[0]
        : null;
    const timeAgo = conversation.updatedAt
      ? formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })
      : '';

    return (
      <li
        key={conversation.id}
        onClick={() => handleConversationClick(conversation.id)}
        className="group relative cursor-pointer rounded-2xl border border-border/60 bg-card/30 p-4 shadow-sm transition hover:bg-card/50 hover:shadow-md"
      >
        {isNavigating === conversation.id && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 dark:bg-black/50 rounded-lg z-10">
            <Spinner />
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Leading visual: DM avatar when possible, else type icon */}
          {conversation.type === 'PRIVATE_DM' && otherDmParticipant ? (
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={otherDmParticipant.image} />
              <AvatarFallback>
                {otherDmParticipant.name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="mt-1 shrink-0">{TYPE_ICONS[conversation.type]}</div>
          )}

          <div className="flex-1 min-w-0">
            {/* Pending deletion banner (public visibility) */}
            {conversation.deletionScheduledFor && conversation.deletionVisibility === 'PUBLIC' && (
              <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded mb-2 -mt-1 -mx-1">
                <FiTrash2 className="h-3 w-3 flex-shrink-0" />
                <span>
                  Scheduled for deletion in {formatDistanceToNowStrict(new Date(conversation.deletionScheduledFor))}
                </span>
              </div>
            )}

          {/* Actions dropdown - only show for users who can manage */}
          {canManage(conversation) && (
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-muted"
                    disabled={actionLoading === conversation.id}
                  >
                    {actionLoading === conversation.id ? (
                      <Spinner />
                    ) : (
                      <FiMoreVertical className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {/* Edit option */}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/conversations/${conversation.id}/edit`);
                    }}
                  >
                    <FiEdit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>

                  {/* Share option (copy link) */}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`${window.location.origin}/conversations/${conversation.id}`);
                    }}
                  >
                    <FiShare2 className="h-4 w-4 mr-2" />
                    Copy Link
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Delete options - different based on pending status */}
                  {conversation.deletionScheduledFor ? (
                    <DropdownMenuItem
                      onClick={(e) => handleCancelDelete(conversation.id, e)}
                      className="text-green-600 focus:text-green-600"
                    >
                      <FiEye className="h-4 w-4 mr-2" />
                      Cancel Deletion
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => handleDelete(conversation.id, 'PRIVATE', e)}
                        className="text-orange-600 focus:text-orange-600"
                      >
                        <FiEyeOff className="h-4 w-4 mr-2" />
                        Delete (Silent)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleDelete(conversation.id, 'PUBLIC', e)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <FiTrash2 className="h-4 w-4 mr-2" />
                        Delete (Public Notice)
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

            {/* Title row */}
            <div className="flex items-center gap-2 mb-1">
              {conversation.isPinned && (
                <BsPin className="h-3 w-3 text-amber-500 flex-shrink-0" />
              )}
              {/* Subtle deletion indicator for private visibility */}
              {conversation.deletionScheduledFor && conversation.deletionVisibility === 'PRIVATE' && (
                <FiTrash2 className="h-3 w-3 text-orange-500 flex-shrink-0" title="Pending deletion" />
              )}
              <h3 className={`font-semibold truncate ${conversation.isAnonymized ? 'italic' : ''}`}>
                {conversation.type === 'PRIVATE_DM' && otherDmParticipant
                  ? otherDmParticipant.name || conversation.title || 'Direct message'
                  : conversation.title || 'Untitled'}
              </h3>
              {conversation.isLocked && (
                <Badge variant="outline" className="text-xs">Locked</Badge>
              )}
            </div>

            {/* Lightweight preview for non-thread chats */}
            {conversation.type !== 'PUBLIC_THREAD' && conversation.lastMessage?.content && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {conversation.lastMessage.content}
              </p>
            )}

            {/* Description for public threads */}
            {conversation.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {conversation.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {/* Creator - show [Deleted User] if anonymized */}
              <div className="flex items-center gap-1">
                {conversation.isAnonymized ? (
                  <>
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px] bg-muted">?</AvatarFallback>
                    </Avatar>
                    <span className="italic text-muted-foreground/70">[Deleted User]</span>
                  </>
                ) : (
                  <>
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={conversation.user?.image} />
                      <AvatarFallback className="text-[8px]">
                        {conversation.user?.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span>{conversation.user?.name || 'Unknown'}</span>
                  </>
                )}
              </div>

              {/* DM target / participants */}
              {conversation.type === 'PRIVATE_DM' && otherDmParticipant ? (
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">to</span>
                  <span className="font-medium text-foreground/90">{otherDmParticipant.name || 'User'}</span>
                </span>
              ) : (
                participants.length > 0 && (
                  <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
                )
              )}

              {/* Message count */}
              <span>{conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}</span>

              {/* Poll indicator */}
              {conversation.hasPoll && (
                <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400" title="Has a poll">
                  <FiBarChart2 className="h-3 w-3" />
                  Poll
                </span>
              )}

              {/* Engagement metrics for public threads - "reach over followers" */}
              {(conversation.viewCount ?? 0) > 0 && conversation.type === 'PUBLIC_THREAD' && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400" title={`${conversation.uniqueViewCount || 0} unique`}>
                  <FiTrendingUp className="h-3 w-3" />
                  {conversation.viewCount ?? 0} views
                </span>
              )}

              {/* Time */}
              {timeAgo && <span>{timeAgo}</span>}
            </div>

            {/* Tags - clickable for filtering */}
            {conversation.tags && conversation.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {/* Show first 3 tags, or all if expanded */}
                {(expandedTags[conversation.id] ? conversation.tags : conversation.tags.slice(0, 3)).map(tag => (
                  <Badge
                    key={tag}
                    variant={tagFilter === tag ? 'default' : 'secondary'}
                    className={`text-xs cursor-pointer hover:bg-primary/20 transition-colors ${
                      tagFilter === tag ? 'ring-1 ring-primary' : ''
                    }`}
                    onClick={(e) => handleTagClick(tag, e)}
                    title={`Filter by #${tag}`}
                  >
                    #{tag}
                  </Badge>
                ))}
                {/* +N button to reveal more tags */}
                {conversation.tags.length > 3 && !expandedTags[conversation.id] && (
                  <Badge
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-muted transition-colors"
                    onClick={(e) => toggleExpandedTags(conversation.id, e)}
                    title="Show all tags"
                  >
                    +{conversation.tags.length - 3}
                  </Badge>
                )}
                {/* Collapse button when expanded */}
                {conversation.tags.length > 3 && expandedTags[conversation.id] && (
                  <Badge
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-muted transition-colors"
                    onClick={(e) => toggleExpandedTags(conversation.id, e)}
                    title="Show fewer tags"
                  >
                    −
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto p-4 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="text-sm text-muted-foreground">
            Browse and manage your conversations
          </p>
        </div>
        <Link href="/conversations/new">
          <Button className="gap-2">
            <FiPlus className="h-4 w-4" />
            New
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="mine">My Conversations</TabsTrigger>
            <TabsTrigger value="public">Public Threads</TabsTrigger>
            <TabsTrigger value="all">All Accessible</TabsTrigger>
          </TabsList>

          {/* Sort dropdown - visible for public/all tabs
              Philosophy: "Reach over followers" - surface genuinely engaging content */}
          {(activeTab === 'public' || activeTab === 'all') && (
            <div className="flex items-center gap-2">
              <FiTrendingUp className="h-4 w-4 text-muted-foreground" />
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Active tag filter indicator */}
        {tagFilter && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtering by:</span>
            <Badge variant="default" className="gap-1 pr-1">
              #{tagFilter}
              <button
                onClick={clearTagFilter}
                className="ml-1 rounded-full hover:bg-white/20 p-0.5 transition-colors"
                title="Clear filter"
              >
                <FiX className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}

        <TabsContent value={activeTab} className="mt-4">
          {/* Apply tag filter to conversations */}
          {(() => {
            const filteredConversations = tagFilter
              ? conversations.filter(c => c.tags?.includes(tagFilter))
              : conversations;

            return isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div
                  key={index}
                  className="bg-muted/50 p-4 rounded-lg animate-pulse h-24"
                />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <FiMessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">
                {tagFilter ? 'No matching conversations' : 'No conversations'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {tagFilter
                  ? `No conversations found with tag #${tagFilter}`
                  : activeTab === 'mine'
                  ? "You haven't started any conversations yet."
                  : activeTab === 'public'
                  ? "There are no public threads at the moment."
                  : "No conversations available."}
              </p>
              {tagFilter ? (
                <Button variant="outline" className="gap-2" onClick={clearTagFilter}>
                  <FiX className="h-4 w-4" />
                  Clear filter
                </Button>
              ) : (
                <Link href="/conversations/new">
                  <Button variant="outline" className="gap-2">
                    <FiPlus className="h-4 w-4" />
                    Start a conversation
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredConversations.map(renderConversationCard)}
            </ul>
          );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConversationsPage;