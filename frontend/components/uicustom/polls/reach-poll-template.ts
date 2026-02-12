/**
 * REACH System Comprehensive Audit - Poll Template
 * 
 * This is a condensed version of the full 93-question REACH audit poll.
 * It includes representative questions from each section to demonstrate
 * all question types and poll features.
 * 
 * For the full poll, see: scripts/seed-reach-poll.ts
 */

import { PollBuilderData, PollSection, PollQuestion, PollType } from "./PollBuilder";

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// Template question type - options without IDs, no question ids
interface TemplateQuestion {
  order?: number;
  type: PollQuestion['type'];
  questionText: string;
  description?: string;
  required: boolean;
  allowImages: boolean;
  options: Array<{ text: string; description?: string; value?: number; imageUrl?: string }>;
  sliderConfig?: PollQuestion['sliderConfig'];
}

// Template type - no flow, sections, or IDs needed (generated at runtime)
interface ReachPollTemplate {
  title: string;
  description: string;
  type: string;
  allowPartialSubmission: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  questions: TemplateQuestion[];
}

/**
 * Full REACH System Audit Poll Template
 * ~30 questions across 10 key sections
 */
export const REACH_POLL_TEMPLATE: ReachPollTemplate = {
  title: "🎯 VeggaStare REACH System Comprehensive Audit",
  description: `🚀 Welcome to the VeggaStare REACH System Comprehensive Audit!

Your voice shapes the future of how we measure TRUE social impact. This isn't about IF the 7 Pillars work — it's about HOW to make each one BETTER!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 WHAT YOU'LL HELP US IMPROVE:

   📈 The 7 Pillars — Rate & fine-tune each pillar's weight
   🔐 Verification Tiers — How should auth affect your voice?
   🎨 UI/UX Design — Charts, themes, animations, layouts
   🚀 Feature Priorities — What should we build NEXT?
   🛡️ Anti-Gaming — Bot prevention & view integrity
   ⚡ Velocity/Pulse — Live drops & realtime momentum
   👑 Owner Power — Should admins have boosted votes?
   🌐 Web3 Features — Wallets, NFTs, crypto payments
   💡 Open Innovation — YOUR wildest ideas!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ YOU DON'T NEED TO COMPLETE EVERYTHING!

   🟢 Answer what interests you most
   🟢 Skip sections you don't care about
   🟢 Partial completion still counts!
   🟢 Come back anytime to finish

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 YOUR VOTE POWER (based on verification):

   👤 Anonymous:      10% weight
   📧 Email:          50% weight
   🔵 Social OAuth:   70% weight
   🔗 Wallet:         90% weight
   ⭐ Fully Verified: 120% BONUS!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️ Time: 15-40 min (depending on how deep you go)
❓ Questions: 30+ across all sections
🎯 Goal: Shape VeggaStare's future TOGETHER!`,
  type: "REACH_ASSESSMENT",
  allowPartialSubmission: true,
  showProgressBar: true,
  randomizeQuestions: false,
  questions: [
    // ════════════════════════════════════════════════════════════════════════
    // SECTION 1: USER CONTEXT
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 1,
      type: "SINGLE_CHOICE",
      questionText: "How would you describe your primary role on VeggaStare?",
      description: "Your perspective shapes how we weight different features! 🌟",
      required: true,
      allowImages: false,
      options: [
        { text: "🎨 Content Creator" },
        { text: "🔍 Content Explorer" },
        { text: "📚 Community Curator" },
        { text: "🏪 Marketplace Seller" },
        { text: "🛒 Smart Shopper" },
        { text: "💎 Collector & Trader" },
        { text: "🤝 Networker & Connector" },
        { text: "📢 Influencer & Advocate" },
        { text: "🚀 Builder & Contributor" },
        { text: "👀 Curious Observer" },
      ],
    },
    {
      order: 2,
      type: "SLIDER",
      questionText: "How familiar are you with VeggaStare's Reach metrics?",
      description: "Rate your understanding of the 7-pillar system",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 7,
        step: 1,
        minLabel: "Never seen it",
        maxLabel: "Deep expertise",
        stepLabels: ["Never seen", "Noticed it", "Basics", "Use regularly", "Know well", "Expert", "Deep expertise"],
      },
    },
    {
      order: 3,
      type: "MULTI_CHOICE",
      questionText: "Which verification methods have you completed?",
      description: "Select all that apply — more = stronger identity 💪",
      required: false,
      allowImages: false,
      options: [
        { text: "📧 Email verified" },
        { text: "🔵 Google OAuth" },
        { text: "⚫ GitHub OAuth" },
        { text: "🟣 Discord OAuth" },
        { text: "🔗 Web3 Wallet connected" },
        { text: "💳 Payment card on file" },
        { text: "🪙 Made a crypto purchase" },
        { text: "📱 Phone number verified" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 2: THE 6 PILLARS
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 4,
      type: "SLIDER",
      questionText: "PILLAR 1: Foundation & Discovery (👁️ 18%)",
      description: "SEO, platform discoverability, SSR pages. How valuable is this?",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 7,
        step: 1,
        minLabel: "Useless",
        maxLabel: "Essential",
        stepLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
      },
    },
    {
      order: 5,
      type: "SLIDER",
      questionText: "PILLAR 2: Killer Content (💬 25%)",
      description: "Relevance, authenticity, surprise factor. How valuable?",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 7,
        step: 1,
        minLabel: "Useless",
        maxLabel: "Essential",
        stepLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
      },
    },
    {
      order: 6,
      type: "RANKING",
      questionText: "Rank these content quality signals by importance",
      description: "Drag to reorder — top = most important 🏆",
      required: true,
      allowImages: false,
      options: [
        { text: "💬 Comments received" },
        { text: "🔖 Saves/Bookmarks" },
        { text: "📤 Shares" },
        { text: "⏱️ Time spent viewing (dwell)" },
        { text: "↩️ Reply thread depth" },
        { text: "💳 Purchase conversions" },
      ],
    },
    {
      order: 7,
      type: "SLIDER",
      questionText: "PILLAR 3: Psychological Drivers (🧠 18%)",
      description: "Social Proof, Scarcity, Authority, Liking, Consistency, Reciprocity",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 7,
        step: 1,
        minLabel: "Useless",
        maxLabel: "Essential",
        stepLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
      },
    },
    {
      order: 8,
      type: "MULTI_CHOICE",
      questionText: "Which psychological triggers work best on YOU?",
      description: "Be honest — helps us tune the UX! Select up to 3",
      required: true,
      allowImages: false,
      options: [
        { text: "👥 Social Proof (others bought it)" },
        { text: "⏳ Scarcity (only X left!)" },
        { text: "🏆 Authority (expert recommends)" },
        { text: "❤️ Liking (I trust the creator)" },
        { text: "🔄 Consistency (I always engage)" },
        { text: "🤝 Reciprocity (they helped me)" },
      ],
    },
    {
      order: 9,
      type: "SLIDER",
      questionText: "PILLAR 4: Community & Belonging (👥 14%)",
      description: "Real relationships, fan groups, retention. How valuable?",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 7,
        step: 1,
        minLabel: "Useless",
        maxLabel: "Essential",
        stepLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
      },
    },
    {
      order: 10,
      type: "SINGLE_CHOICE",
      questionText: "Should paid promotion affect organic Reach?",
      description: "If someone boosts a post, should it count toward their True Reach?",
      required: true,
      allowImages: false,
      options: [
        { text: "✅ Yes, fully count it" },
        { text: "⚖️ Yes, but reduced weight (0.5x)" },
        { text: "📊 Separate paid vs organic scores" },
        { text: "❌ No, only count organic" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 3: THE 7TH PILLAR - VELOCITY
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 11,
      type: "SINGLE_CHOICE",
      questionText: "Should we add a 7th pillar: 'Velocity / Realtime Pulse'?",
      description: "⚡ Live momentum tracking, viral detection, scheduled 'Pulse' events",
      required: true,
      allowImages: false,
      options: [
        { text: "🚀 YES — Definitely add it!" },
        { text: "⚙️ Yes, but make it optional" },
        { text: "🤔 Maybe, need more details" },
        { text: "❌ No, 6 pillars is enough" },
      ],
    },
    {
      order: 12,
      type: "RANKING",
      questionText: "Rank these Velocity sub-metrics by importance",
      description: "What should we track in realtime? Drag to reorder 🏆",
      required: true,
      allowImages: false,
      options: [
        { text: "📈 Engagement rate per hour" },
        { text: "🔥 Viral coefficient (shares → new users)" },
        { text: "⏰ Peak timing analysis" },
        { text: "🌐 Cross-network mentions" },
        { text: "📊 Trend detection alerts" },
        { text: "📉 Momentum graph visualization" },
      ],
    },
    {
      order: 13,
      type: "MULTI_CHOICE",
      questionText: "Which PULSE event features excite you most?",
      description: "Live drops with countdowns, chat, and rewards!",
      required: true,
      allowImages: false,
      options: [
        { text: "⏰ Countdown timers to drops" },
        { text: "🔥 Live sales counter" },
        { text: "💬 Live chat during events" },
        { text: "🔗 Referral bonus for sharing" },
        { text: "🏆 NFT attendance badges" },
        { text: "🎁 Mystery drops/surprises" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 4: VERIFICATION TIERS
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 14,
      type: "SLIDER",
      questionText: "Should VERIFIED users get a Reach boost?",
      description: "More verification = more voting power?",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 0,
        maxValue: 10,
        step: 1,
        minLabel: "No boost",
        maxLabel: "Major advantage",
        stepLabels: [],
      },
    },
    {
      order: 15,
      type: "SINGLE_CHOICE",
      questionText: "What should GUEST (non-authenticated) vote weight be?",
      description: "Currently: 10% weight",
      required: true,
      allowImages: false,
      options: [
        { text: "0% (no voice)" },
        { text: "5% (minimal)" },
        { text: "10% (current)" },
        { text: "25% (fair)" },
        { text: "50% (equal-ish)" },
      ],
    },
    {
      order: 16,
      type: "RANKING",
      questionText: "Rank verification methods by TRUST level",
      description: "What gives YOU the most confidence in a user's identity?",
      required: true,
      allowImages: false,
      options: [
        { text: "📧 Email only" },
        { text: "🔵 Google/Social OAuth" },
        { text: "📱 Phone number verified" },
        { text: "💳 Payment card on file" },
        { text: "🔗 Crypto wallet signature" },
        { text: "✅ Multi-method (2+)" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 5: ANTI-GAMING & VIEW INTEGRITY
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 17,
      type: "SINGLE_CHOICE",
      questionText: "How should bad actors lose their Reach?",
      description: "When users violate guidelines, how fast should Reach decay?",
      required: true,
      allowImages: false,
      options: [
        { text: "🚫 Instantly to zero" },
        { text: "📉 Gradual decay over weeks" },
        { text: "⚠️ Only after multiple warnings" },
        { text: "🗳️ Community decides penalty" },
        { text: "⚖️ Proportional to offense severity" },
      ],
    },
    {
      order: 18,
      type: "SLIDER",
      questionText: "How aggressive should BOT DETECTION be?",
      description: "Trade-off: More aggressive = fewer bots but more false positives",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 7,
        step: 1,
        minLabel: "Very relaxed",
        maxLabel: "Very aggressive",
        stepLabels: ["Very relaxed", "Relaxed", "Moderate", "Balanced", "Firm", "Strict", "Very aggressive"],
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 6: UI/UX PREFERENCES
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 19,
      type: "SINGLE_CHOICE",
      questionText: "How should Reach be DISPLAYED?",
      description: "How do you want to see your reach score?",
      required: true,
      allowImages: false,
      options: [
        { text: "📊 Simple number (e.g., 847)" },
        { text: "📈 Number + trend arrow" },
        { text: "🏆 Rank badge (Top 10%, etc.)" },
        { text: "🌈 Colorful level system" },
        { text: "🕸️ Radar/spider chart" },
        { text: "💪 All of the above" },
      ],
    },
    {
      order: 20,
      type: "SINGLE_CHOICE",
      questionText: "What color theme do you prefer?",
      description: "For data visualizations and charts",
      required: false,
      allowImages: false,
      options: [
        { text: "🌈 Vibrant gradients" },
        { text: "🔵 Professional blues" },
        { text: "🌿 Nature greens" },
        { text: "🌙 Dark mode accents" },
        { text: "⚪ Clean minimalist" },
        { text: "🎨 Let me customize" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 7: WEB3 FEATURES
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 21,
      type: "SLIDER",
      questionText: "How important are WEB3 features to you?",
      description: "NFTs, crypto payments, wallet login, etc.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 7,
        step: 1,
        minLabel: "Not at all",
        maxLabel: "Essential",
        stepLabels: ["Not at all", "Curious", "Nice to have", "Neutral", "Important", "Very important", "Essential"],
      },
    },
    {
      order: 22,
      type: "MULTI_CHOICE",
      questionText: "Which Web3 features EXCITE you most?",
      description: "Select all that interest you",
      required: false,
      allowImages: false,
      options: [
        { text: "🖼️ NFT Profile Pictures" },
        { text: "🔒 Token-Gated Content" },
        { text: "🏆 Achievement NFT Badges" },
        { text: "💸 Crypto Tipping" },
        { text: "🗳️ DAO Governance Voting" },
        { text: "⛓️ On-Chain Reputation" },
        { text: "❌ None of these" },
      ],
    },
    {
      order: 23,
      type: "SINGLE_CHOICE",
      questionText: "Which blockchain should be PRIMARY?",
      description: "For NFTs, payments, and identity",
      required: false,
      allowImages: false,
      options: [
        { text: "Ξ Ethereum (most trusted)" },
        { text: "◎ Solana (fast & cheap)" },
        { text: "🔷 Polygon (Eth L2)" },
        { text: "🔵 Base (Coinbase L2)" },
        { text: "🌐 Multi-chain support" },
        { text: "🤷 I don't care" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 8: FEATURE PRIORITIES
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 24,
      type: "RANKING",
      questionText: "Rank these features by PRIORITY",
      description: "What should we build NEXT? Drag to reorder 🏆",
      required: true,
      allowImages: false,
      options: [
        { text: "⚡ Realtime Velocity Dashboard" },
        { text: "📅 Scheduled Posts + Timing" },
        { text: "🎬 Video Content Support" },
        { text: "🤖 AI-Powered Insights" },
        { text: "📱 Native Mobile App" },
        { text: "🛒 Digital Marketplace" },
      ],
    },
    {
      order: 25,
      type: "SLIDER",
      questionText: "How important is a MOBILE APP?",
      description: "Native iOS/Android app",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 7,
        step: 1,
        minLabel: "Not at all",
        maxLabel: "Won't use without it",
        stepLabels: ["Not at all", "Nice to have", "Somewhat", "Important", "Very important", "Critical", "Won't use without"],
      },
    },
    {
      order: 26,
      type: "SINGLE_CHOICE",
      questionText: "Would you PAY for premium features?",
      description: "Advanced analytics, API access, priority support",
      required: true,
      allowImages: false,
      options: [
        { text: "💳 Yes, monthly subscription" },
        { text: "💰 Yes, one-time purchase" },
        { text: "₿ Yes, but only crypto" },
        { text: "🆓 No, should be free" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 9: COMMUNITY & SOCIAL
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 27,
      type: "SLIDER",
      questionText: "How important is COMMUNITY to you on VeggaStare?",
      description: "A = Just want metrics, G = Community is everything",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 7,
        step: 1,
        minLabel: "Don't care",
        maxLabel: "Everything",
        stepLabels: ["Don't care", "Nice to have", "Somewhat", "Important", "Very important", "Essential", "Everything"],
      },
    },
    {
      order: 28,
      type: "SINGLE_CHOICE",
      questionText: "What culture do you want VeggaStare to have?",
      description: "The vibe of the platform",
      required: true,
      allowImages: false,
      options: [
        { text: "🚀 Hustle/growth culture" },
        { text: "🧘 Mindful/intentional" },
        { text: "🎉 Fun/playful" },
        { text: "📚 Educational/serious" },
        { text: "🤝 Supportive/wholesome" },
        { text: "🎯 Professional/business" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 10: OPEN INNOVATION
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 29,
      type: "TEXT",
      questionText: "What's the ONE feature that would make VeggaStare perfect?",
      description: "Your killer feature request — we read every response! 💡",
      required: false,
      allowImages: true,
      options: [],
    },
    {
      order: 30,
      type: "SCALE",
      questionText: "How excited are you about VeggaStare's future?",
      description: "Be honest! Your enthusiasm helps us gauge momentum.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        minValue: 1,
        maxValue: 10,
        step: 1,
        minLabel: "Meh",
        maxLabel: "Can't wait!",
        stepLabels: [],
      },
    },
  ],
};

/**
 * Generates the REACH poll template with fresh IDs
 */
export function generateREACHTemplate(): PollBuilderData {
  const template = REACH_POLL_TEMPLATE;
  
  // Define sections with stable keys that map to generated IDs
  const sectionDefs: Array<{ key: string; title: string; icon: string; description: string; order: number }> = [
    { key: "user-context", title: "User Context", icon: "👤", description: "Understanding your perspective and platform usage", order: 1 },
    { key: "six-pillars", title: "The 6 Pillars", icon: "📊", description: "Rate and tune the core REACH pillars", order: 2 },
    { key: "velocity", title: "The 7th Pillar - Velocity", icon: "⚡", description: "Momentum and realtime engagement metrics", order: 3 },
    { key: "verification", title: "Verification Tiers", icon: "🔐", description: "How authentication affects your influence", order: 4 },
    { key: "anti-gaming", title: "Anti-Gaming & View Integrity", icon: "🛡️", description: "Bot prevention and authentic engagement", order: 5 },
    { key: "ui-ux", title: "UI/UX Preferences", icon: "🎨", description: "Charts, themes, animations, and layouts", order: 6 },
    { key: "web3", title: "Web3 Features", icon: "🌐", description: "Wallets, NFTs, and crypto integrations", order: 7 },
    { key: "features", title: "Feature Priorities", icon: "🚀", description: "What should we build next?", order: 8 },
    { key: "community", title: "Community & Social", icon: "🤝", description: "Social features and community dynamics", order: 9 },
    { key: "innovation", title: "Open Innovation", icon: "💡", description: "Your wildest ideas and feedback", order: 10 },
  ];

  // Generate section IDs and create mapping
  const sectionIdMap: Record<string, string> = {};
  const sections = sectionDefs.map((s) => {
    const id = generateId();
    sectionIdMap[s.key] = id;
    return {
      id,
      title: s.title,
      description: s.description,
      order: s.order,
      parentSectionId: null,
      isCollapsed: false,
      icon: s.icon,
      flow: [] as Array<{ type: 'QUESTION' | 'SECTION'; id: string }>,
    };
  });

  // Map question order ranges to section keys
  const getQuestionSection = (order: number): string | null => {
    if (order >= 1 && order <= 4) return sectionIdMap["user-context"];
    if (order >= 5 && order <= 10) return sectionIdMap["six-pillars"];
    if (order >= 11 && order <= 12) return sectionIdMap["velocity"];
    if (order >= 13 && order <= 14) return sectionIdMap["verification"];
    if (order >= 15 && order <= 16) return sectionIdMap["anti-gaming"];
    if (order >= 17 && order <= 18) return sectionIdMap["ui-ux"];
    if (order >= 19 && order <= 22) return sectionIdMap["web3"];
    if (order >= 23 && order <= 26) return sectionIdMap["features"];
    if (order >= 27 && order <= 28) return sectionIdMap["community"];
    if (order >= 29) return sectionIdMap["innovation"];
    return null;
  };

  // Generate questions with IDs
  const questions = template.questions.map((q, i) => ({
    ...q,
    id: generateId(),
    order: i + 1,
    sectionId: getQuestionSection(i + 1),
    options: q.options.map(o => ({
      ...o,
      id: generateId(),
    })),
  }));

  // Build section flows - map each section to its questions
  const sectionsWithFlow: PollSection[] = sections.map(s => {
    const sectionQuestions = questions.filter(q => q.sectionId === s.id);
    return {
      ...s,
      flow: sectionQuestions.map(q => ({ type: 'QUESTION' as const, id: q.id })),
    };
  });

  // Top-level flow contains sections in order
  const topLevelFlow = sectionsWithFlow.map(s => ({ type: 'SECTION' as const, id: s.id }));

  return {
    title: template.title,
    description: template.description,
    type: template.type as PollType,
    allowPartialSubmission: template.allowPartialSubmission,
    showProgressBar: template.showProgressBar,
    randomizeQuestions: template.randomizeQuestions,
    sections: sectionsWithFlow,
    questions,
    flow: topLevelFlow,
  };
}
