import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), fetch: vi.fn(), rate: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { aiMediaJob: { findFirst: m.find } } }));
vi.mock('@/lib/ai-credit-ledger', () => ({ aiCreditEnvironment: () => 'SANDBOX' }));
vi.mock('@/lib/private-download-storage', () => ({ fetchPrivateDownload: m.fetch }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate }));
import { GET } from '@/app/api/ai-media/[id]/content/route';
const id='36c12b80-5705-454e-a5df-199d8dd1fc38';
const params={params:Promise.resolve({id})};
const request=new Request(`http://localhost:3000/api/ai-media/${id}/content?download=1`);
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({id:'owner'});m.rate.mockResolvedValue({success:true});});
it('requires sign-in without looking up the file',async()=>{
  m.auth.mockResolvedValue(null);expect((await GET(request,params)).status).toBe(401);expect(m.find).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();
});
it('requires ownership, environment and completed reservation before accessing storage',async()=>{
  m.find.mockResolvedValue(null);expect((await GET(request,params)).status).toBe(404);
  expect(m.find).toHaveBeenCalledWith({where:{id,userId:'owner',environment:'SANDBOX',state:'COMPLETED',Reservation:{state:'COMPLETED'}}});
  expect(m.fetch).not.toHaveBeenCalled();
});
it('streams only a private owner file with safe attachment headers',async()=>{
  m.find.mockResolvedValue({kind:'IMAGE',storageKey:'private-key',mimeType:'image/png',byteSize:3});
  m.fetch.mockResolvedValue(new Response(new Uint8Array([1,2,3])));
  const response=await GET(request,params);
  expect(m.fetch).toHaveBeenCalledWith('private-key','owner');expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('content-disposition')).toBe(`attachment; filename="veggat-${id}.png"`);
  expect((await response.arrayBuffer()).byteLength).toBe(3);
});
it('does not bypass storage rejection',async()=>{
  m.find.mockResolvedValue({kind:'VIDEO',storageKey:'private-key',mimeType:'video/mp4',byteSize:3});
  m.fetch.mockResolvedValue(new Response(null,{status:403}));expect((await GET(request,params)).status).toBe(503);
});
it('limits repeated downloads before opening storage',async()=>{
  m.rate.mockResolvedValue({success:false,resetIn:30});const response=await GET(request,params);
  expect(response.status).toBe(429);expect(response.headers.get('retry-after')).toBe('30');expect(m.fetch).not.toHaveBeenCalled();
});
