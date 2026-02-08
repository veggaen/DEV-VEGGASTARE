import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { 
  calculateViewStrength, 
  determineUserVerificationTier,
  type ViewStrengthContext,
  type VerificationTier,
} from '@/lib/view-strength';
import { ConversationViewPostResponseSchema } from '@/lib/types/conversations';

const LOG_PREFIX = '[api/conversations/[id]/view]';
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Hash IP address for privacy while maintaining uniqueness tracking
 */
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.NEXTAUTH_SECRET).digest('hex').substring(0, 32);
}

/**
 * Determine view type based on context
 */
function determineViewType({
  isLoggedIn,
  isFirstView,
  isNewIp,
  isSameIpDifferentUser,
}: {
  isLoggedIn: boolean;
  isFirstView: boolean;
  isNewIp: boolean;
  isSameIpDifferentUser: boolean;
}): 'FIRST_VIEW' | 'REPEAT_VIEW' | 'ANONYMOUS_VIEW' | 'SAME_IP_NEW_USER' | 'UNIQUE_IP_NEW_USER' {
  if (!isLoggedIn) return 'ANONYMOUS_VIEW';
  if (isFirstView && isNewIp) return 'UNIQUE_IP_NEW_USER';
  if (isFirstView && isSameIpDifferentUser) return 'SAME_IP_NEW_USER';
  if (isFirstView) return 'FIRST_VIEW';
  return 'REPEAT_VIEW';
}

