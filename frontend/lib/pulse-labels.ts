/**
 * Centralized labels for the Pulse feature (the social feed).
 * Changing values here propagates across the UI.
 *
 * Terminology:
 * - Pulse: A post/message sent out (like a heartbeat rippling through the network)
 * - Heartbeat: Positive reaction/like (your heart "beats" for that pulse)
 * - Vibe: Share/retweet with message (spreading the energy)
 * - Sync: Follow/subscribe (aligning your rhythm with someone's pulses)
 * - Ripple: Chain reactions/virality (how one pulse spreads)
 */

export const pulseLabels = {
  /** The page / feature name (nav, etc.) */
  featureName: 'Pulse',

  /** A single post/thread in the feed */
  post: 'Pulse',
  postPlural: 'Pulses',
  postVerb: 'Pulse it',
  postAction: 'Pulse out',

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

  /** Share with message (spreading the vibe) */
  vibe: 'Vibe',
  vibePlural: 'Vibes',
  vibeVerb: 'Vibe this',
  vibeAction: 'Spread the vibe',

  /** Follow/subscribe (aligning rhythms) */
  sync: 'Sync',
  syncPlural: 'Syncs',
  syncVerb: 'Sync with',
  syncAction: 'Sync their rhythm',
  synced: 'Synced',
  unsync: 'Unsync',

  /** Virality/chain reactions */
  ripple: 'Ripple',
  ripplePlural: 'Ripples',
  rippleVerb: 'Watch it ripple',
  reach: 'Reach',
} as const;

export type PulseLabel = keyof typeof pulseLabels;

/**
 * Notification types and their thematic messages
 * Each notification has a unique type, emoji, and message templates
 */
export const notificationTypes = {
  // Heartbeat (likes) notifications
  HEARTBEAT: {
    type: 'HEARTBEAT',
    emoji: '💓',
    icon: 'heart-pulse',
    color: 'rose',
    title: 'Heartbeat',
    single: 'Your pulse just got a heartbeat from {user}—feel it pulsing stronger!',
    multiple: 'Your pulse is beating with {count} new heartbeats—tap to sync the energy!',
    grouped: '{count} heartbeats on your pulse—it\'s rippling!',
  },
  
  // Vibe (shares) notifications
  VIBE: {
    type: 'VIBE',
    emoji: '🌊',
    icon: 'waves',
    color: 'blue',
    title: 'Vibe',
    single: '{user} vibed your pulse: "{preview}"',
    multiple: '{count} people vibed your pulse—the energy is spreading!',
    grouped: 'Your pulse is catching vibes from {count} rhythms!',
    withRipple: 'Your pulse rippled to {count} new syncs—vibe stronger!',
  },
  
  // Repulse (repost) notifications  
  REPULSE: {
    type: 'REPULSE',
    emoji: '🔄',
    icon: 'repeat',
    color: 'emerald',
    title: 'Repulse',
    single: '{user} repulsed your pulse: "{preview}"',
    multiple: 'Your pulse got repulsed {count} times—echoing through the network!',
    grouped: '{count} repulses amplifying your rhythm!',
  },
  
  // Reply/comment notifications
  REPLY: {
    type: 'REPLY',
    emoji: '💬',
    icon: 'message-circle',
    color: 'violet',
    title: 'New Beat',
    single: 'New beat on your pulse from {user}—check the rhythm.',
    multiple: '{count} new beats on your pulse—the conversation is alive!',
    grouped: 'Your pulse has {count} new beats to explore!',
  },
  
  // Sync (follow) notifications
  SYNC: {
    type: 'SYNC',
    emoji: '🔗',
    icon: 'link',
    color: 'cyan',
    title: 'New Sync',
    single: 'New sync: {user} joined your rhythm—welcome the beat!',
    multiple: '{count} new syncs—your vibe is attracting rhythms!',
    milestone: 'Your syncs hit {count}—your vibe is rippling worldwide! 🎉',
  },
  
  // Direct message notifications
  DM: {
    type: 'DM',
    emoji: '💬',
    icon: 'mail',
    color: 'amber',
    title: 'New Pulse',
    single: 'New pulse from {user} in DMs: "{preview}"',
    multiple: '{count} new pulses waiting in your DMs!',
    typing: '{user}\'s heartbeat rising—reply incoming!',
  },
  
  // Group chat notifications
  GROUP_MESSAGE: {
    type: 'GROUP_MESSAGE',
    emoji: '👥',
    icon: 'users',
    color: 'orange',
    title: 'Group Vibe',
    single: 'New pulse in {group}: "{preview}"',
    multiple: 'Group vibe heating up—{count} new messages in {group}. Tap to join the beat.',
    active: '{group} is pulsing live—join the sync!',
  },
  
  // Mention notifications
  MENTION: {
    type: 'MENTION',
    emoji: '📣',
    icon: 'at-sign',
    color: 'pink',
    title: 'Mentioned',
    single: '{user} tuned into your frequency: "{preview}"',
    multiple: 'You\'re resonating—{count} mentions across the network!',
    grouped: '{count} rhythms calling your frequency!',
  },
  
  // Hot/trending pulse notification
  HOT_PULSE: {
    type: 'HOT_PULSE',
    emoji: '🔥',
    icon: 'trending-up',
    color: 'red',
    title: 'Pulse Throbbing',
    alert: 'Your pulse is throbbing—heartbeats spiking at {bpm}bpm!',
    trending: 'Your pulse entered the rhythm charts! 📈',
    viral: 'Your pulse went viral—{count} ripples and counting!',
  },
  
  // System/milestone notifications
  MILESTONE: {
    type: 'MILESTONE',
    emoji: '🏆',
    icon: 'award',
    color: 'yellow',
    title: 'Milestone',
    syncs: 'Your syncs hit {count}—your vibe is rippling worldwide!',
    pulses: 'You\'ve sent {count} pulses—keeping the rhythm alive!',
    heartbeats: 'You\'ve received {count} heartbeats—the network loves your energy!',
  },
  
  // Vibe check (daily prompt)
  VIBE_CHECK: {
    type: 'VIBE_CHECK',
    emoji: '✨',
    icon: 'sparkles',
    color: 'purple',
    title: 'Vibe Check',
    prompt: 'Feel the pulse—share yours in 2 mins for extra ripples!',
    reminder: 'Time for your daily vibe check! How\'s your rhythm today?',
  },
} as const;

