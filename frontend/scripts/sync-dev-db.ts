/**
 * Script to push schema to the DEV database (ep-wild-boat)
 * This syncs the DEV database with the Prisma schema
 * 
 * Run: npx ts-node --transpile-only scripts/sync-dev-db.ts
 */

import { execSync } from 'child_process';
import path from 'path';

const DEV_DB_URL = "postgresql://veggaen:vqeiKZ1mW8kz@ep-wild-boat-a2znlqog-pooler.eu-central-1.aws.neon.tech/mydatabase?sslmode=require";

console.log("🔄 Syncing DEV database (ep-wild-boat) with Prisma schema...\n");

try {
  // We need to temporarily override the DATABASE_URL in the schema
  // Since prisma.config.ts loads .env and uses DATABASE_URL, we'll use a workaround
  
  // Create a temporary env override
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  
  execSync(
    `npx prisma db push --accept-data-loss --skip-generate`,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: DEV_DB_URL,
        DIRECT_URL: DEV_DB_URL.replace('-pooler', ''),
      },
      cwd: path.join(__dirname, '..'),
    }
  );
  
  console.log("\n✅ DEV database synced successfully!");
} catch (error) {
  console.error("❌ Failed to sync DEV database:", error);
  process.exit(1);
}
