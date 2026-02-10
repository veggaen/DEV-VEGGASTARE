/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Reach 7-Pillar System — Constants & Configuration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Central configuration for the Propagation Vitality Index (PVI).
 * All weights, multipliers, thresholds, and decay constants live here.
 */

// ─── 7-Pillar Weights ───────────────────────────────────────────────────────
// Per REACH_7_PILLARS_SPECIFICATION.md — must sum to 1.0

export const PILLAR_WEIGHTS = {
  VISIBILITY: 0.18,
  ENGAGEMENT_DEPTH: 0.25,
  CONVERSION_IMPACT: 0.18,
  LOYALTY: 0.14,
  GROWTH: 0.10,
  RECALL: 0.05,
  VELOCITY: 0.10,
} as const;

// ─── Engagement Intent Weights ──────────────────────────────────────────────
// Higher = more valuable signal for engagement depth

export const ENGAGEMENT_INTENT_WEIGHTS = {
  // Pillar 2: Engagement Depth
  CLICK: 0.8,
  HOVER_DEEP_READ: 0.4,
  SCROLL_DEPTH: 0.3,
  DWELL_TIME: 0.5,
  SAVE_BOOKMARK: 1.5,
  COPY_TEXT: 0.6,
  COMMENT_SHORT: 1.0,
  COMMENT_LONG: 2.0,
  COMMENT_THREAD: 2.5,
  HEARTBEAT: 0.8,
  REPULSE: 3.0,
  SHARE_EXTERNAL: 2.5,
  
  // Pillar 3: Conversion Impact
  PRODUCT_VIEW: 0.5,
  PRODUCT_CLICK: 1.2,
  ADD_TO_CART: 2.5,
  PURCHASE: 5.0,
  PROFILE_FOLLOW: 1.5,
  
  // Pillar 6: Recall
  RETURN_VISIT: 0.8,
  TAB_REFOCUS: 0.3,
} as const;

// ─── Uniqueness Decay (per-user per-pulse) ──────────────────────────────────
// Rapid decay for repeated actions from the same user on the same content.

export const UNIQUENESS_DECAY = {
  FIRST_ACTION: 1.0,
  SECOND_ACTION: 0.6,
  THIRD_PLUS: 0.3,
} as const;

// ─── Thread Depth Multipliers ───────────────────────────────────────────────
// Threaded discussions indicate deeper engagement ("Resonance Multiplier").

export const DEPTH_MULTIPLIERS = {
  TOP_LEVEL: 1.0,
  THREADED_REPLY: 1.3,
  DEEP_THREAD: 1.5, // >4 messages in thread
} as const;

// ─── Echo Propagation ───────────────────────────────────────────────────────
// When a pulse is repulsed, credit flows back to the original.

export const ECHO_CONFIG = {
  /** % of child incoming strength that echoes to parent */
  DIRECT_ECHO_RATE: 0.20,
  /** % of grandchild strength that echoes to grandparent */
  INDIRECT_ECHO_RATE: 0.10,
  /** Max depth for echo traversal (prevents infinite loops) */
  MAX_ECHO_DEPTH: 4,
  /** Min unique engagers on child before echo flows (anti-gaming) */
  MIN_ENGAGERS_FOR_ECHO: 3,
  /** Max echo strength per edge per day */
  DAILY_ECHO_CAP: 50.0,
} as const;

// ─── Community Resonance ────────────────────────────────────────────────────
// When a pulse gets broad authentic engagement, apply a temporary boost.

export const RESONANCE_CONFIG = {
  /** Min unique engagers in window to trigger resonance */
  MIN_UNIQUE_ENGAGERS: 10,
  /** Breadth ratio threshold (unique/total) */
  MIN_BREADTH_RATIO: 0.7,
  /** Time window for checking resonance (hours) */
  WINDOW_HOURS: 24,
  /** Multiplier range: [low, high] */
  MULTIPLIER_RANGE: [1.2, 1.8] as const,
  /** How long resonance lasts (hours) */
  DURATION_HOURS: 48,
} as const;

