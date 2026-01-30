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
        setPulse(data.conversation);
      }
      
      setMessages(data.messages || []);
      
      // Track view with enhanced tracking
      await fetch(`/api/conversations/${pulseId}/view`, { method: 'POST' }).catch(() => {});
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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-[50%] top-[50%] z-[90] w-[95vw] max-w-2xl translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            style={{
              background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.98), rgba(10, 15, 30, 0.99))',
              boxShadow: '0 0 80px rgba(34, 197, 94, 0.08), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
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
            <div className="relative flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                  <FiTrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-white/80">Pulse</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyLink}
                  className="h-8 gap-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  {copied ? <FiCheck className="h-3.5 w-3.5 text-emerald-400" /> : <FiCopy className="h-3.5 w-3.5" />}
                  <span className="text-xs">{copied ? 'Copied!' : 'Share'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openFullPage}
                  className="h-8 gap-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <FiExternalLink className="h-3.5 w-3.5" />
                  <span className="text-xs">Expand</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-white/60 hover:bg-white/10 hover:text-white"
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
              <div className="flex h-80 flex-col items-center justify-center gap-3 text-white/60">
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
                  className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
                  style={{ maxHeight: 'calc(90vh - 200px)' }}
                >
                  <div className="p-5">
                    {/* Original post */}
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
                            <span className="font-semibold text-white">{pulse.user?.name || 'Anonymous'}</span>
                            <span className="text-white/30">·</span>
                            <span className="text-sm text-white/50">
                              {formatDistanceToNowStrict(new Date(pulse.createdAt), { addSuffix: true })}
                            </span>
                          </div>

                          {/* Content - NO TRUNCATION */}
                          <div className="mt-3 space-y-2">
                            {pulse.title && (
                              <p className="text-[15px] leading-relaxed text-white/95 whitespace-pre-wrap break-words">
                                {pulse.title}
                              </p>
                            )}
                            {pulse.description && pulse.description !== pulse.title && (
                              <p className="text-[15px] leading-relaxed text-white/80 whitespace-pre-wrap break-words">
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
                                  className="cursor-pointer border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors"
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
                          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-white/50">
                              <FiMessageCircle className="h-4 w-4" />
                              <span>{messages.length}</span>
                              <span className="hidden sm:inline">comments</span>
                            </div>
                            {pulse.repostCount !== undefined && pulse.repostCount > 0 && (
                              <div className="flex items-center gap-1.5 text-white/50">
                                <FiRepeat className="h-4 w-4" />
                                <span>{pulse.repostCount}</span>
                              </div>
                            )}
                            {pulse.viewCount !== undefined && pulse.viewCount > 0 && (
                              <div className="flex items-center gap-1.5 text-white/50">
                                <FiEye className="h-4 w-4" />
                                <span>{pulse.viewCount}</span>
                                <span className="hidden sm:inline">views</span>
                              </div>
                            )}
                            {pulse.uniqueViewCount !== undefined && pulse.uniqueViewCount > 0 && (
                              <div className="flex items-center gap-1.5 text-emerald-400/70">
                                <FiTrendingUp className="h-4 w-4" />
                                <span>{pulse.uniqueViewCount}</span>
                                <span className="hidden sm:inline">unique</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-slate-900/80 px-3 text-xs font-medium text-white/40">
                          {messages.length > 0 ? `${messages.length} vibes` : 'No vibes yet'}
                        </span>
                      </div>
                    </div>

                    {/* Comments/Messages */}
                    <div className="space-y-4">
                      {messages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03, duration: 0.2 }}
                          className="flex gap-3 rounded-xl bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                        >
                          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
                            <AvatarImage src={message.sender?.image || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-700 text-sm text-white">
                              {message.sender?.name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-sm font-medium text-white/90">
                                {message.sender?.name || 'Anonymous'}
                              </span>
                              <span className="text-xs text-white/40">
                                {formatDistanceToNowStrict(new Date(message.createdAt), { addSuffix: true })}
                              </span>
                              {message.editedAt && (
                                <span className="text-xs text-white/30">(edited)</span>
                              )}
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-white/80 whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                        </motion.div>
                      ))}

                      {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                            <FiMessageCircle className="h-6 w-6 text-white/30" />
                          </div>
                          <p className="text-sm text-white/50">Be the first to drop a vibe</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Message input */}
                {currentUser ? (
                  <div className="shrink-0 border-t border-white/10 bg-white/[0.02] p-4">
                    <MessageInput
                      conversationId={pulse.id}
                      onMessageSent={handleMessageSent}
                    />
                  </div>
                ) : (
                  <div className="shrink-0 border-t border-white/10 bg-white/[0.02] p-4">
                    <p className="text-center text-sm text-white/50">
                      <Button
                        variant="link"
                        className="h-auto p-0 text-emerald-400 hover:text-emerald-300"
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
