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

import 'dotenv/config'
import { PrismaClient, AdvancedPollType, PollQuestionType, Prisma } from "@/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'

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
const DEV_DB_URL = process.env.DATABASE_URL_MAINDEV!;

const connectionString = useDevDb ? DEV_DB_URL : process.env.DATABASE_URL_MAINLIVE!;
const adapter = new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

if (useDevDb) {
  console.log("🔧 Using DEV database (ep-wild-boat)\n");
} else {
  console.log("🔧 Using PROD database (from DATABASE_URL_MAINLIVE)\n");
}

const POLL_DESCRIPTION = `
💬 Your Feedback Shapes Everything

Help us make VeggaStare better! Tell us what you think, 
discover features you might not know about, and help 
us decide what to build next.

• 8 Quick Sections
• Skip anything you want
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
    phaseId: "welcome",
    title: "Welcome & You",
    subtitle: "Tell us about yourself",
    icon: "User",
    color: "emerald",
    questions: [
      {
        localId: "role",
        type: "SINGLE_CHOICE",
        text: "What best describes you on VeggaStare?",
        description: "Pick the closest fit — no wrong answers!",
        required: true,
        visual: "cards",
        options: [
          { localId: "creator", text: "I create content", icon: "🎨", description: "Posts, products, art" },
          { localId: "explorer", text: "I browse & discover", icon: "🔍", description: "Browse, like, comment" },
          { localId: "shopper", text: "I shop & trade", icon: "🛒", description: "Buy products, trade items" },
          { localId: "networker", text: "I connect with people", icon: "🤝", description: "Community, collaborations" },
          { localId: "observer", text: "Just checking things out", icon: "👀", description: "New here!" },
        ],
      },
      {
        localId: "familiarity",
        type: "SLIDER",
        text: "How familiar are you with VeggaStare?",
        description: "Be honest — helps us tailor the experience!",
        required: true,
        sliderConfig: { min: 1, max: 5, minLabel: "Brand new", maxLabel: "Power user", showValue: true },
      },
      {
        localId: "contribute",
        type: "SINGLE_CHOICE",
        text: "Would you like to help build VeggaStare?",
        description: "We're always looking for passionate contributors!",
        required: false,
        visual: "pills",
        options: [
          { localId: "yes", text: "Yes, I'd love to!", icon: "✅" },
          { localId: "maybe", text: "Maybe — tell me more", icon: "🤔" },
          { localId: "no", text: "Not right now", icon: "❌" },
        ],
      },
    ],
  },
  {
    phaseId: "impressions",
    title: "First Impressions",
    subtitle: "Your experience landing on VeggaStare",
    icon: "Sparkles",
    color: "yellow",
    questions: [
      {
        localId: "first-impression",
        type: "SLIDER",
        text: "What was your first impression of VeggaStare?",
        description: "Think back to when you first landed on the site",
        required: true,
        sliderConfig: { min: 1, max: 7, minLabel: "Confused", maxLabel: "Impressed", showValue: true },
      },
      {
        localId: "stood-out",
        type: "MULTI_CHOICE",
        text: "What stood out to you the most? (pick up to 3)",
        description: "First things you noticed or explored",
        required: false,
        visual: "cards",
        options: [
          { localId: "design", text: "The design & dark theme", icon: "🎨" },
          { localId: "marketplace", text: "The marketplace / products", icon: "🛒" },
          { localId: "reach", text: "The REACH analytics system", icon: "📊" },
          { localId: "web3", text: "Web3 / wallet integration", icon: "🔗" },
          { localId: "social", text: "Social features (feed, chat)", icon: "💬" },
          { localId: "polls", text: "The polls & voting system", icon: "🗳️" },
        ],
      },
      {
        localId: "clarity",
        type: "SINGLE_CHOICE",
        text: "Was it clear what VeggaStare is about?",
        description: "Could you tell what the platform does within a minute?",
        required: true,
        visual: "pills",
        options: [
          { localId: "yes", text: "Yes, totally clear", icon: "✅" },
          { localId: "somewhat", text: "Sort of — took exploring", icon: "🤔" },
          { localId: "not-really", text: "Not really", icon: "😕" },
          { localId: "no", text: "No idea honestly", icon: "❓" },
        ],
      },
    ],
  },
  {
    phaseId: "reach-pillars",
    title: "The 7 Pillars",
    subtitle: "Rate the REACH scoring system",
    icon: "Target",
    color: "blue",
    questions: [
      {
        localId: "transparent-scoring",
        type: "SLIDER",
        text: "How important is a transparent scoring system to you?",
        description: "REACH replaces hidden algorithms with 7 visible pillars: Discovery, Content, Psychology, Community, Conversion, Growth & Velocity",
        required: true,
        sliderConfig: { min: 1, max: 5, minLabel: "Don't care", maxLabel: "Essential", showValue: true },
      },
      {
        localId: "velocity-awareness",
        type: "SINGLE_CHOICE",
        text: "Did you know VeggaStare already tracks Velocity (live trending)?",
        description: "⚡ We shipped the 7th pillar! It tracks real-time momentum, engagement spikes, and viral detection.",
        required: true,
        visual: "cards",
        options: [
          { localId: "no-awesome", text: "No way — that's awesome!", icon: "🤯" },
          { localId: "heard", text: "I heard of it but haven't seen it", icon: "😮" },
          { localId: "noticed", text: "Yeah, I've noticed it", icon: "👍" },
          { localId: "confused", text: "What does that even mean?", icon: "🤔" },
        ],
      },
      {
        localId: "velocity-features",
        type: "MULTI_CHOICE",
        text: "Which Velocity features sound most useful?",
        description: "Select all that interest you — these are live or coming soon",
        required: false,
        visual: "cards",
        options: [
          { localId: "live-graph", text: "Live engagement graphs", icon: "📈" },
          { localId: "trending", text: "Trending badges on hot content", icon: "🔥" },
          { localId: "viral-alert", text: "Alerts when your post goes viral", icon: "🚀" },
          { localId: "drop-alert", text: "Notifications when engagement drops", icon: "📉" },
          { localId: "best-time", text: "Best time to post suggestions", icon: "⏰" },
        ],
      },
      {
        localId: "pillar-rank",
        type: "MULTI_CHOICE",
        text: "Which REACH pillars matter most to YOU? (pick top 3)",
        description: "These are the 7 pillars that make up your REACH score",
        required: true,
        visual: "cards",
        options: [
          { localId: "discovery", text: "Discovery — How people find you", icon: "👁️" },
          { localId: "content", text: "Content Quality — Depth over likes", icon: "💬" },
          { localId: "psychology", text: "Psychology — Trust & social proof", icon: "🧠" },
          { localId: "community", text: "Community — Loyal supporters", icon: "👥" },
          { localId: "conversion", text: "Conversion — Views → action", icon: "💳" },
          { localId: "growth", text: "Growth — Organic followers", icon: "📈" },
        ],
      },
    ],
  },
  {
    phaseId: "discovery",
    title: "Discovery Zone",
    subtitle: "Did you know we have these features?",
    icon: "Search",
    color: "cyan",
    questions: [
      {
        localId: "trading",
        type: "SINGLE_CHOICE",
        text: "Did you know we have OSRS-style P2P trading?",
        description: "🎮 You can trade items with other users in a retro RuneScape-style trade window — offer, confirm, complete!",
        required: true,
        visual: "cards",
        options: [
          { localId: "amazing", text: "What?! I need to try this", icon: "🤯" },
          { localId: "saw-it", text: "Saw it but haven't tried", icon: "😮" },
          { localId: "traded", text: "Already traded with someone!", icon: "✅" },
          { localId: "not-thing", text: "Not really my thing", icon: "🤷" },
        ],
      },
      {
        localId: "wallet",
        type: "SINGLE_CHOICE",
        text: "Did you know you can connect a crypto wallet?",
        description: "🔗 Web3 mode lets you connect Ethereum or Solana wallets via WalletConnect. Your wallet also boosts your verification tier!",
        required: true,
        visual: "cards",
        options: [
          { localId: "check-out", text: "Didn't know — I'll check it out!", icon: "🤯" },
          { localId: "connected", text: "Yeah, I connected mine already", icon: "👍" },
          { localId: "no-wallet", text: "Interesting but I don't have a wallet", icon: "🤔" },
          { localId: "not-interested", text: "Not interested in crypto stuff", icon: "❌" },
        ],
      },
      {
        localId: "vote-power",
        type: "SINGLE_CHOICE",
        text: "Did you know your verification level affects your vote power?",
        description: "🔐 Verified users (email, OAuth, wallet) get stronger votes in polls. Fully verified = 120% voting power!",
        required: true,
        visual: "cards",
        options: [
          { localId: "want-verify", text: "No! I want to get verified now", icon: "🤯" },
          { localId: "makes-sense", text: "Makes sense — less bot spam", icon: "👍" },
          { localId: "unfair", text: "Seems unfair to anonymous users", icon: "🤔" },
          { localId: "dont-care", text: "Don't really care about polls", icon: "😐" },
        ],
      },
      {
        localId: "veggasystem",
        type: "SINGLE_CHOICE",
        text: "Did you know we have a system bot called VeggaSystem?",
        description: "🤖 @veggasystem posts changelogs, platform updates, and creates official polls like this one!",
        required: false,
        visual: "pills",
        options: [
          { localId: "cool", text: "That's cool!", icon: "😮" },
          { localId: "seen", text: "I've seen it in the feed", icon: "👍" },
          { localId: "missed", text: "Didn't notice", icon: "🤷" },
        ],
      },
      {
        localId: "features-use",
        type: "MULTI_CHOICE",
        text: "Which of these features would you actually use?",
        description: "Check everything that sounds interesting — helps us prioritize!",
        required: true,
        visual: "cards",
        options: [
          { localId: "p2p", text: "P2P trading with friends", icon: "🎮" },
          { localId: "web3", text: "Web3 wallet login & verification", icon: "🔗" },
          { localId: "analytics", text: "REACH analytics on my profile", icon: "📊" },
          { localId: "polls", text: "Creating my own polls", icon: "🗳️" },
          { localId: "theme", text: "Dark/light theme toggle", icon: "🌙" },
          { localId: "chat", text: "Real-time chat & messaging", icon: "💬" },
        ],
      },
    ],
  },
  {
    phaseId: "trust",
    title: "Trust & Safety",
    subtitle: "Bot prevention, privacy & moderation",
    icon: "Shield",
    color: "violet",
    questions: [
      {
        localId: "trust-factors",
        type: "MULTI_CHOICE",
        text: "What builds trust for you on a social platform?",
        description: "Select the most important factors",
        required: true,
        visual: "cards",
        options: [
          { localId: "transparency", text: "Transparent algorithms", icon: "🔍" },
          { localId: "privacy", text: "Strong privacy controls", icon: "🔒" },
          { localId: "moderation", text: "Fair content moderation", icon: "⚖️" },
          { localId: "ownership", text: "You own your data", icon: "📦" },
          { localId: "community", text: "Healthy community culture", icon: "🤝" },
          { localId: "verified", text: "Verified accounts are marked", icon: "🛡️" },
        ],
      },
      {
        localId: "bot-aggression",
        type: "SLIDER",
        text: "How aggressively should we fight bots & spam?",
        description: "More aggressive = fewer bots but possible false positives",
        required: true,
        sliderConfig: { min: 1, max: 5, minLabel: "Relaxed", maxLabel: "Very strict", showValue: true },
      },
      {
        localId: "new-user-boost",
        type: "SINGLE_CHOICE",
        text: "Should new users get a temporary REACH boost?",
        description: "Help newcomers get discovered while they build their profile",
        required: true,
        visual: "pills",
        options: [
          { localId: "yes", text: "Yes — fair start", icon: "🚀" },
          { localId: "gradual", text: "Gradual unlock", icon: "📊" },
          { localId: "no", text: "No — merit only", icon: "❌" },
        ],
      },
    ],
  },
  {
    phaseId: "design",
    title: "Design & Experience",
    subtitle: "How the platform looks and feels",
    icon: "Palette",
    color: "pink",
    questions: [
      {
        localId: "analytics-display",
        type: "SINGLE_CHOICE",
        text: "How do you prefer to see your analytics?",
        description: "When checking your REACH score and engagement",
        required: true,
        visual: "cards",
        options: [
          { localId: "simple", text: "Simple numbers", icon: "📊" },
          { localId: "charts", text: "Visual charts & graphs", icon: "📈" },
          { localId: "both", text: "Both combined", icon: "🎯" },
          { localId: "minimal", text: "Keep it minimal", icon: "✨" },
        ],
      },
      {
        localId: "theme",
        type: "SINGLE_CHOICE",
        text: "Which theme do you use?",
        description: "We support dark, light, and system-auto themes",
        required: false,
        visual: "pills",
        options: [
          { localId: "dark", text: "Dark mode", icon: "🌙" },
          { localId: "light", text: "Light mode", icon: "☀️" },
          { localId: "auto", text: "Auto (system)", icon: "🔄" },
          { localId: "didnt-know", text: "Didn't know I could change it", icon: "🤷" },
        ],
      },
      {
        localId: "mobile",
        type: "SLIDER",
        text: "How important is mobile experience to you?",
        description: "Do you mainly use VeggaStare on your phone?",
        required: true,
        sliderConfig: { min: 1, max: 5, minLabel: "Desktop only", maxLabel: "Mobile first", showValue: true },
      },
    ],
  },
  {
    phaseId: "roadmap",
    title: "What's Next?",
    subtitle: "Help us prioritize upcoming features",
    icon: "Rocket",
    color: "cyan",
    questions: [
      {
        localId: "feature-rank",
        type: "MULTI_CHOICE",
        text: "Which upcoming features would you use most? (pick top 3)",
        description: "Help us decide what to build first",
        required: true,
        visual: "cards",
        options: [
          { localId: "scheduling", text: "Post scheduling", icon: "📅" },
          { localId: "video", text: "Video content support", icon: "🎬" },
          { localId: "ai", text: "AI-powered insights", icon: "🤖" },
          { localId: "mobile", text: "Native mobile app", icon: "📱" },
          { localId: "api", text: "Developer API", icon: "🔧" },
          { localId: "monetize", text: "Creator monetization", icon: "💰" },
        ],
      },
      {
        localId: "premium",
        type: "SINGLE_CHOICE",
        text: "Would you pay for premium features?",
        description: "Advanced analytics, API access, priority support",
        required: true,
        visual: "pills",
        options: [
          { localId: "yes-sub", text: "Yes, monthly", icon: "💳" },
          { localId: "yes-once", text: "Yes, one-time", icon: "💰" },
          { localId: "maybe", text: "Maybe", icon: "🤔" },
          { localId: "no", text: "Keep it free", icon: "🆓" },
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
          { localId: "low", text: "$2–5", icon: "💵" },
          { localId: "mid", text: "$5–10", icon: "💵" },
          { localId: "high", text: "$10+", icon: "💎" },
        ],
      },
      {
        localId: "focus",
        type: "SINGLE_CHOICE",
        text: "What should VeggaStare focus on most?",
        description: "Our core identity as a platform",
        required: true,
        visual: "cards",
        options: [
          { localId: "creators", text: "Creator success & tools", icon: "🎨" },
          { localId: "discovery", text: "Content discovery & feed", icon: "🔍" },
          { localId: "community", text: "Community & social", icon: "🤝" },
          { localId: "innovation", text: "Innovation & unique features", icon: "🚀" },
          { localId: "simplicity", text: "Simplicity & ease of use", icon: "✨" },
        ],
      },
    ],
  },
  {
    phaseId: "voice",
    title: "Your Voice",
    subtitle: "Open feedback — say anything!",
    icon: "MessageSquare",
    color: "orange",
    questions: [
      {
        localId: "one-change",
        type: "TEXT",
        text: "If you could change ONE thing about VeggaStare, what would it be?",
        description: "Your most important suggestion — we read every single response!",
        required: false,
      },
      {
        localId: "daily-use",
        type: "TEXT",
        text: "What would make you come back every day?",
        description: "What's the one thing that would make VeggaStare a daily habit?",
        required: false,
      },
      {
        localId: "nps",
        type: "SLIDER",
        text: "Would you recommend VeggaStare to a friend?",
        description: "Be totally honest — this helps us more than anything!",
        required: true,
        sliderConfig: { min: 1, max: 10, minLabel: "Not likely", maxLabel: "Absolutely!", showValue: true },
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
  // Clean up any existing polls with old or new title
  for (const title of ["VeggaStare — Your Feedback Shapes Everything", "VeggaStare REACH Feedback"]) {
    const existing = await prisma.advancedPoll.findFirst({ where: { title } });
    if (existing) {
      console.log(`\n🗑️  Deleting existing poll: ${existing.id} ("${title}")`);
      if (existing.conversationId) {
        await prisma.conversation.delete({ where: { id: existing.conversationId } }).catch(() => {});
      }
      await prisma.advancedPoll.delete({ where: { id: existing.id } }).catch(() => {});
    }
    const existingConv = await prisma.conversation.findFirst({ where: { title } });
    if (existingConv) {
      console.log(`\n🗑️  Deleting existing conversation: ${existingConv.id}`);
      await prisma.conversation.delete({ where: { id: existingConv.id } }).catch(() => {});
    }
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
      title: "VeggaStare — Your Feedback Shapes Everything",
      description: "Help us make VeggaStare better! Share your feedback, discover features, and help us prioritize what to build next.",
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
      title: "VeggaStare — Your Feedback Shapes Everything",
      description: POLL_DESCRIPTION,
      type: AdvancedPollType.FEEDBACK as any,
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
      content: `# � Your Feedback Shapes Everything

Hey! We want to hear from you. This feedback poll helps us:

- 🔍 Discover features you didn't know about (P2P trading, Web3 wallets, and more!)
- 📊 Understand how you use the REACH scoring system
- 🚀 Prioritize what to build next
- 💡 Get your honest thoughts and ideas

**No right or wrong answers** — just share what you think.

📊 **Take the poll above** — it takes about 5-10 minutes!

*Your response is weighted by your verification tier (up to 120% for fully verified users)*`,
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
