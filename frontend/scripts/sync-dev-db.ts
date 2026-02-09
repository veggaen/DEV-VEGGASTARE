/**
 * Script to push schema to the DEV database (ep-wild-boat)
 * This syncs the DEV database with the Prisma schema
 * 
 * Run: npx ts-node --transpile-only scripts/sync-dev-db.ts
 */

import 'dotenv/config'
import { execSync } from 'child_process';
import path from 'path';

const DEV_DB_URL = process.env.DATABASE_URL_MAINDEV!;

console.log("🔄 Syncing MainDev database with Prisma schema...\n");

try {
  // Override DATABASE_URL_MAINLIVE so prisma.config.ts picks up the dev URL
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  
  execSync(
    `npx prisma db push --accept-data-loss --skip-generate`,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL_MAINLIVE: DEV_DB_URL,
      },
      cwd: path.join(__dirname, '..'),
    }
  );
  
  console.log("\n✅ DEV database synced successfully!");
} catch (error) {
  console.error("❌ Failed to sync DEV database:", error);
  process.exit(1);
}
