/**
 * Check if polls exist in the database
 * Run: npx ts-node --transpile-only scripts/check-polls.ts
 */
import 'dotenv/config'
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_MAINLIVE!, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Checking for published polls...\n");

  const polls = await prisma.advancedPoll.findMany({
    where: {
      publishedAt: { not: null },
    },
    include: {
      Questions: {
        take: 3,
        include: {
          Options: true,
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (polls.length === 0) {
    console.log("❌ No published polls found!");
  } else {
    console.log(`✅ Found ${polls.length} published polls:\n`);
    for (const poll of polls) {
      console.log(`📊 ${poll.title}`);
      console.log(`   ID: ${poll.id}`);
      console.log(`   Type: ${poll.type}`);
      console.log(`   Published: ${poll.publishedAt?.toISOString()}`);
      
      console.log(`\n   First 3 questions:`);
      for (const q of poll.Questions) {
        console.log(`\n   Q${q.order}: ${q.text.slice(0, 60)}...`);
        console.log(`   Type: ${q.type}`);
        if (q.Options.length > 0) {
          console.log(`   Options (${q.Options.length}):`);
          q.Options.slice(0, 5).forEach((opt, i) => {
            console.log(`      ${i+1}. [${opt.id.slice(-6)}] "${opt.text}"`);
          });
        }
      }
      console.log();
    }
  }

  // Also check if Notification table exists
  console.log("\n🔔 Checking Notification table...");
  try {
    const count = await prisma.notification.count();
    console.log(`✅ Notification table exists (${count} records)`);
  } catch (e: any) {
    console.log(`❌ Notification table error: ${e.message}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
