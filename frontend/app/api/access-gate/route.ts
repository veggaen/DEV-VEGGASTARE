import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CORRECT_PASSWORD = 'MainAdc123';
const COOKIE_NAME = 'veggastare_access';
// Simple hash of the password - in production you'd use a proper secret
const COOKIE_VALUE = 'granted_' + Buffer.from(CORRECT_PASSWORD).toString('base64').slice(0, 16);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    if (password !== CORRECT_PASSWORD) {
      return NextResponse.json(
        { error: 'Incorrect password. Case-sensitive.' },
        { status: 401 }
      );
    }

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // Session cookie - expires when browser closes
      // Or set maxAge for longer: maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

// GET to check if authenticated
export async function GET() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(COOKIE_NAME);

  if (accessCookie?.value === COOKIE_VALUE) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}

// DELETE to logout/clear access
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ success: true });
}
