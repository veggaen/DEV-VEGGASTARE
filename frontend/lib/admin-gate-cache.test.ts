import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/site-config', () => ({ ACCESS_GATE_CONFIG: { enabled: true, password: 'synthetic-gate-fixture', cookieName: 'veggastare_access', bypassRoutes: [] } }));
import proxy from '@/proxy';

describe('admin gate cache boundary', () => {
  it.each(['/api/admin/users', '/admin/users'])('never caches a cookie-dependent refusal at %s', async path => {
    const response = await proxy(new NextRequest('http://localhost:3000' + path));
    expect(response.status).toBe(path.startsWith('/api') ? 401 : 307);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
  });
});
