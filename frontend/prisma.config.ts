import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: isProduction
      ? env('DATABASE_URL_MAINLIVE')
      : env('DATABASE_URL_MAINDEV'),
  },
})
