import useSWR from 'swr';

/**
 * YouTube Video Metadata Hook
 * Fetches video details from YouTube Data API v3 via our server-side API route
 * (Keeps API key secure on server)
 */

export type YouTubeVideoDetails = {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  duration: string; // ISO 8601 format (PT4M13S)
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
    maxres?: string;
  };
  tags?: string[];
  chapters?: { time: number; label: string }[];
};

// Parse ISO 8601 duration to seconds
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Format duration to human readable
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Parse chapters from description (YouTube standard format: 0:00 - Chapter name)
function parseChapters(description: string): { time: number; label: string }[] {
  const chapters: { time: number; label: string }[] = [];
  const lines = description.split('\n');
  
  // Match patterns like "0:00 - Intro" or "1:30 Chapter Name" or "01:30:00 Long Chapter"
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

// Fetcher for SWR
const fetcher = async (url: string): Promise<YouTubeVideoDetails | null> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch video details');
  }
  return res.json();
};

/**
 * Hook to fetch YouTube video metadata
 * Uses server-side API route to keep API key secure
 */
export function useYouTubeVideo(videoId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<YouTubeVideoDetails | null>(
    videoId ? `/api/youtube/video/${videoId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return {
    video: data,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}

/**
 * Utility to extract video ID from various YouTube URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([^&\s]+)/,
    // Short URL: https://youtu.be/VIDEO_ID
    /youtu\.be\/([^?&\s]+)/,
    // Embed URL: https://www.youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([^?&\s]+)/,
    // Shorts URL: https://www.youtube.com/shorts/VIDEO_ID
    /youtube\.com\/shorts\/([^?&\s]+)/,
    // Just the ID (11 chars)
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// Export helpers for server-side use
export { parseDuration, parseChapters };
