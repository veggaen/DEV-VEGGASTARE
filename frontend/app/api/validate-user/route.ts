import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ValidateUserResponseSchema } from '@/lib/types/users';
import { resolveVisibleEmail } from '@/lib/email-visibility';

const isDev = process.env.NODE_ENV !== 'production';

const bodySchema = z.object({
  input: z.string().trim().min(1).max(200),
});

export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ isValid: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bodyResult = await parseJsonOrError(req, bodySchema);
    if (!bodyResult.ok) return bodyResult.response;
    const { input } = bodyResult.data;

    const user = await dbPrisma.user.findFirst({
      where: {
        OR: [
          { email: input },
          { id: input },
          { name: input },
        ],
      },
      select: { id: true, name: true, email: true, emailDisplayMode: true },
    });

    if (user) {
      const visibleEmail = resolveVisibleEmail({
        targetUserId: user.id,
        targetEmail: user.email ?? null,
        targetEmailDisplayMode: user.emailDisplayMode,
        viewerUserId: session.id,
        viewerRole: session.role,
      });

      const dto = {
        isValid: true as const,
        user: {
          id: String(user.id),
          name: user.name ?? null,
          email: visibleEmail,
        },
      };
      const parsed = ValidateUserResponseSchema.safeParse(dto);
      if (!parsed.success) {
        console.error('[api/validate-user] Invalid POST DTO:', parsed.error);
        return NextResponse.json(
          { isValid: false, message: 'Server error.', ...(isDev ? { issues: parsed.error.issues } : {}) },
          { status: 500 }
        );
      }
      return NextResponse.json(parsed.data);
    } else {
      const dto = { isValid: false as const, message: 'User not found.' };
      const parsed = ValidateUserResponseSchema.safeParse(dto);
      if (!parsed.success) {
        console.error('[api/validate-user] Invalid POST DTO:', parsed.error);
        return NextResponse.json({ isValid: false, message: 'Server error.' }, { status: 500 });
      }
      return NextResponse.json(parsed.data, { status: 404 });
    }
  } catch (error) {
    console.error('Error validating user:', error);

    const dto = { isValid: false as const, message: 'Server error.' };
    const parsed = ValidateUserResponseSchema.safeParse(dto);
    if (!parsed.success) {
      return NextResponse.json({ isValid: false, message: 'Server error.' }, { status: 500 });
    }
    return NextResponse.json(parsed.data, { status: 500 });
  }
}