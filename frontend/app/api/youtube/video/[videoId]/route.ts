import { NextRequest, NextResponse } from 'next/server';

/**
 * YouTube Data API v3 - Video Details
 * Securely fetches video metadata using server-side API key
 * 
 * GET /api/youtube/video/[videoId]
 */

// YouTube API base URL
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Parse ISO 8601 duration to seconds
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Parse chapters from description
function parseChapters(description: string): { time: number; label: string }[] {
  const chapters: { time: number; label: string }[] = [];
  const lines = description.split('\n');
  
  const chapterRegex = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—]?\s*(.+)$/;
  
  for (const line of lines) {
    const match = line.trim().match(chapterRegex);
    if (match) {
      const hours = parseInt(match[1] || '0', 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const label = match[4].trim();
      
      if (label) {
        chapters.push({
          time: hours * 3600 + minutes * 60 + seconds,
          label,
        });
      }
    }
  }
  
  return chapters;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    
    // Validate video ID format (YouTube IDs are 11 characters)
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return NextResponse.json(
        { error: 'Invalid video ID format' },
        { status: 400 }
      );
    }

    const apiKey = process.env.AUTH_GOOGLE_API_KEY;
    
    if (!apiKey) {
      console.error('[YouTube API] Missing AUTH_GOOGLE_API_KEY');
      return NextResponse.json(
        { error: 'YouTube API not configured' },
        { status: 500 }
      );
    }

    // Fetch video details from YouTube Data API v3
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set('part', 'snippet,contentDetails,statistics');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[YouTube API] Error response:', errorData);
      
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'YouTube API quota exceeded or key invalid' },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch video details' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const video = data.items[0];
    const { snippet, contentDetails, statistics } = video;

    // Parse chapters from description
    const chapters = parseChapters(snippet.description || '');

    // Build response
    const result = {
      id: video.id,
      title: snippet.title,
      description: snippet.description,
      channelTitle: snippet.channelTitle,
      publishedAt: snippet.publishedAt,
      duration: contentDetails.duration,
      durationSeconds: parseDuration(contentDetails.duration),
      viewCount: parseInt(statistics.viewCount || '0', 10),
      likeCount: parseInt(statistics.likeCount || '0', 10),
      commentCount: parseInt(statistics.commentCount || '0', 10),
      thumbnails: {
        default: snippet.thumbnails?.default?.url,
        medium: snippet.thumbnails?.medium?.url,
        high: snippet.thumbnails?.high?.url,
        maxres: snippet.thumbnails?.maxresdefault?.url,
      },
      tags: snippet.tags || [],
      chapters,
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[YouTube API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
