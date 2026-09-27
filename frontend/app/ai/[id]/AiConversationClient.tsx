"use client";

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/providers/confirm-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ScrollToBottom } from "@/components/uicustom/chats/primitives/ScrollToBottom";
import { TypingIndicator } from "@/components/uicustom/chats/primitives/TypingIndicator";
import { useAiDraft, useAiDraftTransfer, useAiImageDraft, useAiModelDraft } from "@/components/uicustom/ai/AiDrafts";
import { DraftImages, MessageImages } from '@/components/uicustom/ai/ChatImages';
import { CHAT_IMAGE_MAX_BYTES, CHAT_IMAGE_TYPES, imageContext, imageAllowance, type ChatImageView } from '@/lib/ai-chat/image-policy';
import { ChatComposer } from "@/components/uicustom/ai/ChatComposer";
import dynamic from "next/dynamic";
const MessageContent = dynamic(() => import("@/components/uicustom/ai/MessageContent").then(m => m.MessageContent));
const CopyMessage = dynamic(() => import("@/components/uicustom/ai/MessageContent").then(m => m.CopyMessage));

import { ChatSidebar } from "@/components/uicustom/chats/ChatSidebar";
import { cn } from "@/lib/utils";
import { CreditModelPicker } from '@/components/uicustom/ai/CreditModelPicker';
import { useAiCreditConfig } from '@/hooks/use-ai-credit-config';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { isDemoUserId } from "@/lib/demo-policy";
import { useUiPreferences } from "@/components/providers/ui-preferences";
import { readChatStream } from '@/lib/ai-chat/read-stream';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  type: "HUMAN" | "AI_PLATFORM" | "AI_BYOK";
  displayName: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  responseMode: "CONTEXT_ONLY" | "DEEP_ANALYSIS";
  responseBrief: boolean;
  manualOnly: boolean;
  isActive: boolean;
  byokUserId: string | null;
}

interface ConvMessage {
  images?: ChatImageView[];
  id: string;
  content: string;
  role: "user" | "assistant";
  senderType: "HUMAN" | "AI_PLATFORM" | "AI_BYOK";
  modelUsed: string | null;
  createdAt: string;
  participant: { displayName: string | null; type: string };
  hasSensitiveData: boolean;
  sensitiveTypes: string[];
}

interface ConvSession {
  id: string;
  title: string;
  isPublic: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  triggerMode: string;
  creatorId: string;
  participants: Participant[];
  messages: ConvMessage[];
}

// ─── Streaming message (local) ────────────────────────────────────────────────

interface StreamingMsg {
  id: string;
  participantId: string | null;
  participantName: string;
  content: string;
  done: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string;
  isLoggedIn: boolean;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
}

