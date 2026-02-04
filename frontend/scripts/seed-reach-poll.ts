/**
 * Seed Script: Create the Comprehensive REACH System Audit Poll
 * 
 * Run with: npx ts-node --transpile-only scripts/seed-reach-poll.ts
 * 
 * Contains 75+ questions across 8 sections covering all aspects of the REACH system.
 */

import { PrismaClient, AdvancedPollType, PollQuestionType, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const POLL_DESCRIPTION = `
Welcome to the VeggaStare REACH System Comprehensive Audit! 🚀

Your voice shapes the future of how we measure true social impact. This comprehensive audit covers:

📊 The 7 Pillars - Rate and help improve each pillar of the Reach system
🔐 Verification Tiers - Authentication levels and vote weighting  
🎨 UI/UX Preferences - Layout, themes, and visual design
🚀 Feature Priorities - What should we build next
🛡️ Anti-Gaming & Security - Bot prevention and integrity
📈 Analytics & Tracking - Data visualization and insights
👥 Community & Social - Engagement and social features

Your responses are weighted by your verification level:
  • Anonymous: 10% weight
  • Email Verified: 50% weight  
  • Social OAuth: 70% weight
  • Wallet Verified: 90% weight
  • Fully Verified: 120% weight (bonus!)

Partial completion is allowed - but completing more = higher influence!

Estimated time: 15-30 minutes | 75+ questions
`.trim();

interface QuestionData {
  type: "slider" | "choice" | "multi-choice" | "text" | "ranking";
  question: string;
  description?: string;
  required?: boolean;
  sliderLabels?: string[];
  options?: Array<{ label: string; icon?: string; description?: string }>;
  maxSelections?: number;
  maxLength?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1: USER CONTEXT (6 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_1: QuestionData[] = [
  {
    type: "choice",
    question: "How would you describe your primary role here on VeggaStare?",
    description: "We'd love to understand your unique perspective — your voice matters in shaping this platform!",
    required: true,
    options: [
      { label: "Content Creator", icon: "🎨", description: "I create and share content" },
      { label: "Content Explorer", icon: "🔍", description: "I discover and engage with content" },
      { label: "Community Curator", icon: "📚", description: "I organize and recommend content" },
      { label: "Marketplace Seller", icon: "🏪", description: "I sell products/services" },
      { label: "Smart Shopper", icon: "🛒", description: "I browse and purchase" },
      { label: "Collector & Trader", icon: "💎", description: "I collect and trade assets" },
      { label: "Networker", icon: "🤝", description: "I connect people" },
      { label: "Influencer", icon: "📢", description: "I share with my audience" },
      { label: "Supporter", icon: "💖", description: "I support creators" },
      { label: "Contributor", icon: "🚀", description: "I want to help build" },
      { label: "Tester", icon: "🔬", description: "I test and give feedback" },
      { label: "Multi-Role Poweruser", icon: "⭐", description: "I do multiple things" },
      { label: "Observer", icon: "👀", description: "I'm still figuring it out" },
    ],
  },
  {
    type: "choice",
    question: "Would you be interested in contributing to VeggaStare's growth?",
    description: "We're always looking for passionate people to join our mission! 🌟",
    required: false,
    options: [
      { label: "Yes — as a developer", icon: "💻" },
      { label: "Yes — as a designer", icon: "🎨" },
      { label: "Yes — as content creator", icon: "📝" },
      { label: "Yes — as community builder", icon: "🤝" },
      { label: "Yes — as sponsor/investor", icon: "💰" },
      { label: "Yes — as tester/reviewer", icon: "🔬" },
      { label: "Yes — as translator", icon: "🌍" },
      { label: "Maybe later", icon: "⏳" },
      { label: "I prefer to just use the platform", icon: "👤" },
    ],
  },
  {
    type: "slider",
    question: "How familiar are you with VeggaStare's current Reach metrics?",
    description: "A = Never heard of it, G = I understand all pillars deeply",
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
    description: "Select all that apply — more connections = stronger identity 💪",
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
      { label: "Twitter/X OAuth", icon: "🐦" },
      { label: "LinkedIn OAuth", icon: "💼" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which additional verification services would you like us to add?",
    description: "Help us prioritize what matters to you!",
    required: false,
    maxSelections: 5,
    options: [
      { label: "PayPal", icon: "🅿️" },
      { label: "Vipps", icon: "💚" },
      { label: "Twitch", icon: "💜" },
      { label: "YouTube", icon: "🔴" },
      { label: "TikTok", icon: "🎵" },
      { label: "ENS Domain", icon: "🌐" },
      { label: "Lens Protocol", icon: "🌿" },
      { label: "Farcaster", icon: "🟣" },
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2: CURRENT 6 PILLARS EVALUATION (13 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_2: QuestionData[] = [
  // Pillar 1: Visibility
  {
    type: "slider",
    question: "How valuable is the 'Visibility' pillar to you?",
    description: "👁️ Measures unique exposures deduped across sessions (Current: 20% weight)",
    required: true,
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "slider",
    question: "Is 20% weight for Visibility appropriate?",
    description: "Current: 20% of total Reach score",
    required: true,
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Just right", "Slightly low", "Too low", "Way too low"],
  },
  // Pillar 2: Engagement Depth
  {
    type: "slider",
    question: "How valuable is the 'Engagement Depth' pillar to you?",
    description: "💬 Quality interactions beyond likes — saves, comments, dwell time (Current: 30% weight)",
    required: true,
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "slider",
    question: "Is 30% weight for Engagement Depth appropriate?",
    description: "Current: 30% of total Reach score (highest weighted)",
    required: true,
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Just right", "Slightly low", "Too low", "Way too low"],
  },
  {
    type: "multi-choice",
    question: "Which engagement signals should count MORE?",
    description: "Select up to 3 that deserve higher weight",
    required: true,
    maxSelections: 3,
    options: [
      { label: "Comments", icon: "💬" },
      { label: "Saves/Bookmarks", icon: "🔖" },
      { label: "Shares", icon: "📤" },
      { label: "Dwell Time", icon: "⏱️" },
      { label: "Scroll Depth", icon: "📜" },
      { label: "Reply Chains", icon: "↩️" },
    ],
  },
  // Pillar 3: Conversion Impact
  {
    type: "slider",
    question: "How valuable is the 'Conversion Impact' pillar to you?",
    description: "🛒 Marketplace actions driven — clicks, purchases (Current: 20% weight)",
    required: true,
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "choice",
    question: "Should 'Conversion Impact' count for non-sellers?",
    description: "Currently all users get this pillar scored",
    required: true,
    options: [
      { label: "Yes, keep it for everyone" },
      { label: "Higher weight for sellers" },
      { label: "Create separate metrics" },
      { label: "Remove for non-sellers" },
    ],
  },
  // Pillar 4: Loyalty
  {
    type: "slider",
    question: "How valuable is the 'Loyalty' pillar to you?",
    description: "❤️ Repeat engagers who interact consistently (Current: 15% weight)",
    required: true,
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "slider",
    question: "How many interactions should define a 'loyal' engager?",
    description: "A = 2 interactions, G = 10+ interactions over time",
    required: true,
    sliderLabels: ["2 times", "3 times", "4 times", "5 times", "6-7 times", "8-9 times", "10+ times"],
  },
  // Pillar 5: Growth
  {
    type: "slider",
    question: "How valuable is the 'Growth' pillar to you?",
    description: "📈 Organic expansion from posts — new follows/visits (Current: 10% weight)",
    required: true,
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "slider",
    question: "Is 10% weight for Growth appropriate?",
    description: "Currently the second-lowest weighted pillar",
    required: true,
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Just right", "Slightly low", "Too low", "Way too low"],
  },
  // Pillar 6: Recall
  {
    type: "slider",
    question: "How valuable is the 'Recall' pillar to you?",
    description: "🔄 Predicted return rate and content stickiness (Current: 5% weight)",
    required: true,
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
  },
  {
    type: "choice",
    question: "Should 'Recall' be predictive or historical?",
    description: "Currently attempts to predict future engagement",
    required: true,
    options: [
      { label: "Keep it predictive", description: "Forward-looking estimates" },
      { label: "Make it historical only", description: "Based on actual return data" },
      { label: "Blend both approaches", description: "Weight historical more, add prediction" },
      { label: "Merge into Loyalty", description: "Recall is just loyalty over time" },
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3: THE 7TH PILLAR - VELOCITY (7 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_3: QuestionData[] = [
  {
    type: "choice",
    question: "Should we add a 7th pillar: 'Velocity'?",
    description: "⚡ Measures realtime engagement momentum, viral spread, and timing optimization",
    required: true,
    options: [
      { label: "Yes, definitely add it!", icon: "✅" },
      { label: "Yes, but make it optional", icon: "🔄" },
      { label: "Maybe, need more details", icon: "🤔" },
      { label: "No, 6 pillars is enough", icon: "❌" },
    ],
  },
  {
    type: "slider",
    question: "How important is knowing when your content is 'going viral'?",
    description: "A = Not at all, G = Extremely important",
    required: true,
    sliderLabels: ["Not important", "Slightly", "Somewhat", "Moderately", "Important", "Very important", "Critical"],
  },
  {
    type: "multi-choice",
    question: "Which Velocity sub-metrics interest you most?",
    description: "Select all that apply",
    required: true,
    options: [
      { label: "Engagement Rate over Time", icon: "📈" },
      { label: "Viral Coefficient", icon: "🔥" },
      { label: "Peak Timing Analysis", icon: "⏰" },
      { label: "Cross-Network Signals", icon: "🌐" },
      { label: "Trend Detection", icon: "📊" },
      { label: "Momentum Graph", icon: "📉" },
    ],
  },
  {
    type: "slider",
    question: "What weight should Velocity have in the total Reach score?",
    description: "A = 0% (don't include), G = 15% (major factor)",
    required: true,
    sliderLabels: ["0%", "3%", "5%", "8%", "10%", "12%", "15%"],
  },
  {
    type: "choice",
    question: "Should Velocity affect content distribution?",
    description: "High velocity content could get boosted in feeds",
    required: true,
    options: [
      { label: "Yes, boost high-velocity content" },
      { label: "Yes, but only notify creator" },
      { label: "No, display-only metric" },
      { label: "Let users choose" },
    ],
  },
  {
    type: "slider",
    question: "How quickly should Velocity decay for old content?",
    description: "A = Very fast (hours), G = Very slow (weeks)",
    required: true,
    sliderLabels: ["Hours", "1 day", "2-3 days", "1 week", "2 weeks", "1 month", "Never decay"],
  },
  {
    type: "text",
    question: "Any thoughts on the Velocity pillar?",
    description: "Share your ideas or concerns",
    required: false,
    maxLength: 500,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4: AUTH LEVELS & POLL POWER (10 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_4: QuestionData[] = [
  {
    type: "slider",
    question: "How fair is it that verified users have more poll power?",
    description: "Currently: Anonymous = 0.1x, Fully Verified = 1.2x",
    required: true,
    sliderLabels: ["Very unfair", "Unfair", "Slightly unfair", "Neutral", "Slightly fair", "Fair", "Very fair"],
  },
  {
    type: "choice",
    question: "What should be the MINIMUM auth level to participate in polls?",
    description: "Currently requires at least email verification",
    required: true,
    options: [
      { label: "Allow anonymous" },
      { label: "Email verified (current)" },
      { label: "Social OAuth required" },
      { label: "Payment verified only" },
    ],
  },
  {
    type: "slider",
    question: "Should incomplete polls count at all?",
    description: "A = 0% weight (must complete), G = 100% weight (partial = full)",
    required: true,
    sliderLabels: ["0%", "10%", "25%", "50%", "75%", "90%", "100%"],
  },
  {
    type: "multi-choice",
    question: "Which verifications should give the BIGGEST poll power boost?",
    description: "Select up to 3 that should be weighted highest",
    required: true,
    maxSelections: 3,
    options: [
      { label: "Multiple OAuth providers", icon: "🔐" },
      { label: "Web3 wallet signature", icon: "✍️" },
      { label: "Payment card verified", icon: "💳" },
      { label: "Crypto purchase made", icon: "🪙" },
      { label: "Phone verified", icon: "📱" },
      { label: "Account age > 30 days", icon: "📅" },
      { label: "Engagement history", icon: "📊" },
    ],
  },
  {
    type: "choice",
    question: "Should poll power be visible to users?",
    description: "Would you want to see your own poll power score?",
    required: true,
    options: [
      { label: "Yes, show it publicly" },
      { label: "Yes, but only to me" },
      { label: "No, keep it hidden" },
      { label: "Make it opt-in" },
    ],
  },
  {
    type: "choice",
    question: "Should platform owners/admins have boosted poll power?",
    description: "Owners invest time and resources — should their voice carry extra weight?",
    required: true,
    options: [
      { label: "Yes, significant boost (2-3x)", icon: "👑" },
      { label: "Yes, moderate boost (1.5-2x)", icon: "⭐" },
      { label: "Yes, slight boost (1.2-1.5x)", icon: "✨" },
      { label: "No, owners vote equally", icon: "⚖️" },
      { label: "Owners should vote LESS", icon: "🤐" },
    ],
  },
  {
    type: "slider",
    question: "If owner boost exists, how much should it be?",
    description: "A = 1.1x (barely noticeable), G = 5x (dominant voice)",
    required: true,
    sliderLabels: ["1.1x", "1.5x", "2x", "2.5x", "3x", "4x", "5x"],
  },
  {
    type: "multi-choice",
    question: "Which owner/admin actions should be transparent?",
    description: "Select all that you think should be publicly visible",
    required: false,
    maxSelections: 5,
    options: [
      { label: "Boost multiplier on profile", icon: "👁️" },
      { label: "Votes marked as 'owner vote'", icon: "🏷️" },
      { label: "Weight calculation shown", icon: "📊" },
      { label: "Separate owner vs user results", icon: "📈" },
      { label: "Owner actions logged", icon: "📝" },
      { label: "No transparency needed", icon: "🔒" },
    ],
  },
  {
    type: "choice",
    question: "Should owners be able to override poll results?",
    description: "Sometimes the community might vote for something that breaks the platform",
    required: true,
    options: [
      { label: "Never — community decides", icon: "🗳️" },
      { label: "Only in emergencies", icon: "🚨" },
      { label: "Veto with explanation", icon: "📢" },
      { label: "Delay implementation", icon: "⏸️" },
      { label: "Owners have final say", icon: "👑" },
    ],
  },
  {
    type: "text",
    question: "What special considerations should owner/admin polls have?",
    description: "Share your thoughts on balancing platform vision with community voice 🌟",
    required: false,
    maxLength: 500,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5: VIEW STRENGTH & ANTI-GAMING (5 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_5: QuestionData[] = [
  {
    type: "slider",
    question: "How aggressively should we dedupe repeat views?",
    description: "A = Light (count most views), G = Aggressive (strict deduplication)",
    required: true,
    sliderLabels: ["Very light", "Light", "Moderate-light", "Balanced", "Moderate-strict", "Strict", "Very strict"],
  },
  {
    type: "slider",
    question: "How long should a view need to register (dwell time)?",
    description: "Currently: 500ms minimum on-screen",
    required: true,
    sliderLabels: ["100ms", "250ms", "500ms", "1 second", "2 seconds", "3 seconds", "5 seconds"],
  },
  {
    type: "choice",
    question: "Should we reduce view weight for same-IP different users?",
    description: "Currently: 0.7x multiplier for office/home shared IPs",
    required: true,
    options: [
      { label: "Keep current (0.7x)" },
      { label: "Reduce less (0.85x)" },
      { label: "Reduce more (0.5x)" },
      { label: "No reduction" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which anti-gaming measures do you support?",
    description: "Select all measures you think are fair",
    required: true,
    options: [
      { label: "Rate limiting views", icon: "⏱️" },
      { label: "Burst pattern detection", icon: "📊" },
      { label: "Bot detection", icon: "🤖" },
      { label: "VPN/proxy detection", icon: "🔍" },
      { label: "CAPTCHA challenges", icon: "🧩" },
      { label: "Browser fingerprinting", icon: "👆" },
    ],
  },
  {
    type: "slider",
    question: "How transparent should anti-gaming measures be?",
    description: "A = Hidden, G = Fully transparent",
    required: true,
    sliderLabels: ["Hidden", "Minimal info", "Some info", "Balanced", "Detailed", "Very detailed", "Fully open"],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 6: UI/UX PREFERENCES (5 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_6: QuestionData[] = [
  {
    type: "choice",
    question: "How should the Reach score be displayed on profiles?",
    description: "Current: Radar chart with 6 pillars",
    required: true,
    options: [
      { label: "Radar/Spider chart (current)", icon: "🕸️" },
      { label: "Horizontal bar chart", icon: "📊" },
      { label: "Pie/Donut chart", icon: "🍩" },
      { label: "Single number score", icon: "🔢" },
      { label: "Gamified badges/levels", icon: "🏆" },
    ],
  },
  {
    type: "slider",
    question: "How prominent should Reach scores be on profiles?",
    description: "A = Hidden/subtle, G = Front and center",
    required: true,
    sliderLabels: ["Hidden", "Very subtle", "Subtle", "Moderate", "Prominent", "Very prominent", "Dominant"],
  },
  {
    type: "choice",
    question: "Should users be able to hide their Reach score?",
    description: "Privacy option for those who don't want scores public",
    required: true,
    options: [
      { label: "No, always visible" },
      { label: "Yes, hide everything" },
      { label: "Yes, hide breakdown only" },
      { label: "Yes, hide total only" },
    ],
  },
  {
    type: "multi-choice",
    question: "Which Reach insights would you want on your dashboard?",
    description: "Select all that interest you",
    required: true,
    options: [
      { label: "Score trends over time", icon: "📈" },
      { label: "Compare to similar users", icon: "👥" },
      { label: "Improvement tips", icon: "💡" },
      { label: "Milestone notifications", icon: "🎉" },
      { label: "Detailed breakdown", icon: "🔍" },
      { label: "Export/download data", icon: "📥" },
    ],
  },
  {
    type: "choice",
    question: "What theme style do you prefer?",
    description: "The overall visual style of VeggaStare",
    required: true,
    options: [
      { label: "Dark Mode", icon: "🌙" },
      { label: "Light Mode", icon: "☀️" },
      { label: "Auto (System)", icon: "🔄" },
      { label: "Custom/Profile Colors", icon: "🎨" },
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 7: FEATURE PRIORITIZATION (5 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_7: QuestionData[] = [
  {
    type: "ranking",
    question: "Rank these potential features by priority",
    description: "Drag to reorder (top = highest priority)",
    required: true,
    options: [
      { label: "Realtime Velocity Dashboard", icon: "⚡" },
      { label: "Scheduled Posts with Timing Optimization", icon: "📅" },
      { label: "Video Content Support", icon: "🎬" },
      { label: "Cross-Platform Analytics", icon: "🌐" },
      { label: "AI-Powered Insights", icon: "🤖" },
      { label: "Team/Brand Accounts", icon: "👥" },
      { label: "Public API Access", icon: "🔗" },
      { label: "Mobile App", icon: "📱" },
    ],
  },
  {
    type: "slider",
    question: "How interested are you in 'Scheduled Pulse' posts?",
    description: "Schedule content release for optimal timing",
    required: true,
    sliderLabels: ["Not interested", "Slightly", "Somewhat", "Moderately", "Interested", "Very interested", "Extremely"],
  },
  {
    type: "slider",
    question: "How important is video content support?",
    description: "YouTube, Twitch embeds, native video upload",
    required: true,
    sliderLabels: ["Not important", "Slightly", "Somewhat", "Moderately", "Important", "Very important", "Critical"],
  },
  {
    type: "choice",
    question: "Would you pay for premium Reach analytics?",
    description: "Advanced insights, historical data, API access",
    required: true,
    options: [
      { label: "Yes, monthly subscription" },
      { label: "Yes, one-time purchase" },
      { label: "Yes, but only with crypto" },
      { label: "No, should be free" },
    ],
  },
  {
    type: "slider",
    question: "How much would you pay per month for premium analytics?",
    description: "A = $0, G = $20+",
    required: false,
    sliderLabels: ["$0", "$2", "$5", "$8", "$10", "$15", "$20+"],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 8: OPEN FEEDBACK (5 questions)
// ════════════════════════════════════════════════════════════════════════════
const SECTION_8: QuestionData[] = [
  {
    type: "text",
    question: "What's the ONE thing you'd change about the Reach system?",
    description: "Your most impactful suggestion",
    required: false,
    maxLength: 500,
  },
  {
    type: "text",
    question: "What feature would make you use VeggaStare daily?",
    description: "What's missing that would drive daily engagement?",
    required: false,
    maxLength: 500,
  },
  {
    type: "slider",
    question: "Overall, how satisfied are you with VeggaStare?",
    description: "A = Very dissatisfied, G = Very satisfied",
    required: true,
    sliderLabels: ["Very dissatisfied", "Dissatisfied", "Somewhat dissatisfied", "Neutral", "Somewhat satisfied", "Satisfied", "Very satisfied"],
  },
  {
    type: "slider",
    question: "How likely are you to recommend VeggaStare to a friend?",
    description: "Net Promoter Score",
    required: true,
    sliderLabels: ["0 - Never", "2", "4", "5 - Maybe", "6", "8", "10 - Absolutely"],
  },
  {
    type: "text",
    question: "Any other thoughts or feedback?",
    description: "Share anything else on your mind — we read every response! 💜",
    required: false,
    maxLength: 1000,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// ALL SECTIONS COMBINED
// ════════════════════════════════════════════════════════════════════════════
const ALL_SECTIONS = [
  { title: "About You", description: "Help us understand your perspective", questions: SECTION_1 },
  { title: "Current 6 Pillars", description: "Evaluate each existing pillar", questions: SECTION_2 },
  { title: "The 7th Pillar: Velocity", description: "Realtime momentum tracking", questions: SECTION_3 },
  { title: "Auth & Poll Power", description: "Verification affects voting weight", questions: SECTION_4 },
  { title: "View Strength & Anti-Gaming", description: "How we count and protect views", questions: SECTION_5 },
  { title: "UI/UX Preferences", description: "How should Reach be displayed?", questions: SECTION_6 },
  { title: "Feature Priorities", description: "What should we build next?", questions: SECTION_7 },
  { title: "Open Feedback", description: "Share your thoughts freely", questions: SECTION_8 },
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
    console.log("Delete it first if you want to recreate it.");
    console.log("Run: npx ts-node --transpile-only scripts/delete-reach-polls.ts --delete");
    return existingPoll;
  }

  // Build all questions
  let questionOrder = 0;
  const allQuestions: Prisma.PollQuestionCreateWithoutAdvancedPollInput[] = [];

  for (const section of ALL_SECTIONS) {
    console.log(`\n📋 Processing section: ${section.title} (${section.questions.length} questions)`);

    for (const q of section.questions) {
      questionOrder++;

      // Build slider config
      let sliderConfig: Prisma.InputJsonValue | undefined = undefined;
      if (q.type === "slider" && q.sliderLabels) {
        sliderConfig = {
          min: 1,
          max: q.sliderLabels.length,
          steps: q.sliderLabels.length,
          showValue: true,
          labels: q.sliderLabels,
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
        isRequired: q.required ?? true,
        allowImages: q.type === "text",
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
      allowPartial: true,
      requiresAuth: false,
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

  console.log("\n✅ Poll created successfully!");
  console.log(`📊 Poll ID: ${poll.id}`);
  console.log(`📝 Title: ${poll.title}`);
  console.log(`❓ Questions: ${pollWithQuestions.Questions.length}`);

  console.log("\n📋 Section overview:");
  ALL_SECTIONS.forEach((section, i) => {
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

// Run
seedReachAuditPoll()
  .catch((e) => {
    console.error("❌ Error seeding poll:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
