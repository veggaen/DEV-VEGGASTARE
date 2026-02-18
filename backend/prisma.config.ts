import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * @fileOverview Prisma 7 config for the backend service
 * @stability stable
 *
 * Provides the datasource URL for Prisma CLI commands (generate, migrate, db push).
 * The backend connects to DATABASE_URL_MAINLIVE (Railway production / local dev).
 * Falls back to a stub URL for CI (prisma generate/validate don't need a real connection).
 */

const resolvedDatasourceUrl =
  process.env.DATABASE_URL_MAINLIVE
  ?? process.env.DATABASE_URL
  ?? 'postgresql://stub:stub@localhost:5432/stub'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: resolvedDatasourceUrl,
  },
})
