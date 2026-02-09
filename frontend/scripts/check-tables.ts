import 'dotenv/config'
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_MAINLIVE!, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

async function main() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  
  console.log("Tables in database:");
  tables.forEach((t) => console.log("-", t.tablename));
  
  const hasNotification = tables.some(t => t.tablename === "Notification");
  console.log("\nNotification table exists:", hasNotification);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
