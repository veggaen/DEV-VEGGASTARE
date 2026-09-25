import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '@auth/core';
import { encode } from 'next-auth/jwt';
const m=vi.hoisted(()=>({end:vi.fn(),audit:vi.fn(),transaction:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/db',()=>({dbPrisma:{$transaction:m.transaction}}));
import { confirmedSignOutRoute, revokePreviewOnSignOut, PREVIEW_SIGNOUT_ERROR } from './preview-signout';
const token={sub:'qa-member',isImpersonating:true,impersonatingFromId:'qa-owner',tokenVersion:3,
  impersonationOwnerVersion:7,impersonationSessionId:'0ad8f0cc-ffb6-4171-8cd3-26c442ea9a78'};
beforeEach(()=>{vi.resetAllMocks();m.end.mockResolvedValue({count:1});m.audit.mockResolvedValue({id:'qa-audit'});
  m.transaction.mockImplementation(async run=>run({accountPreviewSession:{updateMany:m.end},adminAuditLog:{create:m.audit}}));});
describe('confirmed preview sign-out',()=>{
  it.each([{}, {sub:'qa-user'}, {...token,isImpersonating:false}, {...token,impersonationSessionId:undefined}, {...token,tokenVersion:'3'}])('leaves ordinary/invalid sessions and linked accounts untouched: %j',async claims=>{
    await revokePreviewOnSignOut(claims);expect(m.transaction).not.toHaveBeenCalled();
  });
  it('revokes only the signed grant and audits without returning owner access',async()=>{
    await revokePreviewOnSignOut(token);
    expect(m.end).toHaveBeenCalledWith({where:{id:token.impersonationSessionId,ownerId:'qa-owner',targetId:'qa-member',ownerVersion:7,targetVersion:3,endedAt:null},data:{endedAt:expect.any(Date)}});
    expect(m.audit.mock.calls[0][0].data).toMatchObject({action:'IMPERSONATE',newData:{phase:'signout',readOnly:true,previewSessionId:token.impersonationSessionId}});
  });
  it('treats an already-ended or missing grant idempotently without another audit',async()=>{
    m.end.mockResolvedValue({count:0});await revokePreviewOnSignOut(token);expect(m.audit).not.toHaveBeenCalled();
  });
  it.each(['end','audit'] as const)('suppresses successful cookie clearing when %s fails',async field=>{
    m[field].mockRejectedValue(new Error('private-database-error'));
    const result=await confirmedSignOutRoute(new Request('https://www.veggat.com/api/auth/signout',{method:'POST'}),async()=>{
      try{await revokePreviewOnSignOut(token);}catch{/* Auth.js catches event failures */}
      return Response.json({url:'/auth/login'},{headers:{'Set-Cookie':'authjs.session-token=; Max-Age=0'}});
    });
    expect(result.status).toBe(503);expect(result.headers.has('set-cookie')).toBe(false);expect(result.headers.get('cache-control')).toContain('no-store');
    expect(await result.json()).toEqual({error:PREVIEW_SIGNOUT_ERROR});
  });
  it('keeps request-scoped failures isolated during simultaneous sign-outs',async()=>{
    m.end.mockRejectedValue(new Error('private'));
    const request=()=>new Request('https://www.veggat.com/api/auth/signout',{method:'POST'});
    const results=await Promise.all([
      confirmedSignOutRoute(request(),async()=>{try{await revokePreviewOnSignOut(token);}catch{}return Response.json({url:'/auth/login'});}),
      confirmedSignOutRoute(request(),async()=>{await revokePreviewOnSignOut({sub:'ordinary-user'});return Response.json({url:'/auth/login'});}),
    ]);
    expect(results.map(result=>result.status)).toEqual([503,200]);
  });
  it('does not change unrelated auth responses',async()=>{
    const response=Response.json({csrfToken:'fixture'}),handler=vi.fn().mockResolvedValue(response);
    expect(await confirmedSignOutRoute(new Request('https://www.veggat.com/api/auth/csrf'),handler)).toBe(response);
  });
});

describe('real Auth.js CSRF and cookie parser',()=>{
  const origin='http://localhost:3000', secret='disposable-preview-signout-test-secret',name='authjs.session-token';
  const handle=(request:Request)=>Auth(request,{secret,trustHost:true,basePath:'/api/auth',providers:[],session:{strategy:'jwt'},
    events:{signOut:async message=>{if('token' in message&&message.token)await revokePreviewOnSignOut(message.token);}},logger:{error:()=>{}}});
  async function request(validCsrf=true){
    const csrf=await handle(new Request(`${origin}/api/auth/csrf`));const body=await csrf.json();
    const cookies=csrf.headers.getSetCookie().map(value=>value.split(';')[0]);
    cookies.push(`${name}=${await encode({token,secret,salt:name})}`);
    return new Request(`${origin}/api/auth/signout`,{method:'POST',headers:{cookie:cookies.join('; '),'Content-Type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'},body:new URLSearchParams({csrfToken:validCsrf?body.csrfToken:'invalid',callbackUrl:`${origin}/auth/login`})});
  }
  it('only revokes after a valid CSRF-protected logout and clears the cookie',async()=>{
    const response=await confirmedSignOutRoute(await request(),handle);expect(response.status).toBe(200);expect(m.end).toHaveBeenCalledOnce();
    expect(response.headers.getSetCookie().some(cookie=>cookie.startsWith(`${name}=`)&&cookie.includes('Max-Age=0'))).toBe(true);
  });
  it('cannot revoke through an invalid CSRF request',async()=>{
    await confirmedSignOutRoute(await request(false),handle);expect(m.end).not.toHaveBeenCalled();
  });
  it('overrides Auth.js swallowed failures without leaking details or clearing cookies',async()=>{
    m.audit.mockRejectedValue(new Error('private-audit-error'));
    const response=await confirmedSignOutRoute(await request(),handle);expect(response.status).toBe(503);expect(response.headers.has('set-cookie')).toBe(false);
    expect(await response.json()).toEqual({error:PREVIEW_SIGNOUT_ERROR});
  });
});
