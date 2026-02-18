'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { YouTubeEmbed } from '@next/third-parties/google';
import { cn } from '@/lib/utils';
import { FiExternalLink, FiPlay } from 'react-icons/fi';

/**
 * RichTextContent - Renders text with auto-detected links and YouTube embeds
 * 
 * Features:
 * - Auto-detects and embeds YouTube videos
 * - Makes URLs clickable
 * - Supports hashtags as clickable links
 * - Preserves whitespace and line breaks
 */

interface RichTextContentProps {
  content: string;
  className?: string;
  onTagClick?: (tag: string) => void;
  embedYouTube?: boolean;
  maxYouTubeEmbeds?: number;
  linkClassName?: string;
}

// YouTube URL patterns
const YOUTUBE_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&[^\s]*)*/gi,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?[^\s]*)*/gi,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?[^\s]*)*/gi,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?[^\s]*)*/gi,
];

// General URL pattern
const URL_PATTERN = /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/gi;

// Hashtag pattern
const HASHTAG_PATTERN = /#[\w]+/gi;

// Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    const match = pattern.exec(url);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Check if URL is a YouTube URL
function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_PATTERNS.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(url);
  });
}

// Parse content into segments
type Segment = 
  | { type: 'text'; content: string }
  | { type: 'url'; content: string; href: string }
  | { type: 'youtube'; content: string; videoId: string }
  | { type: 'hashtag'; content: string; tag: string };

function parseContent(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  
  // Combined pattern for all special content
  const combinedPattern = new RegExp(
    `(${URL_PATTERN.source})|(${HASHTAG_PATTERN.source})`,
    'gi'
  );
  
  let match;
  while ((match = combinedPattern.exec(content)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }
    
    const matchedText = match[0];
    
    // Check what type of match
    if (match[1]) {
      // URL match
      const youtubeId = extractYouTubeId(matchedText);
      if (youtubeId) {
        segments.push({
          type: 'youtube',
          content: matchedText,
          videoId: youtubeId,
        });
      } else {
        segments.push({
          type: 'url',
          content: matchedText,
          href: matchedText.startsWith('http') ? matchedText : `https://${matchedText}`,
        });
      }
    } else if (match[2]) {
      // Hashtag match
      segments.push({
        type: 'hashtag',
        content: matchedText,
        tag: matchedText.slice(1), // Remove #
      });
    }
    
    lastIndex = match.index + matchedText.length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }
  
  return segments;
}

// YouTube embed component with nice styling
function YouTubeEmbedCard({ videoId, originalUrl }: { videoId: string; originalUrl: string }) {
  const [showEmbed, setShowEmbed] = React.useState(false);
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  
  // Handler to stop all propagation
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowEmbed(true);
  };
  
  if (showEmbed) {
    return (
      <div 
        className="mt-3 mb-2 rounded-xl overflow-hidden border border-border/60 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-video">
          <YouTubeEmbed
            videoid={videoId}
            params="rel=0&modestbranding=1"
            style="width: 100%; height: 100%;"
          />
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className="mt-3 mb-2 group cursor-pointer"
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="relative rounded-xl overflow-hidden border border-border/60 shadow-sm hover:shadow-md transition-shadow">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-black">
          <Image
            src={thumbnailUrl}
            alt="YouTube video thumbnail"
            fill
            unoptimized
            className="object-cover"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Play button */}
          <button
            type="button"
            onClick={handleClick}
            className="absolute inset-0 flex items-center justify-center w-full h-full"
            aria-label="Play YouTube video"
          >
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-600 text-white shadow-lg transition-transform group-hover:scale-110">
              <FiPlay className="w-7 h-7 ml-1" />
            </div>
          </button>
          
          {/* YouTube badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2 py-1 rounded bg-black/70 text-white text-xs pointer-events-none">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            YouTube
          </div>
        </div>
        
        {/* Click to play text */}
        <div className="absolute bottom-3 right-3 text-xs text-white/80 group-hover:text-white transition-colors pointer-events-none">
          Click to play
        </div>
      </div>
    </div>
  );
}

export default function RichTextContent({
  content,
  className,
  onTagClick,
  embedYouTube = true,
  maxYouTubeEmbeds = 3,
  linkClassName,
}: RichTextContentProps) {
  const { segments, youtubeVideos } = useMemo(() => {
    const parsed = parseContent(content);
    const videos: { videoId: string; originalUrl: string }[] = [];
    
    // Extract unique YouTube videos
    for (const segment of parsed) {
      if (segment.type === 'youtube' && videos.length < maxYouTubeEmbeds) {
        if (!videos.find(v => v.videoId === segment.videoId)) {
          videos.push({ videoId: segment.videoId, originalUrl: segment.content });
        }
      }
    }
    
    return { segments: parsed, youtubeVideos: videos };
  }, [content, maxYouTubeEmbeds]);
  
  // Rendered YouTube IDs (to avoid duplicates)
  const renderedYouTubeIds = new Set<string>();
  
  return (
    <div className={cn('space-y-0', className)}>
      {/* Text content with inline links */}
      <div className="whitespace-pre-wrap break-words">
        {segments.map((segment, index) => {
          switch (segment.type) {
            case 'text':
              return <span key={index}>{segment.content}</span>;
              
            case 'url':
              return (
                <a
                  key={index}
                  href={segment.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'text-blue-500 hover:text-blue-600 hover:underline inline-flex items-center gap-0.5',
                    linkClassName
                  )}
                >
                  {segment.content}
                  <FiExternalLink className="w-3 h-3 opacity-60" />
                </a>
              );
              
            case 'youtube':
              // Render as link in text, embed will be shown below
              return (
                <span
                  key={index}
                  className="text-red-500 hover:text-red-600 cursor-pointer hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Scroll to embed or trigger play
                  }}
                >
                  {segment.content}
                </span>
              );
              
            case 'hashtag':
              return (
                <span
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(segment.tag);
                  }}
                  className="text-primary hover:text-primary/80 cursor-pointer hover:underline"
                >
                  {segment.content}
                </span>
              );
              
            default:
              return null;
          }
        })}
      </div>
      
      {/* YouTube embeds */}
      {embedYouTube && youtubeVideos.map((video) => {
        if (renderedYouTubeIds.has(video.videoId)) return null;
        renderedYouTubeIds.add(video.videoId);
        
        return (
          <YouTubeEmbedCard
            key={video.videoId}
            videoId={video.videoId}
            originalUrl={video.originalUrl}
          />
        );
      })}
    </div>
  );
}
