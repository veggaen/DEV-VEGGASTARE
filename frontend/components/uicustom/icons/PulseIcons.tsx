'use client';

import React from 'react';

interface PulseIconProps {
  className?: string;
  size?: number;
  filled?: boolean;
}

/**
 * Strong pulse wave icon - used for positive pulses
 * Shows an active heartbeat/pulse wave
 */
export function PulsePositive({ className = '', size = 16, filled = false }: PulseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={filled ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Strong pulse wave - high amplitude */}
      <path d="M2 12h4l2 -6l3 12l3 -8l2 4h6" />
      {filled && (
        <path
          d="M2 12h4l2 -6l3 12l3 -8l2 4h6"
          stroke="currentColor"
          strokeWidth={3}
          opacity={0.3}
        />
      )}
    </svg>
  );
}

/**
 * Weak/flat pulse icon - used for "not interested" (hidden negative pulse)
 * Shows a flatline or very weak pulse
 */
export function PulseFlat({ className = '', size = 16 }: PulseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Flat line with tiny blip - minimal activity */}
      <path d="M2 12h7l1 -1l1 2l1 -1h10" />
    </svg>
  );
}

/**
 * No pulse / muted icon - used to indicate "don't show this content"
 */
export function PulseMuted({ className = '', size = 16 }: PulseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Flat line */}
      <path d="M2 12h20" />
      {/* Strike through / mute indicator */}
      <path d="M4 4l16 16" strokeOpacity={0.6} />
    </svg>
  );
}

/**
 * Pulse heart icon - combines heart with pulse wave
 * Alternative positive pulse icon
 */
export function PulseHeart({ className = '', size = 16, filled = false }: PulseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Heart shape */}
      <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
      {/* Pulse line through heart */}
      <path 
        d="M6 12h3l1.5 -3l2 6l1.5 -3h4" 
        stroke={filled ? 'white' : 'currentColor'}
        strokeWidth={1.5}
        fill="none"
      />
    </svg>
  );
}

/**
 * Animated pulse icon - shows pulsing animation
 */
export function PulseAnimated({ className = '', size = 16 }: PulseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} animate-pulse`}
    >
      <path d="M2 12h4l2 -6l3 12l3 -8l2 4h6" />
    </svg>
  );
}

/**
 * Eye off / hide icon - for "not interested" option
 */
export function EyeOff({ className = '', size = 16 }: PulseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
      <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
