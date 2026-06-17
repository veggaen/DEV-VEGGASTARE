'use client';

/**
 * @fileOverview DEV-ONLY preview of the chat frames with mock data, so we can
 * visually verify the modernized MessageList + MessageInput (entrance
 * animations, scroll-to-bottom, emoji, animated send, typing indicator) without
 * needing a real conversation/account. Not linked anywhere; 404s in production.
 *
 * @stability experimental
 */
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { MessageList } from '@/components/uicustom/chats/message-list';
import { MessageInput } from '@/components/uicustom/chats/message-input';
import { TypingIndicator } from '@/components/uicustom/chats/primitives/TypingIndicator';

const NOW = Date.now();
const mins = (m: number) => new Date(NOW - m * 60_000).toISOString();

const MOCK_USERS = [
  { id: 'me', name: 'You', image: null },
  { id: 'alex', name: 'Alex Rivera', image: null },
];

const MOCK_MESSAGES = [
  { id: '1', content: 'Hey! Did you see the new wallet panel?', senderId: 'alex', createdAt: mins(58) },
  { id: '2', content: 'Yeah — the connect flow feels way smoother now 🔥', senderId: 'me', createdAt: mins(56) },
  { id: '3', content: 'Right? And dark mode actually looks premium.', senderId: 'alex', createdAt: mins(55) },
  { id: '4', content: 'Should we ship the paper-trading test chains to everyone?', senderId: 'alex', createdAt: mins(54) },
  { id: '5', content: 'Let me try a few messages to test the entrance animation and the scroll-to-bottom button when the thread gets long enough to scroll.', senderId: 'me', createdAt: mins(40) },
  { id: '6', content: 'Sounds good 👍', senderId: 'alex', createdAt: mins(12) },
  { id: '7', content: 'Testing the animated send button + emoji picker now 😎', senderId: 'me', createdAt: mins(2) },
];

export default function ChatPreviewPage() {
  // Hard gate: dev only.
  if (process.env.NODE_ENV === 'production') notFound();

  const [typing, setTyping] = useState(true);

  return (
    <div className="relative flex h-[calc(100vh-64px)] flex-col">
      {/* Mock of the real conversation header (for visual verification) */}
      <div className="flex items-center gap-2.5 border-b border-black/5 dark:border-white/8 bg-background/70 backdrop-blur-xl px-3 py-2.5">
        <div className="grid place-items-center h-9 w-9 rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </div>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white text-sm font-medium">A</div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="font-semibold text-[15px] text-foreground truncate">Alex Rivera</h1>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400/80">Active now</p>
          </div>
        </div>
        <button
          onClick={() => setTyping((t) => !t)}
          className="rounded-lg border border-border px-3 py-1 text-xs"
        >
          {typing ? 'Hide' : 'Show'} typing
        </button>
        <div className="grid place-items-center h-9 w-9 rounded-full text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-linear-to-b from-muted/30 to-transparent dark:from-white/2">
        <MessageList
          messages={MOCK_MESSAGES}
          users={MOCK_USERS}
          conversationId="preview"
          loading={false}
        />
      </div>

      {/* Mirror the real conversation page: gradient fade + centered dock. */}
      <div className="bg-linear-to-t from-background via-background/95 to-transparent px-4 pb-4 pt-6">
        <div className="mx-auto w-full max-w-3xl">
          {typing && (
            <div className="mb-2 px-1">
              <TypingIndicator label="Alex is typing…" />
            </div>
          )}
          <MessageInput conversationId="preview" onMessageSent={() => {}} />
        </div>
      </div>
    </div>
  );
}
