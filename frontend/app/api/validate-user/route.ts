import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { input } = await req.json();

    if (!input) {
      return NextResponse.json({ isValid: false, message: 'Input is required.' }, { status: 400 });
    }

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