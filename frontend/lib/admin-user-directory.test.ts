import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), users: vi.fn(), count: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findMany: m.users, count: m.count } } }));
vi.mock('@/lib/admin', () => ({ isAdmin: (role: string) => role === 'OWNER' || role === 'ADMIN', logAdminAction: m.audit }));
import { GET, POST } from '@/app/api/admin/users/route';

const get = (query = '') => GET(new NextRequest('http://localhost:3000/api/admin/users?' + query));
const post = () => POST(new NextRequest('http://localhost:3000/api/admin/users', { method: 'POST', body: JSON.stringify({ action: 'delete', userIds: ['other'] }) }));
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'admin', role: 'ADMIN' });
  m.rate.mockResolvedValue({ success: true, resetIn: 12 }); m.users.mockResolvedValue([]); m.count.mockResolvedValue(0);
});

describe('admin directory read boundary', () => {
  it.each([null, { id: 'normal', role: 'USER' }, { id: 'demo_fixture', role: 'OWNER' }])('denies a non-admin identity %j', async actor => {
    m.auth.mockResolvedValue(actor);
    for (const call of [get, post]) {
      const response = await call(); expect(response.status).toBe(actor ? 403 : 401);
      expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie');
    }
    expect(m.users).not.toHaveBeenCalled(); expect(m.count).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
  it.each(['page=0','page=-1','page=abc','page=1.5','page=1001','limit=0','limit=-4','limit=101','limit=NaN','limit=1.1','role=SUPERUSER','sortBy=password','sortOrder=random','search='+'x'.repeat(101)])('rejects invalid query %s', async query => {
    const response = await get(query); expect(response.status).toBe(400); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(m.users).not.toHaveBeenCalled(); expect(m.count).not.toHaveBeenCalled();
  });
  it.each(['ADMIN','OWNER'])('allows bounded current %s reads and stable sorting', async role => {
    m.auth.mockResolvedValue({ id: 'privileged', role }); m.count.mockResolvedValue(31);
    const response = await get('page=2&limit=10&sortBy=name&sortOrder=asc&role=USER&search=%20Alex%25_%20');
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ users: [], pagination: { page: 2, limit: 10, total: 31, totalPages: 4 } });
    const query = m.users.mock.calls[0][0]; expect(query.skip).toBe(10); expect(query.take).toBe(10);
    expect(query.orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }]); expect(JSON.stringify(query.where)).toContain('Alex\\\\%\\\\_');
    expect(query.select.password).toBeUndefined(); expect(query.select.accounts).toBeUndefined(); expect(query.select.phoneNumber).toBeUndefined();
    expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(m.rate).toHaveBeenCalledWith('admin-users:privileged','read');
  });
  it('defaults to twenty users instead of an unbounded directory', async () => {
    expect((await get()).status).toBe(200); expect(m.users.mock.calls[0][0]).toMatchObject({ take: 20, skip: 0, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
  });
  it('rejects unsupported bulk writes without pretending to edit or adding an edit audit', async () => {
    const response = await post(); expect(response.status).toBe(405); expect(response.headers.get('allow')).toBe('GET'); expect(m.audit).not.toHaveBeenCalled();
  });
  it('throttles before database access', async () => {
    m.rate.mockResolvedValue({ success: false, resetIn: 17 }); const response = await get();
    expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('17'); expect(m.users).not.toHaveBeenCalled();
  });
  it.each(['auth','users','count'] as const)('does not disclose %s errors', async source => {
    const spy = vi.spyOn(console,'error').mockImplementation(() => {}); m[source].mockRejectedValue(new Error('private_database_marker'));
    try { const response = await get(); expect(response.status).toBe(500); expect(await response.text()).not.toContain('private_database_marker'); expect(JSON.stringify(spy.mock.calls)).not.toContain('private_database_marker'); expect(response.headers.get('cache-control')).toContain('no-store'); } finally { spy.mockRestore(); }
  });
});
