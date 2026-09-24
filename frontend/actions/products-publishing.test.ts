/** @fileOverview Session/demo/rate boundaries around the publishing action. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),rate:vi.fn(),publish:vi.fn(),refresh:vi.fn()}));
vi.mock('@/auth',()=>({auth:m.auth}));
vi.mock('@/lib/db',()=>({dbPrisma:{}}));
vi.mock('@/lib/rate-limit',()=>({checkRateLimit:m.rate}));
vi.mock('next/cache',()=>({revalidatePath:m.refresh}));
vi.mock('@/lib/product-publishing',()=>({publishProduct:m.publish,ProductPublishingError:class extends Error {}}));
import { MyCreateProductAction, ensureOwnerCheckoutTestProductAction } from './products';
import { MyProductCreateSchema } from '@/schemas';
const input=()=>MyProductCreateSchema.parse({title:'QA',description:'QA',category:'QA',price:29,userId:'forged',quantity:1});
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({user:{id:'seller',role:'USER'}});m.rate.mockResolvedValue({success:true});m.publish.mockResolvedValue({id:'new-product'});vi.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>vi.restoreAllMocks());
it.each([null,{user:{id:'demo_qa'}},{user:{id:'seller',isDemo:true}}])('blocks anonymous/demo %j at the action itself',async session=>{
  m.auth.mockResolvedValue(session);expect(await MyCreateProductAction(input(),[])).toHaveProperty('error');expect(m.publish).not.toHaveBeenCalled();
});
it('checks the rate limit before publication',async()=>{m.rate.mockResolvedValue({success:false});expect(await MyCreateProductAction(input(),[])).toHaveProperty('error');expect(m.publish).not.toHaveBeenCalled();});
it('passes the authenticated identity separately from untrusted form data',async()=>{
  expect(await MyCreateProductAction(input(),[])).toHaveProperty('productId','new-product');expect(m.publish.mock.calls[0][0]).toBe('seller');
});
it('does not expose raw database failures or supplied form payloads',async()=>{
  m.publish.mockRejectedValue(new Error('sensitive database URL'));const response=await MyCreateProductAction(input(),[]);
  expect(JSON.stringify(response)).not.toContain('sensitive');expect(console.error).toHaveBeenCalledExactlyOnceWith('[products] Publication failed');
});
it('returns committed success if post-commit cache refresh fails',async()=>{
  m.refresh.mockImplementation(()=>{throw new Error('cache unavailable');});expect(await MyCreateProductAction(input(),[])).toHaveProperty('productId','new-product');
});
it('retired owner seeding is a non-mutating link to the existing reviewer SKU',async()=>{
  expect(await ensureOwnerCheckoutTestProductAction()).toHaveProperty('error');m.auth.mockResolvedValue({user:{id:'owner',role:'OWNER'}});
  expect(await ensureOwnerCheckoutTestProductAction()).toMatchObject({productId:'cveggatinterviewpack000001',created:false});expect(m.publish).not.toHaveBeenCalled();
});
