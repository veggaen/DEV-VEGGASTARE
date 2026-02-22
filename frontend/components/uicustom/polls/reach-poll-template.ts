/**
 * VeggaStare Feedback & Discovery Poll Template
 * 
 * A hybrid feedback poll with "Did you know?" discovery questions mixed in.
 * Designed for both new and existing users to:
 *   1. Give genuine feedback on the platform
 *   2. Discover features they didn't know existed
 *   3. Help prioritize what to build next
 * 
 * 28 questions across 8 sections:
 *   § 1 — Welcome & You (3 Qs)
 *   § 2 — First Impressions (3 Qs)
 *   § 3 — The 7 Pillars of REACH (4 Qs)
 *   § 4 — Discovery Zone — "Did You Know?" (5 Qs)
 *   § 5 — Trust & Safety (3 Qs)
 *   § 6 — Design & Experience (3 Qs)
 *   § 7 — What's Next? (4 Qs)
 *   § 8 — Your Voice (3 Qs)
 * 
 * Type: FEEDBACK (not scored — no correctAnswer fields)
 * Methodology: Hybrid feedback + feature discovery
 * 
 * Updated: 2026-02-12
 * Reflects shipped features: Velocity pillar, verification tiers, Web3 wallets,
 * BROWSERGAME-style P2P trading, theme toggle, poll weighted voting, VeggaSystem bot.
 */

import { PollBuilderData, PollSection, PollQuestion, PollType } from "./PollBuilder";

const generateId = () => Math.random().toString(36).substring(2, 15);

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
 * VeggaStare Feedback & Discovery Poll — 28 questions, 8 sections
 */
