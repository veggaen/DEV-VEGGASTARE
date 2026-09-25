import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), users: vi.fn(), counts: vi.fn(), following: vi.fn(), rate: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.auth }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.rate }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findMany: mocks.users }, follow: { groupBy: mocks.counts, findMany: mocks.following } } }));
import { GET } from '@/app/api/users/search/route';

const row = { id: 'person', name: 'Alex', email: 'private@example.test', emailDisplayMode: 'HIDE', image: null, role: 'ADMIN', bio: null };
const call = (query = 'q=Alex') => GET(new Request('http://localhost:3000/api/users/search?' + query));
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: 'viewer', role: 'USER' });
  mocks.rate.mockResolvedValue({ success: true, resetIn: 60 }); mocks.users.mockResolvedValue([row]);
  mocks.counts.mockResolvedValue([{ followingId: 'person', _count: { followingId: 2 } }]);
  mocks.following.mockResolvedValue([{ followingId: 'person' }]);
});

describe('bounded private people search', () => {
  it('denies anonymous readers before database or rate work', async () => {
    mocks.auth.mockResolvedValue(undefined); const response = await call();
    expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.users).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
  });
  it('keeps demo search empty without enumerating real people', async () => {
    mocks.auth.mockResolvedValue({ id: 'demo_fixture', role: 'USER' }); const response = await call();
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ users: [], count: 0 });
    expect(mocks.users).not.toHaveBeenCalled();
  });
  it.each(['q=', 'q=A', 'q=%20%20', ''])('short searches do not read the directory: %s', async query => {
    expect(await (await call(query)).json()).toMatchObject({ users: [], count: 0 }); expect(mocks.users).not.toHaveBeenCalled();
  });
  it.each(['q=Alex&limit=21','q=Alex&limit=-1','q=Alex&limit=2.5','q=Alex&excludeSelf=maybe','q='+'a'.repeat(101)])('rejects invalid bounds: %s', async query => {
    const response = await call(query); expect(response.status).toBe(400); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.users).not.toHaveBeenCalled();
  });
  it('throttles by account and returns retry timing without reading data', async () => {
    mocks.rate.mockResolvedValue({ success: false, resetIn: 37 }); const response = await call();
    expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('37');
    expect(mocks.rate).toHaveBeenCalledWith('people-search:viewer','read'); expect(mocks.users).not.toHaveBeenCalled();
  });
  it('redacts hidden email and platform role while preserving public search/follow data', async () => {
    const response = await call('q=%20Alex%20&limit=8'); const body = await response.json();
    expect(body.users).toEqual([{id:'person',name:'Alex',email:null,image:'/users/avatar.webp',role:null,bio:null,followerCount:2,isFollowing:true}]);
    expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie');
    const query = mocks.users.mock.calls[0][0]; expect(query.take).toBe(8); expect(query.orderBy).toEqual([{name:'asc'},{id:'asc'}]);
    expect(query.where).toMatchObject({ AND: [{id:{not:{startsWith:'demo\\_'}}}, {id:{not:'viewer'}}, {OR:[{name:{contains:'Alex',mode:'insensitive'}}, {AND:[{email:{contains:'Alex',mode:'insensitive'}},{OR:[{emailDisplayMode:'PRIMARY'},{id:'viewer'}]}]}]}] });
    expect(query.select.password).toBeUndefined();
  });
  it('allows explicit public email and own email, never a missing visibility policy', async () => {
    mocks.users.mockResolvedValue([{...row,id:'shared',emailDisplayMode:'PRIMARY'}, {...row,id:'viewer'}, {...row,id:'unknown',emailDisplayMode:null}]);
    const body = await (await call('q=Alex&excludeSelf=false')).json();
    expect(body.users.map((u: {email:string|null})=>u.email)).toEqual([row.email,row.email,null]);
    expect(mocks.users.mock.calls[0][0].where.AND).toHaveLength(2);
  });
  it.each(['ADMIN','OWNER'])('retains private-directory visibility for current %s from auth', async role => {
    mocks.auth.mockResolvedValue({id:'viewer',role}); const body = await (await call()).json();
    expect(body.users[0]).toMatchObject({email:row.email,role:'ADMIN'});
    expect(mocks.users.mock.calls[0][0].where.AND[2].OR[1]).toEqual({email:{contains:'Alex',mode:'insensitive'}});
  });
  it('does not perform follow queries for an empty result', async () => {
    mocks.users.mockResolvedValue([]); expect(await (await call()).json()).toEqual({users:[],count:0});
    expect(mocks.counts).not.toHaveBeenCalled(); expect(mocks.following).not.toHaveBeenCalled();
  });
  it.each(['auth','users','counts','following','rate'] as const)('does not disclose/log provider details on %s failure', async method => {
    mocks[method].mockRejectedValue(new Error('private-secret-marker')); const spy = vi.spyOn(console,'error').mockImplementation(()=>{});
    try { const response = await call(); expect(response.status).toBe(500); expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.text()).not.toContain('private-secret-marker'); expect(JSON.stringify(spy.mock.calls)).not.toContain('private-secret-marker');
    } finally {spy.mockRestore();}
  });
});
