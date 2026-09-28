import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auditDataForDisplay } from './audit-log-policy';
const m = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), list: vi.fn(), detail: vi.fn(), count: vi.fn(), admins: vi.fn(), admin: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate }));
vi.mock('@/lib/db', () => ({ dbPrisma: {
  adminAuditLog: { findMany: m.list, findUnique: m.detail, count: m.count },
  user: { findMany: m.admins, findUnique: m.admin }, $transaction: m.transaction,
} }));
import { GET } from '@/app/api/admin/audit-log/route';
const get = (query = '') => GET(new Request('http://localhost:3000/api/admin/audit-log?' + query));
const row = { id: 'qa-entry', adminId: 'qa-owner', action: 'VIEW', targetType: 'USER', targetId: 'qa-member', reason: null, createdAt: new Date('2026-01-01') };
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'qa-owner', role: 'OWNER' });
  m.rate.mockResolvedValue({ success: true, resetIn: 12 });
  m.list.mockResolvedValue([row]); m.count.mockResolvedValue(21); m.admins.mockResolvedValue([]); m.admin.mockResolvedValue(null);
  m.detail.mockResolvedValue({ ...row, previousData: null, newData: { name: 'Changed', password: 'private-marker' }, ipAddress: null, userAgent: null });
  m.transaction.mockImplementation((queries: Promise<unknown>[]) => Promise.all(queries));
});
describe('owner audit read boundary', () => {
  it.each([null, {id:'member',role:'USER'}, {id:'admin',role:'ADMIN'}, {id:'demo_owner',role:'OWNER'}, {id:'fixture',role:'OWNER',isDemo:true}, {id:'preview',role:'OWNER',isImpersonating:true}])('denies %j before reads', async actor => {
    m.auth.mockResolvedValue(actor);
    for (const query of ['', 'entry=qa-entry']) {
      const response = await get(query); expect(response.status).toBe(actor ? 403 : 401);
      expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie');
    }
    expect(m.list).not.toHaveBeenCalled(); expect(m.detail).not.toHaveBeenCalled(); expect(m.rate).not.toHaveBeenCalled();
  });
  it.each(['page=0','page=-1','page=1.5','page=1001','page=x','page=1&page=2','limit=0','limit=-5','limit=101','limit=abc','action=ADMIN','targetType=PASSWORD','entry=','entry=../../secret','entry=x&page=1','unknown=x','adminId='+ 'a'.repeat(129),'startDate=not-date','startDate=2026-02-30T00:00:00Z','startDate=2026-09-25T00:00:00Z&endDate=2026-09-24T00:00:00Z'])('rejects malformed filters %s', async query => {
    expect((await get(query)).status).toBe(400); expect(m.list).not.toHaveBeenCalled(); expect(m.detail).not.toHaveBeenCalled();
  });
  it('projects compact rows, deterministic tie-breaking and a consistent page count', async () => {
    const response = await get('page=2&limit=10&action=IMPERSONATE&targetType=USER&adminId=qa-owner&targetId=qa-member&startDate=2026-01-01T00:00:00Z');
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    const query = m.list.mock.calls[0][0]; expect(query).toMatchObject({ skip: 10, take: 10, orderBy: [{createdAt:'desc'},{id:'desc'}], where: {action:'IMPERSONATE',targetType:'USER',adminId:'qa-owner',targetId:'qa-member'} });
    expect(query.select).not.toHaveProperty('previousData'); expect(query.select).not.toHaveProperty('userAgent'); expect(query.select).not.toHaveProperty('ipAddress');
    expect(m.transaction.mock.calls[0][1]).toEqual({isolationLevel:'RepeatableRead'});
    expect(await response.json()).toMatchObject({logs:[{admin:{id:'qa-owner',name:null}}],pagination:{page:2,limit:10,total:21,totalPages:3}});
    expect(m.rate).toHaveBeenCalledWith('admin-audit:qa-owner','read');
    expect(m.admins.mock.calls[0][0].select).toEqual({id:true,name:true,email:true,image:true});
  });
  it('defaults to twenty rows and omits the administrator lookup for an empty page', async () => {
    m.list.mockResolvedValue([]); await get(); expect(m.list.mock.calls[0][0].take).toBe(20); expect(m.admins).not.toHaveBeenCalled();
  });
  it('fetches only a selected detail and redacts sensitive structured values', async () => {
    const response = await get('entry=qa-entry'); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({entry:{newData:{name:'Changed',password:'[redacted]'}}});
    expect(m.list).not.toHaveBeenCalled(); expect(m.count).not.toHaveBeenCalled(); expect(m.detail.mock.calls[0][0].where).toEqual({id:'qa-entry'});
  });
  it('returns a private 404 for an unavailable entry', async () => {
    m.detail.mockResolvedValue(null); const response=await get('entry=missing'); expect(response.status).toBe(404); expect(response.headers.get('cache-control')).toContain('no-store'); expect(m.admin).not.toHaveBeenCalled();
  });
  it('throttles before either query', async () => {
    m.rate.mockResolvedValue({success:false,resetIn:17}); const response=await get(); expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('17'); expect(m.list).not.toHaveBeenCalled();
  });
  it.each(['auth','rate','list','detail','admins','admin'] as const)('sanitizes %s failures', async source => {
    m[source].mockRejectedValue(new Error('private-marker')); const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
    try { const response=await get(source==='detail'||source==='admin'?'entry=qa-entry':''); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private-marker'); expect(JSON.stringify(spy.mock.calls)).not.toContain('private-marker'); } finally {spy.mockRestore();}
  });
});
describe('audit JSON display projection', () => {
  it('redacts nested secrets without mutating originals or hiding credential version evidence', () => {
    const original={tokenVersion:3, nested:[{AUTH_SECRET:'hidden',access_token:'hidden',cookie:'hidden',name:'Visible'}]};
    expect(auditDataForDisplay(original)).toEqual({tokenVersion:3,nested:[{AUTH_SECRET:'[redacted]',access_token:'[redacted]',cookie:'[redacted]',name:'Visible'}]});
    expect(original.nested[0].AUTH_SECRET).toBe('hidden');
  });
  it('bounds breadth, depth and long text', () => {
    expect(JSON.stringify(auditDataForDisplay({content:'x'.repeat(30_000)})).length).toBeLessThan(2100);
    expect((auditDataForDisplay(Array(100).fill('x')) as unknown[]).length).toBe(31);
    expect(JSON.stringify(auditDataForDisplay({a:{b:{c:{d:{e:{f:{g:{h:'hidden'}}}}}}}}))).toContain('[truncated]');
    expect(JSON.stringify(auditDataForDisplay(Array.from({length:30},()=>Array.from({length:30},()=>Array(30).fill(1))))).length).toBeLessThan(20000);
  });
});
