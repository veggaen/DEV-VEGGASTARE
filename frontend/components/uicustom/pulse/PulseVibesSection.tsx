'use client';

/**
 * PulseVibesSection — live conversation thread for the standalone /pulse/[id] page.
 *
 * Fetches vibes (comments) via the same API the modal uses, subscribes to
 * real-time updates via Pusher, and renders an inline MessageInput for
 * authenticated users.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageInput } from '@/components/uicustom/chats/message-input';
import { UserHoverCard } from '@/components/uicustom/UserHoverCard';
import RichTextContent from '@/components/uicustom/pulse/RichTextContent';
import { useCurrentUser } from '@/hooks/use-current-user';
import { UseCurrentRole } from '@/hooks/use-current-role';
import usePusher from '@/hooks/usePusher';
import Spinner from '@/components/uicustom/spinner';
import { toast } from 'sonner';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FiMessageCircle,
  FiMoreHorizontal,
  FiEdit2,
  FiTrash2,
  FiCornerDownRight,
  FiRepeat,
  FiCopy,
  FiX,
} from 'react-icons/fi';
import { PulseHeart } from '@/components/uicustom/icons/PulseIcons';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  heartbeatCount?: number;
  hasHeartbeated?: boolean;
  parentId?: string | null;
  replyCount?: number;
  repostCount?: number;
  hasRepulsed?: boolean;
  sender: {
    id: string;
    name: string | null;
    image?: string | null;
  };
}

interface PulseVibesSectionProps {
  pulseId: string;
}

export function PulseVibesSection({ pulseId }: PulseVibesSectionProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const userRole = UseCurrentRole();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit / delete state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [pulsingVibeId, setPulsingVibeId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [repulsingVibeId, setRepulsingVibeId] = useState<string | null>(null);

  const isPlatformAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  const canManageComment = (senderId: string) =>
    currentUser?.id === senderId || isPlatformAdmin;

  // ── Fetch vibes ──────────────────────────────────────────────────────
  const fetchVibes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/messages?conversationId=${encodeURIComponent(pulseId)}`,
      );
      if (!res.ok) throw new Error('Failed to load vibes');
      const data = await res.json();

      const allMessages = (data.messages || []).map(
        (msg: Message & {
          User?: { id: string; name: string | null; image?: string | null };
        }) => ({
          ...msg,
          sender: msg.User || msg.sender,
          parentId: msg.parentId ?? null,
          replyCount: msg.replyCount ?? 0,
          repostCount: msg.repostCount ?? 0,
          hasRepulsed: msg.hasRepulsed ?? false,
        }),
      );

      // Skip root message (index 0) — it's the pulse body, already shown above
      setMessages(allMessages.slice(1));
    } catch (err) {
      console.error('Failed to fetch vibes:', err);
      setError('Failed to load vibes');
    } finally {
      setLoading(false);
    }
  }, [pulseId]);

  useEffect(() => {
    fetchVibes();
  }, [fetchVibes]);

  // ── Real-time via Pusher ─────────────────────────────────────────────
  const channelName = `ConversationChannel_${pulseId}`;

  usePusher<{ message: Message }>(
    channelName,
    'new-message',
    useCallback((data) => {
      setMessages((prev) => [...prev, data.message]);
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }, []),
  );

  usePusher<{ messageId: string; content: string; editedAt: string }>(
    channelName,
    'edit-message',
    useCallback((data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, content: data.content, editedAt: data.editedAt }
            : msg,
        ),
      );
    }, []),
  );

  usePusher<{ messageId: string }>(
    channelName,
    'delete-message',
    useCallback((data) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== data.messageId));
    }, []),
  );

  // Real-time vibe heartbeat updates
  usePusher<{ messageId: string; heartbeatCount: number }>(
    channelName,
    'vibe-heartbeat-update',
    useCallback((data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, heartbeatCount: data.heartbeatCount }
            : msg
        ),
      );
    }, []),
  );

  // Real-time vibe repost updates
  usePusher<{ messageId: string; repostCount: number }>(
    channelName,
    'vibe-repost-update',
    useCallback((data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, repostCount: data.repostCount }
            : msg
        ),
      );
    }, []),
  );

  // ── Edit / Delete handlers ───────────────────────────────────────────
  const handleEditComment = async (messageId: string) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update comment');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, content: editContent.trim(), editedAt: new Date().toISOString() }
            : msg,
        ),
      );
      setEditingMessageId(null);
      setEditContent('');
      toast.success('Vibe updated');
    } catch {
      toast.error('Failed to update vibe');
    }
  };

  const handleDeleteComment = async (messageId: string) => {
    setDeletingMessageId(messageId);
    try {
      const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete vibe');
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      toast.success('Vibe deleted');
    } catch {
      toast.error('Failed to delete vibe');
    } finally {
      setDeletingMessageId(null);
    }
  };

  // Handle vibe heartbeat toggle
  const handleVibeHeartbeat = async (messageId: string) => {
    if (!currentUser) return;
    setPulsingVibeId(messageId);

    // Optimistic update
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              hasHeartbeated: !msg.hasHeartbeated,
              heartbeatCount: (msg.heartbeatCount ?? 0) + (msg.hasHeartbeated ? -1 : 1),
            }
          : msg
      )
    );

    try {
      const res = await fetch(`/api/messages/${messageId}/pulse`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to toggle heartbeat');
      const data = await res.json();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, heartbeatCount: data.heartbeatCount, hasHeartbeated: data.heartbeated }
            : msg
        )
      );
    } catch {
      // Revert optimistic update
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                hasHeartbeated: !msg.hasHeartbeated,
                heartbeatCount: (msg.heartbeatCount ?? 0) + (msg.hasHeartbeated ? 1 : -1),
              }
            : msg
        )
      );
      toast.error('Failed to heartbeat vibe');
    } finally {
      setPulsingVibeId(null);
    }
  };

  // Handle vibe repulse toggle
  const handleVibeRepulse = async (messageId: string) => {
    if (!currentUser) return;
    setRepulsingVibeId(messageId);

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              hasRepulsed: !msg.hasRepulsed,
              repostCount: (msg.repostCount ?? 0) + (msg.hasRepulsed ? -1 : 1),
            }
          : msg
      )
    );

    try {
      const res = await fetch(`/api/messages/${messageId}/repost`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to toggle repulse');
      const data = await res.json();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, repostCount: data.repostCount, hasRepulsed: data.repulsed }
            : msg
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                hasRepulsed: !msg.hasRepulsed,
                repostCount: (msg.repostCount ?? 0) + (msg.hasRepulsed ? 1 : -1),
              }
            : msg
        )
      );
      toast.error('Failed to repulse vibe');
    } finally {
      setRepulsingVibeId(null);
    }
  };

  const handleMessageSent = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 100);
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <section className="mt-2">
      {/* Divider */}
      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs font-medium text-muted-foreground">
            {loading
              ? 'Loading vibes…'
              : messages.length > 0
                ? `${messages.length} ${messages.length === 1 ? 'vibe' : 'vibes'}`
                : 'No vibes yet'}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center mb-4">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : (
        (() => {
          const topLevel = messages.filter(m => !m.parentId);
          const repliesByParent = new Map<string, Message[]>();
          for (const m of messages) {
            if (m.parentId) {
              const arr = repliesByParent.get(m.parentId) || [];
              arr.push(m);
              repliesByParent.set(m.parentId, arr);
            }
          }

          const renderVibe = (message: Message, depth: number) => (
            <div key={message.id} className={depth > 0 ? 'ml-6 border-l-2 border-border/50 pl-3' : ''}>
              <div
                className={`group/vibe flex gap-3 rounded-xl bg-muted/50 p-3 transition-colors hover:bg-muted ${
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
                  <Avatar className={`${depth > 0 ? 'h-7 w-7' : 'h-9 w-9'} shrink-0 ring-1 ring-border`}>
                    <AvatarImage src={message.sender?.image || undefined} />
                    <AvatarFallback className="bg-muted-foreground/20 text-sm">
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
                        <span className="text-sm font-medium">
                          {message.sender?.name || 'Anonymous'}
                        </span>
                      </UserHoverCard>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(message.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      {message.editedAt && (
                        <span className="text-xs text-muted-foreground/70">
                          (edited)
                        </span>
                      )}
                    </div>

                    {/* Three-dot menu — visible for ALL users */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded opacity-0 group-hover/vibe:opacity-100 hover:bg-muted transition-all">
                          <FiMoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 z-[9999]">
                        {currentUser && (
                          <DropdownMenuItem onClick={() => setReplyingToId(replyingToId === message.id ? null : message.id)}>
                            <FiCornerDownRight className="h-4 w-4 mr-2" />
                            Reply
                          </DropdownMenuItem>
                        )}
                        {currentUser && (
                          <DropdownMenuItem onClick={() => void handleVibeRepulse(message.id)}>
                            <FiRepeat className="h-4 w-4 mr-2" />
                            {message.hasRepulsed ? 'Undo repulse' : 'Repulse'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => {
                          navigator.clipboard.writeText(message.content);
                          toast.success('Copied to clipboard');
                        }}>
                          <FiCopy className="h-4 w-4 mr-2" />
                          Copy text
                        </DropdownMenuItem>
                        {canManageComment(message.sender?.id) && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditContent(message.content);
                                setEditingMessageId(message.id);
                              }}
                            >
                              <FiEdit2 className="h-4 w-4 mr-2" />
                              Edit
                              {isPlatformAdmin &&
                                currentUser?.id !== message.sender?.id && (
                                  <span className="ml-auto text-[10px] px-1 py-0.5 bg-muted rounded">
                                    Admin
                                  </span>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteComment(message.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <FiTrash2 className="h-4 w-4 mr-2" />
                              Delete
                              {isPlatformAdmin &&
                                currentUser?.id !== message.sender?.id && (
                                  <span className="ml-auto text-[10px] px-1 py-0.5 bg-muted rounded">
                                    Admin
                                  </span>
                                )}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

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
                      className="mt-1 text-sm leading-relaxed text-foreground/80"
                      embedYouTube
                      maxYouTubeEmbeds={1}
                    />
                  )}

                  {/* Action bar — always visible */}
                  <div className="mt-2 flex items-center gap-4">
                    {/* Heartbeat */}
                    <button
                      type="button"
                      disabled={!currentUser || pulsingVibeId === message.id}
                      onClick={() => void handleVibeHeartbeat(message.id)}
                      className={`flex items-center gap-1 text-xs transition-all hover:text-red-500 ${
                        message.hasHeartbeated ? 'text-red-500' : 'text-muted-foreground'
                      }`}
                    >
                      <PulseHeart
                        size={14}
                        filled={!!message.hasHeartbeated}
                        className={`transition-transform ${message.hasHeartbeated ? 'scale-110' : 'hover:scale-105'}`}
                      />
                      {(message.heartbeatCount ?? 0) > 0 && (
                        <span className="tabular-nums">{message.heartbeatCount}</span>
                      )}
                    </button>

                    {/* Reply */}
                    <button
                      type="button"
                      disabled={!currentUser}
                      onClick={() => setReplyingToId(replyingToId === message.id ? null : message.id)}
                      className={`flex items-center gap-1 text-xs transition-all hover:text-emerald-500 ${
                        replyingToId === message.id ? 'text-emerald-500' : 'text-muted-foreground'
                      }`}
                    >
                      <FiCornerDownRight className="h-3.5 w-3.5" />
                      {(message.replyCount ?? 0) > 0 && (
                        <span className="tabular-nums">{message.replyCount}</span>
                      )}
                    </button>

                    {/* Repulse */}
                    <button
                      type="button"
                      disabled={!currentUser || repulsingVibeId === message.id}
                      onClick={() => void handleVibeRepulse(message.id)}
                      className={`flex items-center gap-1 text-xs transition-all hover:text-cyan-500 ${
                        message.hasRepulsed ? 'text-cyan-500' : 'text-muted-foreground'
                      }`}
                    >
                      <FiRepeat className="h-3.5 w-3.5" />
                      {(message.repostCount ?? 0) > 0 && (
                        <span className="tabular-nums">{message.repostCount}</span>
                      )}
                    </button>
                  </div>

                  {/* Inline reply input */}
                  {replyingToId === message.id && currentUser && (
                    <div className="mt-3 rounded-lg bg-background/50 p-2 border border-border/50">
                      <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                        <FiCornerDownRight className="h-3 w-3" />
                        <span>Replying to <strong className="text-foreground/80">{message.sender?.name || 'Anonymous'}</strong></span>
                        <button
                          onClick={() => setReplyingToId(null)}
                          className="ml-auto p-0.5 rounded hover:bg-muted"
                        >
                          <FiX className="h-3 w-3" />
                        </button>
                      </div>
                      <MessageInput
                        conversationId={pulseId}
                        parentId={message.id}
                        onMessageSent={() => {
                          setReplyingToId(null);
                          handleMessageSent();
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Render nested replies */}
              {(repliesByParent.get(message.id) || []).map(reply =>
                renderVibe(reply, Math.min(depth + 1, 3))
              )}
            </div>
          );

          return (
            <div ref={scrollRef} className="space-y-3">
              {topLevel.map(m => renderVibe(m, 0))}

              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <FiMessageCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Be the first to drop a vibe
                  </p>
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Message input */}
      <div className="mt-4 rounded-xl bg-muted/30 p-3">
        {currentUser ? (
          <MessageInput
            conversationId={pulseId}
            onMessageSent={handleMessageSent}
          />
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            <Button
              variant="link"
              className="h-auto p-0 text-primary"
              onClick={() => router.push('/auth/login')}
            >
              Sign in
            </Button>{' '}
            to join the conversation
          </p>
        )}
      </div>
    </section>
  );
}
