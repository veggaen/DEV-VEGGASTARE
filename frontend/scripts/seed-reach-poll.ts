/**
 * Seed Script: Create First Reach Poll
 * 
 * Poll Title: "How should the 'Reach' be upgraded (6→7 Pillars)"
 * 
 * This creates the comprehensive poll asking users about:
 * 1. Which existing pillar is most important
 * 2. Should we add "Realtime Pulse & Network Effects"
 * 3. Rate each pillar's current importance (slider A-G)
 * 4. Open feedback question
 * 
 * Run with: npx ts-node scripts/seed-reach-poll.ts
 * Or use: npm run seed:reach-poll
 */

import { PrismaClient, AdvancedPollType, PollQuestionType } from "@prisma/client";

const prisma = new PrismaClient();

// The proposed 7th pillar
const PROPOSED_7TH_PILLAR = {
  key: "realtimePulse",
  label: "Realtime Pulse & Network Effects",
  shortLabel: "Pulse",
  description: "Live engagement velocity, viral momentum, and cross-network amplification",
  tip: "Captures time-sensitive virality and when content is 'hot'",
  antiGaming: "Decay curve based on natural viral patterns; flag coordinated spikes",
};

// Current 6 pillars for reference
const CURRENT_PILLARS = [
  { key: "visibility", label: "Visibility", emoji: "👁️", description: "Unique exposures deduped across sessions" },
  { key: "engagementDepth", label: "Engagement Depth", emoji: "💬", description: "Quality interactions beyond likes" },
  { key: "conversionImpact", label: "Conversion Impact", emoji: "🛒", description: "Marketplace actions driven" },
  { key: "loyalty", label: "Loyalty", emoji: "❤️", description: "Repeat engagers who interact consistently" },
  { key: "growth", label: "Growth", emoji: "📈", description: "Organic expansion from posts" },
  { key: "recall", label: "Recall", emoji: "🔄", description: "Predicted return rate and stickiness" },
];

async function seedReachPoll() {
  console.log("🚀 Creating the Reach Upgrade Poll...\n");

  // Find or create a system admin user for the poll creator
  // You may need to adjust this to use an existing admin user ID
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (!adminUser) {
    console.error("❌ No admin user found. Please create an admin user first.");
    process.exit(1);
  }

  console.log(`📝 Creating poll as user: ${adminUser.email}`);

  // Create the Advanced Poll
  const poll = await prisma.advancedPoll.create({
    data: {
      title: "VeggaStare Reach System Innovation Poll",
      description: `Shape the future of how we measure true social impact!

Currently we have 6 pillars: Visibility, Engagement Depth, Conversion Impact, Loyalty, Growth, and Recall.

The proposed 7th pillar is **"Realtime Pulse & Network Effects"** - measuring live engagement velocity, viral momentum, and cross-network amplification.

Help us decide by sharing your thoughts on the current pillars and the proposed addition! Your voice matters.`,
      type: AdvancedPollType.REACH_ASSESSMENT,
      allowPartial: true,
      requiresAuth: false,
      isAnonymous: false,
      creatorId: adminUser.id,
      publishedAt: new Date(),
      Questions: {
        create: [
          // Question 1: Most Important Current Pillar
          {
            order: 1,
            type: PollQuestionType.SINGLE_CHOICE,
            text: "Which of the current 6 pillars do you find MOST valuable for understanding your reach?",
            description: "Select the pillar that gives you the most actionable insights",
            isRequired: true,
            allowImages: false,
            allowComments: false,
            Options: {
              create: CURRENT_PILLARS.map((pillar, index) => ({
                text: `${pillar.emoji} ${pillar.label}`,
                order: index + 1,
              })),
            },
          },
          // Question 2: Add 7th Pillar?
          {
            order: 2,
            type: PollQuestionType.SINGLE_CHOICE,
            text: "Should we add a 7th pillar: 'Realtime Pulse & Network Effects'?",
            description: `This would measure: ${PROPOSED_7TH_PILLAR.description}`,
            isRequired: true,
            allowImages: false,
            allowComments: false,
            Options: {
              create: [
                { text: "Yes, definitely add it!", order: 1 },
                { text: "Maybe, but keep it optional", order: 2 },
                { text: "No, 6 pillars is enough", order: 3 },
                { text: "Replace an existing pillar instead", order: 4 },
              ],
            },
          },
          // Questions 3-8: Rate each pillar (sliders)
          ...CURRENT_PILLARS.map((pillar, index) => ({
            order: index + 3,
            type: PollQuestionType.SLIDER,
            text: `Rate the importance of "${pillar.label}" (${pillar.emoji})`,
            description: pillar.description,
            isRequired: true,
            allowImages: false,
            allowComments: false,
            sliderConfig: {
              min: 1,
              max: 7,
              steps: 7,
              showValue: true,
              labels: ["A", "B", "C", "D", "E", "F", "G"],
            },
          })),
          // Question 9: Rate the proposed 7th pillar
          {
            order: 9,
            type: PollQuestionType.SLIDER,
            text: `If added, how important would "Realtime Pulse" (⚡) be to you?`,
            description: PROPOSED_7TH_PILLAR.description,
            isRequired: true,
            allowImages: false,
            allowComments: false,
            sliderConfig: {
              min: 1,
              max: 7,
              steps: 7,
              showValue: true,
              labels: ["A", "B", "C", "D", "E", "F", "G"],
            },
          },
          // Question 10: Open feedback
          {
            order: 10,
            type: PollQuestionType.TEXT,
            text: "Any other thoughts on how we should evolve the Reach metric?",
            description: "Share ideas, concerns, or suggestions (optional)",
            isRequired: false,
            allowImages: true,
            allowComments: false,
          },
        ],
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

  console.log("\n✅ Poll created successfully!");
  console.log(`📊 Poll ID: ${poll.id}`);
  console.log(`📝 Title: ${poll.title}`);
  console.log(`❓ Questions: ${poll.Questions.length}`);
  console.log("\n📋 Questions overview:");
  poll.Questions.forEach((q, i) => {
    console.log(`   ${i + 1}. [${q.type}] ${q.text.substring(0, 60)}...`);
  });

  console.log("\n🎉 Done! The poll is now ready for users to respond.");
  console.log(`\n🔗 Access via API: /api/advanced-polls/${poll.id}`);
}

// Run the seed
seedReachPoll()
  .catch((e) => {
    console.error("❌ Error seeding poll:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
