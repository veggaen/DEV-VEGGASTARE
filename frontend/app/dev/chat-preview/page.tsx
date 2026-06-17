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
      <div className="flex items-center justify-between border-b border-border bg-card/70 px-4 py-3 backdrop-blur-xl">
        <h1 className="font-semibold">Chat preview (dev)</h1>
        <button
          onClick={() => setTyping((t) => !t)}
          className="rounded-lg border border-border px-3 py-1 text-xs"
        >
          {typing ? 'Hide' : 'Show'} typing indicator
        </button>
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