export const REACH_POLL_TEMPLATE: ReachPollTemplate = {
  title: "💬 VeggaStare — Your Feedback Shapes Everything",
  description: `Hey! Thanks for taking a few minutes to help us make VeggaStare better.

This isn't a test — there are no right or wrong answers. We genuinely want to know what you think, what you've tried, and what you'd love to see next.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 WHAT'S INSIDE:

   👋 About you & first impressions
   📊 The REACH system (our 7-pillar scoring)
   🔍 Feature discovery — "Did you know we have this?"
   🛡️ Trust, design & future priorities
   💬 Open feedback — your honest thoughts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ QUICK & FLEXIBLE:

   🟢 ~5–10 minutes
   🟢 Skip anything you want
   🟢 Partial answers still count
   🟢 Your response is weighted by verification tier

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 YOUR VOTE POWER:

   👤 Guest:          10% weight
   📧 Email:          50% weight
   🔵 Social OAuth:   70% weight
   🔗 Wallet:         90% weight
   ⭐ Fully Verified: 120% BONUS!`,
  type: "FEEDBACK",
  allowPartialSubmission: true,
  showProgressBar: true,
  randomizeQuestions: false,
  questions: [
    // ════════════════════════════════════════════════════════════════════════
    // SECTION 1: WELCOME & YOU  (3 questions)
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 1,
      type: "SINGLE_CHOICE",
      questionText: "What best describes you on VeggaStare?",
      description: "Pick the closest fit — no wrong answers!",
      required: true,
      allowImages: false,
      options: [
        { text: "🎨 I create content (posts, products, art)" },
        { text: "🔍 I browse & discover new stuff" },
        { text: "🛒 I shop & trade items" },
        { text: "🤝 I'm here to connect with people" },
        { text: "👀 Just checking things out — I'm new!" },
      ],
    },
    {
      order: 2,
      type: "SLIDER",
      questionText: "How familiar are you with VeggaStare?",
      description: "Be honest — helps us tailor the experience!",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 5,
        step: 1,
        minLabel: "Brand new",
        maxLabel: "Power user",
        stepLabels: ["Brand new", "Looked around", "Used a few features", "Regular user", "Power user"],
      },
    },
    {
      order: 3,
      type: "SINGLE_CHOICE",
      questionText: "Would you like to help build VeggaStare?",
      description: "We're always looking for passionate contributors!",
      required: false,
      allowImages: false,
      options: [
        { text: "✅ Yes, I'd love to!" },
        { text: "🤔 Maybe — tell me more" },
        { text: "❌ Not right now" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 2: FIRST IMPRESSIONS  (3 questions)
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 4,
      type: "SCALE",
      questionText: "What was your first impression of VeggaStare?",
      description: "Think back to when you first landed on the site",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 7,
        step: 1,
        minLabel: "Confused",
        maxLabel: "Impressed",
        stepLabels: ["Confused", "Meh", "Okay", "Neutral", "Interesting", "Cool!", "Impressed"],
      },
    },
    {
      order: 5,
      type: "MULTI_CHOICE",
      questionText: "What stood out to you the most? (pick up to 3)",
      description: "First things you noticed or explored",
      required: false,
      allowImages: false,
      options: [
        { text: "🎨 The design & dark theme" },
        { text: "🛒 The marketplace / products" },
        { text: "📊 The REACH analytics system" },
        { text: "🔗 Web3 / wallet integration" },
        { text: "💬 Social features (feed, chat)" },
        { text: "🗳️ The polls & voting system" },
      ],
    },
    {
      order: 6,
      type: "SINGLE_CHOICE",
      questionText: "Was it clear what VeggaStare is about?",
      description: "Could you tell what the platform does within a minute?",
      required: true,
      allowImages: false,
      options: [
        { text: "✅ Yes, totally clear" },
        { text: "🤔 Sort of — took some exploring" },
        { text: "😕 Not really — still figuring it out" },
        { text: "❓ No idea honestly" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 3: THE 7 PILLARS OF REACH  (4 questions)
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 7,
      type: "SLIDER",
      questionText: "How important is a transparent scoring system to you?",
      description: "REACH replaces hidden algorithms with 7 visible pillars: Discovery, Content, Psychology, Community, Conversion, Growth & Velocity",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 5,
        step: 1,
        minLabel: "Don't care",
        maxLabel: "Essential",
        stepLabels: ["Don't care", "Nice to have", "Somewhat", "Important", "Essential"],
      },
    },
    {
      order: 8,
      type: "RANKING",
      questionText: "Rank these REACH pillars by what matters most to YOU",
      description: "Drag to reorder — top = most important to you personally",
      required: true,
      allowImages: false,
      options: [
        { text: "👁️ Discovery — How people find your content" },
        { text: "💬 Content Quality — Engagement depth, not just likes" },
        { text: "🧠 Psychology — Social proof, trust, authority" },
        { text: "👥 Community — Loyal supporters & repeat visitors" },
        { text: "💳 Conversion — Turning views into real action" },
        { text: "📈 Growth — Organic follower increase" },
        { text: "⚡ Velocity — Live trending & momentum" },
      ],
    },
    {
      order: 9,
      type: "SINGLE_CHOICE",
      questionText: "Did you know VeggaStare already tracks Velocity (live trending)?",
      description: "⚡ We shipped the 7th pillar! It tracks real-time momentum, engagement spikes, and viral detection.",
      required: true,
      allowImages: false,
      options: [
        { text: "🤯 No way — that's awesome!" },
        { text: "😮 I heard of it but haven't seen it" },
        { text: "👍 Yeah, I've noticed it" },
        { text: "🤔 What does that even mean?" },
      ],
    },
    {
      order: 10,
      type: "MULTI_CHOICE",
      questionText: "Which Velocity features sound most useful?",
      description: "Select all that interest you — these are live or coming soon",
      required: false,
      allowImages: false,
      options: [
        { text: "📈 Live engagement graphs" },
        { text: "🔥 Trending badges on hot content" },
        { text: "🚀 Alerts when your post goes viral" },
        { text: "📉 Notifications when engagement drops" },
        { text: "⏰ Best time to post suggestions" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 4: DISCOVERY ZONE — "DID YOU KNOW?"  (5 questions)
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 11,
      type: "SINGLE_CHOICE",
      questionText: "Did you know we have BROWSERGAME-style P2P trading?",
      description: "🎮 You can trade items with other users in a retro RuneScape-style trade window — offer, confirm, complete!",
      required: true,
      allowImages: false,
      options: [
        { text: "🤯 What?! That's amazing, I need to try this" },
        { text: "😮 I saw it but haven't tried trading yet" },
        { text: "✅ Already traded with someone!" },
        { text: "🤷 Not really my thing" },
      ],
    },
    {
      order: 12,
      type: "SINGLE_CHOICE",
      questionText: "Did you know you can connect a crypto wallet?",
      description: "🔗 Web3 mode lets you connect Ethereum or Solana wallets via WalletConnect. Your wallet also boosts your verification tier!",
      required: true,
      allowImages: false,
      options: [
        { text: "🤯 Didn't know — I'll check it out!" },
        { text: "👍 Yeah, I connected mine already" },
        { text: "🤔 Interesting but I don't have a wallet" },
        { text: "❌ Not interested in crypto stuff" },
      ],
    },
    {
      order: 13,
      type: "SINGLE_CHOICE",
      questionText: "Did you know your verification level affects your vote power?",
      description: "🔐 Verified users (email, OAuth, wallet) get stronger votes in polls. Fully verified = 120% voting power!",
      required: true,
      allowImages: false,
      options: [
        { text: "🤯 No! I want to get verified now" },
        { text: "👍 Makes sense — less bot spam that way" },
        { text: "🤔 Seems unfair to anonymous users" },
        { text: "😐 Don't really care about polls" },
      ],
    },
    {
      order: 14,
      type: "SINGLE_CHOICE",
      questionText: "Did you know we have a system bot called VeggaSystem?",
      description: "🤖 @veggasystem posts changelogs, platform updates, and creates official polls like this one!",
      required: false,
      allowImages: false,
      options: [
        { text: "😮 That's cool — gives it personality" },
        { text: "👍 I've seen it in the feed" },
        { text: "🤷 Didn't notice" },
      ],
    },
    {
      order: 15,
      type: "MULTI_CHOICE",
      questionText: "Which of these features would you actually use?",
      description: "Check everything that sounds interesting — helps us prioritize!",
      required: true,
      allowImages: false,
      options: [
        { text: "🎮 P2P trading with friends" },
        { text: "🔗 Web3 wallet login & verification" },
        { text: "📊 REACH analytics on my profile" },
        { text: "🗳️ Creating my own polls" },
        { text: "🌙 Dark/light theme toggle" },
        { text: "💬 Real-time chat & messaging" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 5: TRUST & SAFETY  (3 questions)
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 16,
      type: "MULTI_CHOICE",
      questionText: "What builds trust for you on a social platform?",
      description: "Select the most important factors",
      required: true,
      allowImages: false,
      options: [
        { text: "🔍 Transparent algorithms (you see how scoring works)" },
        { text: "🔒 Strong privacy controls" },
        { text: "⚖️ Fair content moderation" },
        { text: "📦 You own your data" },
        { text: "🤝 Healthy community culture" },
        { text: "🛡️ Verified accounts are clearly marked" },
      ],
    },
    {
      order: 17,
      type: "SLIDER",
      questionText: "How aggressively should we fight bots & spam?",
      description: "More aggressive = fewer bots but possible false positives for real users",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 5,
        step: 1,
        minLabel: "Relaxed",
        maxLabel: "Very strict",
        stepLabels: ["Relaxed", "Moderate", "Balanced", "Firm", "Very strict"],
      },
    },
    {
      order: 18,
      type: "SINGLE_CHOICE",
      questionText: "Should new users get a temporary REACH boost?",
      description: "Help newcomers get discovered while they build their profile",
      required: true,
      allowImages: false,
      options: [
        { text: "🚀 Yes — everyone deserves a fair start" },
        { text: "📊 Gradual unlock — earn it over time" },
        { text: "❌ No — should be purely merit-based" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 6: DESIGN & EXPERIENCE  (3 questions)
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 19,
      type: "SINGLE_CHOICE",
      questionText: "How do you prefer to see your analytics?",
      description: "When checking your REACH score and engagement",
      required: true,
      allowImages: false,
      options: [
        { text: "📊 Simple numbers — just show me the score" },
        { text: "📈 Visual charts & graphs" },
        { text: "🎯 Both combined" },
        { text: "✨ Keep it minimal — I don't check stats" },
      ],
    },
    {
      order: 20,
      type: "SINGLE_CHOICE",
      questionText: "Which theme do you use?",
      description: "We support dark, light, and system-auto themes",
      required: false,
      allowImages: false,
      options: [
        { text: "🌙 Dark mode always" },
        { text: "☀️ Light mode always" },
        { text: "🔄 Auto (follows my system)" },
        { text: "🤷 Didn't know I could change it" },
      ],
    },
    {
      order: 21,
      type: "SLIDER",
      questionText: "How important is mobile experience to you?",
      description: "Do you mainly use VeggaStare on your phone?",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 5,
        step: 1,
        minLabel: "Desktop only",
        maxLabel: "Mobile first",
        stepLabels: ["Desktop only", "Mostly desktop", "Both equally", "Mostly mobile", "Mobile first"],
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 7: WHAT'S NEXT?  (4 questions)
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 22,
      type: "RANKING",
      questionText: "Rank these upcoming features by priority",
      description: "What should we build first? Drag to reorder — top = most wanted",
      required: true,
      allowImages: false,
      options: [
        { text: "📅 Post scheduling & optimal timing" },
        { text: "🎬 Video content support" },
        { text: "🤖 AI-powered content insights" },
        { text: "📱 Native mobile app" },
        { text: "🔧 Developer API for integrations" },
        { text: "💰 Creator monetization tools" },
      ],
    },
    {
      order: 23,
      type: "SINGLE_CHOICE",
      questionText: "Would you pay for premium features?",
      description: "Things like advanced analytics, API access, priority support",
      required: true,
      allowImages: false,
      options: [
        { text: "💳 Yes, monthly subscription" },
        { text: "💰 Yes, one-time purchase" },
        { text: "🤔 Maybe — depends on the features" },
        { text: "🆓 No — keep it free" },
      ],
    },
    {
      order: 24,
      type: "SINGLE_CHOICE",
      questionText: "What would you pay monthly?",
      description: "If premium analytics were available",
      required: false,
      allowImages: false,
      options: [
        { text: "🆓 Keep it free" },
        { text: "💵 $2–5/month" },
        { text: "💵💵 $5–10/month" },
        { text: "💎 $10+/month" },
      ],
    },
    {
      order: 25,
      type: "SINGLE_CHOICE",
      questionText: "What should VeggaStare focus on most?",
      description: "Our core identity as a platform",
      required: true,
      allowImages: false,
      options: [
        { text: "🎨 Creator success & tools" },
        { text: "🔍 Content discovery & feed" },
        { text: "🤝 Community & social features" },
        { text: "🚀 Innovation & unique features" },
        { text: "✨ Simplicity & ease of use" },
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 8: YOUR VOICE  (3 questions)
    // ════════════════════════════════════════════════════════════════════════
    {
      order: 26,
      type: "TEXT",
      questionText: "If you could change ONE thing about VeggaStare, what would it be?",
      description: "Your most important suggestion — we read every single response!",
      required: false,
      allowImages: false,
      options: [],
    },
    {
      order: 27,
      type: "TEXT",
      questionText: "What would make you come back every day?",
      description: "What's the one thing that would make VeggaStare a daily habit?",
      required: false,
      allowImages: false,
      options: [],
    },
    {
      order: 28,
      type: "SCALE",
      questionText: "Would you recommend VeggaStare to a friend?",
      description: "Be totally honest — this helps us more than anything!",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        minLabel: "Not likely",
        maxLabel: "Absolutely!",
        stepLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
    },
  ],
};

/**
 * Generates the REACH poll template with fresh IDs and proper section mapping.
 */
export function generateREACHTemplate(): PollBuilderData {
  const template = REACH_POLL_TEMPLATE;

  // 8 sections matching the template structure
  const sectionDefs: Array<{ key: string; title: string; icon: string; description: string; order: number }> = [
    { key: "welcome",       title: "Welcome & You",       icon: "👋", description: "Tell us about yourself",                            order: 1 },
    { key: "impressions",   title: "First Impressions",    icon: "✨", description: "Your experience landing on VeggaStare",             order: 2 },
    { key: "reach-pillars", title: "The 7 Pillars",        icon: "📊", description: "Rate the REACH scoring system",                     order: 3 },
    { key: "discovery",     title: "Discovery Zone",       icon: "🔍", description: "Did you know we have these features?",              order: 4 },
    { key: "trust",         title: "Trust & Safety",       icon: "🛡️", description: "Bot prevention, privacy & moderation",              order: 5 },
    { key: "design",        title: "Design & Experience",  icon: "🎨", description: "How the platform looks and feels",                  order: 6 },
    { key: "roadmap",       title: "What's Next?",         icon: "🚀", description: "Help us prioritize upcoming features",              order: 7 },
    { key: "voice",         title: "Your Voice",           icon: "💬", description: "Open feedback — say anything!",                     order: 8 },
  ];

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

  // Map question order → section (ranges must match actual question groupings above)
  const getQuestionSection = (order: number): string | null => {
    if (order >= 1  && order <= 3)  return sectionIdMap["welcome"];
    if (order >= 4  && order <= 6)  return sectionIdMap["impressions"];
    if (order >= 7  && order <= 10) return sectionIdMap["reach-pillars"];
    if (order >= 11 && order <= 15) return sectionIdMap["discovery"];
    if (order >= 16 && order <= 18) return sectionIdMap["trust"];
    if (order >= 19 && order <= 21) return sectionIdMap["design"];
    if (order >= 22 && order <= 25) return sectionIdMap["roadmap"];
    if (order >= 26 && order <= 28) return sectionIdMap["voice"];
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

  // Build section flows
  const sectionsWithFlow: PollSection[] = sections.map(s => {
    const sectionQuestions = questions.filter(q => q.sectionId === s.id);
    return {
      ...s,
      flow: sectionQuestions.map(q => ({ type: 'QUESTION' as const, id: q.id })),
    };
  });

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
