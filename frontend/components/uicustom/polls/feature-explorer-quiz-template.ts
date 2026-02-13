/**
 * Feature Explorer Quiz — Test your VeggaStare knowledge!
 * 
 * A scored QUIZ that tests knowledge of real platform features.
 * Different question type combinations from the Verify Demo.
 * Every question has correctAnswer, explanation, wrongExplanation, deepExplanation.
 * 
 * 5 SECTIONS with 18 QUESTIONS:
 * 
 * Section 1: Platform Basics (3 questions)
 * - What REACH stands for, how many pillars, verification tiers
 * 
 * Section 2: Features & Systems (4 questions)
 * - Trading system, VeggaSystem bot, Web3 mode, poll weighted voting
 * 
 * Section 3: Scoring & Trust (4 questions)
 * - Verification multipliers, anti-gaming, pillar ranking, vote weight
 * 
 * Section 4: Design & UX (3 questions)
 * - Theme options, shape match challenge, color identification
 * 
 * Section 5: Deep Knowledge (4 questions)
 * - Velocity pillar, TRICK question, free text, final confidence scale
 * 
 * UNIQUE FEATURE: "Discovery Bonus" — questions where learning the answer
 * teaches you about a feature you might not have known about. The explanation
 * text doubles as a feature showcase.
 * 
 * Updated: 2026-02-12
 */

import type { PollBuilderData, PollSection, PollQuestion, PollType } from "./PollBuilder";

const generateId = () => Math.random().toString(36).substring(2, 15);

interface TemplateQuestion {
  order?: number;
  type: PollQuestion["type"];
  questionText: string;
  description?: string;
  required: boolean;
  allowImages: boolean;
  options: Array<{ text: string; description?: string; value?: number }>;
  sliderConfig?: PollQuestion["sliderConfig"];
  shapeMatchPreset?: PollQuestion["shapeMatchPreset"];
  trickQuestion?: boolean;
  deepExplanation?: string;
}

