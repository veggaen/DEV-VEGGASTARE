'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
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
import { 
  FiPlus, FiMessageCircle, FiUsers, FiLock, FiClock, 
  FiTrash2, FiMoreVertical, FiEdit, FiShare2, FiEye, FiEyeOff,
  FiSearch, FiInbox
} from 'react-icons/fi';
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
  userId: string;
  createdAt: string;
  updatedAt: string;
  deletionRequestedAt?: string;
  deletionScheduledFor?: string;
  deletionVisibility?: 'PUBLIC' | 'PRIVATE';
  isAnonymized?: boolean;
  originalUserId?: string;
}

type SortType = 'recent' | 'active' | 'unread';

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'active', label: 'Most Active' },
  { value: 'unread', label: 'Unread First' },
];

const TYPE_ICONS: Record<Conversation['type'], React.ReactNode> = {
  PUBLIC_THREAD: <FiMessageCircle className="h-5 w-5 text-blue-500" />,
  PRIVATE_DM: <FiMessageCircle className="h-5 w-5 text-zinc-500" />,
  GROUP: <FiUsers className="h-5 w-5 text-emerald-500" />,
  RESTRICTED: <FiLock className="h-5 w-5 text-orange-500" />,
};

export default function ConversationsPage() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const currentUser = useCurrentUser();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState<string | null>(null);
  const [sort, setSort] = useState<SortType>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchConversations = useCallback(async (sortBy: SortType) => {
    setIsLoading(true);
    setError(null);
    try {
      // Only fetch user's private conversations (DMs, groups - excludes public threads/pulse)
      const response = await fetch(`/api/conversations?filter=private&sort=${sortBy}`);
      const data = await response.json();

      if (data.conversations && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      } else if (Array.isArray(data)) {
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
    fetchConversations(sort);
  }, [sort, fetchConversations]);

  const handleDelete = async (conversationId: string, visibility: 'PUBLIC' | 'PRIVATE' = 'PRIVATE', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    setActionLoading(conversationId);
    try {
      const response = await fetch(`/api/conversations/${conversationId}?visibility=${visibility}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchConversations(sort);
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

  const handleCancelDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(conversationId);
    try {
      const response = await fetch(`/api/conversations/${conversationId}?cancel=true`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchConversations(sort);
      }
    } catch (error) {
      console.error('Error cancelling deletion:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const canManage = (conversation: Conversation) => {
    if (!currentUser) return false;
    return (
      currentUser.id === conversation.userId ||
      currentUser.id === conversation.originalUserId ||
      (currentUser as any).role === 'ADMIN' ||
      (currentUser as any).role === 'OWNER'
    );
  };

  const handleConversationClick = (id: string) => {
    setIsNavigating(id);
    router.push(`/conversations/${id}`);
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.title?.toLowerCase().includes(query) ||
      conv.description?.toLowerCase().includes(query) ||
      conv.participantDetails?.some(p => p.name?.toLowerCase().includes(query))
    );
  });

  const renderConversationCard = (conversation: Conversation, index: number) => {
    const participants = conversation.participantDetails || [];
    const otherParticipant =
      conversation.type === 'PRIVATE_DM' && currentUser?.id
        ? participants.find((p) => p.id !== currentUser.id) || participants[0]
        : null;
    const timeAgo = conversation.updatedAt
      ? formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })
      : '';

    return (
      <motion.div
        key={conversation.id}
        initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: index * 0.03 }}
        onClick={() => handleConversationClick(conversation.id)}
        className="group relative cursor-pointer rounded-2xl border border-border/60 bg-zinc-100/80 dark:bg-card/30 p-4 transition-all hover:bg-zinc-200/80 dark:hover:bg-card/60 hover:border-border"
      >
        {isNavigating === conversation.id && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-2xl z-10">
            <Spinner />
          </div>
        )}

        <div className="flex items-start gap-4">
          {/* Avatar */}
          {conversation.type === 'PRIVATE_DM' && otherParticipant ? (
            <Avatar className="h-12 w-12 shrink-0 ring-2 ring-border/30">
              <AvatarImage src={otherParticipant.image} />
              <AvatarFallback className="bg-linear-to-br from-indigo-500 to-purple-600 text-white">
                {otherParticipant.name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
          ) : conversation.type === 'GROUP' ? (
            <div className="relative h-12 w-12 shrink-0">
              {participants.slice(0, 2).map((p, i) => (
                <Avatar key={p.id} className={`h-8 w-8 absolute ${i === 0 ? 'top-0 left-0' : 'bottom-0 right-0'} ring-2 ring-background`}>
                  <AvatarImage src={p.image} />
                  <AvatarFallback className="bg-linear-to-br from-emerald-500 to-teal-600 text-white text-xs">
                    {p.name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
              ))}
              {participants.length > 2 && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-muted text-[10px] flex items-center justify-center text-muted-foreground ring-2 ring-background">
                  +{participants.length - 2}
                </div>
              )}
            </div>
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
              {TYPE_ICONS[conversation.type]}
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Pending deletion banner */}
            {conversation.deletionScheduledFor && (
              <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded mb-2 -mt-1">
                <FiTrash2 className="h-3 w-3 shrink-0" />
                <span>
                  Deletion in {formatDistanceToNowStrict(new Date(conversation.deletionScheduledFor))}
                </span>
              </div>
            )}

            {/* Title row */}
            <div className="flex items-center gap-2 mb-1">
              {conversation.isPinned && (
                <BsPin className="h-3 w-3 text-amber-400 shrink-0" />
              )}
              <h3 className={`font-semibold text-foreground truncate ${conversation.isAnonymized ? 'italic' : ''}`}>
                {conversation.type === 'PRIVATE_DM' && otherParticipant
                  ? otherParticipant.name || 'Direct message'
                  : conversation.title || 'Untitled conversation'}
              </h3>
              {conversation.isLocked && <FiLock className="h-3 w-3 text-orange-400" />}
            </div>

            {/* Last message preview */}
            {conversation.lastMessage && (
              <p className="text-sm text-muted-foreground truncate mb-2">
                {conversation.lastMessage.content}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {conversation.type === 'GROUP' && (
                <span className="flex items-center gap-1">
                  <FiUsers className="h-3 w-3" />
                  {participants.length}
                </span>
              )}
              <span className="flex items-center gap-1">
                <FiMessageCircle className="h-3 w-3" />
                {conversation.messageCount}
              </span>
              <span className="flex items-center gap-1">
                <FiClock className="h-3 w-3" />
                {timeAgo}
              </span>
            </div>
          </div>

          {/* Actions dropdown */}
          {canManage(conversation) && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-muted"
                    disabled={actionLoading === conversation.id}
                  >
                    {actionLoading === conversation.id ? (
                      <Spinner />
                    ) : (
                      <FiMoreVertical className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/conversations/${conversation.id}/edit`);
                    }}
                    className="text-foreground/80 hover:text-foreground focus:text-foreground"
                  >
                    <FiEdit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`${window.location.origin}/conversations/${conversation.id}`);
                    }}
                    className="text-foreground/80 hover:text-foreground focus:text-foreground"
                  >
                    <FiShare2 className="h-4 w-4 mr-2" />
                    Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  {conversation.deletionScheduledFor ? (
                    <DropdownMenuItem
                      onClick={(e) => handleCancelDelete(conversation.id, e)}
                      className="text-emerald-400 focus:text-emerald-400"
                    >
                      <FiEye className="h-4 w-4 mr-2" />
                      Cancel Deletion
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={(e) => handleDelete(conversation.id, 'PRIVATE', e)}
                      className="text-red-400 focus:text-red-400"
                    >
                      <FiTrash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  if (!currentUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-linear-to-b from-black/5 via-transparent to-black/5 dark:from-black/15 dark:to-black/5" />
        <motion.div
          className="absolute -right-20 top-32 h-[480px] w-[480px] rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, -10, 0], y: [0, 8, 0], opacity: [0.08, 0.14, 0.08] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: "radial-gradient(closest-side, rgba(99,102,241,0.12), rgba(168,85,247,0.06), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-6 py-10 lg:py-12">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl mb-2">
                  Messages
                </h1>
                <p className="text-muted-foreground text-sm">
                  Your private conversations and group chats
                </p>
              </div>
              <Link href="/conversations/new">
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
                  <FiPlus className="h-4 w-4" />
                  New Chat
                </Button>
              </Link>
            </div>

            {/* Search and Sort */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-colors hover:bg-background/70 focus:border-primary/50 focus:bg-background/70"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
                <SelectTrigger className="w-40 h-10 border-border bg-background/50 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-foreground">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </header>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
              <p className="text-red-400">{error}</p>
              <Button
                variant="outline"
                className="mt-4 border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => fetchConversations(sort)}
              >
                Try Again
              </Button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-zinc-100/80 dark:bg-card/30 p-12 text-center">
              <FiInbox className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No conversations yet</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Start a new conversation to connect with others
              </p>
              <Link href="/conversations/new">
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
                  <FiPlus className="h-4 w-4" />
                  Start a Conversation
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConversations.map((conv, index) => renderConversationCard(conv, index))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
