/** @fileOverview Baseline an empty schema-only Preview clone after a read-only source comparison. @stability experimental */
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { parse } from 'dotenv';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const expectedHost = arg('expected-host');
if (!expectedHost || !arg('source-env') || !arg('preview-env')) throw new Error('Supply --source-env, --preview-env and the verified --expected-host. Add --apply only after a passing dry run.');
const sourceUrl = new URL(parse(readFileSync(arg('source-env'))).DATABASE_URL_MAINLIVE);
const targetUrl = new URL(parse(readFileSync(arg('preview-env'))).DATABASE_URL_MAINPREVIEW);
const endpoint = url => url.hostname.replace('-pooler.', '.');
if (targetUrl.hostname !== expectedHost || !targetUrl.hostname.endsWith('.neon.tech') || endpoint(sourceUrl) === endpoint(targetUrl)) throw new Error('Preview must be the explicitly verified, separate Neon endpoint.');
for (const url of [sourceUrl, targetUrl]) {
  if (url.searchParams.get('sslmode') !== 'require') throw new Error('SSL is required.');
  url.hostname = endpoint(url);
  url.searchParams.set('uselibpqcompat', 'true');
}
const source = new Client({ connectionString: sourceUrl.toString(), connectionTimeoutMillis: 10_000 });
const target = new Client({ connectionString: targetUrl.toString(), connectionTimeoutMillis: 10_000 });
const quote = value => `"${value.replaceAll('"', '""')}"`;
const schemaQueries = [
  // pg_dump collapses dropped-column ordinal gaps; named Prisma fields are order-independent.
  `SELECT table_name,column_name,column_default,is_nullable,data_type,udt_name,character_maximum_length,numeric_precision,numeric_scale,datetime_precision,is_identity,identity_generation,is_generated,generation_expression FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name`,
  `SELECT c.relname,t.contype,t.conname,pg_get_constraintdef(t.oid,true) AS definition FROM pg_constraint t JOIN pg_class c ON c.oid=t.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,t.conname`,
  `SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`,
  `SELECT t.typname,e.enumsortorder,e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
  `SELECT table_name,view_definition FROM information_schema.views WHERE table_schema='public' ORDER BY table_name`,
  `SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY p.proname,args`,
  `SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid,true) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
  `SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`,
];
try {
  await source.connect(); await target.connect();
  // The source is never mutated, even when --apply is provided.
  await source.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await target.query('BEGIN');
  await target.query('SET LOCAL statement_timeout = 30000');
  await target.query('LOCK TABLE public._prisma_migrations IN ACCESS EXCLUSIVE MODE');
  const tables = (await target.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows;
  for (const { tablename } of tables) {
    if (tablename === '_prisma_migrations') continue;
    const { rows } = await target.query(`SELECT EXISTS(SELECT 1 FROM public.${quote(tablename)} LIMIT 1) AS populated`);
    if (rows[0].populated) throw new Error(`Refusing baseline: nonempty application table ${tablename}.`);
  }
  for (const [index, sql] of schemaQueries.entries()) {
    const sourceRows = (await source.query(sql)).rows;
    const targetRows = (await target.query(sql)).rows;
    if (JSON.stringify(sourceRows) !== JSON.stringify(targetRows)) {
      if (index === 0) {
        const mismatches = sourceRows.flatMap(row => {
          const other = targetRows.find(candidate => candidate.table_name === row.table_name && candidate.column_name === row.column_name);
          const fields = other ? Object.keys(row).filter(key => JSON.stringify(row[key]) !== JSON.stringify(other[key])) : ['missing column'];
          return fields.length ? [{ table: row.table_name, column: row.column_name, fields }] : [];
        });
        console.error('Column differences (names only):', JSON.stringify(mismatches.slice(0, 10)));
      }
      throw new Error(`Source/Preview schema differs in catalog group ${index + 1}; no history is written.`);
    }
  }
  const history = (await source.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name')).rows;
  if (!history.length || history.some(row => !row.finished_at || row.rolled_back_at)) throw new Error('Source migration history is empty or unresolved; manual review required.');
  for (const row of history) {
    if (!/^[A-Za-z0-9_-]+$/.test(row.migration_name)) throw new Error('Unexpected migration name.');
    const sql = readFileSync(new URL(`../prisma/migrations/${row.migration_name}/migration.sql`, import.meta.url));
    const lf = sql.toString('utf8').replaceAll('\r\n', '\n');
    const checksums = [sql, lf, lf.replaceAll('\n', '\r\n')].map(bytes => createHash('sha256').update(bytes).digest('hex'));
    if (!checksums.includes(row.checksum)) throw new Error(`Local/source migration checksum differs beyond line endings: ${row.migration_name}`);
  }
  const existing = (await target.query('SELECT migration_name,checksum FROM public._prisma_migrations ORDER BY migration_name')).rows;
  if (existing.length) {
    if (JSON.stringify(existing) !== JSON.stringify(history.map(({ migration_name, checksum }) => ({ migration_name, checksum })))) throw new Error('Preview has different migration history; refusing overwrite.');
    console.log('Preview already has the matching baseline; no changes made.');
  } else if (process.argv.includes('--apply')) {
    for (const row of history) await target.query('INSERT INTO public._prisma_migrations (id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES ($1,$2,$3,now(),now(),1)', [randomUUID(), row.checksum, row.migration_name]);
    console.log(`Baselined ${history.length} verified migrations. No application rows or source data copied.`);
  } else {
    console.log(`Dry run passed: ${tables.length - 1} empty application tables; schema matches read-only source; ${history.length} migration checksums verified.`);
  }
  await target.query(process.argv.includes('--apply') ? 'COMMIT' : 'ROLLBACK');
  await source.query('ROLLBACK');
} catch (error) {
  await target.query('ROLLBACK').catch(() => {});
  await source.query('ROLLBACK').catch(() => {});
  // Database errors may contain parameter values. Only expose safe operational errors.
  console.error(error.code ? `Database setup stopped (${error.code}). No application data copied.` : error.message);
  process.exitCode = 1;
} finally {
  await source.end(); await target.end();
}
