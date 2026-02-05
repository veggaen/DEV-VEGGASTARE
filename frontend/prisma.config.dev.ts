import { defineConfig } from "prisma/config";

// This config is for syncing the DEV database (ep-wild-boat)
// Usage: npx prisma db push --config prisma.config.dev.ts

const DEV_DB_URL = "postgresql://veggaen:vqeiKZ1mW8kz@ep-wild-boat-a2znlqog-pooler.eu-central-1.aws.neon.tech/mydatabase?sslmode=require";
const DEV_DIRECT_URL = "postgresql://veggaen:vqeiKZ1mW8kz@ep-wild-boat-a2znlqog.eu-central-1.aws.neon.tech/mydatabase?sslmode=require";

// Set environment variables before Prisma reads them
process.env.DATABASE_URL = DEV_DB_URL;
process.env.DIRECT_URL = DEV_DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
});
