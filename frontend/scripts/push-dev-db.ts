import 'dotenv/config'
import { execSync } from 'child_process';

// Push schema to the DEV database directly
const DEV_DB_URL = process.env.DATABASE_URL_DEV!;

console.log("Pushing schema to DEV database (ep-wild-boat)...");

// Set DATABASE_URL temporarily and run prisma db push
process.env.DATABASE_URL = DEV_DB_URL;

execSync('npx prisma db push --accept-data-loss --skip-generate', {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: DEV_DB_URL,
  },
  cwd: process.cwd(),
});

console.log("Done!");
