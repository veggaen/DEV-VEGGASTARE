'use client';

import { YouTubeEmbed } from '@next/third-parties/google';
import { useState, useCallback, useEffect } from 'react';
import { FiPlay, FiRotateCcw, FiClock, FiMaximize2 } from 'react-icons/fi';
import { cn } from '@/lib/utils';

export type Chapter = {
  time: number;
  label: string;
};

export type PremiumYouTubePlayerProps = {
  videoId: string;
  title?: string;
  description?: string;
  start?: number;
  chapters?: Chapter[];
  aspectRatio?: '16/9' | '4/3' | '21/9';
  autoplay?: boolean;
  muted?: boolean;
  showRelated?: boolean;
  className?: string;
  variant?: 'default' | 'hero' | 'minimal' | 'card';
  posterUrl?: string; // Custom thumbnail override
  onPlay?: () => void;
  onEnd?: () => void;
};

export default function PremiumYouTubePlayer({
  videoId,
  title,
  description,
  start = 0,
  chapters = [],
  aspectRatio = '16/9',
  autoplay = false,
  muted = false,
  showRelated = false,
  className,
  variant = 'default',
  posterUrl,
  onPlay,
  onEnd,
}: PremiumYouTubePlayerProps) {
  const [hasInteracted, setHasInteracted] = useState(autoplay);
  const [showReplay, setShowReplay] = useState(false);
  const [currentTime, setCurrentTime] = useState(start);

  // Build YouTube params for clean, professional look
  const params = [
    showRelated ? 'rel=1' : 'rel=0',           // Related videos
    'modestbranding=1',                         // Minimal YouTube branding
    'iv_load_policy=3',                         // Hide annotations
    'color=white',                              // White progress bar
    `start=${currentTime}`,                     // Start time
    'playsinline=1',                            // Inline play on mobile
    autoplay && hasInteracted ? 'autoplay=1' : '',
    muted ? 'mute=1' : '',
    // 'controls=0',                            // Uncomment for ultra-minimal
  ].filter(Boolean).join('&');

  // Handle play button click
  const handlePlay = useCallback(() => {
    setHasInteracted(true);
    setShowReplay(false);
    onPlay?.();
  }, [onPlay]);

  // Handle replay
  const handleReplay = useCallback(() => {
    setCurrentTime(0);
    setHasInteracted(true);
    setShowReplay(false);
  }, []);

  // Navigate to chapter (reloads with timestamp - works with lite-youtube)
  const goToChapter = useCallback((time: number) => {
    setCurrentTime(time);
    setHasInteracted(true);
    // Force re-render with new start time
    setShowReplay(false);
  }, []);

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get aspect ratio class
  const getAspectClass = () => {
    switch (aspectRatio) {
      case '4/3': return 'aspect-[4/3]';
      case '21/9': return 'aspect-[21/9]';
      default: return 'aspect-video';
    }
  };

  // Variant styles
  const variantStyles = {
    default: 'rounded-2xl shadow-2xl',
    hero: 'rounded-none md:rounded-3xl shadow-2xl',
    minimal: 'rounded-lg shadow-lg',
    card: 'rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800',
  };

  // Custom poster or YouTube default
  const poster = posterUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <div className={cn('mx-auto w-full max-w-5xl', className)}>
      {/* Video Container */}
      <div
        className={cn(
          'group relative overflow-hidden bg-black',
          getAspectClass(),
          variantStyles[variant]
        )}
      >
        {/* Custom Overlay - Shows before interaction */}
        {!hasInteracted && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
            onClick={handlePlay}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
            aria-label={`Play ${title || 'video'}`}
          >
            {/* Poster Image */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url(${poster})` }}
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />

            {/* Play Button */}
            <button
              className={cn(
                'relative z-10 flex items-center justify-center rounded-full',
                'bg-red-600 text-white shadow-2xl',
                'transition-all duration-300 ease-out',
                'hover:scale-110 hover:bg-red-500 hover:shadow-red-500/30',
                'active:scale-95',
                'focus:outline-none focus:ring-4 focus:ring-red-500/50',
                variant === 'hero' ? 'h-24 w-24' : 'h-20 w-20'
              )}
            >
              <FiPlay className={cn('ml-1', variant === 'hero' ? 'h-10 w-10' : 'h-8 w-8')} />
            </button>

            {/* Title & Description */}
            {(title || description) && (
              <div className="relative z-10 mt-6 px-8 text-center max-w-2xl">
                {title && (
                  <h3 className={cn(
                    'font-bold text-white drop-shadow-lg',
                    variant === 'hero' ? 'text-2xl md:text-4xl' : 'text-xl md:text-2xl'
                  )}>
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="mt-2 text-sm md:text-base text-white/80 line-clamp-2">
                    {description}
                  </p>
                )}
              </div>
            )}

            {/* Duration Badge (optional - you'd need to fetch this from API) */}
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <FiClock className="h-3 w-3" />
              <span>Watch Video</span>
            </div>
          </div>
        )}

        {/* Replay Overlay */}
        {showReplay && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 cursor-pointer"
            onClick={handleReplay}
          >
            <button
              className="flex items-center justify-center h-20 w-20 rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 hover:scale-110"
            >
              <FiRotateCcw className="h-8 w-8" />
            </button>
            <p className="mt-4 text-white font-medium">Watch Again</p>
          </div>
        )}

        {/* YouTube Embed (lite-youtube for performance) */}
        <div className={cn(!hasInteracted && 'invisible', 'h-full w-full')}>
          <YouTubeEmbed
            videoid={videoId}
            params={params}
            style="width: 100%; height: 100%;"
            playlabel={title || 'Play video'}
          />
        </div>
      </div>

      {/* Chapters Section */}
      {chapters.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
              <FiClock className="h-4 w-4" />
              Chapters
            </h4>
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              {chapters.length} sections
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {chapters.map((chapter, index) => (
              <button
                key={index}
                onClick={() => goToChapter(chapter.time)}
                className={cn(
                  'group/chip flex items-center gap-2 rounded-full px-4 py-2',
                  'bg-zinc-100 dark:bg-zinc-800',
                  'text-sm text-zinc-700 dark:text-zinc-300',
                  'transition-all duration-200',
                  'hover:bg-zinc-200 dark:hover:bg-zinc-700',
                  'hover:shadow-md',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
                  currentTime === chapter.time && 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                )}
              >
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 group-hover/chip:text-emerald-600 dark:group-hover/chip:text-emerald-400">
                  {formatTime(chapter.time)}
                </span>
                <span className="font-medium">{chapter.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Simpler export for quick usage
export function SimpleYouTubeEmbed({ 
  videoId, 
  className 
}: { 
  videoId: string; 
  className?: string;
}) {
  return (
    <div className={cn('aspect-video rounded-xl overflow-hidden', className)}>
      <YouTubeEmbed
        videoid={videoId}
        params="rel=0&modestbranding=1"
        style="width: 100%; height: 100%;"
      />
    </div>
  );
}