export type NotificationType = keyof typeof notificationTypes;

/**
 * User presence/status types (Discord-inspired with rhythmic theme)
 */
export const presenceStatuses = {
  ONLINE: {
    status: 'ONLINE',
    label: 'Pulsing',
    description: 'Online and active',
    color: 'emerald',
    dot: 'animate-pulse',
    icon: '💚',
  },
  IDLE: {
    status: 'IDLE',
    label: 'Fading',
    description: 'Away from keyboard',
    color: 'amber',
    dot: 'animate-pulse-slow',
    icon: '🟡',
  },
  DND: {
    status: 'DND',
    label: 'Quiet Mode',
    description: 'Do not disturb',
    color: 'rose',
    dot: '',
    icon: '🔴',
  },
  OFFLINE: {
    status: 'OFFLINE',
    label: 'Offline',
    description: 'Not connected',
    color: 'zinc',
    dot: '',
    icon: '⚫',
  },
  LIVE: {
    status: 'LIVE',
    label: 'Live Pulsing',
    description: 'Streaming/Live',
    color: 'purple',
    dot: 'animate-pulse',
    icon: '🟣',
  },
  SYNCING: {
    status: 'SYNCING',
    label: 'Syncing',
    description: 'Browsing quietly',
    color: 'blue',
    dot: 'animate-pulse-slow',
    icon: '🔵',
  },
} as const;

export type PresenceStatus = keyof typeof presenceStatuses;

/**
 * Notification setting categories for user preferences
 */
export const notificationCategories = {
  ENGAGEMENT: {
    id: 'engagement',
    label: 'Engagement',
    description: 'Heartbeats, vibes, and repulses on your pulses',
    icon: 'heart',
    types: ['HEARTBEAT', 'VIBE', 'REPULSE'],
  },
  SOCIAL: {
    id: 'social',
    label: 'Social',
    description: 'New syncs, mentions, and replies',
    icon: 'users',
    types: ['SYNC', 'MENTION', 'REPLY'],
  },
  MESSAGES: {
    id: 'messages',
    label: 'Messages',
    description: 'Direct messages and group chats',
    icon: 'message-circle',
    types: ['DM', 'GROUP_MESSAGE'],
  },
  TRENDS: {
    id: 'trends',
    label: 'Trends & Milestones',
    description: 'Hot pulses, viral content, and achievements',
    icon: 'trending-up',
    types: ['HOT_PULSE', 'MILESTONE'],
  },
  PROMPTS: {
    id: 'prompts',
    label: 'Daily Prompts',
    description: 'Vibe checks and engagement reminders',
    icon: 'sparkles',
    types: ['VIBE_CHECK'],
  },
} as const;

export type NotificationCategory = keyof typeof notificationCategories;