/**
 * POST /api/conversations/[id]/view
 *
 * Enhanced view tracking with verification-tier-based strength calculation.
 * 
 * View strength factors:
 * - User verification tier (ANONYMOUS → FULLY_VERIFIED)
 * - First-time vs repeat views (diminishing returns)
 * - Unique IP vs same IP
 * - Account age
 * 
 * This creates a weighted reach score where verified users' views
 * contribute more to reach than anonymous/unverified views.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  const session = await MyLibUserAuth();
  const userId = session?.id;
  const isLoggedIn = Boolean(userId);

  // Get IP and user agent
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  const ipHash = hashIp(ip);
  const userAgent = headersList.get('user-agent') || undefined;

  try {
    // Check if conversation exists
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, visibility: true, participants: true },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Only allow view tracking on public conversations, or for participants of private ones
    if (conversation.visibility !== 'PUBLIC') {
      if (!userId) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }
      // Check if user is a participant (participants is a String[] on the Conversation model)
      if (!conversation.participants.includes(userId)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    }

    // Get user data for verification tier calculation (if logged in)
    // Note: These fields may not exist in older databases - we'll handle gracefully
    let user: {
      id: string;
      createdAt: Date;
      hasGoogleAuth?: boolean;
      hasDiscordAuth?: boolean;
      hasGithubAuth?: boolean;
      hasVerifiedWallet?: boolean;
      hasWeb2Payment?: boolean;
      hasWeb3Payment?: boolean;
      phoneVerified?: Date | null;
      emailVerified?: Date | null;
      web3ModeEnabled?: boolean;
      isTwoFactorEnabled?: boolean;
    } | null = null;

    if (userId) {
      try {
        // Try to fetch with verification fields
        user = await dbPrisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            createdAt: true,
            hasGoogleAuth: true,
            hasDiscordAuth: true,
            hasGithubAuth: true,
            hasVerifiedWallet: true,
            hasWeb2Payment: true,
            hasWeb3Payment: true,
            phoneVerified: true,
            emailVerified: true,
            web3ModeEnabled: true,
            isTwoFactorEnabled: true,
          },
        });
      } catch {
        // Fallback: verification fields don't exist yet in database
        // Just get basic user info
        user = await dbPrisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            createdAt: true,
            emailVerified: true,
            web3ModeEnabled: true,
            isTwoFactorEnabled: true,
          },
        });
      }
    }

    // Check if this IP has viewed before (any user)
    const existingIpView = await dbPrisma.conversationView.findFirst({
      where: {
        conversationId,
        ipHash,
      },
    });
    const isNewIp = !existingIpView;

    // Track context for strength calculation
    let isFirstView = true;
    let previousViewCount = 0;
    let isSameIpDifferentUser = false;

    // Handle logged-in user views
    if (userId) {
      const existingUserView = await dbPrisma.conversationView.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      isFirstView = !existingUserView;
      previousViewCount = existingUserView?.viewCount || 0;
      
      // Check if same IP but different user
      if (existingIpView && existingIpView.userId !== userId) {
        isSameIpDifferentUser = true;
      }

      // Determine verification tier
      const verificationTier: VerificationTier = user 
        ? determineUserVerificationTier(user)
        : 'ANONYMOUS';

      // Calculate account age in days
      const accountAgeDays = user 
        ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Calculate view strength using the new system
      const strengthContext: ViewStrengthContext = {
        verificationTier,
        isFirstView,
        previousViewCount,
        isNewIp,
        isSameIpDifferentUser,
        accountAgeDays,
      };
      
      const strengthResult = calculateViewStrength(strengthContext);
      const strength = strengthResult.strength;

      if (existingUserView) {
        // Update existing view record
        await dbPrisma.conversationView.update({
          where: { id: existingUserView.id },
          data: {
            viewCount: { increment: 1 },
            lastViewedAt: new Date(),
            ipHash, // Update IP in case user moved
            userAgent,
            viewStrength: strength, // Update with latest strength
          },
        });
      } else {
        // Create new view record for this user
        await dbPrisma.conversationView.create({
          data: {
            conversationId,
            userId,
            ipHash,
            userAgent,
            isLoggedIn: true,
            viewCount: 1,
            viewStrength: strength,
            firstViewedAt: new Date(),
            lastViewedAt: new Date(),
          },
        });
      }

      // Log view event for detailed analytics
      const viewType = determineViewType({
        isLoggedIn,
        isFirstView,
        isNewIp,
        isSameIpDifferentUser,
      });

      await dbPrisma.viewEvent.create({
        data: {
          conversationId,
          userId,
          ipHash,
          userAgent,
          viewType,
          strength,
          referrer: req.headers.get('referer') || undefined,
          viewedAt: new Date(),
        },
      });

      // Update conversation aggregates
      const updateData: Record<string, unknown> = {
        viewCount: { increment: 1 },
        lastActivityAt: new Date(),
        reachScore: { increment: strength },
        loggedInViewCount: { increment: 1 },
      };

      if (isNewIp) {
        updateData.uniqueIpCount = { increment: 1 };
      }

      if (isFirstView) {
        updateData.uniqueViewCount = { increment: 1 };
      }

      await dbPrisma.conversation.update({
        where: { id: conversationId },
        data: updateData,
      });

      console.log(
        LOG_PREFIX,
        `View tracked: ${conversationId} | tier: ${verificationTier} | type: ${viewType} | strength: ${strength.toFixed(2)} (${strengthResult.strengthCategory}) | user: ${userId} | ip: ${ipHash.substring(0, 8)}...`
      );

      const payload = {
        success: true as const,
        viewType,
        strength,
        strengthCategory: strengthResult.strengthCategory,
        verificationTier,
        isFirstView,
      };

      const validated = ConversationViewPostResponseSchema.safeParse(payload);
      if (!validated.success) {
        console.error(LOG_PREFIX, 'Invalid view POST response DTO:', validated.error);
        return NextResponse.json(
          { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
          { status: 500 }
        );
      }

      return NextResponse.json(validated.data, { status: 200 });
    } else {
      // Anonymous view - track by IP
      const anonymousStrength = calculateViewStrength({
        verificationTier: 'ANONYMOUS',
        isFirstView: !existingIpView || !existingIpView.userId,
        previousViewCount: existingIpView?.viewCount || 0,
        isNewIp,
        isSameIpDifferentUser: false,
      });

      if (existingIpView && !existingIpView.userId) {
        // Same anonymous visitor
        await dbPrisma.conversationView.update({
          where: { id: existingIpView.id },
          data: {
            viewCount: { increment: 1 },
            lastViewedAt: new Date(),
            userAgent,
            viewStrength: anonymousStrength.strength,
          },
        });
      } else if (!existingIpView) {
        // New anonymous visitor
        await dbPrisma.conversationView.create({
          data: {
            conversationId,
            userId: null,
            ipHash,
            userAgent,
            isLoggedIn: false,
            viewCount: 1,
            viewStrength: anonymousStrength.strength,
            firstViewedAt: new Date(),
            lastViewedAt: new Date(),
          },
        });
      }

      // Log anonymous view event
      await dbPrisma.viewEvent.create({
        data: {
          conversationId,
          userId: null,
          ipHash,
          userAgent,
          viewType: 'ANONYMOUS_VIEW',
          strength: anonymousStrength.strength,
          referrer: req.headers.get('referer') || undefined,
          viewedAt: new Date(),
        },
      });

      // Update conversation aggregates
      const updateData: Record<string, unknown> = {
        viewCount: { increment: 1 },
        lastActivityAt: new Date(),
        reachScore: { increment: anonymousStrength.strength },
        anonymousViewCount: { increment: 1 },
      };

      if (isNewIp) {
        updateData.uniqueIpCount = { increment: 1 };
      }

      await dbPrisma.conversation.update({
        where: { id: conversationId },
        data: updateData,
      });

      console.log(
        LOG_PREFIX,
        `Anonymous view tracked: ${conversationId} | strength: ${anonymousStrength.strength.toFixed(2)} (${anonymousStrength.strengthCategory}) | ip: ${ipHash.substring(0, 8)}...`
      );

      const payload = {
        success: true as const,
        viewType: 'ANONYMOUS_VIEW' as const,
        strength: anonymousStrength.strength,
        strengthCategory: anonymousStrength.strengthCategory,
        verificationTier: 'ANONYMOUS' as const,
        isFirstView: !existingIpView,
      };

      const validated = ConversationViewPostResponseSchema.safeParse(payload);
      if (!validated.success) {
        console.error(LOG_PREFIX, 'Invalid anonymous view POST response DTO:', validated.error);
        return NextResponse.json(
          { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
          { status: 500 }
        );
      }

      return NextResponse.json(validated.data, { status: 200 });
    }
  } catch (error) {
    console.error(LOG_PREFIX, 'Error tracking view:', error);
    return NextResponse.json({ message: 'Error tracking view' }, { status: 500 });
  }
}

