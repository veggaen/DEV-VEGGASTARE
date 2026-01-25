import { NextResponse } from 'next/server';
import type { ZodError, ZodSchema } from 'zod';

const isDev = process.env.NODE_ENV !== 'production';

function formatZodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

export function zodErrorResponse(error: ZodError, status = 400) {
  return NextResponse.json(
    {
      message: 'Invalid request',
      ...(isDev ? { issues: formatZodIssues(error) } : {}),
    },
    { status }
  );
}

export async function parseJsonOrError<T>(req: Request, schema: ZodSchema<T>) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false as const, response: zodErrorResponse(parsed.error) };
  }

  return { ok: true as const, data: parsed.data };
}

export function parseQueryOrError<T>(req: Request, schema: ZodSchema<T>) {
  const { searchParams } = new URL(req.url);
  const queryObject = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(queryObject);

  if (!parsed.success) {
    return { ok: false as const, response: zodErrorResponse(parsed.error) };
  }

  return { ok: true as const, data: parsed.data };
}
