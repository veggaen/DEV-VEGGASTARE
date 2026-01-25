import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
      select: { id: true, name: true, email: true },
    });

    if (user) {
      return NextResponse.json({ isValid: true, user });
    } else {
      return NextResponse.json({ isValid: false, message: 'User not found.' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error validating user:', error);
    return NextResponse.json({ isValid: false, message: 'Server error.' }, { status: 500 });
  }
}