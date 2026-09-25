import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), exact: vi.fn(), users: vi.fn(), conversations: vi.fn(), friends: vi.fn(), follows: vi.fn(), employees: vi.fn(), counts: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findFirst: m.exact, findMany: m.users }, conversation: { findMany: m.conversations }, friendship: { findMany: m.friends }, follow: { findMany: m.follows, groupBy: m.counts }, employee: { findMany: m.employees } } }));
import { POST } from '@/app/api/validate-user/route';
import { GET } from '@/app/api/users/suggestions/route';
const person = { id: 'person', name: 'Alex', email: 'hidden@example.test', emailDisplayMode: 'HIDE', image: null, bio: null };
const exact = (body: unknown = { input: 'Alex' }) => POST(new Request('http://localhost:3000/api/validate-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const suggestions = (query = '') => GET(new NextRequest('http://localhost:3000/api/users/suggestions?' + query));
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'viewer', role: 'USER' }); m.rate.mockResolvedValue({ success: true, resetIn: 30 });
  m.exact.mockResolvedValue(person); m.users.mockResolvedValue([person]); m.conversations.mockResolvedValue([]); m.friends.mockResolvedValue([]); m.follows.mockResolvedValue([]); m.employees.mockResolvedValue([]); m.counts.mockResolvedValue([]);
});
describe('private exact-person lookup and suggestions', () => {
  for (const [name, call] of [['exact', exact], ['suggestions', suggestions]] as const) {
    it(`${name} denies anonymous requests with private headers`, async () => {
      m.auth.mockResolvedValue(null); const r = await call(); expect(r.status).toBe(401); expect(r.headers.get('cache-control')).toBe('private, no-store'); expect(r.headers.get('vary')).toBe('Cookie'); expect(m.exact).not.toHaveBeenCalled(); expect(m.conversations).not.toHaveBeenCalled();
    });
    it(`${name} does not enumerate real accounts in demo`, async () => {
      m.auth.mockResolvedValue({id:'demo_fixture',role:'USER'}); const r = await call();
      expect(r.status).toBe(name === 'exact' ? 404 : 200); expect(m.exact).not.toHaveBeenCalled(); expect(m.conversations).not.toHaveBeenCalled(); expect(m.rate).not.toHaveBeenCalled();
    });
    it(`${name} throttles before database reads`, async () => {
      m.rate.mockResolvedValue({success:false,resetIn:27}); const r = await call(); expect(r.status).toBe(429); expect(r.headers.get('retry-after')).toBe('27'); expect(m.exact).not.toHaveBeenCalled(); expect(m.conversations).not.toHaveBeenCalled();
    });
    it(`${name} handles auth errors without disclosing details`, async () => {
      const spy=vi.spyOn(console,'error').mockImplementation(()=>{}); m.auth.mockRejectedValue(new Error('private-marker'));
      try {const r=await call(); expect(r.status).toBe(500); expect(r.headers.get('cache-control')).toContain('no-store'); expect(await r.text()).not.toContain('private-marker'); expect(JSON.stringify(spy.mock.calls)).not.toContain('private-marker');} finally {spy.mockRestore();}
    });
  }
  it.each([{input:''},{input:'x'.repeat(201)},{input:'Alex',role:'ADMIN'},{}])('rejects malformed exact lookup %j',async body=>{expect((await exact(body)).status).toBe(400);expect(m.exact).not.toHaveBeenCalled();});
  it('exact match applies email privacy in the query, not only serialization',async()=>{
    const r=await exact({input:'  hidden@example.test  '}); expect((await r.json()).user.email).toBeNull();
    expect(m.exact.mock.calls[0][0].where).toEqual({ AND: [{id:{not:{startsWith:'demo\\_'}}},{ OR: [{id:'hidden@example.test'},{name:'hidden@example.test'},{AND:[{email:'hidden@example.test'},{OR:[{emailDisplayMode:'PRIMARY'},{id:'viewer'}]}]}] }] });
    expect(m.exact.mock.calls[0][0].orderBy).toEqual({id:'asc'});
  });
  it.each(['PRIMARY',null,undefined])('exact email serialization fails closed for policy %s',async mode=>{m.exact.mockResolvedValue({...person,emailDisplayMode:mode});expect((await (await exact()).json()).user.email).toBe(mode==='PRIMARY'?person.email:null);});
  it.each(['ADMIN','OWNER'])('preserves privileged exact lookup for %s',async role=>{m.auth.mockResolvedValue({id:'viewer',role});expect((await (await exact()).json()).user.email).toBe(person.email);expect(m.exact.mock.calls[0][0].where.AND[1].OR[2]).toEqual({email:'Alex'});});
  it('uses the same not-found response for absent users and demo',async()=>{m.exact.mockResolvedValue(null);const missing=await exact();m.auth.mockResolvedValue({id:'demo_one'});const demo=await exact();expect(demo.status).toBe(missing.status);expect(await demo.json()).toEqual(await missing.json());});
  it.each(['limit=0','limit=-1','limit=31','limit=1.5','limit=bad'])('rejects invalid suggestion bounds %s',async query=>{expect((await suggestions(query)).status).toBe(400);expect(m.conversations).not.toHaveBeenCalled();});
  it('empty suggestions avoid aggregate queries',async()=>{expect(await (await suggestions()).json()).toEqual({suggestions:[]});expect(m.counts).not.toHaveBeenCalled();expect(m.follows).toHaveBeenCalledTimes(1);});
  it('deduplicates by priority, hides email and excludes self/demo participants',async()=>{
    m.conversations.mockResolvedValue([{userId:'viewer',participants:['person','viewer','demo_one']}]);
    m.friends.mockResolvedValue([{userAId:'viewer',userBId:'person'}]);
    m.follows.mockResolvedValueOnce([{following:person}]).mockResolvedValueOnce([{followingId:'person'}]);
    m.counts.mockResolvedValue([{followingId:'person',_count:{followingId:3}}]);
    const r=await suggestions('limit=5');expect(await r.json()).toEqual({suggestions:[{...person,email: null,emailDisplayMode:undefined,reason:'Recent chat',priority:1,followerCount:3,isFollowing:true}]});
    expect(m.users.mock.calls[0][0].where.id.in).toEqual(['person']);expect(m.conversations.mock.calls[0][0].take).toBeLessThanOrEqual(20);
    expect(m.employees.mock.calls[0][0].take).toBeLessThanOrEqual(30);expect(r.headers.get('cache-control')).toBe('private, no-store');
  });
});
