/** Search privacy checked against real PostgreSQL in a disposable Preview-only schema. */
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
const state = vi.hoisted(() => ({ db: null as unknown, viewer: { id: 'viewer', role: 'USER' } }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: async () => state.viewer }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }) }));
import { GET } from '@/app/api/users/search/route';

describe.skipIf(process.env.TEST_USER_SEARCH_DATABASE !== '1')('people search database privacy', () => {
  const schema = 'qa_people_search_' + randomUUID().replaceAll('-', '');
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    if (process.env.VERCEL_ENV !== 'preview') throw new Error('Isolated Preview required');
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    if (!/^qa_people_search_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TYPE "EmailDisplayMode" AS ENUM ('PRIMARY','HIDE');
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "name" TEXT, "email" TEXT, "emailDisplayMode" "EmailDisplayMode", "role" TEXT NOT NULL DEFAULT 'USER', "image" TEXT, "bio" TEXT);
      CREATE TABLE "Follow" ("id" TEXT PRIMARY KEY, "followerId" TEXT, "followingId" TEXT);
      INSERT INTO "User" ("id","name","email","emailDisplayMode") VALUES
      ('viewer','Alex Viewer','own-hidden@example.test','HIDE'),
      ('hidden','Alex Hidden','secret-only@example.test','HIDE'),
      ('public','Alex Public','public-only@example.test','PRIMARY'),
      ('demo_fixture','Alex Demo','demo-only@example.test','PRIMARY'),
      ('demoxperson','Alex Real','real@example.test','HIDE'),
      ('literal','Design 50%_off','literal@example.test','HIDE');
      INSERT INTO "Follow" ("id","followerId","followingId") VALUES ('follow-one','viewer','public'),('follow-two','hidden','public');`);
    url.searchParams.set('options', '-c search_path=' + schema);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 4 }, { schema }) }); state.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  }, 30_000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_people_search_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      expect((await admin.query('SELECT 1 FROM information_schema.schemata WHERE schema_name=$1',[schema])).rowCount).toBe(0);
      await admin.end();
    }
  });
  beforeEach(() => {state.viewer = {id:'viewer',role:'USER'};});
  const search = async (q: string, extras = '') => {
    const response = await GET(new Request('http://localhost:3000/api/users/search?q=' + encodeURIComponent(q) + extras));
    expect(response.status).toBe(200); return response.json();
  };
  it('name search hides private emails/roles, excludes only exact demo prefix and self', async () => {
    const data = await search('alex'); expect(data.users.map((u: {id:string})=>u.id)).toEqual(['hidden','public','demoxperson']);
    expect(data.users[0]).toMatchObject({email:null,role:null});
    expect(data.users[1]).toMatchObject({email:'public-only@example.test',followerCount:2,isFollowing:true});
  });
  it('hidden email cannot be inferred by matching while shared email is searchable', async () => {
    expect((await search('secret-only')).users).toEqual([]);
    expect((await search('PUBLIC-ONLY')).users[0].id).toBe('public');
  });
  it('includes own hidden email only when requested', async () => {
    expect((await search('own-hidden')).users).toEqual([]);
    expect((await search('own-hidden','&excludeSelf=false')).users[0].email).toBe('own-hidden@example.test');
  });
  it('current privileged viewer retains email search without exposing demos', async () => {
    state.viewer.role='ADMIN'; expect((await search('secret-only')).users[0].email).toBe('secret-only@example.test');
    expect((await search('demo-only')).users).toEqual([]);
  });
  it('demo reader receives no directory rows', async () => {
    state.viewer.id='demo_fixture'; expect((await search('alex')).users).toEqual([]);
  });
  it('limits results deterministically', async () => {
    expect((await search('alex','&limit=1')).users.map((u:{id:string})=>u.id)).toEqual(['hidden']);
  });
  it('treats percent and underscore literally, not SQL wildcards', async () => {
    expect((await search('%%')).users).toEqual([]);
    expect((await search('50%_')).users.map((u:{id:string})=>u.id)).toEqual(['literal']);
  });
});
