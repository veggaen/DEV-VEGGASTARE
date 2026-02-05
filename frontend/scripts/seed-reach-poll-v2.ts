/**
 * Seed Script: Create Poll Questions for ReachAuditPollV2
 * 
 * This creates database questions that work with the ReachAuditPollV2 component.
 * Questions are grouped by phase using metadata in sliderConfig.
 * 
 * Run with: npx ts-node --transpile-only scripts/seed-reach-poll-v2.ts
 * 
 * To seed to DEV database: npx ts-node --transpile-only scripts/seed-reach-poll-v2.ts --dev
 */

import { PrismaClient, AdvancedPollType, PollQuestionType, Prisma } from "@prisma/client";

// System account constants - matches lib/system-account.ts
const SYSTEM_ACCOUNT = {
  id: "system-vegga-official",
  name: "VeggaSystem",
  username: "veggasystem",
  email: "system@veggat.com",
  bio: "🤖 Official system account for Veggat platform updates, changelogs, and announcements. Stay tuned for the latest vibes!",
  image: "https://api.dicebear.com/7.x/bottts/svg?seed=veggasystem&backgroundColor=10b981",
  banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop",
} as const;

// Check for --dev flag to use DEV database
const useDevDb = process.argv.includes('--dev');
const DEV_DB_URL = "postgresql://veggaen:vqeiKZ1mW8kz@ep-wild-boat-a2znlqog-pooler.eu-central-1.aws.neon.tech/mydatabase?sslmode=require";

const prisma = new PrismaClient(
  useDevDb ? { datasources: { db: { url: DEV_DB_URL } } } : undefined
);

if (useDevDb) {
  console.log("🔧 Using DEV database (ep-wild-boat)\n");
} else {
  console.log("🔧 Using PROD database (from DATABASE_URL)\n");
}

const POLL_DESCRIPTION = `
🎯 Shape the Future of VeggaStare

Your voice matters! Help us build a better platform by sharing 
what features you care about most.

• 8 Quick Sections
• Skip what doesn't interest you
• Takes 5-10 minutes
`.trim();

// Phase definitions with questions
interface PhaseDef {
  phaseId: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  questions: QuestionDef[];
}

interface QuestionDef {
  localId: string; // For tracking in frontend state
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "SLIDER" | "TEXT";
  text: string;
  description?: string;
  required: boolean;
  visual?: "cards" | "pills" | "icons" | "minimal";
  sliderConfig?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
    showValue?: boolean;
  };
  options?: Array<{ localId: string; text: string; icon?: string; description?: string }>;
}

