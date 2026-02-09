import { Conversation, DeletionVisibility } from '@/generated/prisma/browser';

/**
 * Deletion System for Conversations
 * 
 * Philosophy:
 * - Low reach content can be deleted instantly
 * - Higher reach content has grace periods to protect valuable discussions
 * - Creator is anonymized immediately upon deletion request
 * - Participants are notified subtly
 * - Suspicious velocity (potential bot activity) is flagged for review
 */

// Reach thresholds for tiered deletion
export const DELETION_THRESHOLDS = {
  // Instant deletion (no grace period)
  LOW: {
    maxViews: 100,
    maxReplies: 10,
    gracePeriodDays: 0,
  },
  // 24-hour grace period
  MEDIUM: {
    maxViews: 1000,
    maxReplies: 100,
    gracePeriodDays: 1,
  },
  // 7-day grace period
  HIGH: {
    maxViews: 10000,
    maxReplies: 1000,
    gracePeriodDays: 7,
  },
  // 30-day grace period (viral content)
  VIRAL: {
    gracePeriodDays: 30,
  },
} as const;

// Suspicious velocity thresholds
export const VELOCITY_THRESHOLDS = {
  // Views per minute that trigger suspicion
  SUSPICIOUS_VIEWS_PER_MINUTE: 100,
  // If this many views in this time window, flag it
  SUSPICIOUS_VIEWS_COUNT: 10000,
  SUSPICIOUS_TIME_WINDOW_MINUTES: 30,
} as const;

export type ReachLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VIRAL';

/**
 * Determine the reach level of a conversation based on engagement metrics
 */
export function getReachLevel(conversation: Pick<Conversation, 'viewCount' | 'replyCount' | 'uniqueRepliers'>): ReachLevel {
  const { viewCount, replyCount } = conversation;

  // Check from highest to lowest
  if (viewCount > DELETION_THRESHOLDS.HIGH.maxViews || replyCount > DELETION_THRESHOLDS.HIGH.maxReplies) {
    return 'VIRAL';
  }
  if (viewCount > DELETION_THRESHOLDS.MEDIUM.maxViews || replyCount > DELETION_THRESHOLDS.MEDIUM.maxReplies) {
    return 'HIGH';
  }
  if (viewCount > DELETION_THRESHOLDS.LOW.maxViews || replyCount > DELETION_THRESHOLDS.LOW.maxReplies) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Calculate the grace period in days based on reach level
 */
export function getGracePeriodDays(reachLevel: ReachLevel): number {
  switch (reachLevel) {
    case 'LOW':
      return DELETION_THRESHOLDS.LOW.gracePeriodDays;
    case 'MEDIUM':
      return DELETION_THRESHOLDS.MEDIUM.gracePeriodDays;
    case 'HIGH':
      return DELETION_THRESHOLDS.HIGH.gracePeriodDays;
    case 'VIRAL':
      return DELETION_THRESHOLDS.VIRAL.gracePeriodDays;
  }
}

/**
 * Calculate the scheduled deletion date based on reach level
 */
export function calculateDeletionDate(conversation: Pick<Conversation, 'viewCount' | 'replyCount' | 'uniqueRepliers'>): Date {
  const reachLevel = getReachLevel(conversation);
  const gracePeriodDays = getGracePeriodDays(reachLevel);
  
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + gracePeriodDays);
  return deletionDate;
}

/**
 * Check if a conversation has suspicious velocity (potential bot activity)
 */
export function checkSuspiciousVelocity(
  conversation: Pick<Conversation, 'viewCount' | 'createdAt'>
): { isSuspicious: boolean; reason?: string } {
  const now = new Date();
  const createdAt = new Date(conversation.createdAt);
  const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);

  // If very new and high views, flag it
  if (
    minutesSinceCreation <= VELOCITY_THRESHOLDS.SUSPICIOUS_TIME_WINDOW_MINUTES &&
    conversation.viewCount >= VELOCITY_THRESHOLDS.SUSPICIOUS_VIEWS_COUNT
  ) {
    return {
      isSuspicious: true,
      reason: `${conversation.viewCount} views in ${Math.round(minutesSinceCreation)} minutes`,
    };
  }

  // Check views per minute rate
  if (minutesSinceCreation > 0) {
    const viewsPerMinute = conversation.viewCount / minutesSinceCreation;
    if (viewsPerMinute > VELOCITY_THRESHOLDS.SUSPICIOUS_VIEWS_PER_MINUTE) {
      return {
        isSuspicious: true,
        reason: `${Math.round(viewsPerMinute)} views/minute (threshold: ${VELOCITY_THRESHOLDS.SUSPICIOUS_VIEWS_PER_MINUTE})`,
      };
    }
  }

  return { isSuspicious: false };
}

/**
 * Format the time remaining until deletion for display
 */
export function formatTimeUntilDeletion(deletionScheduledFor: Date): string {
  const now = new Date();
  const diff = deletionScheduledFor.getTime() - now.getTime();
  
  if (diff <= 0) return 'soon';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return 'less than an hour';
}

/**
 * Check if a conversation can be immediately deleted (no grace period)
 */
export function canDeleteImmediately(conversation: Pick<Conversation, 'viewCount' | 'replyCount' | 'uniqueRepliers'>): boolean {
  return getReachLevel(conversation) === 'LOW';
}

