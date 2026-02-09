import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// This config is for syncing the DEV database (ep-wild-boat)
// Usage: npx prisma db push --config prisma.config.dev.ts

const DEV_DB_URL = process.env.DATABASE_URL_DEV!;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: DEV_DB_URL,
  },
})