const PHASES: PhaseDef[] = [
  {
    phaseId: "about-you",
    title: "About You",
    subtitle: "Help us understand your perspective",
    icon: "User",
    color: "emerald",
    questions: [
      {
        localId: "role",
        type: "SINGLE_CHOICE",
        text: "What brings you to VeggaStare?",
        description: "Pick the one that fits best — you can do multiple things!",
        required: true,
        visual: "cards",
        options: [
          { localId: "creator", text: "I create content", icon: "🎨", description: "Posts, art, products, music" },
          { localId: "explorer", text: "I discover & engage", icon: "🔍", description: "Browse, like, comment, share" },
          { localId: "seller", text: "I sell things", icon: "🏪", description: "Products, services, digital items" },
          { localId: "buyer", text: "I shop & collect", icon: "🛒", description: "Buy products, trade items" },
          { localId: "networker", text: "I connect people", icon: "🤝", description: "Community building, collaborations" },
          { localId: "observer", text: "Just exploring", icon: "👀", description: "New here, checking things out" },
        ],
      },
      {
        localId: "contribute",
        type: "SINGLE_CHOICE",
        text: "Would you like to help build VeggaStare?",
        description: "We're always looking for passionate contributors!",
        required: false,
        visual: "pills",
        options: [
          { localId: "yes", text: "Yes!", icon: "✅" },
          { localId: "no", text: "Not now", icon: "❌" },
        ],
      },
      {
        localId: "familiarity",
        type: "SLIDER",
        text: "How well do you know VeggaStare's features?",
        description: "Be honest — there's no wrong answer!",
        required: true,
        sliderConfig: { min: 1, max: 5, minLabel: "Brand new", maxLabel: "Power user", showValue: true },
      },
    ],
  },
  {
    phaseId: "reach-pillars",
    title: "The Reach System",
    subtitle: "Rate what matters most to you",
    icon: "Target",
    color: "blue",
    questions: [
      {
        localId: "pillar-visibility",
        type: "SLIDER",
        text: "How important is knowing how many people see your content?",
        description: "Views, impressions, and reach",
        required: true,
        sliderConfig: { min: 1, max: 5, showValue: true },
      },
      {
        localId: "pillar-engagement",
        type: "SLIDER",
        text: "How important are meaningful interactions?",
        description: "Comments, saves, time spent — not just likes",
        required: true,
        sliderConfig: { min: 1, max: 5, showValue: true },
      },
      {
        localId: "pillar-conversion",
        type: "SLIDER",
        text: "How important is turning viewers into customers?",
        description: "Profile visits → follows, clicks → purchases",
        required: true,
        sliderConfig: { min: 1, max: 5, showValue: true },
      },
      {
        localId: "pillar-loyalty",
        type: "SLIDER",
        text: "How important is having repeat supporters?",
        description: "People who come back again and again",
        required: true,
        sliderConfig: { min: 1, max: 5, showValue: true },
      },
      {
        localId: "pillar-growth",
        type: "SLIDER",
        text: "How important is organic growth from your posts?",
        description: "New followers discovered through your content",
        required: true,
        sliderConfig: { min: 1, max: 5, showValue: true },
      },
    ],
  },
  {
    phaseId: "velocity",
    title: "Velocity & Momentum",
    subtitle: "Should we track when content goes viral?",
    icon: "Zap",
    color: "amber",
    questions: [
      {
        localId: "velocity-want",
        type: "SINGLE_CHOICE",
        text: "Would you like to know when your content is trending?",
        description: "Real-time alerts when engagement spikes",
        required: true,
        visual: "pills",
        options: [
          { localId: "yes", text: "Yes!", icon: "✅" },
          { localId: "no", text: "No", icon: "❌" },
        ],
      },
      {
        localId: "velocity-importance",
        type: "SLIDER",
        text: "How important is real-time momentum tracking?",
        description: "See engagement as it happens, not just totals",
        required: true,
        sliderConfig: { min: 1, max: 5, showValue: true },
      },
      {
        localId: "velocity-features",
        type: "MULTI_CHOICE",
        text: "Which velocity features interest you?",
        description: "Select all that appeal to you",
        required: false,
        visual: "cards",
        options: [
          { localId: "realtime-graph", text: "Live engagement graph", icon: "📈" },
          { localId: "trending-badge", text: "Trending badges", icon: "🔥" },
          { localId: "viral-alerts", text: "Viral alerts", icon: "🚀" },
          { localId: "drop-detection", text: "Drop detection", icon: "📉" },
          { localId: "optimal-timing", text: "Best time to post", icon: "⏰" },
        ],
      },
    ],
  },
  {
    phaseId: "verification",
    title: "Trust & Verification",
    subtitle: "How should we handle bots and trust?",
    icon: "Shield",
    color: "violet",
    questions: [
      {
        localId: "verification-trust",
        type: "SLIDER",
        text: "Should verified users have more influence in polls?",
        description: "Reduce bot/spam impact",
        required: true,
        sliderConfig: { min: 1, max: 5, minLabel: "No difference", maxLabel: "Much more", showValue: true },
      },
      {
        localId: "verification-tiers",
        type: "MULTI_CHOICE",
        text: "Which verification methods feel trustworthy?",
        description: "Select all that feel trustworthy",
        required: false,
        visual: "cards",
        options: [
          { localId: "email", text: "Email verification", icon: "📧" },
          { localId: "phone", text: "Phone verification", icon: "📱" },
          { localId: "social", text: "Social login", icon: "🔗" },
          { localId: "wallet", text: "Crypto wallet", icon: "🔐" },
          { localId: "id", text: "ID verification", icon: "🪪" },
        ],
      },
      {
        localId: "verification-bots",
        type: "SINGLE_CHOICE",
        text: "Do you worry about bots affecting content?",
        required: true,
        visual: "pills",
        options: [
          { localId: "very", text: "Very worried", icon: "😰" },
          { localId: "somewhat", text: "Somewhat", icon: "🤔" },
          { localId: "not-really", text: "Not really", icon: "😌" },
        ],
      },
    ],
  },
  {
    phaseId: "ux-design",
    title: "Design & Experience",
    subtitle: "How should the platform look and feel?",
    icon: "Palette",
    color: "pink",
    questions: [
      {
        localId: "chart-preference",
        type: "SINGLE_CHOICE",
        text: "What kind of analytics display do you prefer?",
        required: true,
        visual: "cards",
        options: [
          { localId: "simple", text: "Simple numbers", icon: "📊" },
          { localId: "charts", text: "Visual charts", icon: "📈" },
          { localId: "both", text: "Both combined", icon: "🎯" },
          { localId: "minimal", text: "Minimal/hidden", icon: "✨" },
        ],
      },
      {
        localId: "theme-preference",
        type: "SINGLE_CHOICE",
        text: "Which theme do you prefer?",
        required: false,
        visual: "pills",
        options: [
          { localId: "dark", text: "Dark mode", icon: "🌙" },
          { localId: "light", text: "Light mode", icon: "☀️" },
          { localId: "auto", text: "Auto (system)", icon: "🔄" },
        ],
      },
      {
        localId: "mobile-importance",
        type: "SLIDER",
        text: "How important is mobile experience to you?",
        required: true,
        sliderConfig: { min: 1, max: 5, minLabel: "Desktop only", maxLabel: "Mobile first", showValue: true },
      },
    ],
  },
  {
    phaseId: "features",
    title: "Features & Roadmap",
    subtitle: "What should we build next?",
    icon: "Rocket",
    color: "cyan",
    questions: [
      {
        localId: "feature-rank",
        type: "MULTI_CHOICE",
        text: "Which features would you use most?",
        description: "Select your top 3",
        required: true,
        visual: "cards",
        options: [
          { localId: "velocity", text: "Real-time trending", icon: "⚡" },
          { localId: "scheduling", text: "Post scheduling", icon: "📅" },
          { localId: "video", text: "Video support", icon: "🎬" },
          { localId: "ai", text: "AI insights", icon: "🤖" },
          { localId: "mobile", text: "Mobile app", icon: "📱" },
          { localId: "api", text: "Developer API", icon: "🔧" },
        ],
      },
      {
        localId: "premium",
        type: "SINGLE_CHOICE",
        text: "Would you pay for advanced analytics?",
        description: "Premium features like detailed history, API access",
        required: true,
        visual: "pills",
        options: [
          { localId: "yes", text: "Yes", icon: "✅" },
          { localId: "no", text: "No", icon: "❌" },
          { localId: "maybe", text: "Maybe", icon: "🤔" },
        ],
      },
      {
        localId: "price-range",
        type: "SINGLE_CHOICE",
        text: "What would you pay monthly?",
        description: "If premium analytics were available",
        required: false,
        visual: "pills",
        options: [
          { localId: "free", text: "Keep it free", icon: "🆓" },
          { localId: "low", text: "$2-5", icon: "💵" },
          { localId: "mid", text: "$5-10", icon: "💵💵" },
          { localId: "high", text: "$10+", icon: "💎" },
        ],
      },
    ],
  },
  {
    phaseId: "open-feedback",
    title: "Your Voice",
    subtitle: "Share your thoughts freely",
    icon: "MessageSquare",
    color: "orange",
    questions: [
      {
        localId: "one-change",
        type: "TEXT",
        text: "If you could change ONE thing about VeggaStare?",
        description: "Your most important suggestion",
        required: false,
      },
      {
        localId: "daily-use",
        type: "TEXT",
        text: "What would make you visit every day?",
        description: "What's missing that you'd love?",
        required: false,
      },
      {
        localId: "nps",
        type: "SLIDER",
        text: "Would you recommend VeggaStare to a friend?",
        description: "1 = Never, 5 = Absolutely!",
        required: true,
        sliderConfig: { min: 1, max: 5, showValue: true },
      },
    ],
  },
  {
    phaseId: "trust-future",
    title: "Trust & Future",
    subtitle: "Building trust and shaping tomorrow",
    icon: "Shield",
    color: "violet",
    questions: [
      {
        localId: "trust-factors",
        type: "MULTI_CHOICE",
        text: "What builds trust in a social platform?",
        description: "Select the most important factors",
        required: true,
        visual: "cards",
        options: [
          { localId: "transparency", text: "Transparent algorithms", icon: "🔍" },
          { localId: "privacy", text: "Strong privacy controls", icon: "🔒" },
          { localId: "moderation", text: "Fair content moderation", icon: "⚖️" },
          { localId: "ownership", text: "User data ownership", icon: "📦" },
          { localId: "community", text: "Healthy community culture", icon: "🤝" },
        ],
      },
      {
        localId: "verification-value",
        type: "SLIDER",
        text: "How much do you value verified accounts?",
        description: "Should verification affect REACH?",
        required: true,
        sliderConfig: { min: 1, max: 5, minLabel: "No difference", maxLabel: "Major advantage", showValue: true },
      },
      {
        localId: "new-user-boost",
        type: "SINGLE_CHOICE",
        text: "Should new users get a temporary REACH boost?",
        description: "Help newcomers get discovered",
        required: true,
        visual: "pills",
        options: [
          { localId: "yes", text: "Yes", icon: "🚀" },
          { localId: "no", text: "No", icon: "❌" },
          { localId: "gradual", text: "Gradual unlock", icon: "📊" },
        ],
      },
      {
        localId: "platform-vision",
        type: "SINGLE_CHOICE",
        text: "What should VeggaStare prioritize?",
        description: "Our core focus as a platform",
        required: true,
        visual: "cards",
        options: [
          { localId: "creators", text: "Creator success", icon: "🎨" },
          { localId: "discovery", text: "Content discovery", icon: "🔍" },
          { localId: "community", text: "Community building", icon: "🤝" },
          { localId: "innovation", text: "Innovation", icon: "🚀" },
          { localId: "simplicity", text: "Simplicity", icon: "✨" },
        ],
      },
      {
        localId: "final-thoughts",
        type: "TEXT",
        text: "Any final thoughts on REACH or the platform?",
        description: "Share anything we haven't asked about",
        required: false,
      },
    ],
  },
];

