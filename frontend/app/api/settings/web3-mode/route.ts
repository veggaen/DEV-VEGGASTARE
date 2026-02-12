import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { z } from 'zod';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';

const BodySchema = z.object({
  enabled: z.boolean(),
});

/**
 * PATCH /api/settings/web3-mode
 * Toggle Web3 mode on/off for the authenticated user.
 * No email verification required — this just enables the UI toggle.
 * Wallet LINKING (signing + saving address) still requires verification separately.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit
  const rl = await checkRateLimit(
    getClientIdentifier(request, session.user.id),
    'write'
  );
  if (!rl.success) return rateLimitedResponse(rl);

  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    await dbPrisma.user.update({
      where: { id: session.user.id },
      data: { web3ModeEnabled: parsed.data.enabled },
    });

    return NextResponse.json({ success: true, web3ModeEnabled: parsed.data.enabled });
  } catch (error) {
    console.error('[api/settings/web3-mode] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
