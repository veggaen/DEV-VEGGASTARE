"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  FiMessageSquare,
  FiSearch,
  FiArrowRight,
  FiInbox,
  FiEdit,
  FiChevronRight,
} from "react-icons/fi";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ConversationPreview {
  id: string;
  title: string | null;
  type: string;
  lastMessageAt: string | null;
  updatedAt: string;
  unreadCount: number;
  participants: {
    id: string;
    name: string | null;
    image: string | null;
  }[];
  lastMessage?: {
    id: string;
    content: string | null;
    sender: { id: string; name: string | null; image: string | null };
    createdAt: string;
  } | null;
}

interface ChatLiteDropdownProps {
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ChatLiteDropdown({ className }: ChatLiteDropdownProps) {
  const currentUser = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // SSR guard
  useEffect(() => { setMounted(true); }, []);

  // Calculate position
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  // Fetch conversations on open
  useEffect(() => {
    if (!isOpen || !currentUser?.id) return;
    setLoading(true);

    fetch("/api/conversations?filter=private&sort=recent&limit=8")
      .then((res) => (res.ok ? res.json() : { conversations: [] }))
      .then((data) => {
        const convos: ConversationPreview[] = (data.conversations ?? []).map(
          (c: Record<string, unknown>) => ({
            id: c.id,
            title: c.title,
            type: c.type,
            lastMessageAt: c.lastMessageAt,
            updatedAt: c.updatedAt,
            unreadCount: (c as Record<string, number>).unreadCount ?? 0,
            participants: (c as Record<string, unknown[]>).participants ?? [],
            lastMessage: c.lastMessage ?? null,
          })
        );
        setConversations(convos);
        setUnreadTotal(convos.reduce((t, c) => t + c.unreadCount, 0));
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, [isOpen, currentUser?.id]);

  // Focus search on open
  useEffect(() => {
    if (isOpen) setTimeout(() => searchRef.current?.focus(), 100);
  }, [isOpen]);

  // Outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Filter
  const filtered = search.trim()
    ? conversations.filter(
        (c) =>
          c.title?.toLowerCase().includes(search.toLowerCase()) ||
          c.participants.some((p) =>
            p.name?.toLowerCase().includes(search.toLowerCase())
          )
      )
    : conversations;

  // ─── Helpers ───────────────────────────────────────────────────────────

  function getConversationName(c: ConversationPreview): string {
    if (c.title) return c.title;
    const others = c.participants.filter((p) => p.id !== currentUser?.id);
    if (others.length === 0) return "Saved Messages";
    if (others.length === 1) return others[0].name ?? "Unknown";
    return others
      .slice(0, 3)
      .map((p) => p.name?.split(" ")[0] ?? "?")
      .join(", ");
  }

  function getConversationAvatar(c: ConversationPreview) {
    const others = c.participants.filter((p) => p.id !== currentUser?.id);
    return others[0]?.image ?? null;
  }

  function getConversationInitials(c: ConversationPreview) {
    const name = getConversationName(c);
    return name[0]?.toUpperCase() ?? "?";
  }

  function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
  }

  // ─── Dropdown content ──────────────────────────────────────────────────

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && mounted && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            zIndex: 9999,
          }}
          className={cn(
            "w-[360px] max-w-[calc(100vw-32px)]",
            "rounded-xl",
            "bg-white dark:bg-zinc-950",
            "border border-zinc-200 dark:border-zinc-800",
            "shadow-xl shadow-zinc-900/10 dark:shadow-black/30",
            "overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Messages
              </h3>
              <div className="flex items-center gap-1">
                <Link
                  href="/conversations"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <FiArrowRight className="h-3.5 w-3.5" />
                  See all
                </Link>
                <Link
                  href="/conversations?new=true"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  title="New conversation"
                >
                  <FiEdit className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Search */}
            <div className="relative mt-2">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="max-h-[360px] overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center">
                <div className="h-5 w-5 border-2 border-zinc-200 dark:border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Loading conversations...
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <FiInbox className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {search ? "No matches" : "No conversations yet"}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {search
                    ? "Try a different search"
                    : "Start a conversation to see it here"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filtered.map((convo) => (
                  <Link
                    key={convo.id}
                    href={`/conversations/${convo.id}`}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                      convo.unreadCount > 0 &&
                        "bg-emerald-50/40 dark:bg-emerald-900/10"
                    )}
                  >
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage
                        src={getConversationAvatar(convo) ?? undefined}
                      />
                      <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800">
                        {getConversationInitials(convo)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm truncate",
                            convo.unreadCount > 0
                              ? "font-semibold text-zinc-900 dark:text-zinc-100"
                              : "font-medium text-zinc-700 dark:text-zinc-300"
                          )}
                        >
                          {getConversationName(convo)}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
                          {timeAgo(convo.lastMessageAt ?? convo.updatedAt)}
                        </span>
                      </div>
                      {convo.lastMessage?.content && (
                        <p
                          className={cn(
                            "text-xs line-clamp-1 mt-0.5",
                            convo.unreadCount > 0
                              ? "text-zinc-700 dark:text-zinc-300"
                              : "text-zinc-500 dark:text-zinc-400"
                          )}
                        >
                          {convo.lastMessage.sender?.id === currentUser?.id &&
                            "You: "}
                          {convo.lastMessage.content}
                        </p>
                      )}
                    </div>

                    {/* Unread badge */}
                    {convo.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white shrink-0 mt-0.5">
                        {convo.unreadCount > 99
                          ? "99+"
                          : convo.unreadCount}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <Link
              href="/conversations"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              Open full inbox
              <FiChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        aria-label="Messages"
      >
        <FiMessageSquare className="h-[18px] w-[18px]" />
        {unreadTotal > 0 && (
          <motion.span
            key={unreadTotal}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white"
          >
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </motion.span>
        )}
      </button>

      {/* Portal dropdown */}
      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