async function main() {
  console.log("═".repeat(60));
  console.log("🚀 VeggaStare REACH Poll V2 Seeder");
  console.log("═".repeat(60));

  const totalQuestions = PHASES.reduce((sum, p) => sum + p.questions.length, 0);
  console.log(`\n📊 Questions to create: ${totalQuestions} across ${PHASES.length} phases`);

  // Create or find system account
  let systemUser = await prisma.user.findUnique({
    where: { id: SYSTEM_ACCOUNT.id },
  });

  if (!systemUser) {
    console.log("🤖 Creating system account...");
    systemUser = await prisma.user.create({
      data: {
        id: SYSTEM_ACCOUNT.id,
        name: SYSTEM_ACCOUNT.name,
        email: SYSTEM_ACCOUNT.email,
        image: SYSTEM_ACCOUNT.image,
        banner: SYSTEM_ACCOUNT.banner,
        bio: SYSTEM_ACCOUNT.bio,
        role: "ADMIN",
        emailVerified: new Date(),
        verificationTier: "FULLY_VERIFIED",
        verificationScore: 100,
      },
    });
    console.log(`✅ System account created: ${systemUser.id}`);
  }

  console.log(`📝 Creating poll as: ${SYSTEM_ACCOUNT.name} (${SYSTEM_ACCOUNT.id})`);

  // Delete existing polls with same title (and their conversations)
  const existing = await prisma.advancedPoll.findFirst({
    where: { title: "VeggaStare REACH Feedback" },
  });

  if (existing) {
    console.log(`\n🗑️  Deleting existing poll: ${existing.id}`);
    // Delete conversation first if it exists
    if (existing.conversationId) {
      await prisma.conversation.delete({ where: { id: existing.conversationId } }).catch(() => {});
    }
    await prisma.advancedPoll.delete({ where: { id: existing.id } }).catch(() => {});
  }
  
  // Also delete orphaned conversation with same title
  const existingConversation = await prisma.conversation.findFirst({
    where: { title: "VeggaStare REACH Feedback" },
  });
  if (existingConversation) {
    console.log(`\n🗑️  Deleting existing conversation: ${existingConversation.id}`);
    await prisma.conversation.delete({ where: { id: existingConversation.id } }).catch(() => {});
  }

  // Build questions with phase metadata in sliderConfig
  let questionOrder = 0;
  const allQuestions: Prisma.PollQuestionCreateWithoutAdvancedPollInput[] = [];

  for (const phase of PHASES) {
    console.log(`\n📋 ${phase.title} (${phase.questions.length} questions)`);

    for (const q of phase.questions) {
      questionOrder++;

      // Store all metadata in sliderConfig
      const config: Record<string, unknown> = {
        phaseId: phase.phaseId,
        phaseTitle: phase.title,
        phaseSubtitle: phase.subtitle,
        phaseIcon: phase.icon,
        phaseColor: phase.color,
        localId: q.localId,
        visual: q.visual,
        ...(q.sliderConfig || {}),
      };

      allQuestions.push({
        order: questionOrder,
        type: q.type as PollQuestionType,
        text: q.text,
        description: q.description || null,
        isRequired: q.required,
        allowImages: false,
        allowComments: true,
        sliderConfig: config as Prisma.InputJsonValue,
        ...(q.options ? {
          Options: {
            create: q.options.map((opt, optIndex) => ({
              text: opt.icon ? `${opt.icon} ${opt.text}` : opt.text,
              order: optIndex + 1,
              // Store localId in value field for reference
              value: optIndex + 1,
            })),
          },
        } : {}),
      });
    }
  }

  // Create a conversation (pulse) for the poll so it shows in the feed
  console.log("\n📝 Creating conversation for poll...");
  const conversation = await prisma.conversation.create({
    data: {
      title: "VeggaStare REACH Feedback",
      description: "Help us build the REACH algorithm - a new social metric to replace followers!",
      type: "PUBLIC_THREAD",
      visibility: "PUBLIC",
      replyPermission: "EVERYONE",
      userId: systemUser.id,
      participants: [systemUser.id],
      tags: ["poll", "reach", "feedback", "algorithm", "community"],
    },
  });

  // Create the poll linked to the conversation
  const poll = await prisma.advancedPoll.create({
    data: {
      title: "VeggaStare REACH Feedback",
      description: POLL_DESCRIPTION,
      type: AdvancedPollType.REACH_ASSESSMENT,
      allowPartial: true,
      requiresAuth: false,
      isAnonymous: false,
      creatorId: systemUser.id,
      conversationId: conversation.id, // Link to conversation!
      publishedAt: new Date(),
      Questions: {
        create: allQuestions,
      },
    },
    include: {
      Questions: {
        include: { Options: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  // Create initial message for the conversation
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: systemUser.id,
      content: `# 🚀 Help Shape the Future of Social Media!

We're building **REACH** - a revolutionary new metric to replace traditional follower counts.

**What is REACH?**
REACH measures your true social influence based on engagement quality, content relevance, and community connection - not just vanity metrics.

**Your input matters!**
This poll will help us design an algorithm that:
- Rewards quality content over quantity
- Gives newcomers a fair chance
- Prevents gaming and bot manipulation
- Creates genuine connections

📊 **Take the poll above** to share your thoughts on how REACH should work!

*Estimated time: 10-15 minutes across 4 phases*`,
    },
  });

  console.log("\n" + "═".repeat(60));
  console.log("✅ POLL CREATED SUCCESSFULLY!");
  console.log("═".repeat(60));
  console.log(`💬 Conversation ID: ${conversation.id}`);
  console.log(`📊 Poll ID: ${poll.id}`);
  console.log(`📝 Title: ${poll.title}`);
  console.log(`❓ Questions: ${poll.Questions.length}`);
  console.log(`📅 Published: ${poll.publishedAt?.toISOString()}`);

  console.log("\n📋 Questions by phase:");
  let currentPhase = "";
  poll.Questions.forEach((q, i) => {
    const config = q.sliderConfig as Record<string, unknown>;
    const phase = config?.phaseId as string;
    if (phase !== currentPhase) {
      currentPhase = phase;
      console.log(`\n   📂 ${config?.phaseTitle || phase}`);
    }
    const opts = (q as any).Options?.length || 0;
    console.log(`      ${i + 1}. ${q.text.slice(0, 45)}... (${q.type}${opts ? `, ${opts} opts` : ''})`);
  });

  console.log("\n🎉 Done! Now update ReachAuditPollV2 to load from API.");
  return poll;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
