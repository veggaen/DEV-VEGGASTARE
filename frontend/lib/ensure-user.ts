import { dbPrisma } from '@/lib/db';
import { ExtendedUser } from '@/next-auth';

const LOG_PREFIX = '[lib/ensure-user]';

export interface EnsureUserResult {
  success: boolean;
  userId: string;
  created: boolean;
  error?: string;
}

/**
 * Ensures a User row exists in the database for the given session user.
 * This prevents FK violations (P2003) when creating dependent records like UserPrivacySettings.
 * 
 * The function uses upsert to handle race conditions safely.
 * 
 * @param session - The session user from auth (ExtendedUser)
 * @returns EnsureUserResult with success status and userId
 */
export async function ensureUser(session: ExtendedUser): Promise<EnsureUserResult> {
  if (!session?.id) {
    return {
      success: false,
      userId: '',
      created: false,
      error: 'No session ID provided',
    };
  }

  const userId = session.id;
  const email = session.email || null;
  const name = session.name || null;
  const image = session.image || null;

  try {
    // First, check if user exists (fast path)
    const existingUser = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (existingUser) {
      return {
        success: true,
        userId: existingUser.id,
        created: false,
      };
    }

    // User doesn't exist - create them
    // This can happen if:
    // 1. User signed in via OAuth but adapter didn't create User row
    // 2. Database was reset/migrated
    // 3. Session data is stale
    
    console.log(`${LOG_PREFIX} Creating missing user row for session id=${userId}`);
    
    // Use upsert to handle race conditions (another request might create the user)
    const user = await dbPrisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email,
        name,
        image,
        // Set sensible defaults
        role: 'USER',
        web3ModeEnabled: false,
        isTwoFactorEnabled: false,
        verificationScore: 0,
        verificationTier: 'ANONYMOUS',
      },
      update: {
        // If user exists (race condition), just update basic info if missing
        email: email || undefined,
        name: name || undefined,
        image: image || undefined,
      },
      select: { id: true },
    });

    console.log(`${LOG_PREFIX} User row ensured for id=${user.id}`);

    return {
      success: true,
      userId: user.id,
      created: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to ensure user:`, error);
    
    // Check if it's a unique constraint error (user was created by another request)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      // User was created by race condition - this is fine
      return {
        success: true,
        userId,
        created: false,
      };
    }

    return {
      success: false,
      userId,
      created: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Ensures user exists and returns the user ID, or throws an error.
 * Convenience wrapper for when you need to fail fast.
 */
export async function ensureUserOrThrow(session: ExtendedUser): Promise<string> {
  const result = await ensureUser(session);
  if (!result.success) {
    throw new Error(result.error || 'Failed to ensure user exists');
  }
  return result.userId;
}
