import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const vercelEnv = process.env.VERCEL_ENV // 'production' | 'preview' | 'development'
const isProduction = vercelEnv === 'production' || process.env.NODE_ENV === 'production'
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

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolvedDatasourceUrl,
  },
})
