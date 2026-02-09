import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { dbPrisma } from '@/lib/db';
import { formatDistanceToNowStrict } from 'date-fns';
import { FiArrowLeft, FiMessageCircle, FiEye, FiRepeat, FiTrendingUp } from 'react-icons/fi';

// ─────────────────────────────────────────────────────────────────────────────
// /pulse/[id] — Full standalone pulse page (hard navigation / SEO)
//
// PURPOSE:
//  1. SEO & link previews — crawlers get <meta og:*> + server-rendered HTML
//  2. Shared link destination — users landing from Discord/Slack/Twitter see
//     a clean, focused reading page for the pulse
//  3. Hard-nav fallback — when user refreshes on /pulse/[id], this renders
//     instead of the intercepted modal overlay
//
// In-app (soft) navigation from /pulse feed → /pulse/[id] is intercepted
// by the @modal parallel slot, so users see the modal overlay instead.
// ─────────────────────────────────────────────────────────────────────────────

interface PulsePageProps {
  params: Promise<{ id: string }>;
}

async function getPulse(id: string) {
  try {
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id, visibility: 'PUBLIC' },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        tags: true,
        userId: true,
        viewCount: true,
        uniqueViewCount: true,
        repulseCount: true,
        positivePulseCount: true,
        reachScore: true,
        User: {
          select: { id: true, name: true, image: true },
        },
        Message: {
          take: 12,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            editedAt: true,
            User: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        AdvancedPoll: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            _count: { select: { Responses: true } },
          },
        },
        _count: {
          select: { Message: true },
        },
      },
    });

    return conversation;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PulsePageProps): Promise<Metadata> {
  const { id } = await params;
  const pulse = await getPulse(id);

  if (!pulse) {
    return { title: 'Pulse not found' };
  }

  const authorName = pulse.User?.name || 'Anonymous';
  const content = pulse.description?.trim()
    || pulse.Message?.[0]?.content?.trim()
    || pulse.title?.trim()
    || '';
  const preview = content.length > 160 ? `${content.slice(0, 157)}…` : content;
  const title = pulse.title || `Pulse by ${authorName}`;

  return {
    title: `${title} — Vegga`,
    description: preview,
    openGraph: {
      title,
      description: preview,
      type: 'article',
      publishedTime: pulse.createdAt.toISOString(),
      authors: [authorName],
      tags: pulse.tags || [],
      siteName: 'Vegga',
      url: `https://veggat.com/pulse/${id}`,
    },
    twitter: {
      card: 'summary',
      title,
      description: preview,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone Pulse Page — clean, focused reading view
// ─────────────────────────────────────────────────────────────────────────────

export default async function PulsePage({ params }: PulsePageProps) {
  const { id } = await params;
  const pulse = await getPulse(id);

  if (!pulse) notFound();

  const author = pulse.User;
  const authorName = author?.name || 'Anonymous';
  const authorInitial = authorName.charAt(0).toUpperCase();
  const firstMessage = pulse.Message?.[0];
  const replyMessages = pulse.Message?.slice(1) || [];
  const totalReplies = pulse._count.Message - 1; // exclude root message
  const moreReplies = totalReplies - replyMessages.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/pulse"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Feed
          </Link>
          <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground/60">
            Pulse
          </span>
        </div>
      </nav>

      {/* ── Main article ─────────────────────────────────────────────────── */}
      <article className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Author row */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative">
            {author?.image ? (
              <img
                src={author.image}
                alt={authorName}
                className="w-11 h-11 rounded-full ring-2 ring-background shadow-md object-cover"
              />
            ) : (
              <div className="w-11 h-11 rounded-full ring-2 ring-background shadow-md bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {authorInitial}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 ring-2 ring-background" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-tight">{authorName}</span>
            <time
              dateTime={pulse.createdAt.toISOString()}
              className="text-xs text-muted-foreground"
            >
              {formatDistanceToNowStrict(pulse.createdAt, { addSuffix: true })}
            </time>
          </div>
        </div>

        {/* Title */}
        {pulse.title && (
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 leading-snug">
            {pulse.title}
          </h1>
        )}

        {/* Description / root content */}
        {(pulse.description || firstMessage?.content) && (
          <div className="text-base sm:text-lg leading-relaxed text-foreground/90 mb-6 whitespace-pre-wrap">
            {pulse.description || firstMessage?.content}
          </div>
        )}

        {/* Tags */}
        {pulse.tags && pulse.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {pulse.tags.map((tag) => (
              <Link
                key={tag}
                href={`/pulse?filter=all&tag=${encodeURIComponent(tag)}`}
                className="px-3 py-1 text-xs font-medium rounded-full bg-primary/8 text-primary hover:bg-primary/15 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Advanced Poll card */}
        {pulse.AdvancedPoll && (
          <div className="rounded-xl border bg-card p-5 mb-8 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <FiTrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Poll
              </span>
            </div>
            <h3 className="font-semibold mb-1">{pulse.AdvancedPoll.title}</h3>
            {pulse.AdvancedPoll.description && (
              <p className="text-sm text-muted-foreground mb-3">{pulse.AdvancedPoll.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="capitalize">{pulse.AdvancedPoll.type.toLowerCase().replace('_', ' ')}</span>
              <span>•</span>
              <span>{pulse.AdvancedPoll._count.Responses} responses</span>
            </div>
          </div>
        )}

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-5 text-sm text-muted-foreground border-y border-border/50 py-3.5 mb-8">
          {totalReplies > 0 && (
            <span className="flex items-center gap-1.5">
              <FiMessageCircle className="w-4 h-4" />
              {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
            </span>
          )}
          {(pulse.viewCount ?? 0) > 0 && (
            <span className="flex items-center gap-1.5">
              <FiEye className="w-4 h-4" />
              {pulse.viewCount!.toLocaleString()} views
            </span>
          )}
          {(pulse.repulseCount ?? 0) > 0 && (
            <span className="flex items-center gap-1.5">
              <FiRepeat className="w-4 h-4" />
              {pulse.repulseCount} repulses
            </span>
          )}
          {(pulse.positivePulseCount ?? 0) > 0 && (
            <span className="flex items-center gap-1.5">
              ❤️ {pulse.positivePulseCount}
            </span>
          )}
          {(pulse.reachScore ?? 0) > 0 && (
            <span className="flex items-center gap-1.5">
              <FiTrendingUp className="w-4 h-4 text-amber-500" />
              {Math.round(pulse.reachScore!)} reach
            </span>
          )}
        </div>

        {/* ── Reply thread ───────────────────────────────────────────────── */}
        {replyMessages.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-5">
              Conversation
            </h2>
            <div className="space-y-1">
              {replyMessages.map((msg, idx) => {
                const sender = msg.User;
                const senderName = sender?.name || 'Anonymous';
                const senderInitial = senderName.charAt(0).toUpperCase();
                const isLast = idx === replyMessages.length - 1;

                return (
                  <div key={msg.id} className="relative flex gap-3 group">
                    {/* Thread line */}
                    {!isLast && (
                      <div className="absolute left-[18px] top-10 bottom-0 w-px bg-border/60" />
                    )}

                    {/* Avatar */}
                    <div className="relative flex-shrink-0 pt-1">
                      {sender?.image ? (
                        <img
                          src={sender.image}
                          alt={senderName}
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground ring-1 ring-border">
                          {senderInitial}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-5">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{senderName}</span>
                        <time className="text-xs text-muted-foreground">
                          {formatDistanceToNowStrict(new Date(msg.createdAt), { addSuffix: true })}
                        </time>
                        {msg.editedAt && (
                          <span className="text-xs text-muted-foreground italic">(edited)</span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {moreReplies > 0 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                + {moreReplies} more {moreReplies === 1 ? 'reply' : 'replies'}
              </p>
            )}
          </section>
        )}

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <div className="text-center py-8 border-t border-border/40">
          <p className="text-sm text-muted-foreground mb-4">
            Join the conversation, react, and reply in the live feed
          </p>
          <Link
            href="/pulse"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all active:scale-95"
          >
            Open in Pulse Feed
            <FiArrowLeft className="w-4 h-4 rotate-180" />
          </Link>
        </div>
      </article>
    </div>
  );
}