export const FEATURE_EXPLORER_QUIZ_TEMPLATE: {
  title: string;
  description: string;
  type: string;
  allowPartialSubmission: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  questions: TemplateQuestion[];
} = {
  title: "🔍 Feature Explorer Quiz — How Well Do You Know VeggaStare?",
  description: `Test your knowledge of VeggaStare's features!

Every answer teaches you something new about the platform — even if you get it wrong.

**5 Sections with 18 Questions:**

🏠 **Section 1: Platform Basics** — REACH, pillars, verification  
⚙️ **Section 2: Features & Systems** — Trading, bots, Web3, polls  
🛡️ **Section 3: Scoring & Trust** — Multipliers, anti-gaming, weights  
🎨 **Section 4: Design & UX** — Themes, shapes, colors  
🧠 **Section 5: Deep Knowledge** — Velocity, tricks, final challenge

🎁 **Discovery Bonus:** Wrong answers reveal features you didn't know about!`,
  type: "QUIZ",
  allowPartialSubmission: true,
  showProgressBar: true,
  randomizeQuestions: false,
  questions: [
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: PLATFORM BASICS (3 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 1,
      type: "SINGLE_CHOICE",
      questionText: "How many pillars make up VeggaStare's REACH scoring system?",
      description: "REACH measures your true social influence through multiple dimensions.",
      required: true,
      allowImages: false,
      options: [
        { text: "5 pillars" },
        { text: "6 pillars" },
        { text: "7 pillars" },
        { text: "10 pillars" },
      ],
    },
    {
      order: 2,
      type: "MULTI_CHOICE",
      questionText: "Which of these are REAL verification methods on VeggaStare?",
      description: "Select ALL that actually exist. Discovery bonus: learn what verification gets you!",
      required: true,
      allowImages: false,
      options: [
        { text: "📧 Email verification" },
        { text: "🔵 Google/GitHub/Discord OAuth" },
        { text: "🔗 Crypto wallet connection" },
        { text: "📱 Phone number SMS" },
        { text: "🪪 Government ID scan" },
        { text: "🧬 DNA verification" },
      ],
    },
    {
      order: 3,
      type: "SCALE",
      questionText: "On VeggaStare, what voting power does a FULLY VERIFIED user get?",
      description: "Slide to the percentage. Hint: it's a bonus above 100%! Answer in units of 10.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 50,
        max: 200,
        step: 10,
        minLabel: "50%",
        maxLabel: "200%",
        showValue: true,
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: FEATURES & SYSTEMS (4 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 4,
      type: "SINGLE_CHOICE",
      questionText: "VeggaStare has a retro-style trading system inspired by which game?",
      description: "🎮 Discovery bonus: did you know you can trade items P2P on VeggaStare?",
      required: true,
      allowImages: false,
      options: [
        { text: "🗡️ World of Warcraft" },
        { text: "⚔️ Old School RuneScape (OSRS)" },
        { text: "🏰 Final Fantasy XIV" },
        { text: "🎯 Diablo IV" },
      ],
    },
    {
      order: 5,
      type: "SINGLE_CHOICE",
      questionText: "What is VeggaSystem?",
      description: "🤖 Discovery bonus: find out who posts changelogs and creates official polls!",
      required: true,
      allowImages: false,
      options: [
        { text: "A programming language" },
        { text: "The official system bot account (@veggasystem)" },
        { text: "A third-party analytics tool" },
        { text: "The name of the backend server" },
      ],
    },
    {
      order: 6,
      type: "MULTI_CHOICE",
      questionText: "What can you do with Web3 mode on VeggaStare?",
      description: "Select ALL that apply. Discovery bonus: explore our Web3 integration!",
      required: true,
      allowImages: false,
      options: [
        { text: "🔗 Connect Ethereum wallets" },
        { text: "◎ Connect Solana wallets" },
        { text: "🔐 Boost your verification tier" },
        { text: "🖼️ Mint NFT profile pictures" },
        { text: "🗳️ Vote in DAO governance" },
      ],
    },
    {
      order: 7,
      type: "SINGLE_CHOICE",
      questionText: "What happens to your vote in a poll based on your verification level?",
      description: "Our weighted voting system prevents bot manipulation.",
      required: true,
      allowImages: false,
      options: [
        { text: "Everyone's vote counts equally" },
        { text: "Unverified votes are completely ignored" },
        { text: "Votes are weighted by verification tier (10% to 120%)" },
        { text: "Only admin votes count" },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: SCORING & TRUST (4 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 8,
      type: "SLIDER",
      questionText: "What is the MINIMUM time (in seconds) before you can submit your first poll answer?",
      description: "VeggaStare has anti-gaming measures to prevent speed-bots. How fast is too fast?",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 0,
        max: 10,
        step: 1,
        minLabel: "0 sec",
        maxLabel: "10 sec",
        showValue: true,
      },
    },
    {
      order: 9,
      type: "RANKING",
      questionText: "Rank these verification tiers from LOWEST to HIGHEST vote power",
      description: "Put the weakest voting power at top, strongest at bottom.",
      required: true,
      allowImages: false,
      options: [
        { text: "👤 Anonymous / Guest" },
        { text: "📧 Email verified" },
        { text: "🔵 Social OAuth (Google/GitHub)" },
        { text: "🔗 Wallet connected" },
        { text: "⭐ Fully verified (multi-method)" },
      ],
    },
    {
      order: 10,
      type: "SINGLE_CHOICE",
      questionText: "Which anti-gaming feature does VeggaStare use to detect bot voters?",
      description: "Multiple protection layers keep polls fair.",
      required: true,
      allowImages: false,
      trickQuestion: true,
      options: [
        { text: "CAPTCHA on every poll" },
        { text: "IP hashing + speed checks + straightline detection" },
        { text: "Require payment to vote" },
        { text: "Manual admin review of every vote" },
      ],
    },
    {
      order: 11,
      type: "SLIDER",
      questionText: "How many answers per minute does VeggaStare allow before flagging as suspicious?",
      description: "The anti-gaming system has a maximum speed limit.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 5,
        max: 60,
        step: 5,
        minLabel: "5/min",
        maxLabel: "60/min",
        showValue: true,
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: DESIGN & UX (3 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 12,
      type: "MULTI_CHOICE",
      questionText: "Which theme modes does VeggaStare support?",
      description: "Select ALL available theme options.",
      required: true,
      allowImages: false,
      options: [
        { text: "🌙 Dark mode" },
        { text: "☀️ Light mode" },
        { text: "🔄 System auto-detect" },
        { text: "🌈 Rainbow mode" },
        { text: "👾 Retro CRT mode" },
      ],
    },
    {
      order: 13,
      type: "SHAPE_MATCH",
      questionText: "Match the shapes to their outlines!",
      description: "Drag each colored shape into its matching outline. This is a real poll question type!",
      required: true,
      allowImages: false,
      options: [],
    },
    {
      order: 14,
      type: "SINGLE_CHOICE",
      questionText: "Which color scheme does VeggaStare primarily use in its UI?",
      description: "Think about the accent colors you see most often.",
      required: true,
      allowImages: false,
      options: [
        { text: "🔴 Red & Orange warmth" },
        { text: "🟢 Emerald green & dark zinc" },
        { text: "🔵 Blue & white corporate" },
        { text: "🟡 Yellow & gold sunshine" },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: DEEP KNOWLEDGE (4 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 15,
      type: "MULTI_CHOICE",
      questionText: "What does the Velocity pillar track?",
      description: "⚡ The 7th pillar was added to measure real-time momentum.",
      required: true,
      allowImages: false,
      options: [
        { text: "📈 Engagement rate per hour" },
        { text: "🔥 Viral coefficient (shares → new users)" },
        { text: "💰 Revenue generated" },
        { text: "📊 Momentum delta (1h and 24h)" },
        { text: "🏋️ How heavy your content is in megabytes" },
      ],
    },
    {
      order: 16,
      type: "SINGLE_CHOICE",
      questionText: "How many question types does VeggaStare's poll system support?",
      description: "🎭 Careful — this one's tricky! Count ALL types including the exotic ones.",
      required: true,
      allowImages: false,
      trickQuestion: true,
      options: [
        { text: "5 types (choice, slider, text, scale, ranking)" },
        { text: "7 types (add shape match & multi-choice)" },
        { text: "9 types in the builder" },
        { text: "11 types in the database schema" },
      ],
    },
    {
      order: 17,
      type: "TEXT",
      questionText: "What is the username of VeggaStare's official system bot?",
      description: "Type the exact username (without the @ symbol).",
      required: true,
      allowImages: false,
      options: [],
    },
    {
      order: 18,
      type: "SCALE",
      questionText: "How confident are you in your VeggaStare knowledge now?",
      description: "After completing this quiz, rate your confidence! This one's just for fun — any answer is correct.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        minLabel: "Still learning",
        maxLabel: "Expert!",
        showValue: true,
      },
    },
  ],
};

/**
 * Generates the Feature Explorer Quiz template with correct answers, 
 * explanations, and "Discovery Bonus" learning content.
 */
export function generateFeatureExplorerTemplate(): PollBuilderData {
  const template = FEATURE_EXPLORER_QUIZ_TEMPLATE;

  const section1Id = generateId();
  const section2Id = generateId();
  const section3Id = generateId();
  const section4Id = generateId();
  const section5Id = generateId();

  const sections: PollSection[] = [
    {
      id: section1Id,
      title: "🏠 Platform Basics",
      description: "REACH, pillars, verification tiers",
      isCollapsed: false,
      icon: "🏠",
      flow: [],
    },
    {
      id: section2Id,
      title: "⚙️ Features & Systems",
      description: "Trading, bots, Web3, polls",
      isCollapsed: false,
      icon: "⚙️",
      flow: [],
    },
    {
      id: section3Id,
      title: "🛡️ Scoring & Trust",
      description: "Multipliers, anti-gaming, vote weights",
      isCollapsed: false,
      icon: "🛡️",
      flow: [],
    },
    {
      id: section4Id,
      title: "🎨 Design & UX",
      description: "Themes, shapes, colors",
      isCollapsed: false,
      icon: "🎨",
      flow: [],
    },
    {
      id: section5Id,
      title: "🧠 Deep Knowledge",
      description: "Velocity, tricks, final challenge",
      isCollapsed: false,
      icon: "🧠",
      flow: [],
    },
  ];

  const getSectionId = (i: number) => {
    if (i < 3) return section1Id;   // 0-2: Platform Basics
    if (i < 7) return section2Id;   // 3-6: Features & Systems
    if (i < 11) return section3Id;  // 7-10: Scoring & Trust
    if (i < 14) return section4Id;  // 11-13: Design & UX
    return section5Id;              // 14-17: Deep Knowledge
  };

  const questions: (PollQuestion & { sectionId: string })[] = template.questions.map((q, i) => {
    const opts = q.options.map((o) => ({ ...o, id: generateId() }));
    const sectionId = getSectionId(i);
    const question: PollQuestion & { sectionId: string } = {
      ...q,
      id: generateId(),
      order: i + 1,
      sectionId,
      options: opts,
      trickQuestion: q.trickQuestion,
      shapeMatchPreset: q.shapeMatchPreset,
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: PLATFORM BASICS (Q0–Q2)
    // ═══════════════════════════════════════════════════════════════════════

    // Q0: How many pillars? → 7 (third option)
    if (i === 0 && q.type === "SINGLE_CHOICE" && opts[2]) {
      question.correctAnswer = opts[2].id;
      question.explanation = "VeggaStare REACH has 7 pillars: Discovery, Content Quality, Psychological Drivers, Community, Conversion, Growth, and Velocity.";
      question.wrongExplanation = "It used to be 6, but the Velocity pillar was added as the 7th! It tracks real-time trending and momentum.";
      question.deepExplanation = "The 7 pillars and their approximate weights:\n\n1. 👁️ Foundation & Discovery (18%)\n2. 💬 Killer Content (25%)\n3. 🧠 Psychological Drivers (18%)\n4. 👥 Community & Belonging (14%)\n5. 💳 Conversion (10%)\n6. 📈 Growth (10%)\n7. ⚡ Velocity (5%)\n\nVelocity was the most recent addition — it measures engagement spikes, viral coefficients, and momentum deltas.";
    }

    // Q1: Verification methods → Email, OAuth, Wallet (first 3)
    if (i === 1 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[2]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[2].id];
      question.explanation = "VeggaStare supports email verification, social OAuth (Google/GitHub/Discord), and crypto wallet connections. Phone SMS and government ID are not currently available.";
      question.wrongExplanation = "Phone SMS and government ID scan are NOT available on VeggaStare. DNA verification is obviously fictional! The real methods are: email, OAuth, and wallet.";
      question.deepExplanation = "🎁 Discovery Bonus: Each verification method contributes to your verification tier:\n\n• Email → Basic verified\n• OAuth → Social verified\n• Wallet → Wallet verified\n• Multiple methods → Fully verified (120% vote power!)\n\nYou can check your tier in Settings. More verification = more trust = stronger votes in polls.";
    }

    // Q2: Fully verified vote power → 120%
    if (i === 2 && q.type === "SCALE" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "120" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "120";
      question.explanation = "Fully verified users get 120% vote power — a 20% bonus above equal! This rewards users who verify their identity through multiple methods.";
      question.wrongExplanation = "The correct answer is 120%. The verification tiers are: Anonymous 10%, Email 50%, Social 70%, Wallet 90%, Fully Verified 120%.";
      question.deepExplanation = "🎁 Discovery Bonus: The full tier breakdown:\n\n👤 Anonymous: 10% (0.1x)\n📧 Email: 50% (0.5x)\n🔵 Social OAuth: 70% (0.7x)\n🔗 Wallet: 90% (0.9x)\n⭐ Fully Verified: 120% (1.2x)\n\nThis system uses poll-response-weighting.ts which combines tier multiplier × completion multiplier × response quality for the final weight.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: FEATURES & SYSTEMS (Q3–Q6)
    // ═══════════════════════════════════════════════════════════════════════

    // Q3: Trading system inspired by → OSRS (second option)
    if (i === 3 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.explanation = "VeggaStare's P2P trading system is inspired by Old School RuneScape! It features a dual-panel trade window where both parties offer items, confirm, and complete the trade.";
      question.wrongExplanation = "The correct answer is OSRS (Old School RuneScape). The trade window has the classic offer → confirm → complete flow that OSRS players will recognize.";
      question.deepExplanation = "🎁 Discovery Bonus: The trade system features:\n\n• Dual-panel trade window (your offer vs theirs)\n• Both parties must confirm before the trade completes\n• Purple blink notification when someone wants to trade\n• Accessible via the Trade button on user hover cards\n• Real-time updates via WebSocket\n\nTry hovering over a user's avatar and clicking 'Trade'!";
    }

    // Q4: VeggaSystem → official system bot (second option)
    if (i === 4 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.explanation = "VeggaSystem (@veggasystem) is the official system bot account. It posts changelogs, platform updates, and creates official polls like this one!";
      question.wrongExplanation = "VeggaSystem is the platform's official bot account, not a language, tool, or server name. It has an ADMIN role and the 'FULLY_VERIFIED' tier.";
      question.deepExplanation = "🎁 Discovery Bonus: VeggaSystem details:\n\n• Username: veggasystem\n• Role: ADMIN\n• Verification: FULLY_VERIFIED (100 score)\n• Avatar: Bottts-style robot (emerald green)\n• Posts: changelogs, announcements, official polls\n• Created automatically by seed scripts\n\nLook for the 🤖 bot in your feed!";
    }

    // Q5: Web3 mode features → Ethereum wallet, Solana wallet, verification boost (first 3)
    if (i === 5 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[2]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[2].id];
      question.explanation = "Web3 mode supports Ethereum and Solana wallets, and connecting one boosts your verification tier. NFT minting and DAO governance are NOT yet available.";
      question.wrongExplanation = "NFT profile pictures and DAO governance voting are planned but NOT yet implemented. The current Web3 features are: ETH wallets, SOL wallets, and verification tier boost.";
      question.deepExplanation = "🎁 Discovery Bonus: Web3 integration details:\n\n• Uses Reown (WalletConnect) AppKit v1.8\n• Supports wagmi 2 for Ethereum\n• Supports Solana wallet adapters\n• Connecting a wallet = 'WALLET_VERIFIED' tier (90% vote power)\n• Toggle Web3 mode in Settings (no email verification needed)\n• Wallet disconnect triggers clean Web2 sign-out automatically";
    }

    // Q6: Vote weighting → weighted by tier (third option)
    if (i === 6 && q.type === "SINGLE_CHOICE" && opts[2]) {
      question.correctAnswer = opts[2].id;
      question.explanation = "Votes are weighted by verification tier! Anonymous gets 10%, fully verified gets 120%. This prevents bot manipulation while still letting everyone participate.";
      question.wrongExplanation = "Votes are NOT equal, NOT ignored for unverified, and NOT admin-only. They're weighted by verification tier on a scale from 10% to 120%.";
      question.deepExplanation = "🎁 Discovery Bonus: The weighting system uses three factors:\n\n1. Verification tier multiplier (0.1x to 1.2x)\n2. Completion multiplier (finishing more = higher weight)\n3. Response quality score (thoughtful answers count more)\n\nThe final weight = tier × completion × quality. See poll-response-weighting.ts for the full algorithm.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: SCORING & TRUST (Q7–Q10)
    // ═══════════════════════════════════════════════════════════════════════

    // Q7: Minimum time before first answer → 2 seconds
    if (i === 7 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "2" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "2";
      question.explanation = "The minTimeToFirstAnswer is 2000ms (2 seconds). This prevents speed-bots from rapid-fire answering polls.";
      question.wrongExplanation = "The correct answer is 2 seconds (2000ms). This is configured in the anti-gaming settings to prevent bots from answering instantly.";
      question.deepExplanation = "Anti-gaming configuration values:\n\n• minTimeToFirstAnswer: 2000ms (2 sec)\n• maxAnswersPerMinute: 30\n• straightlineDetection: enabled\n• IP hashing: enabled (privacy-preserving)\n\nThese work together to identify suspicious voting patterns without affecting normal users.";
    }

    // Q8: Verification tier ranking (correct order: Anonymous → Email → Social → Wallet → Fully Verified)
    if (i === 8 && q.type === "RANKING") {
      question.correctAnswer = opts.map((o) => o.id);
      question.explanation = "Correct order from lowest to highest: Anonymous (10%) → Email (50%) → Social OAuth (70%) → Wallet (90%) → Fully Verified (120%).";
      question.wrongExplanation = "The order from weakest to strongest is: Anonymous → Email → Social OAuth → Wallet → Fully Verified. Each level adds more trust.";
      question.deepExplanation = "The tier system is designed so that:\n\n• Anyone can participate (10% minimum)\n• Easy verification (email) gives meaningful weight (50%)\n• Social login proves you have a real account (70%)\n• Wallet proves crypto ownership (90%)\n• Multi-method verification earns a 120% bonus\n\nThis creates a gradient that rewards verification without excluding anyone.";
    }

    // Q9: Anti-gaming features → IP hashing + speed + straightline (second option) — TRICK
    if (i === 9 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.trickQuestion = true;
      question.explanation = "VeggaStare uses IP hashing, speed checks, AND straightline detection — all three! No CAPTCHA, no payments, no manual review.";
      question.wrongExplanation = "There's no CAPTCHA, no payment requirement, and no manual review. The three real anti-gaming methods are: IP hashing (privacy-preserving), speed checks (min 2s, max 30/min), and straightline detection (same answer for every question).";
      question.deepExplanation = "Why these three methods?\n\n1. IP Hashing: prevents one person voting multiple times without storing their actual IP\n2. Speed Checks: bots answer faster than humans — 2s minimum + 30/min cap\n3. Straightline Detection: selecting the same answer for every question indicates a bot or disengaged user\n\nNo CAPTCHA needed because verification tiers already weight votes by trust level.";
    }

    // Q10: Max answers per minute → 30
    if (i === 10 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "30" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "30";
      question.explanation = "The maxAnswersPerMinute is set to 30. This allows engaged users to answer quickly while flagging bot-like speeds.";
      question.wrongExplanation = "The correct value is 30 answers per minute. Combined with the 2-second minimum delay, this creates a natural rhythm that bots can't match.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: DESIGN & UX (Q11–Q13)
    // ═══════════════════════════════════════════════════════════════════════

    // Q11: Theme modes → Dark, Light, System auto (first 3)
    if (i === 11 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[2]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[2].id];
      question.explanation = "VeggaStare supports Dark mode, Light mode, and System auto-detect. Rainbow mode and Retro CRT mode... we wish! 😄";
      question.wrongExplanation = "The three real theme options are Dark, Light, and System auto-detect. Rainbow and CRT modes don't exist (yet?).";
    }

    // Q12: Shape match — handled by ShapeMatchQuestion component
    if (i === 12 && q.type === "SHAPE_MATCH") {
      question.shapeMatchPreset = "outlineMatch";
      question.explanation = "Nice work dragging the shapes! This is one of VeggaStare's 11 question types — designed for visual, interactive assignments.";
      question.wrongExplanation = "Drag each colored shape into the matching black outline. The shape's form must match the outline's form.";
      question.deepExplanation = "🎁 Discovery Bonus: VeggaStare's poll system supports these visual question types:\n\n• SHAPE_MATCH — Drag shapes to outlines or color zones\n• UI_ARRANGE — Drag boxes to arrange UI layouts on a grid\n• RANKING — Drag items to reorder them by priority\n\nAll three use Framer Motion for smooth spring animations!";
    }

    // Q13: Primary color scheme → Emerald green & dark zinc (second option)
    if (i === 13 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.explanation = "VeggaStare primarily uses emerald green accents on dark zinc backgrounds. The classic tech-meets-nature aesthetic!";
      question.wrongExplanation = "Look at the buttons, links, and highlights — emerald green (#10b981) on dark zinc backgrounds is the primary palette.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: DEEP KNOWLEDGE (Q14–Q17)
    // ═══════════════════════════════════════════════════════════════════════

    // Q14: What Velocity tracks → engagement rate, viral coefficient, momentum delta (opts 0, 1, 3)
    if (i === 14 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[3]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[3].id];
      question.explanation = "Velocity tracks engagement rate/hour, viral coefficient, and momentum deltas (1h/24h). It does NOT track revenue or file sizes!";
      question.wrongExplanation = "Revenue and file size are NOT part of Velocity. The pillar tracks: engagement rate per hour, viral coefficient (shares → new users), and momentum delta (1h and 24h comparisons).";
      question.deepExplanation = "Velocity pillar internals (from pillar-calculator.ts):\n\n• momentumDelta1h — engagement change in the last hour\n• momentumDelta24h — engagement change in the last 24 hours\n• breadthRatio — how diverse your engagement sources are\n\nThese inputs feed into the Velocity pillar score, which currently has approximately 5% weight in the overall REACH calculation.";
    }

    // Q15: How many poll question types? TRICK → 11 in DB, 9 in builder (fourth option is most correct)
    if (i === 15 && q.type === "SINGLE_CHOICE" && opts[3]) {
      question.correctAnswer = opts[3].id;
      question.trickQuestion = true;
      question.explanation = "Tricky! The database schema defines 11 question types, while the PollBuilder UI supports 9 of them. Both answers are 'correct' depending on context, but 11 is the most complete answer.";
      question.wrongExplanation = "The database has 11 types: SINGLE_CHOICE, MULTI_CHOICE, SLIDER, SCALE, TEXT, NESTED, RANKING, UI_ARRANGE, SHAPE_MATCH, IMAGE_UPLOAD, and TREE. The PollBuilder supports 9 of these.";
      question.deepExplanation = "Full breakdown:\n\n📦 Database types (11): SINGLE_CHOICE, MULTI_CHOICE, SLIDER, SCALE, TEXT, NESTED, RANKING, UI_ARRANGE, SHAPE_MATCH, IMAGE_UPLOAD, TREE\n\n🔧 PollBuilder types (9): SINGLE_CHOICE, MULTI_CHOICE, SLIDER, SCALE, TEXT, RANKING, SHAPE_MATCH, UI_ARRANGE, NESTED\n\nNot in builder: IMAGE_UPLOAD, TREE (these exist in the schema but aren't fully wired into the UI yet).";
    }

    // Q16: VeggaSystem username → "veggasystem"
    if (i === 16 && q.type === "TEXT") {
      question.correctAnswer = "veggasystem";
      question.explanation = "Correct! The system bot username is 'veggasystem'. Look for @veggasystem in your feed for official updates!";
      question.wrongExplanation = "The exact username is 'veggasystem' (all lowercase, no spaces, no @ symbol). It's defined in lib/system-account.ts.";
      question.deepExplanation = "VeggaSystem account details:\n\n• ID: system-vegga-official\n• Username: veggasystem\n• Email: system@veggat.com\n• Role: ADMIN\n• Verification: FULLY_VERIFIED (score: 100)\n• Avatar: Bottts-style robot (dicebear.com)\n\nThe account is created automatically by seed scripts and posts changelogs.";
    }

    // Q17: Confidence — any answer is correct (it's a fun closer)
    if (i === 17 && q.type === "SCALE" && question.sliderConfig) {
      // Any answer from 1-10 is "correct" — it's a feel-good closer
      question.sliderConfig = { ...question.sliderConfig } as unknown as PollQuestion["sliderConfig"];
      question.explanation = "Every answer is correct here! 🎉 Thanks for taking the Feature Explorer Quiz. Whether you scored 100% or learned something new, you now know VeggaStare better than most!";
      question.wrongExplanation = "There's no wrong answer for this one — it's just for fun! Thanks for playing.";
      question.deepExplanation = "🎁 Final Discovery Bonus:\n\nYou've just experienced VeggaStare's quiz system! Here's what makes it special:\n\n• Two-tier feedback: explanation → 'Still don't understand?' → deepExplanation\n• Trick questions marked with 🎭\n• Verification-weighted scoring\n• Anti-gaming protection (speed limits, straightline detection)\n• 11 question types (you tried 7 of them!)\n\nNow go explore the features you learned about! 🚀";
    }

    return question;
  });

  // Assign questions to sections
  sections[0].flow = questions.slice(0, 3).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[1].flow = questions.slice(3, 7).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[2].flow = questions.slice(7, 11).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[3].flow = questions.slice(11, 14).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[4].flow = questions.slice(14, 18).map((q) => ({ type: "QUESTION" as const, id: q.id }));

  return {
    title: template.title,
    description: template.description,
    type: template.type as PollType,
    allowPartialSubmission: template.allowPartialSubmission,
    showProgressBar: template.showProgressBar,
    randomizeQuestions: template.randomizeQuestions,
    sections,
    questions,
    flow: [
      { type: "SECTION" as const, id: section1Id },
      { type: "SECTION" as const, id: section2Id },
      { type: "SECTION" as const, id: section3Id },
      { type: "SECTION" as const, id: section4Id },
      { type: "SECTION" as const, id: section5Id },
    ],
  };
}
