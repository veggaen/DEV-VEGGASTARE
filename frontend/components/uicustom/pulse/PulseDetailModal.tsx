'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageInput } from '@/components/uicustom/chats/message-input';
import { PollDisplay } from '@/components/uicustom/chats/poll-display';
import { useCurrentUser } from '@/hooks/use-current-user';
import { formatDistanceToNowStrict } from 'date-fns';
import { 
  FiX, 
  FiMessageCircle, 
  FiRepeat, 
  FiTrendingUp, 
  FiEye,
  FiExternalLink,
  FiCopy,
  FiCheck
} from 'react-icons/fi';
import { PulseHeart } from '@/components/uicustom/icons/PulseIcons';
import Pusher from 'pusher-js';
import Spinner from '@/components/uicustom/spinner';

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
}

interface PulseDetailModalProps {
  pulseId: string | null;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
}

export function PulseDetailModal({ pulseId, onClose, onTagClick }: PulseDetailModalProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        const allMessages = (data.messages || []).map((msg: Message & { User?: { id: string; name: string | null; image?: string | null }; senderId?: string }) => ({
          ...msg,
          sender: msg.User || msg.sender,
        }));
        
        // Filter out the first "initial" message that duplicates the pulse content
        // This happens when creating a pulse - an initial message is auto-created
        const filteredMessages = allMessages.filter((msg: Message & { senderId?: string }, index: number) => {
          // Skip the first message if:
          // 1. It's the first message (index 0)
          // 2. It was sent by the conversation creator
          // 3. Its content matches the pulse title or description
          if (index === 0) {
            const senderId = msg.senderId || msg.sender?.id;
            const isFromCreator = senderId === conv.userId;
            const contentMatches = msg.content === conv.title || msg.content === conv.description;
            if (isFromCreator && contentMatches) {
              return false; // Filter out this duplicate
            }
          }
          return true;
        });
        
        setMessages(filteredMessages);
      } else {
        // No conversation data, just set messages as-is
        const normalizedMessages = (data.messages || []).map((msg: Message & { User?: { id: string; name: string | null; image?: string | null } }) => ({
          ...msg,
          sender: msg.User || msg.sender,
        }));
        setMessages(normalizedMessages);
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

  // Real-time updates via Pusher
  useEffect(() => {
    if (!pulseId) return;

    const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });

    const channel = pusherClient.subscribe(`ConversationChannel_${pulseId}`);

    channel.bind('new-message', (data: { message: Message }) => {
      setMessages(prev => [...prev, data.message]);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    });

    channel.bind('edit-message', (data: { messageId: string; content: string; editedAt: string }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: data.content, editedAt: data.editedAt }
            : msg
        )
      );
    });

    channel.bind('delete-message', (data: { messageId: string }) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(`ConversationChannel_${pulseId}`);
      pusherClient.disconnect();
    };
  }, [pulseId]);

  const handleMessageSent = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const openFullPage = () => {
    router.push(`/conversations/${pulseId}`);
    onClose();
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/feed?pulse=${pulseId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOpen = Boolean(pulseId);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
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
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed left-[50%] top-[50%] z-[90] w-[95vw] max-w-2xl translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-900"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxHeight: '90vh',
            }}
          >
            {/* Ambient glow effects */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20"
                style={{
                  background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
                  filter: 'blur(40px)',
                }}
              />
              <div
                className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full opacity-15"
                style={{
                  background: 'radial-gradient(circle, rgba(56, 189, 248, 0.4) 0%, transparent 70%)',
                  filter: 'blur(40px)',
                }}
              />
            </div>

            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-5 py-4">
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
                  className="h-8 gap-1.5 text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white"
                >
                  {copied ? <FiCheck className="h-3.5 w-3.5 text-emerald-500" /> : <FiCopy className="h-3.5 w-3.5" />}
                  <span className="text-xs">{copied ? 'Copied!' : 'Share'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openFullPage}
                  className="h-8 gap-1.5 text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white"
                >
                  <FiExternalLink className="h-3.5 w-3.5" />
                  <span className="text-xs">Expand</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white"
                >
                  <FiX className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex h-80 items-center justify-center">
                <Spinner />
              </div>
            ) : error ? (
              <div className="flex h-80 flex-col items-center justify-center gap-3 text-muted-foreground">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            ) : pulse ? (
              <div className="flex max-h-[calc(90vh-130px)] flex-col">
                {/* Scrollable content */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/10"
                  style={{ maxHeight: 'calc(90vh - 200px)' }}
                >
                  <div className="p-5">
                    {/* Original Pulse */}
                    <div className="pb-5">
                      <div className="flex gap-4">
                        {/* Avatar with glow */}
                        <div className="relative shrink-0">
                          <div
                            className="absolute inset-0 rounded-full opacity-40"
                            style={{
                              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.5) 0%, transparent 70%)',
                              filter: 'blur(8px)',
                              transform: 'scale(1.2)',
                            }}
                          />
                          <Avatar className="relative h-12 w-12 ring-2 ring-emerald-500/30">
                            <AvatarImage src={pulse.user?.image || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-white font-semibold">
                              {pulse.user?.name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Author info */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-foreground dark:text-white">{pulse.user?.name || 'Anonymous'}</span>
                            <span className="text-muted-foreground/50 dark:text-white/30">·</span>
                            <span className="text-sm text-muted-foreground dark:text-white/50">
                              {formatDistanceToNowStrict(new Date(pulse.createdAt), { addSuffix: true })}
                            </span>
                          </div>

                          {/* Content - NO TRUNCATION */}
                          <div className="mt-3 space-y-2">
                            {pulse.title && (
                              <p className="text-[15px] leading-relaxed text-foreground/95 dark:text-white/95 whitespace-pre-wrap break-words">
                                {pulse.title}
                              </p>
                            )}
                            {pulse.description && pulse.description !== pulse.title && (
                              <p className="text-[15px] leading-relaxed text-foreground/80 dark:text-white/80 whitespace-pre-wrap break-words">
                                {pulse.description}
                              </p>
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
                                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
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
                        <div className="w-full border-t border-slate-200 dark:border-white/10" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white dark:bg-slate-900 px-3 text-xs font-medium text-muted-foreground dark:text-white/40">
                          {messages.length > 0 ? `${messages.length} vibes` : 'No vibes yet'}
                        </span>
                      </div>
                    </div>

                    {/* Comments/Messages */}
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className="flex gap-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 p-3 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
                        >
                          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-slate-200 dark:ring-white/10">
                            <AvatarImage src={message.sender?.image || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700 text-sm text-white">
                              {message.sender?.name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-sm font-medium text-foreground/90 dark:text-white/90">
                                {message.sender?.name || 'Anonymous'}
                              </span>
                              <span className="text-xs text-muted-foreground dark:text-white/40">
                                {formatDistanceToNowStrict(new Date(message.createdAt), { addSuffix: true })}
                              </span>
                              {message.editedAt && (
                                <span className="text-xs text-muted-foreground/70 dark:text-white/30">(edited)</span>
                              )}
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-foreground/80 dark:text-white/80 whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      ))}

                      {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                            <FiMessageCircle className="h-6 w-6 text-muted-foreground dark:text-white/30" />
                          </div>
                          <p className="text-sm text-muted-foreground dark:text-white/50">Be the first to drop a vibe</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Message input */}
                {currentUser ? (
                  <div className="shrink-0 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-4">
                    <MessageInput
                      conversationId={pulse.id}
                      onMessageSent={handleMessageSent}
                    />
                  </div>
                ) : (
                  <div className="shrink-0 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-4">
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
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
