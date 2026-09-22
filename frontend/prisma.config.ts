import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const vercelEnv = process.env.VERCEL_ENV // 'production' | 'preview' | 'development'
const isProduction = vercelEnv === 'production' || (!vercelEnv && process.env.NODE_ENV === 'production')
const isPreview = vercelEnv === 'preview'

const resolvedDatasourceUrl = isProduction
  ? process.env.DATABASE_URL_MAINLIVE ?? process.env.DATABASE_URL ?? process.env.DATABASE_URL_MAINDEV
  : isPreview
    ? process.env.DATABASE_URL_MAINPREVIEW ?? process.env.DATABASE_URL_MAINDEV ?? process.env.DATABASE_URL ?? process.env.DATABASE_URL_MAINLIVE
    : process.env.DATABASE_URL_MAINDEV ?? process.env.DATABASE_URL ?? process.env.DATABASE_URL_MAINLIVE

if (!resolvedDatasourceUrl) {
  throw new Error(
    'Prisma config error: set one of DATABASE_URL_MAINDEV, DATABASE_URL, or DATABASE_URL_MAINLIVE.'
  )
}

// Migration advisory locks need a session connection, not transaction pooling.
// Derive only Neon's documented direct endpoint; keep the selected environment,
// database and credentials identical. Runtime Prisma still uses its pooled URL.
const migrationUrl = new URL(resolvedDatasourceUrl);
if (migrationUrl.hostname.endsWith('.neon.tech')) {
  migrationUrl.hostname = migrationUrl.hostname.replace('-pooler.', '.');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: migrationUrl.toString(),
  },
})