// ─── Momentum Decay ─────────────────────────────────────────────────────────
// Exponential decay applied daily if no significant activity.

export const DECAY_CONFIG = {
  /** Base decay factor per day of inactivity (pulses/users/companies) */
  DAILY_DECAY_RATE: 0.96,
  /** Product-specific decay (semi-evergreen, decays slower) */
  PRODUCT_DAILY_DECAY_RATE: 0.97,
  /** Minimum interaction strength to count as "active" (prevents decay) */
  ACTIVITY_THRESHOLD: 0.5,
  /** Hours of inactivity before decay starts */
  INACTIVITY_GRACE_HOURS: 48,
  /** Recent activity lift window (hours) */
  RECENT_LIFT_WINDOW_HOURS: 72,
  /** Floor: momentum cannot drop below this fraction of lifetime */
  MOMENTUM_FLOOR_RATIO: 0.05,
} as const;

// ─── Velocity ───────────────────────────────────────────────────────────────
// Pillar 7: Trending speed, breadth-weighted momentum delta.

export const VELOCITY_CONFIG = {
  /** Weight for 1-hour delta */
  DELTA_1H_WEIGHT: 0.65,
  /** Weight for 24-hour delta */
  DELTA_24H_WEIGHT: 0.35,
  /** Breadth multiplier clamp range */
  BREADTH_CLAMP: [0.5, 1.4] as const,
} as const;

// ─── Loyalty (Pillar 4) ─────────────────────────────────────────────────────

export const LOYALTY_CONFIG = {
  /** Min distinct sessions to count as "repeat engager" */
  MIN_SESSIONS_FOR_LOYALTY: 3,
  /** Bonus per repeat engagement session */
  REPEAT_SESSION_BONUS: 0.2,
  /** Affinity boost: pulse bridges >N loyalty cliques */
  AFFINITY_CLIQUE_THRESHOLD: 2,
  AFFINITY_BOOST: 0.20,
} as const;

// ─── Growth (Pillar 5) ──────────────────────────────────────────────────────

export const GROWTH_CONFIG = {
  /** Bonus per unique referrer source */
  UNIQUE_REFERRER_BONUS: 0.3,
  /** External share bonus (detected via referrer) */
  EXTERNAL_SHARE_BONUS: 0.5,
} as const;

// ─── Recall (Pillar 6) ──────────────────────────────────────────────────────

export const RECALL_CONFIG = {
  /** Bonus per return visit (>1h gap) */
  RETURN_VISIT_BONUS: 0.3,
  /** Min gap between visits to count as "return" (hours) */
  MIN_RETURN_GAP_HOURS: 1,
  /** Max time-away bonus multiplier */
  MAX_TIME_AWAY_BONUS: 2.0,
} as const;

// ─── Anti-Gaming ────────────────────────────────────────────────────────────

export const ANTI_GAMING = {
  /** Min breadth ratio (unique/total) for full strength */
  MIN_BREADTH_RATIO: 0.6,
  /** Below this ratio, strength is halved */
  BREADTH_PENALTY_FACTOR: 0.5,
  /** Max events from same user per pulse per hour */
  MAX_EVENTS_PER_USER_PER_HOUR: 10,
  /** Max self-interaction % of total */
  MAX_SELF_INTERACTION_PCT: 0.05,
  /** Suspicious velocity: views per minute */
  SUSPICIOUS_VIEWS_PER_MINUTE: 100,
  /** Suspicious velocity: total views in 30 min */
  SUSPICIOUS_VIEWS_30MIN: 10000,
} as const;

// ─── Dwell Time Thresholds ──────────────────────────────────────────────────

export const DWELL_CONFIG = {
  /** Min dwell time for a quality view (ms) */
  MIN_QUALITY_DWELL_MS: 500,
  /** Quality dwell bonus threshold (ms) */
  QUALITY_DWELL_THRESHOLD_MS: 30000,
  /** Bonus for quality dwell */
  QUALITY_DWELL_BONUS: 0.5,
  /** Min hover duration to count as deep read (ms) */
  DEEP_READ_HOVER_MS: 3000,
} as const;
