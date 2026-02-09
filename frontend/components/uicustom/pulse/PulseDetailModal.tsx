'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageInput } from '@/components/uicustom/chats/message-input';
import { PollDisplay } from '@/components/uicustom/chats/poll-display';
import { useCurrentUser } from '@/hooks/use-current-user';
import { UseCurrentRole } from '@/hooks/use-current-role';
import { UserHoverCard } from '@/components/uicustom/UserHoverCard';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDistanceToNowStrict } from 'date-fns';
import { 
  FiX, 
  FiMessageCircle, 
  FiRepeat, 
  FiTrendingUp, 
  FiEye,
  FiExternalLink,
  FiCopy,
  FiCheck,
  FiBarChart2,
  FiUsers as FiUsersIcon,
  FiArrowRight,
  FiMoreHorizontal,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import { PulseHeart } from '@/components/uicustom/icons/PulseIcons';
import usePusher from '@/hooks/usePusher';
import Spinner from '@/components/uicustom/spinner';
import RichTextContent from '@/components/uicustom/pulse/RichTextContent';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  sender: {
    id: string;
    name: string | null;
    image?: string | null;
  };
}

interface AdvancedPollPreview {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  totalResponses: number;
}

interface PulseData {
  id: string;
  title: string | null;
  description?: string;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    image?: string | null;
  };
  tags: string[];
  messageCount: number;
  viewCount?: number;
  uniqueViewCount?: number;
  repostCount?: number;
  positivePulseCount?: number;
  hasPoll?: boolean;
  advancedPoll?: AdvancedPollPreview | null;
}

interface PulseDetailModalProps {
  pulseId: string | null;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
  advancedPoll?: AdvancedPollPreview | null;
  onOpenPoll?: (pollId: string) => void;
}

