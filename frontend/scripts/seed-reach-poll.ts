/**
 * Seed Script: Create the Comprehensive REACH System Audit Poll
 * 
 * Poll Title: "VeggaStare REACH System Comprehensive Audit"
 * 
 * This creates the 75+ question audit poll with 8 sections:
 * 1. About You (User Context)
 * 2. Current 6 Pillars Evaluation
 * 3. The 7th Pillar: Velocity
 * 4. Auth & Poll Power (Verification Weighting)
 * 5. View Strength & Anti-Gaming
 * 6. UI/UX Preferences
 * 7. Feature Priorities
 * 8. Open Feedback
 * 
 * This audit gathers community feedback on:
 * - How to IMPROVE each pillar (not IF we want 7 pillars)
 * - Verification tier weighting for polls
 * - UI/UX preferences including drag-and-drop layout tasks
 * - Feature prioritization via ranking
 * - Anti-gaming measures
 * - Future innovation ideas
 * 
 * Run with: npx ts-node scripts/seed-reach-poll.ts
 * Or use: npm run seed:reach-poll
 */

import { PrismaClient, AdvancedPollType, PollQuestionType, Prisma } from "@prisma/client";
import {
  REACH_AUDIT_POLL_CONFIG,
  REACH_AUDIT_POLL_SECTIONS,
  TOTAL_QUESTIONS,
} from "../lib/data/reach-audit-poll-questions";

const prisma = new PrismaClient();

// Map our question types to Prisma's PollQuestionType
function mapQuestionType(type: string): PollQuestionType {
  const typeMap: Record<string, PollQuestionType> = {
    'slider': PollQuestionType.SLIDER,
    'choice': PollQuestionType.SINGLE_CHOICE,
    'multi-choice': PollQuestionType.MULTI_CHOICE,
    'text': PollQuestionType.TEXT,
    'ranking': PollQuestionType.RANKING,
    'ui-arrange': PollQuestionType.UI_ARRANGE,
    'image-upload': PollQuestionType.TEXT,
    // Add NESTED type if needed
  };
  return typeMap[type] || PollQuestionType.TEXT;
}

async function seedReachAuditPoll() {
  console.log("🚀 Creating the REACH System Comprehensive Audit Poll...\n");
  console.log(`📊 Total questions: ${TOTAL_QUESTIONS}`);
  console.log(`📑 Total sections: ${REACH_AUDIT_POLL_SECTIONS.length}`);

  // Find or create a system admin user for the poll creator
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (!adminUser) {
    console.error("❌ No admin user found. Please create an admin user first.");
    process.exit(1);
  }

  console.log(`\n📝 Creating poll as user: ${adminUser.email}`);

  // Check if poll already exists
  const existingPoll = await prisma.advancedPoll.findFirst({
    where: { title: "VeggaStare REACH System Comprehensive Audit" },
  });

  if (existingPoll) {
    console.log(`\n⚠️  Poll already exists with ID: ${existingPoll.id}`);
    console.log("Delete it first if you want to recreate it.");
    return existingPoll;
  }

  // Build all questions from sections
  let questionOrder = 0;
  const allQuestions: Prisma.PollQuestionCreateWithoutAdvancedPollInput[] = [];

  for (const section of REACH_AUDIT_POLL_SECTIONS) {
    console.log(`\n📋 Processing section: ${section.title} (${section.questions.length} questions)`);
    
    for (const q of section.questions) {
      questionOrder++;
      
      // Build slider config if applicable
      let sliderConfig: Prisma.InputJsonValue | undefined = undefined;
      if (q.type === 'slider' && q.sliderLabels) {
        sliderConfig = {
          min: 1,
          max: q.sliderLabels.length,
          steps: q.sliderLabels.length,
          showValue: true,
          labels: q.sliderLabels,
        } as Prisma.InputJsonValue;
      }

      // Build options if applicable
      const options = q.options?.map((opt, idx) => ({
        text: opt.icon ? `${opt.icon} ${opt.label}` : opt.label,
        order: idx + 1,
      }));

      allQuestions.push({
        order: questionOrder,
        type: mapQuestionType(q.type),
        text: q.question,
        description: q.description || null,
        isRequired: q.required ?? true,
        allowImages: q.type === 'image-upload' || q.type === 'text',
        allowComments: true,
        sliderConfig,
        ...(options && options.length > 0 ? { Options: { create: options } } : {}),
      });
    }
  }

  console.log(`\n📊 Total questions to create: ${allQuestions.length}`);

  // Create the Advanced Poll
  const poll = await prisma.advancedPoll.create({
    data: {
      title: "VeggaStare REACH System Comprehensive Audit",
      description: REACH_AUDIT_POLL_CONFIG.description,
      type: AdvancedPollType.REACH_ASSESSMENT,
      allowPartial: true,
      requiresAuth: false, // Allow anonymous with reduced weight
      isAnonymous: false,
      creatorId: adminUser.id,
      publishedAt: new Date(),
      Questions: {
        create: allQuestions,
      },
    },
    include: {
      Questions: {
        include: {
          Options: true,
        },
      },
    },
  });

  // Type assertion since we included Questions
  const pollWithQuestions = poll as typeof poll & { Questions: Array<{ type: string }> };

  console.log("\n✅ Poll created successfully!");
  console.log(`📊 Poll ID: ${poll.id}`);
  console.log(`📝 Title: ${poll.title}`);
  console.log(`❓ Questions: ${pollWithQuestions.Questions.length}`);
  
  console.log("\n📋 Section overview:");
  REACH_AUDIT_POLL_SECTIONS.forEach((section, i) => {
    console.log(`   ${i + 1}. ${section.title}: ${section.questions.length} questions`);
  });

  console.log("\n📋 Question types breakdown:");
  const typeCounts: Record<string, number> = {};
  for (const q of pollWithQuestions.Questions) {
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
  }
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  console.log("\n🎉 Done! The comprehensive REACH audit poll is now ready.");
  console.log(`\n🔗 Access via API: /api/advanced-polls/${poll.id}`);
  
  return poll;
}

// Run the seed
seedReachAuditPoll()
  .catch((e) => {
    console.error("❌ Error seeding poll:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
