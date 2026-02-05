import { execSync } from 'child_process';

// Push schema to the DEV database directly
const DEV_DB_URL = "postgresql://veggaen:vqeiKZ1mW8kz@ep-wild-boat-a2znlqog-pooler.eu-central-1.aws.neon.tech/mydatabase?sslmode=require";

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
