import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mkdir, appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

function getLogPaths() {
  const logsDir = path.join(process.cwd(), '..', '.error-logs');
  const logPath = path.join(logsDir, 'client-errors.ndjson');
  return { logsDir, logPath };
}

const bodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
  stack: z.string().trim().max(20000).optional().nullable(),
  digest: z.string().trim().max(200).optional().nullable(),
  name: z.string().trim().max(200).optional().nullable(),
  href: z.string().trim().max(2048).optional().nullable(),
  pathname: z.string().trim().max(1024).optional().nullable(),
  userAgent: z.string().trim().max(1024).optional().nullable(),
  theme: z.enum(['light', 'dark', 'system']).optional().nullable(),
  consent: z
    .object({
      version: z.number().optional(),
      necessary: z.boolean().optional(),
      analytics: z.boolean().optional(),
      marketing: z.boolean().optional(),
      updatedAt: z.string().optional(),
      source: z.enum(['localStorage', 'missing']).optional(),
    })
    .optional()
    .nullable(),
  meta: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Invalid payload' }, { status: 400 });
    }

    const payload = parsed.data;
    const now = new Date().toISOString();

    const record = {
      ts: now,
      message: payload.message,
      name: payload.name ?? null,
      digest: payload.digest ?? null,
      stack: payload.stack ?? null,
      href: payload.href ?? null,
      pathname: payload.pathname ?? null,
      userAgent: payload.userAgent ?? req.headers.get('user-agent') ?? null,
      theme: payload.theme ?? null,
      consent: payload.consent ?? null,
      meta: payload.meta ?? null,
    };

    // NOTE: filesystem persistence is best-effort (works locally; serverless may be ephemeral)
    const { logsDir, logPath } = getLogPaths();

    await mkdir(logsDir, { recursive: true });
    await appendFile(logPath, JSON.stringify(record) + '\n', { encoding: 'utf8' });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    // Never throw from telemetry endpoint
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET(req: Request) {
  // Avoid exposing stacks/user agent in production by default.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
  }

  try {
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get('limit');
    const limit = Math.max(1, Math.min(500, Number.parseInt(limitRaw ?? '100', 10) || 100));

    const { logPath } = getLogPaths();

    let fileText = '';
    try {
      fileText = await readFile(logPath, { encoding: 'utf8' });
    } catch {
      return NextResponse.json({ ok: true, records: [] }, { status: 200 });
    }

    const lines = fileText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const tail = lines.slice(Math.max(0, lines.length - limit));

    const records: unknown[] = [];
    for (const line of tail) {
      try {
        records.push(JSON.parse(line));
      } catch {
        // ignore malformed lines
      }
    }

    // Newest first
    records.reverse();

    return NextResponse.json({ ok: true, records }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, records: [] }, { status: 200 });
  }
}
