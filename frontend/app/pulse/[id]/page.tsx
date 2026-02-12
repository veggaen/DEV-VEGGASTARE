import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { dbPrisma } from '@/lib/db';
import { formatDistanceToNowStrict } from 'date-fns';
import { FiArrowLeft } from 'react-icons/fi';
import { PulseVibesSection } from '@/components/uicustom/pulse/PulseVibesSection';
import { PulseStatsBar } from '@/components/uicustom/pulse/PulseStatsBar';
import { PulseReachTracker } from '@/components/uicustom/pulse/PulseReachTracker';
import { StandalonePollCard } from '@/components/uicustom/pulse/StandalonePollCard';
import RichTextContent from '@/components/uicustom/pulse/RichTextContent';

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
        reachMomentum: true,
        User: {
          select: { id: true, name: true, image: true },
        },
        Message: {
          take: 1, // only need root message for body text
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
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
            Back to Flow
          </Link>
          <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground/60">
            Pulse
          </span>
        </div>
      </nav>

      {/* ── Main article ─────────────────────────────────────────────────── */}
      <article className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Author row */}
        <div className="flex items-center gap-3 mb-5">
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 leading-snug">
            {pulse.title}
          </h1>
        )}

        {/* Description / root content with YouTube embed support */}
        {(pulse.description || firstMessage?.content) && (
          <div className="text-base sm:text-lg leading-relaxed text-foreground/90 mb-4">
            <RichTextContent
              content={pulse.description || firstMessage?.content || ''}
              embedYouTube={true}
              maxYouTubeEmbeds={3}
              className="whitespace-pre-wrap"
            />
          </div>
        )}

        {/* Tags */}
        {pulse.tags && pulse.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
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

        {/* Interactive Poll card - click to take the poll */}
        {pulse.AdvancedPoll && (
          <div className="mb-8">
            <StandalonePollCard
              poll={{
                id: pulse.AdvancedPoll.id,
                title: pulse.AdvancedPoll.title,
                description: pulse.AdvancedPoll.description,
                type: pulse.AdvancedPoll.type,
                responseCount: pulse.AdvancedPoll._count.Responses,
              }}
            />
          </div>
        )}

        {/* ── Stats bar (real-time) ─────────────────────────────────────── */}
        <PulseStatsBar
          pulseId={id}
          initialStats={{
            messageCount: pulse._count.Message,
            viewCount: pulse.viewCount ?? 0,
            repulseCount: pulse.repulseCount ?? 0,
            positivePulseCount: pulse.positivePulseCount ?? 0,
            reachScore: pulse.reachScore ?? 0,
            reachMomentum: pulse.reachMomentum ?? 0,
          }}
        />

        {/* ── Live vibes / conversation ─────────────────────────────────── */}
        <PulseVibesSection pulseId={id} />

        {/* ── Reach tracking (invisible, behavioral) ───────────────────── */}
        <PulseReachTracker conversationId={id} />
      </article>
    </div>
  );
}
