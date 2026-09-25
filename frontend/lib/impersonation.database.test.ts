import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { decode } from 'next-auth/jwt';
import { previewDatabaseUrl } from './preview-database';
import { SESSION_COOKIE_NAME } from './auth-cookies';
import { validImpersonation, validPreviewSession } from './impersonation-policy';
const state = vi.hoisted(() => ({ db: null as unknown, actor: {} as Record<string, unknown>, pause: null as null | (() => Promise<void>) }));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/db',()=>({ get dbPrisma(){ return state.db; } }));
vi.mock('@/lib/user-auth',()=>({MyLibUserAuth:async()=>state.actor}));
vi.mock('@/lib/auth-rate-limit',()=>({allowAuthAttempt:async()=>true}));
vi.mock('next-auth/jwt',async original=>{
  const actual=await original<typeof import('next-auth/jwt')>();
  return {...actual, encode:async(...args:Parameters<typeof actual.encode>)=>{await state.pause?.();return actual.encode(...args);}};
});
import { switchAccount } from './impersonation';
describe.skipIf(process.env.TEST_IMPERSONATION_DATABASE!=='1')('isolated audited account preview',()=>{
  const schema=`qa_preview_${randomUUID().replaceAll('-','')}`, secret='isolated-preview-test-key-only';
  let admin:Client, db:PrismaClient;
  const select={id:true,role:true,tokenVersion:true,updatedAt:true} as const;
  beforeAll(async()=>{
    vi.stubEnv('AUTH_SECRET',secret);state.actor={id:'qa-owner',role:'OWNER',sessionVersion:3};
    const url=new URL(previewDatabaseUrl({DATABASE_URL_MAINPREVIEW:process.env.DATABASE_URL_MAINPREVIEW,DATABASE_URL_MAINLIVE:process.env.DATABASE_URL_MAINLIVE}));
    url.hostname=url.hostname.replace('-pooler.','.');url.searchParams.set('sslmode','verify-full');
    admin=new Client({connectionString:url.toString()});await admin.connect();
    if(!/^qa_preview_[a-f0-9]{32}$/.test(schema))throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`);await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TABLE "User" ("id" TEXT PRIMARY KEY,"role" TEXT,"tokenVersion" INTEGER,"name" TEXT,"updatedAt" TIMESTAMP(3) DEFAULT now());
      CREATE TYPE "AdminAction" AS ENUM ('IMPERSONATE'); CREATE TYPE "AdminTargetType" AS ENUM ('USER');
      CREATE TABLE "AdminAuditLog" ("id" TEXT PRIMARY KEY,"adminId" TEXT,"action" "AdminAction","targetType" "AdminTargetType","targetId" TEXT,
        "previousData" JSONB,"newData" JSONB,"ipAddress" TEXT,"userAgent" TEXT,"reason" TEXT,"createdAt" TIMESTAMP(3) DEFAULT now(),"updatedAt" TIMESTAMP(3) DEFAULT now());
      INSERT INTO "User" ("id","role","tokenVersion","name") VALUES ('qa-owner','OWNER',3,'QA Owner'),('qa-target','USER',7,'QA Member');`);
    await admin.query(readFileSync(new URL('../prisma/migrations/20260925160000_account_preview_revocation/migration.sql',import.meta.url),'utf8'));
    url.searchParams.set('options',`-c search_path=${schema}`);db=new PrismaClient({adapter:new PrismaPg({connectionString:url.toString(),max:5},{schema})});state.db=db;
    expect((await db.$queryRaw<{current_schema:string}[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  },30000);
  afterAll(async()=>{state.pause=null;await db?.$disconnect();if(admin&&/^qa_preview_[a-f0-9]{32}$/.test(schema)){await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();}vi.unstubAllEnvs();});
  const request=async()=>new Request('http://localhost:3000/api/admin/impersonate',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({targetUserId:'qa-target',expectedUpdatedAt:(await db.user.findUniqueOrThrow({where:{id:'qa-target'},select})).updatedAt.toISOString(),reason:'Disposable support test'})});
  const claims=async(response:Response)=>{
    const cookie=response.headers.getSetCookie().find(value=>value.startsWith(`${SESSION_COOKIE_NAME}=`));expect(cookie).toBeTruthy();
    return decode({token:cookie!.split(';')[0].slice(SESSION_COOKIE_NAME.length+1),secret,salt:SESSION_COOKIE_NAME});
  };
  it('issues and restores encrypted claims with start/end audits and no member change',async()=>{
    const before=await db.user.findMany({select});const response=await switchAccount(await request());expect(response.status).toBe(200);
    const token=(await claims(response))!;expect(validImpersonation(token,before.find(u=>u.id==='qa-owner')!,before.find(u=>u.id==='qa-target')!)).toBe(true);
    const previewId=token.impersonationSessionId as string;
    expect(validPreviewSession(token,await db.accountPreviewSession.findUnique({where:{id:previewId}}))).toBe(true);
    state.actor={...token,id:token.sub,sessionVersion:token.tokenVersion,role:'USER'};
    const restored=await switchAccount(await request(),true);expect(restored.status).toBe(200);expect(await claims(restored)).toMatchObject({sub:'qa-owner',tokenVersion:3,isImpersonating:false});
    expect(await db.adminAuditLog.count()).toBe(2);expect(await db.user.findMany({select})).toEqual(before);
    expect(validPreviewSession(token,await db.accountPreviewSession.findUnique({where:{id:previewId}}))).toBe(false);
    const replay=await switchAccount(await request(),true);expect(replay.status).toBe(401);expect(replay.headers.has('set-cookie')).toBe(false);expect(await db.adminAuditLog.count()).toBe(2);
    state.actor={id:'qa-owner',role:'OWNER',sessionVersion:3};
  },30000);
  it('does not issue a cookie when the audit transaction fails',async()=>{
    const grantsBefore=await db.accountPreviewSession.count();
    await admin.query('ALTER TABLE "AdminAuditLog" RENAME TO "AuditUnavailable"');
    try{const response=await switchAccount(await request());expect(response.status).toBe(503);expect(response.headers.has('set-cookie')).toBe(false);}finally{await admin.query('ALTER TABLE "AuditUnavailable" RENAME TO "AdminAuditLog"');}
    expect(await db.adminAuditLog.count()).toBe(2);
    expect(await db.accountPreviewSession.count()).toBe(grantsBefore);
  },30000);
  it('rolls back revocation on audit failure and permits a safe retry',async()=>{
    const token=(await claims(await switchAccount(await request())))!; const id=token.impersonationSessionId as string;
    state.actor={...token,id:token.sub,sessionVersion:token.tokenVersion,role:'USER'};
    await admin.query('ALTER TABLE "AdminAuditLog" RENAME TO "AuditUnavailable"');
    try { const failed=await switchAccount(await request(),true);expect(failed.status).toBe(503);expect(failed.headers.has('set-cookie')).toBe(false); }
    finally { await admin.query('ALTER TABLE "AuditUnavailable" RENAME TO "AdminAuditLog"'); }
    expect(validPreviewSession(token,await db.accountPreviewSession.findUnique({where:{id}}))).toBe(true);
    expect((await switchAccount(await request(),true)).status).toBe(200);
    expect(validPreviewSession(token,await db.accountPreviewSession.findUnique({where:{id}}))).toBe(false);
    state.actor={id:'qa-owner',role:'OWNER',sessionVersion:3};
  },30000);
  it('only one simultaneous End can restore the owner or create an end audit',async()=>{
    const token=(await claims(await switchAccount(await request())))!; const id=token.impersonationSessionId as string;
    state.actor={...token,id:token.sub,sessionVersion:token.tokenVersion,role:'USER'};
    const requests=await Promise.all([request(),request()]);
    const responses=await Promise.all(requests.map(value=>switchAccount(value,true)));
    expect(responses.map(value=>value.status).sort()).toEqual([200,401]);
    expect(responses.filter(value=>value.headers.has('set-cookie'))).toHaveLength(1);
    expect(await db.adminAuditLog.count({where:{newData:{path:['previewSessionId'],equals:id}}})).toBe(2);
    expect(validPreviewSession(token,await db.accountPreviewSession.findUnique({where:{id}}))).toBe(false);
    state.actor={id:'qa-owner',role:'OWNER',sessionVersion:3};
  },30000);
  it('ending one preview does not end another separately-issued preview',async()=>{
    const first=(await claims(await switchAccount(await request())))!,second=(await claims(await switchAccount(await request())))!;
    state.actor={...first,id:first.sub,sessionVersion:first.tokenVersion,role:'USER'};
    expect((await switchAccount(await request(),true)).status).toBe(200);
    expect(validPreviewSession(first,await db.accountPreviewSession.findUnique({where:{id:first.impersonationSessionId as string}}))).toBe(false);
    expect(validPreviewSession(second,await db.accountPreviewSession.findUnique({where:{id:second.impersonationSessionId as string}}))).toBe(true);
    state.actor={id:'qa-owner',role:'OWNER',sessionVersion:3};
  },30000);
  it('serializes owner revocation against issuance and the resulting old-version token is invalid',async()=>{
    let release!:()=>void, entered!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;});const pause=new Promise<void>(resolve=>{release=resolve;});
    state.pause=async()=>{entered();await pause;};const pending=switchAccount(await request());await ready;
    let revoked=false;const revocation=db.user.update({where:{id:'qa-owner'},data:{tokenVersion:{increment:1}},select}).then(value=>{revoked=true;return value;});
    try{await new Promise(resolve=>setTimeout(resolve,100));expect(revoked).toBe(false);}finally{release();state.pause=null;}
    const response=await pending;expect(response.status).toBe(200);const owner=await revocation;
    expect(validImpersonation((await claims(response))!,owner,await db.user.findUniqueOrThrow({where:{id:'qa-target'},select}))).toBe(false);
    expect((await switchAccount(await request())).status).toBe(401);
  },30000);
});
