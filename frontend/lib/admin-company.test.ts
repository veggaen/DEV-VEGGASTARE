import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), reads: vi.fn(), writes: vi.fn(), actor: vi.fn(), list: vi.fn(), count: vi.fn(), get: vi.fn(), update: vi.fn(), audit: vi.fn(), raw: vi.fn(), transaction: vi.fn(), checkoutCounts: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.writes, allowAdminDetailRead: m.reads }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: m.transaction } }));
vi.mock('./company-checkout-counts', () => ({ companyCheckoutCounts: m.checkoutCounts }));
import { adminCompanies, adminCompanyDetail } from './admin-company';
import { adminCompanyPatchSchema } from './admin-company-policy';
const time = '2026-01-01T00:00:00.000Z';
const row = { id: 'company', name: 'Original', description: null, websiteUrl: null, logo: [], bannerImage: [], colorScheme: null, usesShipping: false, updatedAt: new Date(time) };
const request = (method = 'GET', body?: unknown, headers?: Record<string, string>) => new Request('http://localhost:3000/api/admin/companies/company', { method, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const patch = (body: object = {}) => adminCompanyDetail(request('PATCH', { expectedUpdatedAt: time, reason: 'Support correction', name: 'Updated', ...body }), 'company', 'PATCH');
const list = (query = '') => adminCompanies(new Request('http://localhost:3000/api/admin/companies?' + query));
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'actor', role: 'ADMIN', sessionVersion: 3 }); m.actor.mockResolvedValue({ id: 'actor', role: 'ADMIN', tokenVersion: 3 });
  m.rate.mockResolvedValue({ success: true, resetIn: 12 }); m.reads.mockResolvedValue(true); m.writes.mockResolvedValue(true);
  m.list.mockResolvedValue([]); m.count.mockResolvedValue(31); m.get.mockResolvedValue(row); m.update.mockResolvedValue({ ...row, name: 'Updated' }); m.audit.mockResolvedValue({ id: 'audit' });
  m.checkoutCounts.mockResolvedValue(new Map([['company', { livePaid: 2, liveAdjusted: 1, liveReview: 0, sandbox: 5 }]]));
  m.transaction.mockImplementation(async (run: (tx: unknown) => unknown) => run({ user: { findUnique: m.actor }, company: { findMany: m.list, count: m.count, findUnique: m.get, update: m.update }, adminAuditLog: { create: m.audit }, $queryRaw: m.raw }));
});
describe('company administration boundary', () => {
  it.each([null, { id: 'member', role: 'USER' }, { id: 'demo_test', role: 'OWNER' }, { id: 'actor', role: 'OWNER', isImpersonating: true }])('denies restricted identity %j without data', async actor => {
    m.auth.mockResolvedValue(actor);
    for (const response of [await list(), ...await Promise.all((['GET', 'PATCH', 'DELETE'] as const).map(method => adminCompanyDetail(request(method), 'company', method)))]) {
      expect(response.status).toBe(actor ? 403 : 401); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie');
    }
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it.each(['page=-1', 'page=0', 'page=NaN', 'page=1.5', 'page=1001', 'limit=-1', 'limit=101', 'sortBy=paypalEmail', 'sortOrder=no', 'search=' + 'x'.repeat(101), 'page=1&page=2', 'unknown=1'])('rejects invalid filters %s', async query => {
    expect((await list(query)).status).toBe(400); expect(m.transaction).not.toHaveBeenCalled();
  });
  it('uses bounded summary fields, literal search and stable sorting', async () => {
    const response = await list('page=2&limit=10&search=Shop%25_&sortBy=name&sortOrder=asc'); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pagination: { page: 2, limit: 10, total: 31, totalPages: 4 } });
    const query = m.list.mock.calls[0][0]; expect(query).toMatchObject({ take: 10, skip: 10, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    expect(query.where.OR[0].name.contains).toBe('Shop\\%\\_'); expect(query.select).not.toHaveProperty('paypalEmail'); expect(query.select).not.toHaveProperty('description');
    expect(query.select.User_Company_ownerIdToUser.select).toEqual({ id: true, name: true }); expect(m.transaction.mock.calls[0][1].isolationLevel).toBe('RepeatableRead');
  });
  it('checks current actor version and role before reading or editing', async () => {
    for (const current of [null, { role: 'ADMIN', tokenVersion: 4 }, { role: 'USER', tokenVersion: 3 }]) {
      m.actor.mockResolvedValue(current);
      for (const response of [await list(), await patch(), await adminCompanyDetail(request(), 'company', 'GET')]) expect([401, 403]).toContain(response.status);
    }
    expect(m.get).not.toHaveBeenCalled(); expect(m.list).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it('requires same-origin writes', async () => {
    for (const method of ['PATCH', 'DELETE'] as const) expect((await adminCompanyDetail(request(method, {}, { origin: 'https://attacker.example' }), 'company', method)).status).toBe(403);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it('throttles lists and details/writes', async () => {
    m.rate.mockResolvedValue({ success: false, resetIn: 17 }); m.reads.mockResolvedValue(false); m.writes.mockResolvedValue(false);
    for (const response of [await list(), await patch(), await adminCompanyDetail(request(), 'company', 'GET')]) { expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBeTruthy(); }
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it('returns not-found and refuses destructive cascading deletion', async () => {
    m.get.mockResolvedValue(null); expect((await adminCompanyDetail(request(), 'company', 'GET')).status).toBe(404); expect((await patch()).status).toBe(404);
    expect((await adminCompanyDetail(request('DELETE'), 'company', 'DELETE')).status).toBe(409); expect(m.update).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
  it('returns a bounded detail and mandatory VIEW audit without payout or verification-token data', async () => {
    const response = await adminCompanyDetail(request(), 'company', 'GET'); expect(response.status).toBe(200);
    expect((await response.json()).company.checkoutCounts).toEqual({ livePaid: 2, liveAdjusted: 1, liveReview: 0, sandbox: 5 });
    const select = m.get.mock.calls[0][0].select; expect(select.orgVerification.select).toEqual({ status: true, verifiedAt: true }); expect(select).not.toHaveProperty('paypalEmail'); expect(select).not.toHaveProperty('Employee');
    expect(m.audit.mock.calls[0][0].data).toMatchObject({ adminId: 'actor', action: 'VIEW', targetType: 'COMPANY', targetId: 'company' });
    expect(m.transaction.mock.calls[0][1].isolationLevel).toBe('RepeatableRead');
  });
  it('loads checkout counts only for the visible page in the same transaction', async () => {
    m.list.mockResolvedValue([row]); const response = await list();
    expect((await response.json()).companies[0].checkoutCounts.livePaid).toBe(2);
    expect(m.checkoutCounts).toHaveBeenCalledTimes(1); expect(m.checkoutCounts.mock.calls[0][1]).toEqual(['company']);
    expect(m.checkoutCounts.mock.calls[0][0].company.findMany).toBe(m.list);
  });
  it('does not substitute zero when checkout reporting fails', async () => {
    m.checkoutCounts.mockRejectedValue(new Error('private-reporting-failure'));
    for (const response of [await list(), await adminCompanyDetail(request(), 'company', 'GET')]) {
      expect(response.status).toBe(503); expect(await response.text()).not.toContain('private-reporting-failure');
    }
    expect(m.audit).not.toHaveBeenCalled();
  });
});
describe('audited company edits', () => {
  it.each([{ ownerId: 'other' }, { orgNumber: '123' }, { orgType: 'AS' }, { paypalEmail: 'buyer@example.test' }, { defaultReceivingWalletId: 'wallet' }, { orgVerification: {} }, { logo: 'https://example.test/a.png' }, { logo: [null] }, { logo: Array(6).fill('https://example.test/a.png') }, { websiteUrl: 'javascript:alert(1)' }, { logo: ['https://name:password@example.test/a.png'] }, { reason: '' }, { name: '   ' }, { expectedUpdatedAt: 'yesterday' }, { usesShipping: 'yes' }])('rejects unsupported/invalid payload %j', async body => {
    expect((await patch(body)).status).toBe(400); expect(m.update).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
  it('commits only changed storefront fields and exact audit together', async () => {
    expect((await patch({ logo: ['https://example.test/logo.png'], description: null, usesShipping: true })).status).toBe(200);
    const data = m.update.mock.calls[0][0].data; expect(data).toMatchObject({ name: 'Updated', logo: ['https://example.test/logo.png'], usesShipping: true }); expect(data).not.toHaveProperty('description');
    expect(m.audit.mock.calls[0][0].data).toMatchObject({ action: 'EDIT', reason: 'Support correction', previousData: { name: 'Original', logo: [], usesShipping: false }, newData: { name: 'Updated', logo: ['https://example.test/logo.png'], usesShipping: true } });
    expect(m.raw.mock.calls.length).toBe(2); expect(m.transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects stale or no-op edits', async () => {
    expect((await patch({ expectedUpdatedAt: '2020-01-01T00:00:00.000Z' })).status).toBe(409);
    expect((await patch({ name: 'Original' })).status).toBe(400); expect(m.update).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
  it('bounds bodies before parsing and handles malformed JSON', async () => {
    const options = { method: 'PATCH', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' } };
    expect((await adminCompanyDetail(new Request('http://localhost:3000/api/admin/companies/company', { ...options, body: 'x'.repeat(32769) }), 'company', 'PATCH')).status).toBe(413);
    expect((await adminCompanyDetail(new Request('http://localhost:3000/api/admin/companies/company', { ...options, body: '{' }), 'company', 'PATCH')).status).toBe(400);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it.each(['auth', 'audit', 'update', 'get'] as const)('does not expose private %s failures', async source => {
    m[source].mockRejectedValue(new Error('private_database_marker')); const response = await patch();
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private_database_marker'); expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('accepts correctly typed optional arrays and nulls', () => {
    expect(adminCompanyPatchSchema.safeParse({ expectedUpdatedAt: time, reason: 'Clear branding', logo: [], bannerImage: [], websiteUrl: null, colorScheme: null }).success).toBe(true);
  });
});
