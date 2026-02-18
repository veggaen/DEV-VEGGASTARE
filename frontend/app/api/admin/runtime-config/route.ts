/**
 * @fileOverview Owner-admin runtime toggle API for payment and Bring live/test modes.
 * @stability stable
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isAdmin, isOwner, logAdminAction } from '@/lib/admin';
import { AdminAction, AdminTargetType } from '@/generated/prisma/browser';
import { getRuntimeConfig, upsertRuntimeConfig } from '@/lib/runtime-config';
import { parseJsonOrError } from '@/lib/api-validate';

const PatchRuntimeConfigSchema = z
  .object({
    paymentsLiveEnabled: z.boolean().optional(),
    bringLiveEnabled: z.boolean().optional(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .refine((value) => value.paymentsLiveEnabled !== undefined || value.bringLiveEnabled !== undefined, {
    message: 'At least one runtime toggle must be provided',
  });

const LOG_PREFIX = '[api/admin/runtime-config]';

export async function GET() {
  const session = await MyLibUserAuth();

  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const runtime = await getRuntimeConfig();
  return NextResponse.json({ runtime });
}

export async function PATCH(req: Request) {
  const session = await MyLibUserAuth();

  if (!session?.id || !isOwner(session.role)) {
    return NextResponse.json({ error: 'Forbidden — OWNER only' }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(req, PatchRuntimeConfigSchema);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const before = await getRuntimeConfig();
    const after = await upsertRuntimeConfig({
      paymentsLiveEnabled: bodyResult.data.paymentsLiveEnabled,
      bringLiveEnabled: bodyResult.data.bringLiveEnabled,
      updatedBy: session.id,
    });

    await logAdminAction({
      adminId: session.id,
      action: AdminAction.EDIT,
      targetType: AdminTargetType.RUNTIME_CONFIG,
      targetId: 'default',
      previousData: {
        paymentsLiveEnabled: before.paymentsLiveEnabled,
        bringLiveEnabled: before.bringLiveEnabled,
      },
      newData: {
        paymentsLiveEnabled: after.paymentsLiveEnabled,
        bringLiveEnabled: after.bringLiveEnabled,
      },
      reason: bodyResult.data.reason || 'Updated runtime integration toggles',
    });

    return NextResponse.json({ runtime: after });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to update runtime config:`, error);
    return NextResponse.json({ error: 'Failed to update runtime config' }, { status: 500 });
  }
}
