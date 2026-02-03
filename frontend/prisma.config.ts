import path from "node:path";
import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// Load .env file
config({ path: path.resolve(__dirname, ".env") });

// In development, use DATABASE_URL_DEV for Prisma CLI operations (migrations, db push, etc.)
// This ensures CLI tools use the dev database, not production
const isDev = process.env.NODE_ENV !== 'production';
if (isDev && process.env.DATABASE_URL_DEV) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_DEV;
  // Also set DIRECT_URL to the dev database for direct connections
  process.env.DIRECT_URL = process.env.DATABASE_URL_DEV.replace('-pooler', '');
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