// ── Client-side sensitive detection ──
const SENSITIVE_RE = [
  { type: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { type: "phone", re: /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/ },
];
const detectSensitive = (text: string) =>
  SENSITIVE_RE.filter((p) => p.re.test(text)).map((p) => p.type);


// ─── Component ────────────────────────────────────────────────────────────────

export default function AiConversationClient({
  sessionId,
  isLoggedIn,
  userId,
  userName,
  userRole,
}: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const { prefs } = useUiPreferences();

  const [conv, setConv] = useState<ConvSession | null>(() => sessionId ? null : ({
    id: '', title: 'New chat', isPublic: false, isSuspended: false, suspendedReason: null,
    triggerMode: 'AUTO', creatorId: userId ?? '', participants: [], messages: [],
  }));
  const createdId = useRef(sessionId);
  const mounted = useRef(true);
  const sending = useRef(false);
  const [loading, setLoading] = useState(!!sessionId);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useAiDraft(sessionId || "new");
  const [draftImages, setDraftImages, totalDraftImages] = useAiImageDraft(sessionId || 'new');
  const [imageError, setImageError] = useState<string | null>(null);
  const transferDraft = useAiDraftTransfer();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMsgs, setStreamingMsgs] = useState<StreamingMsg[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const { config: creditConfig, error: creditError } = useAiCreditConfig();
  const [{ provider, model }, setSelectedModel] = useAiModelDraft(sessionId || 'new');
  const selectedModel = creditConfig?.models.find(item => item.provider === provider && item.model === model);
  const usingOwnKey = creditConfig?.savedProviders.includes(provider) ?? false;
  const contextImages = imageContext([...(conv?.messages ?? []).filter(message => !message.id.startsWith('temp-')).slice(-19), { role: 'user', content: input, images: draftImages.map(image => ({ id: image.id, width: 0, height: 0 })) }]);
  const imageCount = contextImages.reduce((sum, message) => sum + message.images.length, 0);
  const supportedImages = imageAllowance(provider, model);
  const imageModelBlocked = imageCount > 0 && !supportedImages;
  const messageCredits = usingOwnKey ? 0 : selectedModel ? selectedModel.credits + imageCount * (supportedImages?.credits ?? 0) : undefined;
  const insufficientCredits = !!creditConfig && messageCredits !== undefined && creditConfig.balance < messageCredits;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sensitiveBanner, setSensitiveBanner] = useState<string[] | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const demo = isDemoUserId(userId);
  const participantButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const followTranscriptRef = useRef(true);
  const isCreator = conv?.creatorId === userId;
  const isAdmin = userRole === "ADMIN" || userRole === "OWNER";
  const handleFiles = (files: File[]) => {
    setImageError(null);
    if (files.some(file => !(CHAT_IMAGE_TYPES as readonly string[]).includes(file.type) || !file.size || file.size > CHAT_IMAGE_MAX_BYTES)) {
      setImageError('Choose JPG, PNG or WebP images under 4 MB each.'); return;
    }
    if (draftImages.length + files.length > 2) { setImageError('Attach up to two images per message.'); return; }
    if (totalDraftImages + files.length > 10) { setImageError('Remove an unsent image from another chat first. Ten draft images can be kept at once.'); return; }
    const additions = files.map(file => ({ id: crypto.randomUUID(), file }));
    setDraftImages(current => [...current, ...additions]);
  };

  // The page is keyed by account/chat; obsolete reads and streams are aborted.
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    if (sessionId) {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/ai-chat/sessions/${encodeURIComponent(sessionId)}`, { signal: controller.signal });
          if (!res.ok) throw new Error([401, 403, 404, 410].includes(res.status) ? 'Conversation unavailable.' : 'Could not load this conversation. Please retry.');
          const data = await res.json(), conversation = data.conversation ?? data;
          if (conversation.id !== sessionId || !Array.isArray(conversation.messages) || !Array.isArray(conversation.participants)) throw new Error('The conversation response was incomplete.');
          if (!controller.signal.aborted) setConv(conversation);
        } catch (error) {
          if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Connection failed. Please retry.');
        } finally { if (!controller.signal.aborted) setLoading(false); }
      })();
    }
    return () => { mounted.current = false; controller.abort(); abortRef.current?.abort(); };
  }, [sessionId]);

  // ── Seed the composer from a starter prompt (?seed= from the AI home page) ──
  // Pre-fills the input once, focuses it, then strips the param so a refresh
  // doesn't re-seed. The user still presses send — we don't auto-fire.
  useEffect(() => {
    const seed = searchParams.get("seed");
    if (!seed) return;
    setInput(seed);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const el = inputRef.current;
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    });
    router.replace(`/ai/${sessionId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scroll to bottom ──
  useEffect(() => {
    const scroller = messagesContainerRef.current;
    if (scroller && followTranscriptRef.current) scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
  }, [conv?.messages, streamingMsgs, reduceMotion]);

  // ── Auto-resize textarea (enables Shift+Enter multi-line) ──
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // ── Send message ──
  const handleSend = useCallback(async () => {
    const trimmed = input.trim() || (draftImages.length ? 'Describe the attached image.' : '');
    if (!trimmed || sending.current || isStreaming) return;
    if (!isLoggedIn) {
      router.push("/auth/login?callbackUrl=%2Fai");
      return;
    }
    // UX preflight only. The server still atomically authorizes every request
    // against the latest balance; a stale tab cannot bypass that reservation.
    if (insufficientCredits || imageModelBlocked) return;

    sending.current = true;
    setIsStreaming(true);
    setSendError(null);
    const sentImages = draftImages.slice();
    const abort = new AbortController();
    abortRef.current = abort;
    let targetId = createdId.current;
    if (!targetId) {
      try {
        const response = await fetch('/api/ai-chat/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]),
        });
        const data = await response.json();
        if (!response.ok || typeof data.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(data.id)) throw new Error(data.message || 'Could not start the chat. Please retry.');
        targetId = data.id; createdId.current = targetId;
        window.dispatchEvent(new Event('ai-chat:sessions-changed'));
        if (!mounted.current) { sending.current = false; return; }
      } catch (error) {
        if (mounted.current) { setSendError(error instanceof Error ? error.message : 'Could not start the chat. Please retry.'); setIsStreaming(false); }
        sending.current = false;
        return;
      }
    }
    followTranscriptRef.current = true;
    const sensitive = detectSensitive(trimmed);
    if (sensitive.length > 0) setSensitiveBanner(sensitive);

    setInput("");
    setIsStreaming(true);

    // Optimistic append of user message
    const tempUserMsg: ConvMessage = {
      id: `temp-${Date.now()}`,
      content: trimmed,
      role: "user",
      senderType: "HUMAN",
      modelUsed: null,
      createdAt: new Date().toISOString(),
      participant: { displayName: userName, type: "HUMAN" },
      hasSensitiveData: sensitive.length > 0,
      sensitiveTypes: sensitive,
    };
    const isFirstMessage = (conv?.messages.filter(message => !message.id.startsWith('temp-')).length ?? 0) === 0;
    setConv((prev) => prev ? { ...prev, messages: [...prev.messages.filter(message => !message.id.startsWith('temp-')), tempUserMsg] } : prev);

    // Stream
    const aiStreamId = `stream-${Date.now()}`;
    setStreamingMsgs([{
      id: aiStreamId,
      participantId: null,
      participantName: "AI",
      content: "",
      done: false,
    }]);

    let fullContent = "";
    let savedReply = false;
    let responseSensitive: string[] = [];
    const restoreFailedDraft = () => {
      setInput(current => current || trimmed);
      if (fullContent) {
        setStreamingMsgs(prev => prev.map(item => item.id === aiStreamId ? { ...item, done: true } : item));
      } else {
        setConv(prev => prev ? { ...prev, messages: prev.messages.filter(message => message.id !== tempUserMsg.id) } : prev);
        setStreamingMsgs([]);
      }
    };

    try {
      const uploaded: ChatImageView[] = [];
      for (const image of sentImages) {
        if (image.uploaded?.sessionId === targetId) { uploaded.push(image.uploaded); continue; }
        const response = await fetch(`/api/ai-chat/images?sessionId=${encodeURIComponent(targetId)}`, { method: 'POST', headers: { 'Content-Type': image.file.type }, body: image.file, signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not attach the image. Please retry.');
        uploaded.push(data);
        setDraftImages(current => current.map(item => item.id === image.id ? { ...item, uploaded: { ...data, sessionId: targetId } } : item));
      }
      if (uploaded.length) setConv(previous => previous ? { ...previous, messages: previous.messages.map(message => message.id === tempUserMsg.id ? { ...message, images: uploaded } : message) } : previous);
      const history = (conv?.messages ?? []).filter(message => !message.id.startsWith('temp-'));
      const apiMessages = imageContext([...history.slice(-19), { role: 'user' as const, content: trimmed, images: uploaded }])
        .map(message => ({ role: message.role, content: message.content, ...(message.images.length ? { imageIds: message.images.map(image => image.id) } : {}) }));

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, sessionId: targetId, provider, model, requestId: crypto.randomUUID() }),
        signal: abort.signal,
      });

      const serverSensitive = res.headers.get("X-Sensitive-Types");
      if (serverSensitive) {
        responseSensitive = serverSensitive.split(",").filter(Boolean);
        setSensitiveBanner((prev) => [...(prev ?? []), ...responseSensitive.filter((t) => !prev?.includes(t))]);
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSendError(errData.message ?? "Failed to get response.");
        restoreFailedDraft();
        return;
      }

      fullContent = await readChatStream(res, text => {
        fullContent += text;
        setStreamingMsgs(previous => previous.map(message => message.id === aiStreamId ? { ...message, content: message.content + text } : message));
      });

      setStreamingMsgs((prev) => prev.map((m) => m.id === aiStreamId ? { ...m, done: true } : m));

      // Persist and reload messages
      if (fullContent) {
        const saved = await fetch(`/api/ai-chat/sessions/${targetId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: trimmed,
            assistantMessage: fullContent,
            providerUsed: res.headers.get('X-Ai-Provider') ?? provider,
            modelUsed: res.headers.get('X-Ai-Model') ?? model,
            imageIds: uploaded.map(image => image.id),
          }),
        });

        if (!saved.ok) {
          setSendError('The reply arrived, but could not be saved. Copy it before leaving this page.');
          return;
        }

        savedReply = true;
        setDraftImages(current => current.filter(image => !sentImages.some(sent => sent.id === image.id)));
        // Auto-name the conversation from the first message (ChatGPT/t3.chat
        // style). Runs only now that the user message is persisted, and only
        // while the title is still default (the endpoint guards that). Fire-and-
        // forget — updates the header in place, never blocks the chat.
        if (isFirstMessage) {
          void fetch(`/api/ai-chat/sessions/${targetId}/title`, { method: "POST" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.ok && d.title) {
                setConv((prev) => (prev ? { ...prev, title: d.title } : prev));
                // Refresh the shell rail so the new auto-title appears there too.
                window.dispatchEvent(new Event("ai-chat:sessions-changed"));
              }
            })
            .catch(() => {});
        }
      }

      // Reload session to get persisted messages
      const refreshed = await fetch(`/api/ai-chat/sessions/${targetId}`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        setConv(data.conversation ?? data);
      }
      setStreamingMsgs([]);
    } catch (err: any) {
      restoreFailedDraft();
      setSendError((err?.name === 'AbortError' ? 'The response was stopped.' : err instanceof Error ? err.message : 'Connection error. Please try again.') + (fullContent ? ' Your partial reply is kept here but is not saved. Copy it before leaving.' : ' Your draft is preserved.'));
    } finally {
      sending.current = false;
      if (mounted.current) {
        setIsStreaming(false);
        if (!sessionId && savedReply) { transferDraft('new', targetId); router.replace(`/ai/${targetId}`); }
      }
      window.dispatchEvent(new Event('ai-credit:refresh'));
    }
  }, [input, draftImages, setDraftImages, imageModelBlocked, isStreaming, isLoggedIn, conv, sessionId, userName, provider, model, insufficientCredits, router, setInput, transferDraft]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Trigger BYOK AI ──
  const handleTriggerAi = useCallback(async (participantId: string) => {
    const abort = new AbortController();
    abortRef.current = abort;
    const participant = conv?.participants.find((p) => p.id === participantId);
    const streamId = `byok-${Date.now()}`;

    setStreamingMsgs([{
      id: streamId,
      participantId,
      participantName: participant?.displayName ?? "AI",
      content: "",
      done: false,
    }]);
    setIsStreaming(true);

    let fullContent = "";

    try {
      const res = await fetch(`/api/ai-chat/sessions/${sessionId}/trigger-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, requestId: crypto.randomUUID() }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSendError(err.message ?? err.error ?? "Failed to trigger AI.");
        setStreamingMsgs([]);
        setIsStreaming(false);
        return;
      }

      fullContent = await readChatStream(res, text => {
        fullContent += text;
        setStreamingMsgs(previous => previous.map(message => message.id === streamId ? { ...message, content: message.content + text } : message));
      });

      // Reload
      const refreshed = await fetch(`/api/ai-chat/sessions/${sessionId}`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        setConv(data.conversation ?? data);
      }
      setStreamingMsgs([]);
    } catch (err: any) {
      if (err?.name !== "AbortError") setSendError("Stream error.");
    } finally {
      setIsStreaming(false);
      window.dispatchEvent(new Event("ai-credit:refresh"));
    }
  }, [conv, sessionId]);

  // ── Delete conversation ──
  const handleDelete = useCallback(async () => {
    if (!(await confirm({
      title: "Delete this conversation?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    }))) return;
    const res = await fetch(`/api/ai-chat/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) router.push("/ai");
  }, [sessionId, router, confirm]);

  // ── Admin moderation (inline; replaces the old standalone /admin page) ──
  const [moderating, setModerating] = useState(false);
  const handleModerate = useCallback(async (action: "suspend" | "unsuspend" | "flag") => {
    let reason: string | undefined;
    if (action === "suspend" || action === "flag") {
      reason = window.prompt(`Reason for ${action} (optional):`) ?? undefined;
    }
    setModerating(true);
    try {
      const res = await fetch(`/api/admin/ai-chat/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (res.ok) {
        if (action === "suspend") setConv((prev) => prev ? { ...prev, isSuspended: true } : prev);
        if (action === "unsuspend") setConv((prev) => prev ? { ...prev, isSuspended: false } : prev);
      }
    } finally {
      setModerating(false);
    }
  }, [sessionId]);

  // ── Copy share link ──
  const handleShare = useCallback(async () => {
    if (!conv) return;
    if (!conv.isPublic && !(await confirm({ title: 'Share this conversation publicly?', description: 'Anyone with the link can read its messages. Remove private information before sharing.', confirmLabel: 'Make public' }))) return;
    try {
      if (!conv.isPublic) {
        const response = await fetch(`/api/ai-chat/sessions/${sessionId}`, {
          method: "PATCH", signal: AbortSignal.timeout(15_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic: true }),
        });
        if (!response.ok) { toast.error('Could not share this conversation. Please retry.'); return; }
        setConv((prev) => prev ? { ...prev, isPublic: true } : prev);
      }
      await navigator.clipboard.writeText(`${window.location.origin}/ai/${sessionId}`);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error('Could not copy the link. Check sharing status before trying again.');
    }
  }, [conv, sessionId, confirm]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-brand-accent/40 border-t-brand-accent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">✦</div>
          <p className="text-lg font-semibold mb-2">Oops</p>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <Link href="/ai" className="inline-flex items-center px-4 py-2 rounded-xl bg-brand-accent text-brand-accent-foreground text-sm font-semibold hover:bg-brand-accent-light transition-colors">
            Back to AI Chat
          </Link>
        </div>
      </div>
    );
  }

  if (!conv) return null;

  const aiParticipants = conv.participants.filter(
    (p) => p.type === "AI_BYOK" || p.type === "AI_PLATFORM"
  );
  const myByokAis = aiParticipants.filter(
    (p) => p.type === "AI_BYOK" && p.byokUserId === userId
  );

  const allMessages: Array<ConvMessage | StreamingMsg & { _streaming: true }> = [
    ...conv.messages,
    ...streamingMsgs.map((s) => ({ ...s, _streaming: true as true })),
  ];

  const empty = conv.messages.length === 0 && streamingMsgs.length === 0;

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background overflow-hidden">

      {/* ── Top bar — theme-aware glassy bar; contents centered to the thread
          column so controls aren't stranded on wide screens. ── */}
      <div className="relative z-10 bg-linear-to-b from-background via-background/80 to-transparent px-3 py-2.5 shrink-0 [@media(max-height:500px)]:py-0.5">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button type="button" aria-label="Open conversations" onClick={() => window.dispatchEvent(new Event('ai-chat:open-conversations'))}
              className={cn('grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted', prefs.aiChatLayout !== 'overlay' && 'lg:hidden')}>
              <span aria-hidden="true">☰</span>
            </button>
            <Link
              href="/ai"
              aria-label="Back to AI chats"
              className={cn("hidden place-items-center h-11 w-11 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0", sessionId && "lg:grid")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0 leading-tight">
              <h1 className="text-[15px] font-semibold truncate">{conv.title}</h1>
              {aiParticipants.length > 0 && <p className="text-[11px] text-muted-foreground">
                {`${aiParticipants.length} AI · ${conv.participants.length} participant${conv.participants.length !== 1 ? "s" : ""}`}
              </p>}
            </div>
            {conv.isSuspended && (
              <span className="text-[10px] text-red-500 border border-red-500/30 rounded-md px-1.5 py-0.5 shrink-0">
                Suspended
              </span>
            )}
          </div>

          <div className={cn("flex items-center gap-0.5 shrink-0", !sessionId && "hidden")}>
            {sessionId && isLoggedIn && !demo && (
              <button
                onClick={handleShare}
                className="grid place-items-center h-11 w-11 rounded-full hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                title={conv.isPublic ? "Copy share link" : "Make public & copy link"}
                aria-label="Share"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
              </button>
            )}

            <button
              ref={settingsButtonRef}
              onClick={() => setShowSettings((v) => !v)}
              className={cn(
                "grid place-items-center h-11 w-11 rounded-full transition-colors",
                showSettings
                  ? "text-brand-accent bg-brand-accent/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
              )}
              title="Settings"
              aria-label="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>

            <button
              ref={participantButtonRef}
              onClick={() => setSidebarOpen((v) => !v)}
              className={cn(
                "grid place-items-center h-11 w-11 rounded-full transition-colors",
                sidebarOpen
                  ? "text-brand-accent bg-brand-accent/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
              )}
              title="Participants"
              aria-label="Participants"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ── (row-reverse puts the members/voice rail on the LEFT) */}
      <div className="relative z-10 flex-1 flex flex-row-reverse min-h-0">
        {/* Messages + input */}
        <div className={cn("flex-1 flex flex-col min-w-0 min-h-0", empty && "justify-center overflow-y-auto")}>
          {/* Suspended banner */}
          {conv.isSuspended && (
            <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400 text-center">
              This conversation has been suspended by a moderator.
              {conv.suspendedReason && <> Reason: {conv.suspendedReason}</>}
            </div>
          )}

          {/* Sensitive data banner */}
          <AnimatePresence>
            {sensitiveBanner && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300">
                  <span className="mt-0.5">⚠</span>
                  <span className="flex-1">
                    Message contains {sensitiveBanner.join(" and ")} data sent to the AI. Avoid sharing personal information.
                  </span>
                  <button onClick={() => setSensitiveBanner(null)} className="text-amber-400 hover:text-amber-200">✕</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages — the SCROLLER is full-width so its scrollbar sits at the
              pane edge (not stranded mid-screen); message content is centered
              within via an inner max-w-3xl column. */}
          <div ref={messagesContainerRef} className={cn("relative flex-1 overflow-y-auto overscroll-contain min-h-0", empty && "hidden")} data-ai-transcript
            onScroll={event => { const el = event.currentTarget; followTranscriptRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
            <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-6 sm:px-6">
              {conv.messages.map((msg) => (
                <ConvMessageBubble key={msg.id} msg={msg} userId={userId} reduceMotion={!!reduceMotion} />
              ))}

              {streamingMsgs.map((s) => (
                <StreamingBubble key={s.id} msg={s} reduceMotion={!!reduceMotion} />
              ))}

              {/* "Thinking" indicator while waiting for the first streamed token */}
              {isStreaming && streamingMsgs.every((s) => !s.content) && (
                <TypingIndicator label="AI is thinking…" />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Floating scroll-to-latest (appears when scrolled up) */}
            <ScrollToBottom containerRef={messagesContainerRef} />
          </div>

          {/* Send error */}
          <AnimatePresence>
            {sendError && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden max-w-3xl w-full mx-auto px-4"
              >
                <div role="alert" className="flex items-center gap-2 py-2 text-xs text-red-400 border-t border-red-500/20">
                  <span className="min-w-0 flex-1">{sendError}</span>
                  <button aria-label="Dismiss AI error" className="h-11 w-11 shrink-0" onClick={() => setSendError(null)}>✕</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!conv.isSuspended && (
            <div className={cn("shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 [@media(max-height:500px)]:pt-1 [@media(max-height:500px)]:pb-[max(.25rem,env(safe-area-inset-bottom))]", empty && "pb-[clamp(1rem,12dvh,7rem)]")}>
              <div className="mx-auto w-full max-w-3xl">
                {empty && <h2 className="mb-7 text-center text-2xl font-medium tracking-tight sm:text-3xl">What’s on your mind?</h2>}
                <ChatComposer value={input} onChange={setInput} onSend={() => void handleSend()} busy={isStreaming}
                  disabled={insufficientCredits || imageModelBlocked} onStop={() => abortRef.current?.abort()}
                  hasAttachments={draftImages.length > 0}
                  onFiles={isLoggedIn && isCreator && !demo && !conv.isPublic ? handleFiles : undefined}
                  attachments={draftImages.length ? <DraftImages images={draftImages} busy={isStreaming} remove={id => { setDraftImages(current => current.filter(image => image.id !== id)); setImageError(null); }} /> : undefined}
                  toolbar={<CreditModelPicker provider={provider} model={model} config={creditConfig} error={creditError} disabled={isStreaming}
                    onSelect={(nextProvider, nextModel) => { setSelectedModel({ provider: nextProvider, model: nextModel }); setSendError(null); }} />}
                  guidance={imageModelBlocked ? <span role="status">Images need a vision model. <button type="button" onClick={() => setSelectedModel({ provider: 'OPENAI', model: 'gpt-5.6-luna' })} className="min-h-11 underline underline-offset-4">Choose GPT-5.6 Luna</button></span>
                    : insufficientCredits ? <span role="status">This message needs {messageCredits} credits. {demo ? 'Choose another model.' : <Link href="/products/cveggatinterviewcredits01" className="underline underline-offset-4">Buy credits or choose another model.</Link>}</span>
                    : !isLoggedIn ? <Link href="/auth/login?callbackUrl=%2Fai" className="underline underline-offset-4">Sign in to send</Link>
                    : <div className="flex flex-wrap items-center justify-between gap-x-3"><span>{usingOwnKey ? 'Your key' : messageCredits === undefined ? 'Choose a model' : messageCredits === 0 ? 'Free preview' : `${imageCount ? 'Up to ' : ''}${messageCredits} credits / message`}</span><Link href="/ai/credits" className="inline-flex min-h-7 items-center underline-offset-4 hover:underline">{creditConfig?.balance ?? '…'} credits</Link></div>} />
                {imageError && <p role="alert" className="mt-2 text-sm text-destructive">{imageError}</p>}
                {imageCount > 0 && <details className="mt-1 px-2 text-xs text-muted-foreground"><summary className="cursor-pointer py-2">Image privacy & pricing</summary><p className="max-w-prose pb-2 leading-5">Only sending uploads your images. The selected model receives up to four recent images, resized to 1024 px without location metadata. Images stay private to this chat. The displayed credit cost includes image context on each reply.</p></details>}
              </div>
            </div>
          )}
        </div>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="right" accessibleTitle="Participants" accessibleDescription="Conversation members and experimental voice tools."
            onCloseAutoFocus={event => { event.preventDefault(); participantButtonRef.current?.focus(); }}
            className="flex w-[min(22rem,calc(100%-2rem))] max-w-full flex-col p-0 pt-14 pb-[env(safe-area-inset-bottom)]">
            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20">
                <ChatSidebar
                  roomId={sessionId}
                  self={{ id: userId ?? "me", name: userName ?? "You", image: null }}
                  isHost={!!isCreator}
                  membersTitle="Participants"
                  members={conv.participants.map((p) => ({
                    id: p.id,
                    name: p.displayName ?? (p.type === "HUMAN" ? "Member" : "AI"),
                    image: null,
                    isAi: p.type === "AI_BYOK" || p.type === "AI_PLATFORM",
                    label:
                      p.byokUserId === conv.creatorId || (p.type === "HUMAN" && p.byokUserId === userId && isCreator)
                        ? "Owner"
                        : p.type === "AI_BYOK"
                          ? "BYOK"
                          : p.type === "AI_PLATFORM"
                            ? "AI"
                            : undefined,
                  }))}
                />
                {/* Admin actions footer */}
                {!demo && (isCreator || isAdmin) && (
                  <div className="sticky bottom-0 inset-x-0 px-3 py-3 border-t border-border/60 space-y-1 bg-background/80 backdrop-blur-xl">
                    {isCreator && (
                      <button
                        onClick={handleDelete}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Delete conversation
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                          Moderation
                        </div>
                        {conv.isSuspended ? (
                          <button
                            onClick={() => handleModerate("unsuspend")}
                            disabled={moderating}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg text-brand-accent-hover dark:text-brand-accent-light hover:bg-brand-accent/10 disabled:opacity-50 transition-colors"
                          >
                            Unsuspend conversation
                          </button>
                        ) : (
                          <button
                            onClick={() => handleModerate("suspend")}
                            disabled={moderating}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
                          >
                            Suspend conversation
                          </button>
                        )}
                        <button
                          onClick={() => handleModerate("flag")}
                          disabled={moderating}
                          className="w-full text-left text-xs px-3 py-2 rounded-lg text-muted-foreground hover:bg-foreground/[0.05] disabled:opacity-50 transition-colors"
                        >
                          Flag for review
                        </button>
                      </>
                    )}
                  </div>
                )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="right" accessibleTitle="Conversation settings" accessibleDescription="Edit this conversation."
          onCloseAutoFocus={event => { event.preventDefault(); settingsButtonRef.current?.focus(); }}
          className="w-[min(26rem,calc(100%-2rem))] max-w-full overflow-y-auto overscroll-contain px-4 pt-16 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <h2 className="mb-4 text-lg font-semibold">Conversation settings</h2>
          {demo ? <p className="text-sm text-muted-foreground">Demo conversations stay private. Use your own account to rename, share, or manage participants.</p> :
            <ConvSettings conv={conv} sessionId={sessionId} onUpdate={setConv} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── ParticipantCard ──────────────────────────────────────────────────────────

function ParticipantCard({
  participant: p,
  isOwner,
  onTrigger,
  isStreaming,
}: {
  participant: Participant;
  isOwner: boolean;
  onTrigger: (id: string) => void;
  isStreaming: boolean;
}) {
  const isAi = p.type === "AI_BYOK" || p.type === "AI_PLATFORM";
  return (
    <div className="px-3 py-3 rounded-xl bg-foreground/[0.05] border border-border/60">
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] ${isAi ? "bg-brand-accent/20 text-brand-accent" : "bg-foreground/[0.05] text-muted-foreground"}`}>
          {isAi ? "✦" : (p.displayName?.[0] ?? "?")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{p.displayName ?? (isAi ? "AI" : "Human")}</p>
          <p className="text-[10px] text-muted-foreground">
            {p.type === "AI_BYOK" ? `BYOK · ${p.aiProvider ?? ""}` : p.type === "AI_PLATFORM" ? `Platform · ${p.aiModel ?? ""}` : "Human"}
          </p>
        </div>
      </div>

      {/* BYOK AI owner controls */}
      {isOwner && isAi && p.type === "AI_BYOK" && (
        <div className="mt-2 pt-2 border-t border-border/60 space-y-2">
          <button
            onClick={() => onTrigger(p.id)}
            disabled={isStreaming}
            className="w-full text-xs py-1.5 rounded-lg bg-brand-accent/15 border border-brand-accent/20 text-brand-accent hover:bg-brand-accent/25 disabled:opacity-50 transition-colors"
          >
            {isStreaming ? "Responding…" : `Prompt ${p.displayName ?? "AI"} to respond`}
          </button>
          <div className="flex gap-1 text-[10px]">
            <span className="text-muted-foreground">Mode:</span>
            <span className="text-foreground">{p.responseMode === "DEEP_ANALYSIS" ? "Deep" : "Context-only"}</span>
            <span className="text-muted-foreground ml-auto">{p.responseBrief ? "Brief" : "Detailed"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ConvSettings ─────────────────────────────────────────────────────────────

function ConvSettings({
  conv,
  sessionId,
  onUpdate,
}: {
  conv: ConvSession;
  sessionId: string;
  onUpdate: (updater: (prev: ConvSession | null) => ConvSession | null) => void;
}) {
  const [saving, setSaving] = useState(false);

  const patch = useCallback(async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        onUpdate((prev) => prev ? { ...prev, ...data } : prev);
        // Keep the shell rail in sync (e.g. a manual title change).
        if ("title" in data) window.dispatchEvent(new Event("ai-chat:sessions-changed"));
      }
    } finally {
      setSaving(false);
    }
  }, [sessionId, onUpdate]);

  const [title, setTitle] = useState(conv.title);
  const [copied, setCopied] = useState(false);

  const saveTitle = useCallback(() => {
    const next = title.trim();
    if (!next || next === conv.title) return;
    void patch({ title: next });
  }, [title, conv.title, patch]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/ai/${sessionId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  }, [sessionId]);

  return (
    <div className="space-y-5 text-sm">
      {/* Rename */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Name</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveTitle(); (e.target as HTMLInputElement).blur(); } }}
          disabled={saving}
          maxLength={120}
          className="w-full rounded-xl bg-foreground/[0.05] border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-brand-accent/50 transition-colors"
          placeholder="Conversation name"
        />
      </div>

      {/* Visibility — honest about what "public" means */}
      <div className="rounded-xl border border-border p-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{conv.isPublic ? "Anyone with the link" : "Private"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {conv.isPublic
                ? "Anyone who has the link can view this conversation. It's not listed anywhere — only people you share the link with can find it."
                : "Only you and the participants can see this conversation."}
            </p>
          </div>
          <button
            onClick={() => patch({ isPublic: !conv.isPublic })}
            disabled={saving}
            role="switch"
            aria-checked={conv.isPublic}
            aria-label="Make conversation public"
            className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${conv.isPublic ? "bg-brand-accent" : "bg-muted"}`}
          >
            <span className={`inline-block h-4.5 w-4.5 rounded-full bg-card shadow transition-transform ${conv.isPublic ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
          </button>
        </div>

        {conv.isPublic && (
          <button
            onClick={copyLink}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent-hover dark:text-brand-accent-light px-3 py-2 text-xs font-medium transition-colors"
          >
            {copied ? "✓ Link copied" : "Copy share link"}
          </button>
        )}
      </div>

      {saving && <p className="text-xs text-muted-foreground text-center">Saving…</p>}
    </div>
  );
}

// ─── Message bubbles ──────────────────────────────────────────────────────────

function ConvMessageBubble({
  msg,
  userId,
  reduceMotion,
}: {
  msg: ConvMessage;
  userId: string | null;
  reduceMotion: boolean;
}) {
  const isUser = msg.role === "user";
  const isMe = msg.participant.type === "HUMAN";
  const name = !isUser && msg.modelUsed ? msg.modelUsed : msg.participant.displayName ?? (isUser ? "You" : "AI");

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="mt-1 h-6 w-6 rounded-full bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center text-[10px] text-brand-accent shrink-0">
          ✦
        </div>
      )}
      <div className={cn("min-w-0 space-y-1", isUser ? "max-w-[90%] sm:max-w-[85%]" : "flex-1")}>
        {!isUser && (
          <p className="text-[10px] text-muted-foreground px-1">{name}</p>
        )}
        <div
          className={`rounded-2xl text-base leading-7 [overflow-wrap:anywhere] ${
            isUser
              ? "bg-muted px-4 py-3 whitespace-pre-wrap text-foreground"
              : "py-1 text-foreground"
          }`}
        >
          {!!msg.images?.length && <MessageImages images={msg.images} />}
          {isUser ? msg.content : <MessageContent content={msg.content} />}
        </div>
        {!isUser && <CopyMessage content={msg.content} />}
        {msg.hasSensitiveData && (
          <p className="text-[10px] text-amber-400/70 px-1">⚠ Contains sensitive data</p>
        )}
      </div>
    </motion.div>
  );
}

function StreamingBubble({ msg, reduceMotion }: { msg: StreamingMsg; reduceMotion: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
      className="flex gap-3 justify-start"
    >
      <div className="mt-1 h-6 w-6 rounded-full bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center text-[10px] text-brand-accent shrink-0">
        ✦
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[10px] text-muted-foreground px-1">{msg.participantName}</p>
        <div className="min-w-0 py-1 text-base leading-7 [overflow-wrap:anywhere]">
          {msg.content ? <MessageContent content={msg.content} /> : (
            <span className="inline-flex gap-1 items-center h-4">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current opacity-60" />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
