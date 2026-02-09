/**
 * Seed Script: Create the Comprehensive REACH System Audit Poll
 * 
 * Run with: npx ts-node --transpile-only scripts/seed-reach-poll.ts
 * 
 * Contains 90+ questions across 10 sections covering all aspects of the REACH system.
 * Includes advanced question types: RANKING, UI_ARRANGE, NESTED, IMAGE_UPLOAD
 * 
 * ⚡ PARTIAL COMPLETION ENABLED - Users don't need to complete all questions!
 */

import 'dotenv/config'
import { PrismaClient, AdvancedPollType, PollQuestionType, Prisma } from "@/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

const POLL_DESCRIPTION = `
🚀 Welcome to the VeggaStare REACH System Comprehensive Audit!

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
❓ Questions: 90+ across 10 sections
🎯 Goal: Shape VeggaStare's future TOGETHER!
`.trim();

// ════════════════════════════════════════════════════════════════════════════
// QUESTION DATA TYPES
// ════════════════════════════════════════════════════════════════════════════

interface QuestionData {
  type: "slider" | "choice" | "multi-choice" | "text" | "ranking" | "ui-arrange" | "nested" | "image-upload";
  question: string;
  description?: string;
  required?: boolean;
  sliderLabels?: string[];
  options?: Array<{ label: string; icon?: string; description?: string }>;
  maxSelections?: number;
  maxLength?: number;
  // For nested questions
  followUps?: Array<{ condition: string; questions: QuestionData[] }>;
  // For UI arrange
  uiElements?: Array<{ id: string; label: string; icon?: string }>;
  // For image upload
  maxImages?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1: USER CONTEXT (8 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_1: QuestionData[] = [
  {
    type: "choice",
    question: "How would you describe your primary role on VeggaStare?",
    description: "Your perspective shapes how we weight different features! 🌟",
    required: true,
    options: [
      { label: "Content Creator", icon: "🎨", description: "I create and share content" },
      { label: "Content Explorer", icon: "🔍", description: "I discover and engage" },
      { label: "Community Curator", icon: "📚", description: "I organize and recommend" },
      { label: "Marketplace Seller", icon: "🏪", description: "I sell products/services" },
      { label: "Smart Shopper", icon: "🛒", description: "I browse and purchase" },
      { label: "Collector & Trader", icon: "💎", description: "I collect digital assets" },
      { label: "Networker & Connector", icon: "🤝", description: "I connect people" },
      { label: "Influencer & Advocate", icon: "📢", description: "I promote to my audience" },
      { label: "Supporter & Fan", icon: "💖", description: "I support creators" },
      { label: "Builder & Contributor", icon: "🚀", description: "I want to help build" },
      { label: "Tester & Reviewer", icon: "🔬", description: "I test and give feedback" },
      { label: "Multi-Role Poweruser", icon: "⭐", description: "I do all the things!" },
      { label: "Curious Observer", icon: "👀", description: "Just exploring" },
    ],
  },
  {
    type: "nested",
    question: "Would you contribute to VeggaStare's growth?",
    description: "We're building this together — your skills matter! 🛠️",
    required: false,
    options: [
      { label: "Yes, I want to help!", icon: "✅" },
      { label: "Maybe later", icon: "⏳" },
      { label: "I prefer to just use it", icon: "👤" },
    ],
    followUps: [
      {
        condition: "Yes, I want to help!",
        questions: [
          {
            type: "multi-choice",
            question: "What kind of contribution interests you?",
            options: [
              { label: "Development/Engineering", icon: "💻" },
              { label: "Design/UX", icon: "🎨" },
              { label: "Content Creation", icon: "📝" },
              { label: "Community Building", icon: "🤝" },
              { label: "Testing/QA", icon: "🔬" },
              { label: "Translation", icon: "🌍" },
              { label: "Sponsorship/Investment", icon: "💰" },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "slider",
    question: "How familiar are you with VeggaStare's Reach metrics?",
    description: "A = Never heard of it, G = I understand all 7 pillars deeply",
    required: true,
    sliderLabels: ["Never seen", "Noticed it", "Basics", "Use regularly", "Know well", "Expert", "Deep expertise"],
  },
  {
    type: "slider",
    question: "How important is understanding your 'true reach' to you?",
    description: "A = Don't care, G = Critical for my success",
    required: true,
    sliderLabels: ["Not important", "Slightly", "Somewhat", "Moderately", "Important", "Very important", "Critical"],
  },
  {
    type: "multi-choice",
    question: "Which verification methods have you completed?",
    description: "Select all that apply — more = stronger identity 💪",
    required: false,
    maxSelections: 15,
    options: [
      { label: "Email verified", icon: "📧" },
      { label: "Google OAuth", icon: "🔵" },
      { label: "GitHub OAuth", icon: "⚫" },
      { label: "Discord OAuth", icon: "🟣" },
      { label: "Web3 Wallet connected", icon: "🔗" },
      { label: "Wallet signature verified", icon: "✍️" },
      { label: "Payment card on file", icon: "💳" },
      { label: "Made a crypto purchase", icon: "🪙" },
      { label: "Phone number verified", icon: "📱" },
      { label: "X OAuth", icon: "𝕏" },
      { label: "LinkedIn OAuth", icon: "💼" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which NEW verification services should we add?",
    description: "Help us prioritize integrations!",
    required: false,
    maxSelections: 6,
    options: [
      { label: "Vipps (Norway)", icon: "💚" },
      { label: "PayPal", icon: "🅿️" },
      { label: "Twitch", icon: "💜" },
      { label: "YouTube", icon: "🔴" },
      { label: "TikTok", icon: "🎵" },
      { label: "Instagram", icon: "📸" },
      { label: "Spotify", icon: "🎧" },
      { label: "ENS Domain (.eth)", icon: "🌐" },
      { label: "Lens Protocol", icon: "🌿" },
      { label: "Farcaster", icon: "🟣" },
      { label: "Apple ID", icon: "🍎" },
      { label: "Steam", icon: "🎮" },
    ],
  },
  {
    type: "slider",
    question: "How long have you been using social platforms?",
    description: "A = Just started, G = 10+ years veteran",
    required: false,
    sliderLabels: ["< 1 year", "1-2 years", "3-4 years", "5-6 years", "7-8 years", "9-10 years", "10+ years"],
  },
  {
    type: "choice",
    question: "Which platform did you come from primarily?",
    description: "Helps us understand your expectations",
    required: false,
    options: [
      { label: "X", icon: "𝕏" },
      { label: "Instagram", icon: "📸" },
      { label: "TikTok", icon: "🎵" },
      { label: "Reddit", icon: "🤖" },
      { label: "Discord", icon: "🟣" },
      { label: "YouTube", icon: "🔴" },
      { label: "LinkedIn", icon: "💼" },
      { label: "Friend.tech", icon: "👥" },
      { label: "Farcaster", icon: "🟪" },
      { label: "This is my first!", icon: "🆕" },
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2: 6 PILLARS DEEP EVALUATION (16 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_2: QuestionData[] = [
  // Pillar 1: Foundation & Discovery (18%)
  {
    type: "slider",
    question: "PILLAR 1: Foundation & Discovery (👁️ 18%)",
    description: "SEO, platform discoverability, SSR pages. How valuable is this?",
    required: true,
    sliderLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "slider",
    question: "Is 18% weight for Foundation appropriate?",
    description: "Current: 18% of total Reach score",
    required: true,
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Perfect", "Slightly low", "Too low", "Way too low"],
  },
  // Pillar 2: Killer Content (25%)
  {
    type: "slider",
    question: "PILLAR 2: Killer Content (💬 25%)",
    description: "Relevance, authenticity, surprise factor, creator stories. How valuable?",
    required: true,
    sliderLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "slider",
    question: "Is 25% weight for Killer Content appropriate?",
    description: "Current: 25% (highest weighted pillar)",
    required: true,
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Perfect", "Slightly low", "Too low", "Way too low"],
  },
  {
    type: "ranking",
    question: "Rank these content quality signals by importance",
    description: "Drag to reorder — top = most important 🏆",
    required: true,
    options: [
      { label: "💬 Comments received", icon: "💬" },
      { label: "🔖 Saves/Bookmarks", icon: "🔖" },
      { label: "📤 Shares", icon: "📤" },
      { label: "⏱️ Time spent viewing (dwell)", icon: "⏱️" },
      { label: "📜 Scroll depth", icon: "📜" },
      { label: "↩️ Reply thread depth", icon: "↩️" },
      { label: "💳 Purchase conversions", icon: "💳" },
      { label: "➕ New follows gained", icon: "➕" },
    ],
  },
  // Pillar 3: Psychological Drivers (18%)
  {
    type: "slider",
    question: "PILLAR 3: Psychological Drivers (🧠 18%)",
    description: "Social Proof, Scarcity, Authority, Liking, Consistency, Reciprocity (Solis 6)",
    required: true,
    sliderLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "multi-choice",
    question: "Which psychological triggers work best on YOU?",
    description: "Be honest — helps us tune the UX! Select up to 3",
    required: true,
    maxSelections: 3,
    options: [
      { label: "Social Proof (others bought it)", icon: "👥" },
      { label: "Scarcity (only X left!)", icon: "⏳" },
      { label: "Authority (expert recommends)", icon: "🏆" },
      { label: "Liking (I trust the creator)", icon: "❤️" },
      { label: "Consistency (I always engage)", icon: "🔄" },
      { label: "Reciprocity (they helped me)", icon: "🤝" },
    ],
  },
  // Pillar 4: Community & Belonging (14%)
  {
    type: "slider",
    question: "PILLAR 4: Community & Belonging (👥 14%)",
    description: "Real relationships, wallet-gated channels, fan groups, retention",
    required: true,
    sliderLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "slider",
    question: "Is 14% weight for Community appropriate?",
    description: "Current: 14% of total Reach score",
    required: true,
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Perfect", "Slightly low", "Too low", "Way too low"],
  },
  // Pillar 5: Amplification Tactics (10%)
  {
    type: "slider",
    question: "PILLAR 5: Amplification Tactics (📣 10%)",
    description: "Paid boosts, influencers, referral rewards, viral contests",
    required: true,
    sliderLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "choice",
    question: "Should paid promotion affect organic Reach?",
    description: "If someone boosts a post, should it count toward their True Reach?",
    required: true,
    options: [
      { label: "Yes, fully count it", icon: "✅" },
      { label: "Yes, but reduced weight (0.5x)", icon: "⚖️" },
      { label: "Separate paid vs organic scores", icon: "📊" },
      { label: "No, only count organic", icon: "❌" },
    ],
  },
  // Pillar 6: Analytics & Iteration (5%)
  {
    type: "slider",
    question: "PILLAR 6: Analytics & Iteration (📊 5%)",
    description: "Real-time data, fast pivots, dashboard insights",
    required: true,
    sliderLabels: ["Useless", "Low", "Some", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "slider",
    question: "Is 5% weight for Analytics appropriate?",
    description: "Currently the lowest weighted pillar",
    required: true,
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Perfect", "Slightly low", "Too low", "Way too low"],
  },
  // Overall Pillar Balance
  {
    type: "nested",
    question: "Do you think any pillar should be REMOVED?",
    description: "Sometimes less is more...",
    required: false,
    options: [
      { label: "No, keep all 6 (soon 7)", icon: "✅" },
      { label: "Yes, remove one", icon: "🗑️" },
    ],
    followUps: [
      {
        condition: "Yes, remove one",
        questions: [
          {
            type: "choice",
            question: "Which pillar would you remove?",
            options: [
              { label: "Foundation & Discovery" },
              { label: "Killer Content" },
              { label: "Psychological Drivers" },
              { label: "Community & Belonging" },
              { label: "Amplification Tactics" },
              { label: "Analytics & Iteration" },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "text",
    question: "What's ONE thing you'd change about the current 6 pillars?",
    description: "Your biggest suggestion",
    required: false,
    maxLength: 500,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3: THE 7TH PILLAR - VELOCITY/PULSE (10 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_3: QuestionData[] = [
  {
    type: "nested",
    question: "Should we add a 7th pillar: 'Velocity / Realtime Pulse'?",
    description: "⚡ Live momentum tracking, viral detection, scheduled 'Pulse' events",
    required: true,
    options: [
      { label: "YES — Definitely add it!", icon: "🚀" },
      { label: "Yes, but make it optional", icon: "⚙️" },
      { label: "Maybe, need more details", icon: "🤔" },
      { label: "No, 6 pillars is enough", icon: "❌" },
    ],
    followUps: [
      {
        condition: "YES — Definitely add it!",
        questions: [
          {
            type: "slider",
            question: "What weight should Velocity have?",
            description: "A = 0%, G = 20%",
            sliderLabels: ["0%", "5%", "8%", "10%", "12%", "15%", "20%"],
          },
        ],
      },
      {
        condition: "No, 6 pillars is enough",
        questions: [
          {
            type: "text",
            question: "Why do you think 6 pillars is enough?",
            description: "Help us understand your perspective",
            maxLength: 300,
          },
        ],
      },
    ],
  },
  {
    type: "slider",
    question: "How important is knowing when your content 'goes viral'?",
    description: "A = Not at all, G = Extremely important",
    required: true,
    sliderLabels: ["Not important", "Slightly", "Somewhat", "Moderately", "Important", "Very", "Critical"],
  },
  {
    type: "ranking",
    question: "Rank these Velocity sub-metrics by importance",
    description: "What should we track in realtime? Drag to reorder 🏆",
    required: true,
    options: [
      { label: "📈 Engagement rate per hour", icon: "📈" },
      { label: "🔥 Viral coefficient (shares → new users)", icon: "🔥" },
      { label: "⏰ Peak timing analysis", icon: "⏰" },
      { label: "🌐 Cross-network mentions", icon: "🌐" },
      { label: "📊 Trend detection alerts", icon: "📊" },
      { label: "📉 Momentum graph visualization", icon: "📉" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which PULSE event features excite you most?",
    description: "Live drops with countdowns, chat, and rewards! Select all that interest you",
    required: true,
    options: [
      { label: "⏰ Countdown timers to drops", icon: "⏰" },
      { label: "🔥 Live sales counter", icon: "🔥" },
      { label: "💬 Live chat during events", icon: "💬" },
      { label: "🔗 Referral bonus for sharing", icon: "🔗" },
      { label: "🏆 NFT attendance badges", icon: "🏆" },
      { label: "👥 Buyer avatar wall", icon: "👥" },
      { label: "📡 Auto-post to socials", icon: "📡" },
      { label: "🎁 Mystery drops/surprises", icon: "🎁" },
    ],
  },
  {
    type: "choice",
    question: "Would YOU participate in Pulse events?",
    description: "Live drops with countdowns, chat, and rewards",
    required: true,
    options: [
      { label: "As a CREATOR (host my own)", icon: "🎤" },
      { label: "As a BUYER (attend and purchase)", icon: "🛒" },
      { label: "BOTH creator and buyer", icon: "⭐" },
      { label: "Just watch/observe", icon: "👀" },
      { label: "Not interested", icon: "❌" },
    ],
  },
  {
    type: "slider",
    question: "How quickly should Velocity decay for old content?",
    description: "A = Very fast (hours), G = Very slow (weeks)",
    required: true,
    sliderLabels: ["Hours", "1 day", "2-3 days", "1 week", "2 weeks", "1 month", "Never"],
  },
  {
    type: "choice",
    question: "Should high-velocity content get boosted in feeds?",
    description: "Trending content could rise automatically",
    required: true,
    options: [
      { label: "Yes, boost trending content", icon: "📈" },
      { label: "Yes, but only notify creator", icon: "🔔" },
      { label: "No, display-only metric", icon: "📊" },
      { label: "Let each user choose", icon: "⚙️" },
    ],
  },
  {
    type: "slider",
    question: "Would you pay for Pulse Pro features?",
    description: "Advanced scheduling, analytics, cross-platform blast",
    required: false,
    sliderLabels: ["Never", "Maybe $2/mo", "$5/mo", "$10/mo", "$15/mo", "$20/mo", "Pay with crypto"],
  },
  {
    type: "text",
    question: "Describe your DREAM Pulse event",
    description: "If you could host any live drop, what would it look like?",
    required: false,
    maxLength: 500,
  },
  {
    type: "image-upload",
    question: "Have a mockup or inspiration image for Pulse UI?",
    description: "Drop an image of what you'd want to see (optional)",
    required: false,
    maxImages: 2,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4: AUTH LEVELS & POLL POWER (12 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_4: QuestionData[] = [
  {
    type: "slider",
    question: "How FAIR is verification-weighted voting?",
    description: "Currently: Anonymous = 10%, Fully Verified = 120%",
    required: true,
    sliderLabels: ["Very unfair", "Unfair", "Slightly unfair", "Neutral", "Slightly fair", "Fair", "Very fair"],
  },
  {
    type: "choice",
    question: "What should Anonymous users' vote weight be?",
    description: "Current: 10% (0.10x). Not logged in users.",
    required: true,
    options: [
      { label: "0% (No vote at all)", icon: "🚫" },
      { label: "5% (0.05x)", icon: "📉" },
      { label: "10% (current)", icon: "✓" },
      { label: "20%", icon: "📈" },
      { label: "30%", icon: "📈📈" },
    ],
  },
  {
    type: "choice",
    question: "Should we REQUIRE login to take polls?",
    description: "Or allow anonymous with reduced weight?",
    required: true,
    options: [
      { label: "Yes, require login", icon: "🔒" },
      { label: "Allow anonymous (reduced)", icon: "👤" },
      { label: "Let poll creator decide", icon: "⚙️" },
    ],
  },
  {
    type: "slider",
    question: "What should Fully Verified users' BONUS be?",
    description: "Current: 120% (1.20x). All verifications complete.",
    required: true,
    sliderLabels: ["1.0x (no bonus)", "1.1x", "1.2x (current)", "1.3x", "1.4x", "1.5x", "2.0x"],
  },
  {
    type: "ranking",
    question: "Rank these verifications by trustworthiness",
    description: "Which should give the BIGGEST poll power boost? 🏆",
    required: true,
    options: [
      { label: "🔐 Multiple OAuth providers", icon: "🔐" },
      { label: "✍️ Web3 wallet signature", icon: "✍️" },
      { label: "💳 Payment card verified", icon: "💳" },
      { label: "🪙 Crypto purchase made", icon: "🪙" },
      { label: "📱 Phone number verified", icon: "📱" },
      { label: "📅 Account age > 30 days", icon: "📅" },
      { label: "📊 Engagement history", icon: "📊" },
    ],
  },
  {
    type: "choice",
    question: "Should poll power be VISIBLE to users?",
    description: "Would you want to see your own poll power score?",
    required: true,
    options: [
      { label: "Yes, show publicly", icon: "👁️" },
      { label: "Yes, but only to me", icon: "🔒" },
      { label: "No, keep it hidden", icon: "🙈" },
      { label: "Make it opt-in", icon: "⚙️" },
    ],
  },
  {
    type: "slider",
    question: "Should incomplete polls count at all?",
    description: "A = 0% (must complete), G = 100% (partial = full)",
    required: true,
    sliderLabels: ["0%", "10%", "25%", "50%", "75%", "90%", "100%"],
  },
  // Owner Power questions
  {
    type: "choice",
    question: "👑 Should OWNERS/ADMINS have boosted poll power?",
    description: "They build the platform — should their voice carry extra weight?",
    required: true,
    options: [
      { label: "Yes, 2-3x boost (significant)", icon: "👑" },
      { label: "Yes, 1.5-2x boost (moderate)", icon: "⭐" },
      { label: "Yes, 1.2-1.5x boost (slight)", icon: "✨" },
      { label: "No, equal votes", icon: "⚖️" },
      { label: "Owners should vote LESS", icon: "🤐" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which owner actions should be TRANSPARENT?",
    description: "Select all that should be publicly visible",
    required: false,
    maxSelections: 5,
    options: [
      { label: "Boost multiplier shown", icon: "👁️" },
      { label: "Votes marked 'owner vote'", icon: "🏷️" },
      { label: "Weight calculation shown", icon: "📊" },
      { label: "Separate results view", icon: "📈" },
      { label: "Owner action changelog", icon: "📝" },
      { label: "None needed", icon: "🔒" },
    ],
  },
  {
    type: "choice",
    question: "Should owners be able to OVERRIDE poll results?",
    description: "Sometimes community votes for something that breaks the platform",
    required: true,
    options: [
      { label: "Never — democracy!", icon: "🗳️" },
      { label: "Only emergencies", icon: "🚨" },
      { label: "Veto with explanation", icon: "📢" },
      { label: "Delay implementation", icon: "⏸️" },
      { label: "Final say always", icon: "👑" },
    ],
  },
  {
    type: "text",
    question: "How should owner power be balanced with community voice?",
    description: "Share your thoughts on governance 🏛️",
    required: false,
    maxLength: 500,
  },
  {
    type: "slider",
    question: "Would you trust a DAO-style voting system?",
    description: "Token-weighted voting with on-chain results",
    required: false,
    sliderLabels: ["No trust", "Very skeptical", "Skeptical", "Neutral", "Curious", "Interested", "Love DAOs"],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5: VIEW STRENGTH & ANTI-GAMING (8 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_5: QuestionData[] = [
  {
    type: "slider",
    question: "How concerned are you about bots and fake engagement?",
    description: "Gaming the Reach system with fake views/votes",
    required: true,
    sliderLabels: ["Not at all", "Slightly", "Somewhat", "Moderately", "Very", "Extremely", "Critical"],
  },
  {
    type: "slider",
    question: "How AGGRESSIVELY should we dedupe repeat views?",
    description: "A = Light (count most), G = Aggressive (strict dedup)",
    required: true,
    sliderLabels: ["Very light", "Light", "Moderate-light", "Balanced", "Moderate-strict", "Strict", "Very strict"],
  },
  {
    type: "slider",
    question: "How long should content be on-screen to count as a view?",
    description: "Current: 500ms minimum dwell time",
    required: true,
    sliderLabels: ["100ms", "250ms", "500ms", "1 sec", "2 sec", "3 sec", "5 sec"],
  },
  {
    type: "slider",
    question: "What should REPEAT views be worth?",
    description: "Same user viewing same content again",
    required: true,
    sliderLabels: ["0%", "5%", "10%", "15%", "20%", "25%", "30%"],
  },
  {
    type: "choice",
    question: "What anti-bot verification do you prefer?",
    description: "Balance security vs. user experience",
    required: true,
    options: [
      { label: "None (trust verification tiers)", icon: "✓" },
      { label: "Invisible reCAPTCHA", icon: "🔍" },
      { label: "Checkbox reCAPTCHA", icon: "☑️" },
      { label: "Image selection", icon: "🖼️" },
      { label: "Shape matching (drag)", icon: "🔷" },
      { label: "Puzzle slide", icon: "🧩" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which anti-gaming measures do you support?",
    description: "Select all that seem fair",
    required: true,
    options: [
      { label: "Rate limiting views", icon: "⏱️" },
      { label: "Burst pattern detection", icon: "📊" },
      { label: "Bot detection AI", icon: "🤖" },
      { label: "VPN/proxy flagging", icon: "🔍" },
      { label: "CAPTCHA challenges", icon: "🧩" },
      { label: "Browser fingerprinting", icon: "👆" },
    ],
  },
  {
    type: "choice",
    question: "How should we handle suspicious engagement BURSTS?",
    description: "Sudden spikes in views/votes",
    required: true,
    options: [
      { label: "Flag for manual review", icon: "🚩" },
      { label: "Auto-reduce weight", icon: "📉" },
      { label: "Quarantine 24h", icon: "⏳" },
      { label: "Trust the system", icon: "✓" },
    ],
  },
  {
    type: "slider",
    question: "How TRANSPARENT should anti-gaming be?",
    description: "A = Hidden, G = Fully explained",
    required: true,
    sliderLabels: ["Hidden", "Minimal", "Some info", "Balanced", "Detailed", "Very detailed", "Fully open"],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 6: UI/UX PREFERENCES (10 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_6: QuestionData[] = [
  {
    type: "choice",
    question: "What THEME style do you prefer?",
    description: "Overall visual style of VeggaStare",
    required: true,
    options: [
      { label: "Dark Mode 🌙", icon: "🌙" },
      { label: "Light Mode ☀️", icon: "☀️" },
      { label: "Auto (System)", icon: "🔄" },
      { label: "Custom/Profile Colors", icon: "🎨" },
      { label: "OLED Black", icon: "⬛" },
    ],
  },
  {
    type: "choice",
    question: "How should the Reach score be DISPLAYED?",
    description: "The 7 Pillars visualization style",
    required: true,
    options: [
      { label: "Radar/Spider chart", icon: "🕸️" },
      { label: "Horizontal bars", icon: "📊" },
      { label: "Pie/Donut chart", icon: "🍩" },
      { label: "Single number only", icon: "🔢" },
      { label: "Gamified badges", icon: "🏆" },
      { label: "Multiple options (user picks)", icon: "⚙️" },
    ],
  },
  {
    type: "slider",
    question: "How PROMINENT should Reach scores be?",
    description: "A = Hidden, G = Front and center",
    required: true,
    sliderLabels: ["Hidden", "Very subtle", "Subtle", "Moderate", "Prominent", "Very prominent", "Dominant"],
  },
  {
    type: "slider",
    question: "How much ANIMATION do you want?",
    description: "Framer Motion effects, transitions, micro-interactions",
    required: true,
    sliderLabels: ["None", "Minimal", "Subtle", "Moderate", "Noticeable", "Rich", "Maximum"],
  },
  {
    type: "choice",
    question: "Should users be able to HIDE their Reach score?",
    description: "Privacy option",
    required: true,
    options: [
      { label: "No, always visible", icon: "👁️" },
      { label: "Yes, hide everything", icon: "🙈" },
      { label: "Yes, hide breakdown only", icon: "📊" },
      { label: "Yes, hide total only", icon: "🔢" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which dashboard insights do you want?",
    description: "Select all that interest you",
    required: true,
    options: [
      { label: "Score trends over time", icon: "📈" },
      { label: "Compare to similar users", icon: "👥" },
      { label: "Improvement tips", icon: "💡" },
      { label: "Milestone notifications", icon: "🎉" },
      { label: "Detailed breakdown", icon: "🔍" },
      { label: "Export data (CSV/JSON)", icon: "📥" },
      { label: "AI recommendations", icon: "🤖" },
    ],
  },
  {
    type: "ui-arrange",
    question: "How would you ARRANGE the profile page?",
    description: "Drag elements to your preferred layout",
    required: false,
    uiElements: [
      { id: "avatar", label: "Avatar/Picture", icon: "👤" },
      { id: "reach_score", label: "Reach Score", icon: "📊" },
      { id: "reach_chart", label: "Reach Chart", icon: "🕸️" },
      { id: "bio", label: "Bio/Description", icon: "📝" },
      { id: "follower_stats", label: "Follower Stats", icon: "👥" },
      { id: "posts_feed", label: "Posts Feed", icon: "📰" },
      { id: "verification_badges", label: "Verification Badges", icon: "✓" },
      { id: "nft_gallery", label: "NFT Gallery", icon: "🖼️" },
    ],
  },
  {
    type: "slider",
    question: "How important is MOBILE-first design?",
    description: "A = Desktop only, G = Mobile only",
    required: true,
    sliderLabels: ["Desktop only", "Desktop focus", "Slight desktop", "Equal", "Slight mobile", "Mobile focus", "Mobile only"],
  },
  {
    type: "multi-choice",
    question: "Which chart types do you find most USEFUL?",
    description: "For analytics and visualizations",
    required: false,
    options: [
      { label: "Radar/Spider", icon: "🕸️" },
      { label: "Line charts (trends)", icon: "📈" },
      { label: "Bar charts", icon: "📊" },
      { label: "Pie/Donut", icon: "🍩" },
      { label: "Heatmaps", icon: "🗺️" },
      { label: "Funnel charts", icon: "🔻" },
      { label: "Gauge meters", icon: "🎯" },
    ],
  },
  {
    type: "image-upload",
    question: "Have a screenshot or mockup of your ideal UI?",
    description: "Share inspiration! (optional)",
    required: false,
    maxImages: 3,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 7: WEB3 & CRYPTO FEATURES (8 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_7: QuestionData[] = [
  {
    type: "slider",
    question: "How interested are you in Web3 features?",
    description: "Wallets, NFTs, crypto payments, DAOs",
    required: true,
    sliderLabels: ["Not at all", "Curious", "Somewhat", "Interested", "Very interested", "Love Web3", "Web3 native"],
  },
  {
    type: "multi-choice",
    question: "Which PAYMENT methods should we support?",
    description: "Select all you'd actually use",
    required: true,
    options: [
      { label: "Credit/Debit Card", icon: "💳" },
      { label: "Vipps (Norway)", icon: "💚" },
      { label: "PayPal", icon: "🅿️" },
      { label: "Apple Pay", icon: "🍎" },
      { label: "Bitcoin", icon: "₿" },
      { label: "Ethereum", icon: "Ξ" },
      { label: "Solana", icon: "◎" },
      { label: "USDC Stablecoin", icon: "💵" },
      { label: "Bank Transfer", icon: "🏦" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which Web3 features EXCITE you most?",
    description: "Select all that interest you",
    required: false,
    options: [
      { label: "NFT Profile Pictures", icon: "🖼️" },
      { label: "Token-Gated Content", icon: "🔒" },
      { label: "Achievement NFT Badges", icon: "🏆" },
      { label: "Crypto Tipping", icon: "💸" },
      { label: "DAO Governance Voting", icon: "🗳️" },
      { label: "On-Chain Reputation", icon: "⛓️" },
      { label: "Soulbound Tokens", icon: "💫" },
      { label: "None of these", icon: "❌" },
    ],
  },
  {
    type: "choice",
    question: "Should Web3 users get HIGHER verification tier?",
    description: "Wallet + signature = more trust?",
    required: true,
    options: [
      { label: "Yes, crypto = high trust", icon: "⭐" },
      { label: "Equal to social OAuth", icon: "⚖️" },
      { label: "Lower than phone verify", icon: "📉" },
      { label: "Depends on on-chain history", icon: "📊" },
    ],
  },
  {
    type: "slider",
    question: "Would you buy an NFT badge for verified status?",
    description: "A = Never, G = Absolutely",
    required: false,
    sliderLabels: ["Never", "Unlikely", "Maybe", "Probably", "Likely", "Very likely", "Day 1 buy"],
  },
  {
    type: "choice",
    question: "Which blockchain should be PRIMARY?",
    description: "For NFTs, payments, and identity",
    required: false,
    options: [
      { label: "Ethereum (most trusted)", icon: "Ξ" },
      { label: "Solana (fast & cheap)", icon: "◎" },
      { label: "Polygon (Eth L2)", icon: "🔷" },
      { label: "Base (Coinbase L2)", icon: "🔵" },
      { label: "Multi-chain support", icon: "🌐" },
      { label: "I don't care", icon: "🤷" },
    ],
  },
  {
    type: "text",
    question: "What Web3 feature would make you use VeggaStare daily?",
    description: "Dream feature request",
    required: false,
    maxLength: 400,
  },
  {
    type: "slider",
    question: "Would you stake tokens for governance power?",
    description: "Lock tokens → more voting weight",
    required: false,
    sliderLabels: ["Never", "Very unlikely", "Unlikely", "Maybe", "Probably", "Very likely", "Yes!"],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 8: FEATURE PRIORITIES (8 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_8: QuestionData[] = [
  {
    type: "ranking",
    question: "Rank these features by PRIORITY",
    description: "What should we build NEXT? Drag to reorder 🏆",
    required: true,
    options: [
      { label: "⚡ Realtime Velocity Dashboard", icon: "⚡" },
      { label: "📅 Scheduled Posts + Timing", icon: "📅" },
      { label: "🎬 Video Content Support", icon: "🎬" },
      { label: "🌐 Cross-Platform Analytics", icon: "🌐" },
      { label: "🤖 AI-Powered Insights", icon: "🤖" },
      { label: "👥 Team/Brand Accounts", icon: "👥" },
      { label: "🔗 Public API Access", icon: "🔗" },
      { label: "📱 Native Mobile App", icon: "📱" },
      { label: "🔐 Encrypted Messaging", icon: "🔐" },
      { label: "🛒 Digital Marketplace", icon: "🛒" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which SOCIAL features are most important?",
    description: "Select your top priorities",
    required: true,
    options: [
      { label: "Direct Messages", icon: "✉️" },
      { label: "Group Chats", icon: "👥" },
      { label: "Voice Channels", icon: "🎙️" },
      { label: "Stories/Reels", icon: "📱" },
      { label: "Live Streaming", icon: "🔴" },
      { label: "Communities/Groups", icon: "🏘️" },
      { label: "Events Calendar", icon: "📅" },
      { label: "Collaborative Posts", icon: "🤝" },
    ],
  },
  {
    type: "slider",
    question: "How important is a MOBILE APP?",
    description: "Native iOS/Android app",
    required: true,
    sliderLabels: ["Not at all", "Nice to have", "Somewhat", "Important", "Very important", "Critical", "Won't use without"],
  },
  {
    type: "slider",
    question: "How interested are you in API ACCESS?",
    description: "Build tools on top of VeggaStare",
    required: false,
    sliderLabels: ["Not at all", "Curious", "Somewhat", "Interested", "Very", "Would pay", "Day 1"],
  },
  {
    type: "nested",
    question: "Would you PAY for premium features?",
    description: "Advanced analytics, API access, priority support",
    required: true,
    options: [
      { label: "Yes, monthly subscription", icon: "💳" },
      { label: "Yes, one-time purchase", icon: "💰" },
      { label: "Yes, but only crypto", icon: "₿" },
      { label: "No, should be free", icon: "🆓" },
    ],
    followUps: [
      {
        condition: "Yes, monthly subscription",
        questions: [
          {
            type: "slider",
            question: "How much per month?",
            sliderLabels: ["$2", "$5", "$8", "$10", "$15", "$20", "$30+"],
          },
        ],
      },
    ],
  },
  {
    type: "choice",
    question: "How should we handle NOTIFICATIONS?",
    description: "Alerts for new activity",
    required: true,
    options: [
      { label: "All notifications always", icon: "🔔" },
      { label: "Smart/AI-filtered", icon: "🤖" },
      { label: "Daily digest only", icon: "📧" },
      { label: "Let me fully customize", icon: "⚙️" },
      { label: "As few as possible", icon: "🔕" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which INTEGRATIONS would you use?",
    description: "Connect VeggaStare to other services",
    required: false,
    options: [
      { label: "Notion", icon: "📝" },
      { label: "Zapier", icon: "⚡" },
      { label: "Discord bots", icon: "🟣" },
      { label: "Telegram", icon: "✈️" },
      { label: "Slack", icon: "💬" },
      { label: "Google Sheets", icon: "📊" },
      { label: "Shopify", icon: "🛒" },
      { label: "WordPress", icon: "📰" },
    ],
  },
  {
    type: "text",
    question: "What's the ONE feature that would make VeggaStare perfect?",
    description: "Your killer feature request",
    required: false,
    maxLength: 400,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 9: COMMUNITY & SOCIAL (6 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_9: QuestionData[] = [
  {
    type: "slider",
    question: "How important is COMMUNITY to you on VeggaStare?",
    description: "A = Just want metrics, G = Community is everything",
    required: true,
    sliderLabels: ["Don't care", "Nice to have", "Somewhat", "Important", "Very important", "Essential", "Everything"],
  },
  {
    type: "multi-choice",
    question: "What kind of COMMUNITIES would you join?",
    description: "Select all that interest you",
    required: false,
    options: [
      { label: "Creator communities", icon: "🎨" },
      { label: "Trader/investor groups", icon: "📈" },
      { label: "Local/regional", icon: "📍" },
      { label: "Industry/niche specific", icon: "🎯" },
      { label: "Learning/education", icon: "📚" },
      { label: "Gaming/esports", icon: "🎮" },
      { label: "Music/entertainment", icon: "🎵" },
      { label: "Web3/crypto", icon: "⛓️" },
    ],
  },
  {
    type: "choice",
    question: "Should communities be TOKEN-GATED?",
    description: "Require NFT/token to access",
    required: true,
    options: [
      { label: "Yes, some should be", icon: "🔒" },
      { label: "Optional for creators", icon: "⚙️" },
      { label: "No, always open", icon: "🔓" },
      { label: "Paid tier only", icon: "💳" },
    ],
  },
  {
    type: "slider",
    question: "Would you pay for PREMIUM community features?",
    description: "Private channels, custom roles, analytics",
    required: false,
    sliderLabels: ["Never", "Maybe", "$2/mo", "$5/mo", "$10/mo", "$15/mo", "$20+/mo"],
  },
  {
    type: "choice",
    question: "How should MODERATION work?",
    description: "Keeping communities safe",
    required: true,
    options: [
      { label: "Community elected mods", icon: "🗳️" },
      { label: "Creator appoints mods", icon: "👑" },
      { label: "AI-assisted moderation", icon: "🤖" },
      { label: "Platform-wide rules only", icon: "📜" },
      { label: "Hybrid approach", icon: "⚖️" },
    ],
  },
  {
    type: "text",
    question: "Describe your ideal VeggaStare community",
    description: "What would make it special?",
    required: false,
    maxLength: 400,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 10: OPEN FEEDBACK & INNOVATION (8 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_10: QuestionData[] = [
  {
    type: "slider",
    question: "Overall, how SATISFIED are you with VeggaStare?",
    description: "A = Very dissatisfied, G = Love it!",
    required: true,
    sliderLabels: ["Very dissatisfied", "Dissatisfied", "Neutral", "Somewhat satisfied", "Satisfied", "Very satisfied", "Love it!"],
  },
  {
    type: "slider",
    question: "How likely are you to RECOMMEND VeggaStare?",
    description: "Net Promoter Score",
    required: true,
    sliderLabels: ["0 - Never", "2", "4", "5 - Maybe", "6", "8", "10 - Absolutely!"],
  },
  {
    type: "text",
    question: "What's the ONE thing you'd change about the Reach system?",
    description: "Your most impactful suggestion",
    required: false,
    maxLength: 500,
  },
  {
    type: "text",
    question: "What feature would make you use VeggaStare DAILY?",
    description: "What's missing?",
    required: false,
    maxLength: 500,
  },
  {
    type: "text",
    question: "What's your WILDEST idea for VeggaStare?",
    description: "Dream big — no idea is too crazy! 🚀",
    required: false,
    maxLength: 600,
  },
  {
    type: "image-upload",
    question: "Have mockups, sketches, or screenshots to share?",
    description: "Upload any visual feedback!",
    required: false,
    maxImages: 5,
  },
  {
    type: "choice",
    question: "Would you participate in a BETA tester program?",
    description: "Early access to new features",
    required: false,
    options: [
      { label: "Yes, sign me up!", icon: "🚀" },
      { label: "Maybe, depends on rewards", icon: "🤔" },
      { label: "Only for specific features", icon: "⚙️" },
      { label: "No thanks", icon: "❌" },
    ],
  },
  {
    type: "text",
    question: "Any final thoughts or feedback?",
    description: "We read EVERY response! 💜",
    required: false,
    maxLength: 1000,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// ALL SECTIONS COMBINED
// ════════════════════════════════════════════════════════════════════════════
const ALL_SECTIONS = [
  { title: "👤 About You", description: "Help us understand your perspective", questions: SECTION_1 },
  { title: "📊 The 6 Pillars", description: "Evaluate and tune each pillar", questions: SECTION_2 },
  { title: "⚡ 7th Pillar: Velocity", description: "Realtime momentum tracking", questions: SECTION_3 },
  { title: "🔐 Auth & Poll Power", description: "Verification affects voting weight", questions: SECTION_4 },
  { title: "🛡️ Anti-Gaming", description: "View integrity and bot prevention", questions: SECTION_5 },
  { title: "🎨 UI/UX Design", description: "How should everything look?", questions: SECTION_6 },
  { title: "🌐 Web3 & Crypto", description: "Wallets, NFTs, payments", questions: SECTION_7 },
  { title: "🚀 Feature Priorities", description: "What should we build next?", questions: SECTION_8 },
  { title: "👥 Community", description: "Social features and groups", questions: SECTION_9 },
  { title: "💡 Open Innovation", description: "Your wildest ideas!", questions: SECTION_10 },
];

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════
function mapQuestionType(type: string): PollQuestionType {
  const typeMap: Record<string, PollQuestionType> = {
    slider: PollQuestionType.SLIDER,
    choice: PollQuestionType.SINGLE_CHOICE,
    "multi-choice": PollQuestionType.MULTI_CHOICE,
    text: PollQuestionType.TEXT,
    ranking: PollQuestionType.RANKING,
    "ui-arrange": PollQuestionType.UI_ARRANGE,
    nested: PollQuestionType.NESTED,
    "image-upload": PollQuestionType.IMAGE_UPLOAD,
  };
  return typeMap[type] || PollQuestionType.TEXT;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ════════════════════════════════════════════════════════════════════════════
async function seedReachAuditPoll() {
  const totalQuestions = ALL_SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);

  console.log("🚀 Creating the REACH System Comprehensive Audit Poll...\n");
  console.log(`📊 Total questions: ${totalQuestions}`);
  console.log(`📑 Total sections: ${ALL_SECTIONS.length}`);

  // Find admin user
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
    console.log("Delete it first to recreate:");
    console.log("  npx ts-node --transpile-only scripts/delete-reach-polls.ts --delete");
    return existingPoll;
  }

  // Build all questions
  let questionOrder = 0;
  const allQuestions: Prisma.PollQuestionCreateWithoutAdvancedPollInput[] = [];

  for (const section of ALL_SECTIONS) {
    console.log(`\n📋 ${section.title} (${section.questions.length} questions)`);

    for (const q of section.questions) {
      questionOrder++;

      // Build slider config (also used for other JSON configs)
      let sliderConfig: Prisma.InputJsonValue | undefined = undefined;
      if (q.type === "slider" && q.sliderLabels) {
        sliderConfig = {
          min: 1,
          max: q.sliderLabels.length,
          steps: q.sliderLabels.length,
          showValue: true,
          labels: q.sliderLabels,
        } as Prisma.InputJsonValue;
      } else if (q.type === "nested" && q.followUps) {
        // Store nested config in sliderConfig field (JSON)
        sliderConfig = {
          type: "nested",
          followUps: q.followUps.map(fu => ({
            condition: fu.condition,
            questionCount: fu.questions?.length || 0,
          })),
        } as Prisma.InputJsonValue;
      } else if (q.type === "ui-arrange" && q.uiElements) {
        // Store UI arrange config in sliderConfig field (JSON)
        sliderConfig = {
          type: "ui-arrange",
          elements: q.uiElements,
        } as Prisma.InputJsonValue;
      } else if (q.type === "image-upload") {
        sliderConfig = {
          type: "image-upload",
          maxImages: q.maxImages || 3,
        } as Prisma.InputJsonValue;
      }

      // Build options
      const options = q.options?.map((opt, idx) => ({
        text: opt.icon ? `${opt.icon} ${opt.label}` : opt.label,
        order: idx + 1,
      }));

      allQuestions.push({
        order: questionOrder,
        type: mapQuestionType(q.type),
        text: q.question,
        description: q.description || null,
        isRequired: q.required ?? false, // Default to NOT required for partial completion
        allowImages: q.type === "text" || q.type === "image-upload",
        allowComments: true,
        sliderConfig,
        ...(options && options.length > 0 ? { Options: { create: options } } : {}),
      });
    }
  }

  console.log(`\n📊 Total questions to create: ${allQuestions.length}`);

  // Create the poll
  const poll = await prisma.advancedPoll.create({
    data: {
      title: "VeggaStare REACH System Comprehensive Audit",
      description: POLL_DESCRIPTION,
      type: AdvancedPollType.REACH_ASSESSMENT,
      allowPartial: true, // ⚡ PARTIAL COMPLETION ENABLED
      requiresAuth: false, // Allow anonymous (with reduced weight)
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

  const pollWithQuestions = poll as typeof poll & { Questions: Array<{ type: string }> };

  console.log("\n" + "═".repeat(60));
  console.log("✅ POLL CREATED SUCCESSFULLY!");
  console.log("═".repeat(60));
  console.log(`📊 Poll ID: ${poll.id}`);
  console.log(`📝 Title: ${poll.title}`);
  console.log(`❓ Questions: ${pollWithQuestions.Questions.length}`);
  console.log(`⚡ Partial Completion: ENABLED`);
  console.log(`👤 Anonymous Access: ALLOWED (10% weight)`);

  console.log("\n📋 SECTION BREAKDOWN:");
  ALL_SECTIONS.forEach((section, i) => {
    console.log(`   ${i + 1}. ${section.title}: ${section.questions.length} questions`);
  });

  console.log("\n📋 QUESTION TYPES:");
  const typeCounts: Record<string, number> = {};
  for (const q of pollWithQuestions.Questions) {
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
  }
  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

  console.log("\n" + "═".repeat(60));
  console.log("🎉 The comprehensive REACH audit poll is now LIVE!");
  console.log("═".repeat(60));
  console.log(`\n🔗 API: /api/advanced-polls/${poll.id}`);

  return poll;
}

// Run
seedReachAuditPoll()
  .catch((e) => {
    console.error("❌ Error seeding poll:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
