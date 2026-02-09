/**
 * Admin Script: Delete REACH Polls
 * 
 * This script lists all REACH_ASSESSMENT polls and allows deleting them.
 * 
 * Run with: npx ts-node scripts/delete-reach-polls.ts
 * 
 * For production, make sure DATABASE_URL_MAINLIVE points to your production database.
 */

import 'dotenv/config'
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_MAINLIVE!, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

async function listAndDeleteReachPolls() {
  console.log("🔍 Searching for REACH_ASSESSMENT polls...\n");

  // Find all REACH polls
  const polls = await prisma.advancedPoll.findMany({
    where: {
      type: "REACH_ASSESSMENT",
    },
    include: {
      _count: {
        select: {
          Questions: true,
          Responses: true,
        },
      },
      Creator: {
        select: { email: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (polls.length === 0) {
    console.log("✅ No REACH_ASSESSMENT polls found.");
    return;
  }

  console.log(`📊 Found ${polls.length} REACH_ASSESSMENT poll(s):\n`);
  
  for (const poll of polls) {
    console.log("─".repeat(60));
    console.log(`📝 Title: ${poll.title}`);
    console.log(`🆔 ID: ${poll.id}`);
    console.log(`📅 Created: ${poll.createdAt.toISOString()}`);
    console.log(`👤 Creator: ${poll.Creator?.name || poll.Creator?.email || "Unknown"}`);
    console.log(`❓ Questions: ${poll._count.Questions}`);
    console.log(`📬 Responses: ${poll._count.Responses}`);
    console.log(`📢 Published: ${poll.publishedAt ? "Yes" : "No"}`);
  }
  console.log("─".repeat(60));

  // LIST-ONLY MODE (default)
  // To delete, pass --delete flag: npx ts-node scripts/delete-reach-polls.ts --delete
  const shouldDelete = process.argv.includes("--delete");
  
  if (!shouldDelete) {
    console.log("\n📋 LIST MODE - No deletions performed.");
    console.log("   To delete, run with: npx ts-node --transpile-only scripts/delete-reach-polls.ts --delete");
    return;
  }

  console.log("\n🗑️  Deleting all REACH_ASSESSMENT polls...\n");
  
  for (const poll of polls) {
    console.log(`Deleting: ${poll.title} (${poll.id})...`);
    await prisma.advancedPoll.delete({
      where: { id: poll.id },
    });
    console.log(`  ✅ Deleted!`);
  }
  
  console.log("\n🎉 All REACH polls deleted successfully!");

  // DELETE SPECIFIC POLL BY ID:
  /*
  const pollIdToDelete = "YOUR_POLL_ID_HERE";
  console.log(`\n🗑️  Deleting poll: ${pollIdToDelete}...`);
  await prisma.advancedPoll.delete({
    where: { id: pollIdToDelete },
  });
  console.log("✅ Poll deleted!");
  */
}

// Run
listAndDeleteReachPolls()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
