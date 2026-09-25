import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from './lib/auth-cookies';
const m = vi.hoisted(() => ({ token: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken:m.token }));
vi.mock('@/lib/site-config', () => ({ ACCESS_GATE_CONFIG:{ enabled:true, password:'unit-only-gate', cookieName:'gate', bypassRoutes:[] } }));
vi.mock('@/lib/access-gate-cookie', () => ({ makeGateCookieValue: () => 'unit-cookie' }));
import proxy, { config } from './proxy';
import { allowsImpersonationRequest } from './lib/impersonation-policy';
beforeEach(() => { m.token.mockReset(); m.token.mockResolvedValue({sub:'qa-member',isImpersonating:true}); });
const req = (path:string, method='POST', extra:Record<string,string>={}) => new NextRequest('http://localhost:3000'+path,{method,headers:{cookie:`${SESSION_COOKIE_NAME}=signed-fixture; gate=unit-cookie`,...extra}});
describe('read-only account preview perimeter', () => {
  it.each(['/api/checkout','/api/ai-chat','/api/ai-media','/api/messages','/api/wallets','/api/users/qa-member','/api/edgestore/upload','/api/pusher','/settings','/api/admin/impersonate'])('blocks writes at %s', async path => {
    for(const method of ['POST','PATCH','DELETE','PUT']) {const response=await proxy(req(path,method)); expect(response.status).toBe(403);expect(response.headers.get('cache-control')).toContain('no-store');expect(await response.json()).toHaveProperty('error','IMPERSONATION_READ_ONLY');}
  });
  it.each(['/api/auth/signin/google','/api/auth/callback/github','/api/auth/phone/send','/api/auth/unlink-oauth'])('blocks identity linking even through GET %s', async path => {
    for(const method of ['GET','POST']) expect((await proxy(req(path,method))).status).toBe(403);
  });
  it('blocks Server Actions including dot-suffixed routes', async () => {
    expect((await proxy(req('/products/asset.jpg','POST',{'next-action':'fixture'}))).status).toBe(403);
    expect(config.matcher).toContainEqual({source:'/:path*',has:[{type:'header',key:'next-action'}]});
    expect(allowsImpersonationRequest('/api/admin/impersonate/end','POST',true)).toBe(false);
  });
  it.each(['/api/download/token','/api/payments/paypal/capture','/api/trades/id',
    '/api/users/privacy-settings','/api/users/ai-keys','/api/notifications/settings',
    '/api/system/account','/api/companies/verify-org','/auth/security-action','/api/ai-media/id/content'])('blocks side-effectful or private-delivery GET %s',async path=>{
    expect((await proxy(req(path,'GET'))).status).toBe(403);
  });
  it.each(['/','/products','/my-orders','/api/auth/session','/api/auth/csrf'])('keeps safe reads at %s', async path => {
    expect((await proxy(req(path,'GET'))).status).toBe(200);
  });
  it('lets the hardened restore endpoint run without an admin gate cookie', async () => {
    const response=await proxy(req('/api/admin/impersonate/end','POST',{cookie:`${SESSION_COOKIE_NAME}=signed-fixture`})); expect(response.status).toBe(200);
  });
  it('keeps logout available',async()=>{expect((await proxy(req('/api/auth/signout'))).status).toBe(200);});
  it('does not treat plain metadata as an impersonation or owner grant',async()=>{
    m.token.mockResolvedValue(null);await proxy(req('/api/checkout','POST',{cookie:'x-impersonate-owner-id=qa-owner'}));expect(m.token).not.toHaveBeenCalled();
  });
  it('does not change ordinary sessions or weaken the admin gate',async()=>{
    m.token.mockResolvedValue({sub:'qa-member'});expect((await proxy(req('/api/checkout'))).status).toBe(200);
    expect((await proxy(req('/api/admin/impersonate','POST',{cookie:`${SESSION_COOKIE_NAME}=signed-fixture`}))).status).toBe(401);
  });
});
