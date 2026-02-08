import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { dbPrisma } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// /pulse/[id] — Server-rendered individual pulse page
//
// PURPOSE: SEO & link previews. When a user shares a pulse URL, crawlers
// (Google, Twitter, Discord, Slack) hit this route and get proper
// <meta og:*> tags + server-rendered content.
//
// For logged-in users navigating in-app, the /pulse feed still uses the
// modal overlay via ?pulse=id (SPA pattern). This page is the fallback
// for direct navigation and for crawlers.
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
        User: {
          select: { id: true, name: true, image: true },
        },
        Messages: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: { content: true },
        },
        _count: {
          select: { Messages: true },
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
    || pulse.Messages?.[0]?.content?.trim()
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

export default async function PulsePage({ params }: PulsePageProps) {
  const { id } = await params;

  // For direct navigation, redirect to the feed with the pulse modal open.
  // This preserves the SPA experience while this route handles SEO/OG tags.
  redirect(`/pulse?pulse=${encodeURIComponent(id)}`);
}
