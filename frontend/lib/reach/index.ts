/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Reach 7-Pillar System — Public API
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Barrel export for the complete reach system.
 * Import from '@/lib/reach' in your components and API routes.
 */

// Constants & Configuration
export {
  PILLAR_WEIGHTS,
  ENGAGEMENT_INTENT_WEIGHTS,
  UNIQUENESS_DECAY,
  DEPTH_MULTIPLIERS,
  ECHO_CONFIG,
  RESONANCE_CONFIG,
  DECAY_CONFIG,
  VELOCITY_CONFIG,
  LOYALTY_CONFIG,
  GROWTH_CONFIG,
  RECALL_CONFIG,
  ANTI_GAMING,
  DWELL_CONFIG,
} from './constants';

// Engagement Strength Calculator
export {
  calculateEngagementStrength,
  aggregateEngagementsToPillars,
  type EngagementType,
  type EngagementStrengthContext,
  type EngagementStrengthResult,
} from './engagement-strength';

// 7-Pillar Calculator
export {
  calculatePillarScores,
  calculateTrueReachScore,
  calculateMomentum,
  checkResonance,
  type PillarInputs,
  type PillarScores,
  type ReachResult,
} from './pillar-calculator';

// Echo Propagation
export {
  propagateEcho,
  getEchoStats,
  type EchoResult,
} from './echo-propagation';
