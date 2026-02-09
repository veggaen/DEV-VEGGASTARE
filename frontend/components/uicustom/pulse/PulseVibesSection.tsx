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
} from 'react-icons/fi';
import { PulseHeart } from '@/components/uicustom/icons/PulseIcons';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  heartbeatCount?: number;
  hasHeartbeated?: boolean;
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
        <div ref={scrollRef} className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`group flex gap-3 rounded-xl bg-muted/50 p-3 transition-colors hover:bg-muted ${
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
                <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border">
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

                  {canManageComment(message.sender?.id) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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

                {/* Vibe stats — heartbeat */}
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!currentUser || pulsingVibeId === message.id}
                    onClick={() => void handleVibeHeartbeat(message.id)}
                    className={`flex items-center gap-1 text-xs transition-all hover:text-red-500 group ${
                      message.hasHeartbeated ? 'text-red-500' : 'text-muted-foreground'
                    }`}
                  >
                    <PulseHeart
                      size={14}
                      filled={!!message.hasHeartbeated}
                      className={`transition-transform ${message.hasHeartbeated ? 'scale-110' : 'group-hover:scale-105'}`}
                    />
                    {(message.heartbeatCount ?? 0) > 0 && (
                      <span className="tabular-nums">{message.heartbeatCount}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}

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
