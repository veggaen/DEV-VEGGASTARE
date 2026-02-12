/**
 * Delete the REACH System poll
 * Run with: npx tsx scripts/delete-reach-poll.ts --dev
 */

import 'dotenv/config'
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'

const useDevDb = process.argv.includes('--dev');
const connectionString = useDevDb 
  ? process.env.DATABASE_URL_MAINDEV! 
  : process.env.DATABASE_URL_MAINLIVE!;

const adapter = new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

async function deletePoll() {
  console.log(useDevDb ? "🔧 Using DEV database\n" : "🔧 Using PROD database\n");
  
  const poll = await prisma.advancedPoll.findFirst({
    where: { title: 'VeggaStare REACH System Comprehensive Audit' }
  });
  
  if (poll) {
    // Delete the conversation if linked
    if (poll.conversationId) {
      await prisma.conversation.delete({ where: { id: poll.conversationId } }).catch(() => {});
      console.log('Deleted linked conversation:', poll.conversationId);
    }
    
    await prisma.advancedPoll.delete({ where: { id: poll.id } });
    console.log('✅ Deleted poll:', poll.id);
  } else {
    console.log('⚠️ No poll found to delete');
  }
  
  await prisma.$disconnect();
}

deletePoll().catch(console.error);
