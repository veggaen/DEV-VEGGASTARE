import 'dotenv/config'
import { execSync } from 'child_process';

// Push schema to the DEV database directly
const DEV_DB_URL = process.env.DATABASE_URL_MAINDEV!;

console.log("Pushing schema to MainDev database...");

// Override DATABASE_URL_MAINLIVE so prisma.config.ts picks up the dev URL
process.env.DATABASE_URL_MAINLIVE = DEV_DB_URL;

execSync('npx prisma db push --accept-data-loss --skip-generate', {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL_MAINLIVE: DEV_DB_URL,
  },
  cwd: process.cwd(),
});

console.log("Done!");