export function PulseDetailModal({ pulseId, onClose, onTagClick, advancedPoll, onOpenPoll }: PulseDetailModalProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const userRole = UseCurrentRole();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [rootMessageContent, setRootMessageContent] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [modalHeight, setModalHeight] = useState<number | null>(null);
  
  // Comment edit/delete state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  
  // Permission checks
  const isPlatformAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  
  // Check if user can manage a specific comment
  const canManageComment = (senderId: string) => {
    return currentUser?.id === senderId || isPlatformAdmin;
  };
  
  // Handle comment edit
  const handleEditComment = async (messageId: string) => {
    if (!editContent.trim()) return;
    
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      
      if (!res.ok) throw new Error('Failed to update comment');
      
      // Update local state
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: editContent.trim(), editedAt: new Date().toISOString() }
            : msg
        )
      );
      
      setEditingMessageId(null);
      setEditContent('');
      toast.success('Comment updated');
    } catch (err) {
      console.error('Edit comment failed:', err);
      toast.error('Failed to update comment');
    }
  };
  
  // Handle comment delete
  const handleDeleteComment = async (messageId: string) => {
    setDeletingMessageId(messageId);
    
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Failed to delete comment');
      
      // Remove from local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast.success('Comment deleted');
    } catch (err) {
      console.error('Delete comment failed:', err);
      toast.error('Failed to delete comment');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const { titleText, bodyText } = useMemo(() => {
    const title = pulse?.title?.trim() || '';
    const description = pulse?.description?.trim() || '';
    const root = rootMessageContent?.trim() || '';

    // Prefer stored description; otherwise fall back to the root message.
    const body = description || root || title;

    // Only show title separately when it's clearly not an auto-generated preview of the body.
    const shouldShowTitle = Boolean(
      title &&
        description &&
        title !== description &&
        !description.startsWith(title)
    );

    return {
      titleText: shouldShowTitle ? title : '',
      bodyText: body,
    };
  }, [pulse, rootMessageContent]);

  // Fetch pulse details and messages
  const fetchPulseData = useCallback(async () => {
    if (!pulseId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/messages?conversationId=${encodeURIComponent(pulseId)}`);
      if (!res.ok) throw new Error('Failed to load pulse');
      
      const data = await res.json();
      
      if (data.conversation) {
        // Normalize user data (API returns User but we expect user)
        const conv = data.conversation;
        setPulse({
          ...conv,
          user: conv.User || conv.user,
        });
        
        // Normalize message sender data (API returns User but we expect sender)
        const allMessages = (data.messages || []).map(
          (msg: Message & {
            User?: { id: string; name: string | null; image?: string | null };
          }) => ({
            ...msg,
            sender: msg.User || msg.sender,
          })
        );

        // Treat the first message as the pulse itself (root post), not a comment.
        const root = allMessages[0];
        setRootMessageContent(root?.content?.trim() || null);
        setMessages(allMessages.slice(1));
      } else {
        // No conversation data, just set messages as-is
        const normalizedMessages = (data.messages || []).map((msg: Message & { User?: { id: string; name: string | null; image?: string | null } }) => ({
          ...msg,
          sender: msg.User || msg.sender,
        }));
        const root = normalizedMessages[0];
        setRootMessageContent(root?.content?.trim() || null);
        setMessages(normalizedMessages.slice(1));
      }
      
      // Track view in background (non-blocking)
      fetch(`/api/conversations/${pulseId}/view`, { method: 'POST' }).catch(() => {});
    } catch (err) {
      console.error('Failed to fetch pulse:', err);
      setError('Failed to load pulse');
    } finally {
      setLoading(false);
    }
  }, [pulseId]);

  useEffect(() => {
    if (pulseId) {
      fetchPulseData();
    }
  }, [pulseId, fetchPulseData]);

  // Real-time updates via shared Pusher singleton
  const channelName = pulseId ? `ConversationChannel_${pulseId}` : '';

  usePusher<{ message: Message }>(
    channelName,
    'new-message',
    useCallback((data) => {
      setMessages(prev => [...prev, data.message]);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }, [])
  );

  usePusher<{ messageId: string; content: string; editedAt: string }>(
    channelName,
    'edit-message',
    useCallback((data) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: data.content, editedAt: data.editedAt }
            : msg
        )
      );
    }, [])
  );

  usePusher<{ messageId: string }>(
    channelName,
    'delete-message',
    useCallback((data) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    }, [])
  );

  const handleMessageSent = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const openFullPage = () => {
    router.push(`/pulse/${pulseId}`);
    onClose();
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/pulse/${pulseId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Close on Escape
  useEffect(() => {
    if (!pulseId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pulseId, onClose]);

  // Pre-compute a stable modal height (prevents stutter when content loads)
  useEffect(() => {
    if (!pulseId) {
      setModalHeight(null);
      return;
    }

    const compute = () => {
      // Keep it feeling like a macOS popover: tall enough to read, never full-screen.
      const vh = window.innerHeight;
      const target = Math.min(Math.floor(vh * 0.86), 760);
      setModalHeight(Math.max(520, target));
    };

    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [pulseId]);

  const handleOverlayPointerDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const isOpen = Boolean(pulseId);

  const modalEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
  const compactHeight = 210;
  const expandedHeight = modalHeight ?? 640;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: modalEase }}
            className="fixed inset-0 z-[80] bg-black/50 dark:bg-black/70 backdrop-blur-sm"
            style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
            }}
          />

          {/* Modal overlay (keeps it centered on all screens) */}
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            onMouseDown={handleOverlayPointerDown}
            onTouchStart={handleOverlayPointerDown}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, filter: 'blur(8px)', height: compactHeight }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', height: expandedHeight }}
              exit={{ opacity: 0, y: 8, filter: 'blur(6px)', height: compactHeight }}
              transition={{ duration: 0.24, ease: modalEase }}
              className="w-full max-w-2xl max-h-[90dvh] overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl bg-white dark:bg-zinc-900 flex flex-col"
              style={{
                transformOrigin: '50% 50%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                  <FiTrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-foreground/80 dark:text-white/80">Pulse</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyLink}
                  className="h-8 gap-1.5 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white"
                >
                  {copied ? <FiCheck className="h-3.5 w-3.5 text-emerald-500" /> : <FiCopy className="h-3.5 w-3.5" />}
                  <span className="text-xs">{copied ? 'Copied!' : 'Share'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openFullPage}
                  className="h-8 gap-1.5 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white"
                >
                  <FiExternalLink className="h-3.5 w-3.5" />
                  <span className="text-xs">Expand</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white"
                >
                  <FiX className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Advanced Poll Banner - Show when pulse has an advanced poll */}
            {advancedPoll && (
              <div className="border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10">
                <button
                  onClick={() => {
                    if (onOpenPoll) {
                      onOpenPoll(advancedPoll.id);
                    } else {
                      // Fallback: update URL and close modal
                      const url = new URL(window.location.href);
                      url.searchParams.set('poll', advancedPoll.id);
                      window.history.pushState({}, '', url.toString());
                      window.dispatchEvent(new PopStateEvent('popstate'));
                      onClose();
                    }
                  }}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-emerald-500/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <FiBarChart2 className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">
                          {advancedPoll.type === 'REACH_ASSESSMENT' ? '🎯 ' : '📊 '}
                          {advancedPoll.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <FiUsersIcon className="h-3 w-3" />
                          {advancedPoll.totalResponses} responses
                        </span>
                        {advancedPoll.description && (
                          <span className="line-clamp-1">{advancedPoll.description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <span className="text-sm font-medium group-hover:underline">Take Poll</span>
                    <FiArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            )}

            {error ? (
              <div className="flex flex-1 min-h-0 flex-col">
                <div className="flex-1 min-h-0 flex items-center justify-center px-6">
                  <div className="w-full max-w-md text-center text-muted-foreground">
                    <p className="text-sm">{error}</p>
                    <div className="mt-4 flex justify-center">
                      <Button variant="outline" size="sm" onClick={onClose}>
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col">
                {/* Scrollable content */}
                <div
                  ref={scrollRef}
                  className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300 dark:scrollbar-thumb-white/10"
                >
                  <div className="p-5">
                    {loading ? (
                      <div className="flex h-64 items-center justify-center">
                        <Spinner />
                      </div>
                    ) : pulse ? (
                      <>
                        {/* Original Pulse */}
                        <div className="pb-5">
                          <div className="flex gap-4">
                            {/* Avatar with glow */}
                            <div className="relative shrink-0">
                          <UserHoverCard
                            userId={pulse.userId}
                            userName={pulse.user?.name}
                            userImage={pulse.user?.image}
                            side="right"
                            align="start"
                          >
                            <Avatar className="relative h-12 w-12 ring-2 ring-emerald-500/30">
                              <AvatarImage src={pulse.user?.image || undefined} />
                              <AvatarFallback className="bg-emerald-600 text-white font-semibold">
                                {pulse.user?.name?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                          </UserHoverCard>
                            </div>

                            <div className="min-w-0 flex-1">
                          {/* Author info */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <UserHoverCard
                              userId={pulse.userId}
                              userName={pulse.user?.name}
                              userImage={pulse.user?.image}
                              side="bottom"
                              align="start"
                            >
                              <span className="font-semibold text-foreground dark:text-white">
                                {pulse.user?.name || 'Anonymous'}
                              </span>
                            </UserHoverCard>
                            <span className="text-muted-foreground/50 dark:text-white/30">·</span>
                            <span className="text-sm text-muted-foreground dark:text-white/50">
                              {formatDistanceToNowStrict(new Date(pulse.createdAt), { addSuffix: true })}
                            </span>
                          </div>

                          {/* Content - NO TRUNCATION */}
                          <div className="mt-3 space-y-2">
                            {titleText && (
                              <p className="text-[15px] leading-relaxed text-foreground/95 dark:text-white/95 whitespace-pre-wrap break-words">
                                {titleText}
                              </p>
                            )}
                            {bodyText && (
                              <RichTextContent
                                content={bodyText}
                                className="text-[15px] leading-relaxed text-foreground/80 dark:text-white/80"
                                embedYouTube={true}
                                maxYouTubeEmbeds={3}
                              />
                            )}
                          </div>

                          {/* Poll */}
                          {pulse.hasPoll && (
                            <div className="mt-4">
                              <PollDisplay conversationId={pulse.id} />
                            </div>
                          )}

                          {/* Tags */}
                          {pulse.tags && pulse.tags.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {pulse.tags.map(tag => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="cursor-pointer border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-200 transition-colors"
                                  onClick={() => {
                                    onTagClick?.(tag);
                                    onClose();
                                  }}
                                >
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Stats bar */}
                          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
                            {/* Heartbeats (likes) */}
                            <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
                              <PulseHeart size={16} filled={(pulse.positivePulseCount || 0) > 0} />
                              <span>{pulse.positivePulseCount || 0}</span>
                            </div>
                            
                            {/* Vibes (comments) */}
                            <div className="flex items-center gap-2 text-muted-foreground dark:text-white/50">
                              <FiMessageCircle className="h-4 w-4" />
                              <span>{messages.length}</span>
                            </div>
                            
                            {/* Reposts */}
                            {pulse.repostCount !== undefined && pulse.repostCount > 0 && (
                              <div className="flex items-center gap-2 text-muted-foreground dark:text-white/50">
                                <FiRepeat className="h-4 w-4" />
                                <span>{pulse.repostCount}</span>
                              </div>
                            )}
                            
                            {/* Views with unique on hover */}
                            {pulse.viewCount !== undefined && pulse.viewCount > 0 && (
                              <div 
                                className="group relative flex items-center gap-2 text-muted-foreground dark:text-white/50 cursor-default"
                                title={pulse.uniqueViewCount ? `${pulse.uniqueViewCount} unique viewers` : undefined}
                              >
                                <FiEye className="h-4 w-4" />
                                <span>{pulse.viewCount}</span>
                                {pulse.uniqueViewCount !== undefined && pulse.uniqueViewCount > 0 && (
                                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 dark:bg-zinc-700 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                                    {pulse.uniqueViewCount} unique
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-200 dark:border-white/10" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white dark:bg-zinc-900 px-3 text-xs font-medium text-muted-foreground dark:text-white/40">
                          {messages.length > 0 ? `${messages.length} vibes` : 'No vibes yet'}
                        </span>
                      </div>
                    </div>

                    {/* Comments/Messages */}
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`group flex gap-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
                            deletingMessageId === message.id ? 'opacity-50' : ''
                          }`}
                        >
                          <UserHoverCard
                            userId={message.sender?.id}
                            userName={message.sender?.name}
                            userImage={message.sender?.image}
                            side="right"
                            align="start"
                          >
                            <Avatar className="h-9 w-9 shrink-0 ring-1 ring-zinc-200 dark:ring-white/10">
                              <AvatarImage src={message.sender?.image || undefined} />
                              <AvatarFallback className="bg-zinc-500 dark:bg-zinc-600 text-sm text-white">
                                {message.sender?.name?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                          </UserHoverCard>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <UserHoverCard
                                  userId={message.sender?.id}
                                  userName={message.sender?.name}
                                  userImage={message.sender?.image}
                                  side="bottom"
                                  align="start"
                                >
                                  <span className="text-sm font-medium text-foreground/90 dark:text-white/90">
                                    {message.sender?.name || 'Anonymous'}
                                  </span>
                                </UserHoverCard>
                                <span className="text-xs text-muted-foreground dark:text-white/40">
                                  {formatDistanceToNowStrict(new Date(message.createdAt), { addSuffix: true })}
                                </span>
                                {message.editedAt && (
                                  <span className="text-xs text-muted-foreground/70 dark:text-white/30">(edited)</span>
                                )}
                              </div>
                              
                              {/* Edit/Delete menu for comment owner or admin */}
                              {canManageComment(message.sender?.id) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
                                      <FiMoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditContent(message.content);
                                        setEditingMessageId(message.id);
                                      }}
                                    >
                                      <FiEdit2 className="h-4 w-4 mr-2" />
                                      Edit
                                      {isPlatformAdmin && currentUser?.id !== message.sender?.id && (
                                        <span className="ml-auto text-[10px] px-1 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">Admin</span>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteComment(message.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <FiTrash2 className="h-4 w-4 mr-2" />
                                      Delete
                                      {isPlatformAdmin && currentUser?.id !== message.sender?.id && (
                                        <span className="ml-auto text-[10px] px-1 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">Admin</span>
                                      )}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            
                            {/* Edit mode or display mode */}
                            {editingMessageId === message.id ? (
                              <div className="mt-2 space-y-2">
                                <Textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="min-h-[60px] text-sm resize-none"
                                  autoFocus
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditContent('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleEditComment(message.id)}
                                    disabled={!editContent.trim()}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <RichTextContent
                                content={message.content}
                                className="mt-1 text-sm leading-relaxed text-foreground/80 dark:text-white/80"
                                embedYouTube={true}
                                maxYouTubeEmbeds={1}
                              />
                            )}
                          </div>
                        </div>
                      ))}

                      {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <FiMessageCircle className="h-6 w-6 text-muted-foreground dark:text-white/30" />
                          </div>
                          <p className="text-sm text-muted-foreground dark:text-white/50">Be the first to drop a vibe</p>
                        </div>
                      )}
                    </div>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Message input */}
                {currentUser ? (
                  <div className="shrink-0 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                    <MessageInput
                      conversationId={pulseId!}
                      onMessageSent={handleMessageSent}
                    />
                  </div>
                ) : (
                  <div className="shrink-0 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                    <p className="text-center text-sm text-muted-foreground dark:text-white/50">
                      <Button
                        variant="link"
                        className="h-auto p-0 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                        onClick={() => router.push('/auth/login')}
                      >
                        Sign in
                      </Button>{' '}
                      to join the conversation
                    </p>
                  </div>
                )}
              </div>
            )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
