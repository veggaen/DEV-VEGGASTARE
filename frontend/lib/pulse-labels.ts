/**
 * Centralized labels for the Pulse feature (the social feed).
 * Changing values here propagates across the UI.
 */

export const pulseLabels = {
  /** The page / feature name (nav, etc.) */
  featureName: 'Pulse',

  /** A single post/thread in the feed */
  post: 'Pulse',
  postPlural: 'Pulses',

  /** The positive reaction (like) */
  heartbeat: 'Heartbeat',
  heartbeatPlural: 'Heartbeats',
  heartbeatVerb: 'Give a heartbeat',
  heartbeatPastTense: 'heartbeated',

  /** The negative reaction */
  negativeHeartbeat: 'Negative Heartbeat',
  negativeHeartbeatPlural: 'Negative Heartbeats',

  /** Repost/share action */
  repulse: 'Repulse',
  repulsePlural: 'Repulses',

  /** Quote repost */
  quoteRepulse: 'Quote repulse',

  /** Comment in a pulse */
  vibe: 'Vibe',
  vibePlural: 'Vibes',
} as const;

export type PulseLabel = keyof typeof pulseLabels;
