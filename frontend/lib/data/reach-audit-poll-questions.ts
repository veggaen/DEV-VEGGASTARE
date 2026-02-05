/**
 * VeggaStare Reach System Audit Poll
 * 
 * A comprehensive survey/exam to gather user feedback on improving the Reach metric system.
 * This poll uses various question types and branching logic.
 * 
 * Question Types:
 * - slider: A→G scale (7 points)
 * - choice: Single selection from options
 * - multi-choice: Multiple selections allowed
 * - tree: Branching based on selection
 * - text: Free text input
 * - ui-arrange: Drag boxes to arrange UI elements
 * - ranking: Drag to reorder
 * - image-upload: Paste/upload images
 */

// ─── Local Interfaces ────────────────────────────────────────────────────────

export interface PollQuestionOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface UIElement {
  id: string;
  label: string;
  defaultPosition: { x: number; y: number };
  size: 'small' | 'medium' | 'large';
}

export interface PillarContext {
  pillar: string;
  icon: string;
  currentWeight: number;
}

export interface BranchingLogic {
  [optionId: string]: string[];
}

export interface AdvancedPollQuestion {
  id: string;
  type: 'slider' | 'choice' | 'multi-choice' | 'text' | 'ranking' | 'ui-arrange' | 'image-upload';
  question: string;
  description?: string;
  options?: PollQuestionOption[];
  sliderLabels?: string[];
  pillarContext?: PillarContext;
  required?: boolean;
  conditional?: boolean;
  branchingLogic?: BranchingLogic;
  minSelections?: number;
  maxSelections?: number;
  placeholder?: string;
  maxLength?: number;
  uiElements?: UIElement[];
  maxImages?: number;
  acceptedFormats?: string[];
}

export interface PollSection {
  id: string;
  title: string;
  description: string;
  questions: AdvancedPollQuestion[];
}

// ─── Poll Configuration ──────────────────────────────────────────────────────

export const REACH_AUDIT_POLL_CONFIG = {
  id: "reach-system-innovation-v2",
  title: "VeggaStare Reach System Innovation Poll",
  subtitle: "Shape the future of how we measure true social impact together",
  description: `
    Welcome to the future of engagement metrics! Your voice helps us revolutionize 
    how VeggaStare measures and celebrates genuine social connections.
    
    Together, we're building:
    • A smarter 6-pillar system that sees beyond vanity metrics
    • The new 7th pillar (Velocity) — capturing realtime momentum
    • Fair, transparent auth-powered poll influence
    • An intuitive UI that puts your insights first
    • Features prioritized by the community, for the community
    
    Every answer shapes our shared future. Let's innovate together!
  `,
  minAuthTier: "WEB2_BASIC",
  estimatedQuestions: 75,
  sections: 8,
  allowPartial: true,
  partialPenalty: 0.5,
  // Dynamic time tracking
  defaultEstimateMinutes: { min: 15, max: 30 },
  completionTimes: [] as number[], // Will be populated dynamically
};

// ─── Section 1: User Context ─────────────────────────────────────────────────

export const SECTION_1_USER_CONTEXT: AdvancedPollQuestion[] = [
  {
    id: "s1q1",
    type: "choice",
    question: "How would you describe your primary role here on VeggaStare?",
    description: "We'd love to understand your unique perspective — your voice matters in shaping this platform!",
    options: [
      // Core User Roles
      { id: "creator", label: "Content Creator", description: "I create and share content (posts, art, products)", icon: "🎨" },
      { id: "consumer", label: "Content Explorer", description: "I discover, consume, and engage with others' content", icon: "🔍" },
      { id: "curator", label: "Community Curator", description: "I organize, highlight, and recommend great content/people", icon: "📚" },
      
      // Commerce Roles
      { id: "seller", label: "Marketplace Seller", description: "I sell products/services and build my business here", icon: "🏪" },
      { id: "buyer", label: "Smart Shopper", description: "I browse, compare, and purchase products/services", icon: "🛒" },
      { id: "trader", label: "Collector & Trader", description: "I collect, trade, and invest in digital assets/NFTs", icon: "💎" },
      
      // Social Roles
      { id: "networker", label: "Networker & Connector", description: "I connect people and facilitate collaborations", icon: "🤝" },
      { id: "influencer", label: "Influencer & Advocate", description: "I share VeggaStare with my audience and community", icon: "📢" },
      { id: "supporter", label: "Supporter & Cheerleader", description: "I support creators with engagement, tips, or subscriptions", icon: "💖" },
      
      // Builder Roles  
      { id: "contributor", label: "Future Contributor", description: "I'm interested in helping build VeggaStare!", icon: "🚀" },
      { id: "reviewer", label: "Tester & Reviewer", description: "I explore features and provide detailed feedback", icon: "🔬" },
      { id: "advisor", label: "Advisor & Strategist", description: "I have expertise to share (business, legal, tech, etc.)", icon: "🧠" },
      
      // Hybrid
      { id: "hybrid", label: "Multi-Role Poweruser", description: "I embrace multiple aspects of VeggaStare", icon: "⭐" },
      { id: "observer", label: "Curious Observer", description: "I'm new and still figuring out my role here", icon: "👀" },
    ],
    required: true,
  },
  {
    id: "s1q1b",
    type: "choice",
    question: "Would you be interested in contributing to VeggaStare's growth?",
    description: "We're always looking for passionate people to join our mission! 🌟",
    options: [
      { id: "yes_dev", label: "Yes — as a developer/engineer", description: "I can contribute code, features, or technical expertise", icon: "💻" },
      { id: "yes_design", label: "Yes — as a designer/creative", description: "I can help with UI/UX, graphics, or branding", icon: "🎨" },
      { id: "yes_content", label: "Yes — as a content creator", description: "I can create educational or promotional content", icon: "📝" },
      { id: "yes_community", label: "Yes — as a community builder", description: "I can help moderate, support, or grow the community", icon: "🤝" },
      { id: "yes_sponsor", label: "Yes — as a sponsor/investor", description: "I'm interested in financially supporting VeggaStare", icon: "💰" },
      { id: "yes_services", label: "Yes — I offer professional services", description: "I have services that could benefit VeggaStare", icon: "🛠️" },
      { id: "yes_review", label: "Yes — as a tester/reviewer", description: "I can test features, review UX, and report bugs", icon: "🔬" },
      { id: "yes_translate", label: "Yes — as a translator", description: "I can help translate VeggaStare to other languages", icon: "🌍" },
      { id: "maybe_later", label: "Maybe later — keeping my options open", description: "Not now, but keep me updated!", icon: "⏳" },
      { id: "just_user", label: "I prefer to just use the platform", description: "That's totally fine — your usage helps us grow!", icon: "👤" },
    ],
    required: false,
    conditional: true, // Show based on s1q1 answer potentially
  },
  {
    id: "s1q1c",
    type: "multi-choice",
    question: "What types of review work interest you most?",
    description: "Select all that apply — we'll match you with relevant testing opportunities! 🧪",
    options: [
      { id: "ux_review", label: "UX/Usability Testing", description: "Test user flows, identify friction points", icon: "🎯" },
      { id: "bug_hunting", label: "Bug Hunting", description: "Find and report technical issues", icon: "🐛" },
      { id: "feature_feedback", label: "Feature Feedback", description: "Review new features before launch", icon: "✨" },
      { id: "content_moderation", label: "Content Review", description: "Help moderate and flag inappropriate content", icon: "🛡️" },
      { id: "accessibility", label: "Accessibility Testing", description: "Test for a11y compliance and improvements", icon: "♿" },
      { id: "mobile_testing", label: "Mobile App Testing", description: "Test on iOS/Android devices", icon: "📱" },
      { id: "security_review", label: "Security Review", description: "Look for vulnerabilities and security issues", icon: "🔒" },
      { id: "performance", label: "Performance Testing", description: "Test speed, load times, and optimization", icon: "⚡" },
      { id: "competitive", label: "Competitive Analysis", description: "Compare features to other platforms", icon: "📊" },
      { id: "user_stories", label: "User Story Validation", description: "Review if features meet real user needs", icon: "📖" },
    ],
    required: false,
    conditional: true, // Show if reviewer or contributor selected
    minSelections: 0,
    maxSelections: 10,
  },
  {
    id: "s1q2",
    type: "slider",
    question: "How familiar are you with VeggaStare's current Reach metrics?",
    description: "No pressure — we're here to learn together! A = Never heard of it, G = I understand all 6 pillars deeply",
    sliderLabels: ["Never seen", "Noticed it", "Understand basics", "Use it regularly", "Know it well", "Expert level", "Deep expertise"],
    required: true,
  },
  {
    id: "s1q3",
    type: "slider",
    question: "How important is understanding your 'true reach' here on this application to you?",
    description: "Your authentic impact matters — help us measure it better! A = Don't care, G = Critical for my success",
    sliderLabels: ["Not important", "Slightly", "Somewhat", "Moderately", "Important", "Very important", "Critical"],
    required: true,
  },
  {
    id: "s1q4",
    type: "multi-choice",
    question: "Which verification methods have you completed?",
    description: "Select all that apply — more connections = stronger identity 💪",
    options: [
      { id: "email", label: "Email verified", icon: "📧", description: "Basic account verification" },
      { id: "google", label: "Google OAuth", icon: "🔵", description: "Connected via Google" },
      { id: "github", label: "GitHub OAuth", icon: "⚫", description: "Developer identity verified" },
      { id: "discord", label: "Discord OAuth", icon: "🟣", description: "Community identity verified" },
      { id: "wallet", label: "Web3 Wallet connected", icon: "🔗", description: "Blockchain wallet linked" },
      { id: "wallet_signed", label: "Wallet signature verified", icon: "✍️", description: "Cryptographic proof of ownership" },
      { id: "payment_card", label: "Payment card on file", icon: "💳", description: "Financial identity verified" },
      { id: "crypto_purchase", label: "Made a crypto purchase", icon: "🪙", description: "On-chain transaction history" },
      { id: "phone", label: "Phone number verified", icon: "📱", description: "SMS verification complete" },
      { id: "x", label: "X OAuth", icon: "𝕏", description: "Social identity verified" },
      { id: "linkedin", label: "LinkedIn OAuth", icon: "💼", description: "Professional identity verified" },
      { id: "paypal", label: "PayPal connected", icon: "🅿️", description: "🔜 Coming soon!" },
      { id: "vipps", label: "Vipps connected", icon: "💚", description: "🔜 Will be installed soon!" },
      { id: "apple", label: "Apple ID connected", icon: "🍎", description: "🔜 Coming soon!" },
      { id: "spotify", label: "Spotify connected", icon: "🎵", description: "🔜 Music identity (coming soon)" },
      { id: "instagram", label: "Instagram connected", icon: "📸", description: "🔜 Visual identity (coming soon)" },
    ],
    required: false,
    minSelections: 0,
    maxSelections: 16,
  },
  {
    id: "s1q5",
    type: "multi-choice",
    question: "Which additional verification services would you like us to add?",
    description: "Help us prioritize what matters to you!",
    options: [
      { id: "want_paypal", label: "PayPal", icon: "🅿️", description: "Trusted payments platform" },
      { id: "want_vipps", label: "Vipps", icon: "💚", description: "Norwegian mobile payment" },
      { id: "want_venmo", label: "Venmo", icon: "💙", description: "Social payments" },
      { id: "want_cashapp", label: "Cash App", icon: "💵", description: "Square's payment app" },
      { id: "want_twitch", label: "Twitch", icon: "💜", description: "Streamer identity" },
      { id: "want_youtube", label: "YouTube", icon: "🔴", description: "Creator identity" },
      { id: "want_tiktok", label: "TikTok", icon: "🎵", description: "Short-form creator" },
      { id: "want_ens", label: "ENS Domain", icon: "🌐", description: "Web3 identity (yourname.eth)" },
      { id: "want_lens", label: "Lens Protocol", icon: "🌿", description: "Decentralized social graph" },
      { id: "want_farcaster", label: "Farcaster", icon: "🟣", description: "Decentralized social" },
    ],
    required: false,
    maxSelections: 5,
  },
];

// ─── Section 2: Current 6 Pillars Evaluation ─────────────────────────────────

export const SECTION_2_PILLAR_EVALUATION: AdvancedPollQuestion[] = [
  // Pillar 1: Visibility
  {
    id: "s2q1",
    type: "slider",
    question: "How valuable is the 'Visibility' pillar to you?",
    description: "Measures unique exposures deduped across sessions",
    pillarContext: {
      pillar: "visibility",
      icon: "👁️",
      currentWeight: 20,
    },
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
    required: true,
  },
  {
    id: "s2q2",
    type: "slider",
    question: "Is 20% weight for Visibility appropriate?",
    description: "Current: 20% of total Reach score",
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Just right", "Slightly low", "Too low", "Way too low"],
    required: true,
  },
  
  // Pillar 2: Engagement Depth
  {
    id: "s2q3",
    type: "slider",
    question: "How valuable is the 'Engagement Depth' pillar to you?",
    description: "Quality interactions beyond likes (saves, comments, dwell time)",
    pillarContext: {
      pillar: "engagementDepth",
      icon: "💬",
      currentWeight: 30,
    },
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
    required: true,
  },
  {
    id: "s2q4",
    type: "slider",
    question: "Is 30% weight for Engagement Depth appropriate?",
    description: "Current: 30% of total Reach score (highest weighted)",
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Just right", "Slightly low", "Too low", "Way too low"],
    required: true,
  },
  {
    id: "s2q5",
    type: "multi-choice",
    question: "Which engagement signals should count MORE?",
    description: "Select up to 3 that deserve higher weight",
    options: [
      { id: "comments", label: "Comments", description: "Written responses" },
      { id: "saves", label: "Saves/Bookmarks", description: "Content saved for later" },
      { id: "shares", label: "Shares", description: "Content shared externally" },
      { id: "dwell", label: "Dwell Time", description: "Time spent viewing" },
      { id: "scroll", label: "Scroll Depth", description: "How much content viewed" },
      { id: "replies", label: "Reply Chains", description: "Back-and-forth conversations" },
    ],
    required: true,
    maxSelections: 3,
  },

  // Pillar 3: Conversion Impact
  {
    id: "s2q6",
    type: "slider",
    question: "How valuable is the 'Conversion Impact' pillar to you?",
    description: "Marketplace actions driven (clicks, purchases)",
    pillarContext: {
      pillar: "conversionImpact",
      icon: "🛒",
      currentWeight: 20,
    },
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
    required: true,
  },
  {
    id: "s2q7",
    type: "choice",
    question: "Should 'Conversion Impact' count for non-sellers?",
    description: "Currently all users get this pillar scored",
    options: [
      { id: "all", label: "Yes, keep it for everyone", description: "Profile visits, follows are conversions too" },
      { id: "sellers_only", label: "Higher weight for sellers", description: "Scale based on seller activity" },
      { id: "separate", label: "Create separate metrics", description: "Different conversions for different users" },
      { id: "remove", label: "Remove for non-sellers", description: "Only marketplace participants need this" },
    ],
    required: true,
  },

  // Pillar 4: Loyalty
  {
    id: "s2q8",
    type: "slider",
    question: "How valuable is the 'Loyalty' pillar to you?",
    description: "Repeat engagers who interact consistently",
    pillarContext: {
      pillar: "loyalty",
      icon: "❤️",
      currentWeight: 15,
    },
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
    required: true,
  },
  {
    id: "s2q9",
    type: "slider",
    question: "How many interactions should define a 'loyal' engager?",
    description: "A = 2 interactions, G = 10+ interactions over time",
    sliderLabels: ["2 times", "3 times", "4 times", "5 times", "6-7 times", "8-9 times", "10+ times"],
    required: true,
  },

  // Pillar 5: Growth
  {
    id: "s2q10",
    type: "slider",
    question: "How valuable is the 'Growth' pillar to you?",
    description: "Organic expansion from posts (new follows/visits)",
    pillarContext: {
      pillar: "growth",
      icon: "📈",
      currentWeight: 10,
    },
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
    required: true,
  },
  {
    id: "s2q11",
    type: "slider",
    question: "Is 10% weight for Growth appropriate?",
    description: "Currently the second-lowest weighted pillar",
    sliderLabels: ["Way too high", "Too high", "Slightly high", "Just right", "Slightly low", "Too low", "Way too low"],
    required: true,
  },

  // Pillar 6: Recall
  {
    id: "s2q12",
    type: "slider",
    question: "How valuable is the 'Recall' pillar to you?",
    description: "Predicted return rate and content stickiness",
    pillarContext: {
      pillar: "recall",
      icon: "🔄",
      currentWeight: 5,
    },
    sliderLabels: ["Useless", "Low value", "Some value", "Neutral", "Valuable", "Very valuable", "Essential"],
    required: true,
  },
  {
    id: "s2q13",
    type: "choice",
    question: "Should 'Recall' be predictive or historical?",
    description: "Currently attempts to predict future engagement",
    options: [
      { id: "predictive", label: "Keep it predictive", description: "Forward-looking estimates" },
      { id: "historical", label: "Make it historical only", description: "Based on actual return data" },
      { id: "hybrid", label: "Blend both approaches", description: "Weight historical more, add prediction" },
      { id: "remove", label: "Merge into Loyalty", description: "Recall is just loyalty over time" },
    ],
    required: true,
  },
];

// ─── Section 3: The 7th Pillar - Velocity ────────────────────────────────────

export const SECTION_3_VELOCITY_PILLAR: AdvancedPollQuestion[] = [
  {
    id: "s3q1",
    type: "choice",
    question: "Should we add a 7th pillar: 'Velocity'?",
    description: "Measures realtime engagement momentum, viral spread, and timing optimization",
    options: [
      { id: "yes_full", label: "Yes, definitely add it!", description: "I see value in tracking realtime momentum" },
      { id: "yes_optional", label: "Yes, but make it optional", description: "Let users choose to see it" },
      { id: "maybe", label: "Maybe, need more details", description: "Depends on implementation" },
      { id: "no", label: "No, 6 pillars is enough", description: "Adding more complicates things" },
    ],
    required: true,
    branchingLogic: {
      "yes_full": ["s3q2", "s3q3", "s3q4", "s3q5", "s3q6"],
      "yes_optional": ["s3q2", "s3q3", "s3q4", "s3q5", "s3q6"],
      "maybe": ["s3q2", "s3q3"],
      "no": ["s3q7"],
    },
  },
  {
    id: "s3q2",
    type: "slider",
    question: "How important is knowing when your content is 'going viral'?",
    description: "A = Not at all, G = Extremely important",
    sliderLabels: ["Not important", "Slightly", "Somewhat", "Moderately", "Important", "Very important", "Critical"],
    required: true,
    conditional: true,
  },
  {
    id: "s3q3",
    type: "multi-choice",
    question: "Which Velocity sub-metrics interest you most?",
    description: "Select all that apply",
    options: [
      { id: "engagement_rate", label: "Engagement Rate over Time", description: "Interactions per hour/day" },
      { id: "viral_coefficient", label: "Viral Coefficient", description: "How many new users each share brings" },
      { id: "peak_timing", label: "Peak Timing Analysis", description: "Best times to post for you" },
      { id: "cross_network", label: "Cross-Network Signals", description: "External shares and mentions" },
      { id: "trend_detection", label: "Trend Detection", description: "Early alerts when content gains traction" },
      { id: "momentum_graph", label: "Momentum Graph", description: "Visual timeline of engagement" },
    ],
    required: true,
    conditional: true,
    minSelections: 1,
  },
  {
    id: "s3q4",
    type: "slider",
    question: "What weight should Velocity have in the total Reach score?",
    description: "A = 0% (don't include), G = 15% (major factor)",
    sliderLabels: ["0%", "3%", "5%", "8%", "10%", "12%", "15%"],
    required: true,
    conditional: true,
  },
  {
    id: "s3q5",
    type: "choice",
    question: "Should Velocity affect content distribution?",
    description: "High velocity content could get boosted in feeds",
    options: [
      { id: "yes_boost", label: "Yes, boost high-velocity content", description: "Trending content should spread faster" },
      { id: "yes_notify", label: "Yes, but only notify creator", description: "Alert me when something takes off" },
      { id: "no_display_only", label: "No, display-only metric", description: "Just show it, don't act on it" },
      { id: "user_choice", label: "Let users choose", description: "Configurable per user" },
    ],
    required: true,
    conditional: true,
  },
  {
    id: "s3q6",
    type: "slider",
    question: "How quickly should Velocity decay for old content?",
    description: "A = Very fast (hours), G = Very slow (weeks)",
    sliderLabels: ["Hours", "1 day", "2-3 days", "1 week", "2 weeks", "1 month", "Never decay"],
    required: true,
    conditional: true,
  },
  {
    id: "s3q7",
    type: "text",
    question: "Why do you think 6 pillars is enough?",
    description: "Help us understand your perspective (optional)",
    placeholder: "Share your thoughts...",
    required: false,
    conditional: true,
    maxLength: 500,
  },
];

// ─── Section 4: Auth Levels & Poll Power ─────────────────────────────────────

export const SECTION_4_AUTH_POLL_POWER: AdvancedPollQuestion[] = [
  {
    id: "s4q1",
    type: "slider",
    question: "How fair is it that verified users have more poll power?",
    description: "Currently: Anonymous = 0.1x, Fully Verified = 1.2x",
    sliderLabels: ["Very unfair", "Unfair", "Slightly unfair", "Neutral", "Slightly fair", "Fair", "Very fair"],
    required: true,
  },
  {
    id: "s4q2",
    type: "choice",
    question: "What should be the MINIMUM auth level to participate in polls?",
    description: "Currently requires at least email verification",
    options: [
      { id: "anonymous", label: "Allow anonymous", description: "Anyone can vote (very low power)" },
      { id: "email", label: "Email verified (current)", description: "Basic account required" },
      { id: "social", label: "Social OAuth required", description: "Google/GitHub/Discord login" },
      { id: "payment", label: "Payment verified only", description: "Must have payment on file" },
    ],
    required: true,
  },
  {
    id: "s4q3",
    type: "slider",
    question: "Should incomplete polls count at all?",
    description: "A = 0% weight (must complete), G = 100% weight (partial = full)",
    sliderLabels: ["0%", "10%", "25%", "50%", "75%", "90%", "100%"],
    required: true,
  },
  {
    id: "s4q4",
    type: "multi-choice",
    question: "Which verifications should give the BIGGEST poll power boost?",
    description: "Select up to 3 that should be weighted highest",
    options: [
      { id: "multi_oauth", label: "Multiple OAuth providers", description: "Cross-platform identity proof" },
      { id: "wallet_signed", label: "Web3 wallet signature", description: "Cryptographic proof" },
      { id: "payment_card", label: "Payment card verified", description: "Financial identity" },
      { id: "crypto_purchase", label: "Crypto purchase made", description: "On-chain transaction" },
      { id: "phone", label: "Phone verified", description: "Mobile number confirmed" },
      { id: "account_age", label: "Account age > 30 days", description: "Established presence" },
      { id: "engagement_history", label: "Engagement history", description: "Active participation record" },
    ],
    required: true,
    maxSelections: 3,
  },
  {
    id: "s4q5",
    type: "choice",
    question: "Should poll power be visible to users?",
    description: "Would you want to see your own poll power score?",
    options: [
      { id: "yes_public", label: "Yes, show it publicly", description: "Display alongside profile" },
      { id: "yes_private", label: "Yes, but only to me", description: "Personal dashboard only" },
      { id: "no", label: "No, keep it hidden", description: "Don't show the numbers" },
      { id: "opt_in", label: "Make it opt-in", description: "Let users choose to see it" },
    ],
    required: true,
  },
  // Owner Boost Questions
  {
    id: "s4q6",
    type: "choice",
    question: "Should platform owners/admins have boosted poll power?",
    description: "Owners invest time and resources into building the platform — should their voice carry extra weight?",
    options: [
      { id: "yes_significant", label: "Yes, significant boost (2-3x)", icon: "👑", description: "They built this — their vision matters most" },
      { id: "yes_moderate", label: "Yes, moderate boost (1.5-2x)", icon: "⭐", description: "Extra weight but not overwhelming" },
      { id: "yes_slight", label: "Yes, slight boost (1.2-1.5x)", icon: "✨", description: "Small acknowledgment of ownership" },
      { id: "no_equal", label: "No, owners vote equally", icon: "⚖️", description: "Democracy — everyone's voice is equal" },
      { id: "no_less", label: "Owners should vote LESS", icon: "🤐", description: "Avoid bias — let users decide" },
    ],
    required: true,
  },
  {
    id: "s4q7",
    type: "slider",
    question: "If owner boost exists, how much should it be?",
    description: "A = 1.1x (barely noticeable), G = 5x (dominant voice)",
    sliderLabels: ["1.1x", "1.5x", "2x", "2.5x", "3x", "4x", "5x"],
    required: true,
    conditional: true,
  },
  {
    id: "s4q8",
    type: "multi-choice",
    question: "Which owner/admin actions should be transparent?",
    description: "Select all that you think should be publicly visible",
    options: [
      { id: "boost_visible", label: "Boost multiplier shown on profile", icon: "👁️", description: "Everyone can see owner status" },
      { id: "votes_marked", label: "Votes marked as 'owner vote'", icon: "🏷️", description: "Clearly labeled in poll results" },
      { id: "weight_explained", label: "Weight calculation shown", icon: "📊", description: "Show how their vote was weighted" },
      { id: "separate_results", label: "Separate owner vs user results", icon: "📈", description: "Show both perspectives" },
      { id: "changelog", label: "Owner actions logged", icon: "📝", description: "Public changelog of all owner decisions" },
      { id: "none", label: "No transparency needed", icon: "🔒", description: "Keep it private" },
    ],
    required: false,
    maxSelections: 5,
  },
  {
    id: "s4q9",
    type: "choice",
    question: "Should owners be able to override poll results?",
    description: "Sometimes the community might vote for something that breaks the platform",
    options: [
      { id: "never", label: "Never — community decides", icon: "🗳️", description: "Full democracy, no overrides" },
      { id: "emergency", label: "Only in emergencies", icon: "🚨", description: "Security/legal issues only" },
      { id: "veto", label: "Veto with explanation", icon: "📢", description: "Can override but must explain publicly" },
      { id: "delay", label: "Delay implementation", icon: "⏸️", description: "Can pause but not cancel" },
      { id: "final_say", label: "Owners have final say", icon: "👑", description: "Polls are advisory only" },
    ],
    required: true,
  },
  {
    id: "s4q10",
    type: "text",
    question: "What special considerations should owner/admin polls have?",
    description: "Share your thoughts on how to balance platform vision with community voice — we're building this together! 🌟",
    placeholder: "I think owners should be able to...",
    required: false,
    maxLength: 500,
  },
];

// ─── Section 5: View Strength & Anti-Gaming ──────────────────────────────────

export const SECTION_5_VIEW_STRENGTH: AdvancedPollQuestion[] = [
  {
    id: "s5q1",
    type: "slider",
    question: "How aggressively should we dedupe repeat views?",
    description: "A = Light (count most views), G = Aggressive (strict deduplication)",
    sliderLabels: ["Very light", "Light", "Moderate-light", "Balanced", "Moderate-strict", "Strict", "Very strict"],
    required: true,
  },
  {
    id: "s5q2",
    type: "slider",
    question: "How long should a view need to register (dwell time)?",
    description: "Currently: 500ms minimum on-screen",
    sliderLabels: ["100ms", "250ms", "500ms", "1 second", "2 seconds", "3 seconds", "5 seconds"],
    required: true,
  },
  {
    id: "s5q3",
    type: "choice",
    question: "Should we reduce view weight for same-IP different users?",
    description: "Currently: 0.7x multiplier for office/home shared IPs",
    options: [
      { id: "current", label: "Keep current (0.7x)", description: "Moderate reduction" },
      { id: "less", label: "Reduce less (0.85x)", description: "Light reduction" },
      { id: "more", label: "Reduce more (0.5x)", description: "Heavier reduction" },
      { id: "none", label: "No reduction", description: "Trust all users equally" },
    ],
    required: true,
  },
  {
    id: "s5q4",
    type: "multi-choice",
    question: "Which anti-gaming measures do you support?",
    description: "Select all measures you think are fair",
    options: [
      { id: "rate_limit", label: "Rate limiting views", description: "Max views per hour from same user" },
      { id: "burst_detection", label: "Burst pattern detection", description: "Flag sudden spikes" },
      { id: "bot_detection", label: "Bot detection", description: "Block automated views" },
      { id: "vpn_detection", label: "VPN/proxy detection", description: "Flag masked IPs" },
      { id: "captcha", label: "CAPTCHA challenges", description: "Verify human on suspicious patterns" },
      { id: "browser_fingerprint", label: "Browser fingerprinting", description: "Track unique devices" },
    ],
    required: true,
    minSelections: 1,
  },
  {
    id: "s5q5",
    type: "slider",
    question: "How transparent should anti-gaming measures be?",
    description: "A = Hidden (don't tell users), G = Fully transparent (explain everything)",
    sliderLabels: ["Hidden", "Minimal info", "Some info", "Balanced", "Detailed", "Very detailed", "Fully open"],
    required: true,
  },
];

// ─── Section 6: UI/UX Preferences ────────────────────────────────────────────

export const SECTION_6_UI_PREFERENCES: AdvancedPollQuestion[] = [
  {
    id: "s6q1",
    type: "choice",
    question: "How should the Reach score be displayed on profiles?",
    description: "Current: Radar chart with 6 pillars",
    options: [
      { id: "radar", label: "Radar/Spider chart (current)", description: "Shows all pillars at once" },
      { id: "bars", label: "Horizontal bar chart", description: "Simple progress bars" },
      { id: "pie", label: "Pie/Donut chart", description: "Proportion visualization" },
      { id: "number_only", label: "Single number score", description: "Just the total, hide breakdown" },
      { id: "gamified", label: "Gamified badges/levels", description: "Achievement-style display" },
    ],
    required: true,
  },
  {
    id: "s6q2",
    type: "slider",
    question: "How prominent should Reach scores be on profiles?",
    description: "A = Hidden/subtle, G = Front and center",
    sliderLabels: ["Hidden", "Very subtle", "Subtle", "Moderate", "Prominent", "Very prominent", "Dominant"],
    required: true,
  },
  {
    id: "s6q3",
    type: "choice",
    question: "Should users be able to hide their Reach score?",
    description: "Privacy option for those who don't want scores public",
    options: [
      { id: "no", label: "No, always visible", description: "Reach is core to the platform" },
      { id: "yes_all", label: "Yes, hide everything", description: "Let users go fully private" },
      { id: "yes_partial", label: "Yes, hide breakdown only", description: "Show total, hide pillars" },
      { id: "yes_total", label: "Yes, hide total only", description: "Show pillars, hide score" },
    ],
    required: true,
  },
  {
    id: "s6q4",
    type: "multi-choice",
    question: "Which Reach insights would you want on your dashboard?",
    description: "Select all that interest you",
    options: [
      { id: "trends", label: "Score trends over time", description: "Historical graph" },
      { id: "comparisons", label: "Compare to similar users", description: "Percentile rankings" },
      { id: "tips", label: "Improvement tips", description: "How to boost each pillar" },
      { id: "notifications", label: "Milestone notifications", description: "Alerts for achievements" },
      { id: "detailed_breakdown", label: "Detailed breakdown", description: "Every factor explained" },
      { id: "export", label: "Export/download data", description: "CSV/JSON export" },
    ],
    required: true,
    minSelections: 0,
  },
  {
    id: "s6q5",
    type: "ui-arrange",
    question: "How would you arrange the profile page elements?",
    description: "Drag boxes to your preferred layout",
    uiElements: [
      { id: "avatar", label: "Avatar/Profile Picture", defaultPosition: { x: 1, y: 1 }, size: "medium" },
      { id: "reach_score", label: "Reach Score", defaultPosition: { x: 2, y: 1 }, size: "small" },
      { id: "reach_chart", label: "Reach Chart", defaultPosition: { x: 3, y: 1 }, size: "large" },
      { id: "bio", label: "Bio/Description", defaultPosition: { x: 1, y: 2 }, size: "medium" },
      { id: "stats", label: "Follower Stats", defaultPosition: { x: 2, y: 2 }, size: "small" },
      { id: "posts", label: "Posts Feed", defaultPosition: { x: 1, y: 3 }, size: "large" },
      { id: "badges", label: "Verification Badges", defaultPosition: { x: 3, y: 2 }, size: "small" },
    ],
    required: false,
  },
];

// ─── Section 7: Feature Prioritization ───────────────────────────────────────

export const SECTION_7_FEATURE_PRIORITY: AdvancedPollQuestion[] = [
  {
    id: "s7q1",
    type: "ranking",
    question: "Rank these potential features by priority",
    description: "Drag to reorder (top = highest priority)",
    options: [
      { id: "realtime_velocity", label: "Realtime Velocity Dashboard", description: "Live engagement tracking" },
      { id: "scheduled_posts", label: "Scheduled Posts with Timing Optimization", description: "Post at best times" },
      { id: "video_support", label: "Video Content Support", description: "Upload and embed videos" },
      { id: "cross_platform", label: "Cross-Platform Analytics", description: "Track external shares" },
      { id: "ai_insights", label: "AI-Powered Insights", description: "Personalized recommendations" },
      { id: "team_accounts", label: "Team/Brand Accounts", description: "Multi-user management" },
      { id: "api_access", label: "Public API Access", description: "Build on top of Reach data" },
      { id: "mobile_app", label: "Mobile App", description: "Native iOS/Android" },
    ],
    required: true,
  },
  {
    id: "s7q2",
    type: "slider",
    question: "How interested are you in 'Scheduled Pulse' posts?",
    description: "Schedule content release for optimal timing",
    sliderLabels: ["Not interested", "Slightly", "Somewhat", "Moderately", "Interested", "Very interested", "Extremely"],
    required: true,
  },
  {
    id: "s7q3",
    type: "slider",
    question: "How important is video content support?",
    description: "YouTube, Twitch embeds, native video upload",
    sliderLabels: ["Not important", "Slightly", "Somewhat", "Moderately", "Important", "Very important", "Critical"],
    required: true,
  },
  {
    id: "s7q4",
    type: "choice",
    question: "Would you pay for premium Reach analytics?",
    description: "Advanced insights, historical data, API access",
    options: [
      { id: "yes_monthly", label: "Yes, monthly subscription", description: "Recurring payment" },
      { id: "yes_onetime", label: "Yes, one-time purchase", description: "Pay once, keep forever" },
      { id: "crypto_only", label: "Yes, but only with crypto", description: "Web3-native payments" },
      { id: "no", label: "No, should be free", description: "Core features free for all" },
    ],
    required: true,
  },
  {
    id: "s7q5",
    type: "slider",
    question: "How much would you pay per month for premium analytics?",
    description: "A = $0, G = $20+",
    sliderLabels: ["$0", "$2", "$5", "$8", "$10", "$15", "$20+"],
    required: false,
    conditional: true, // Only show if willing to pay
  },
];

// ─── Section 8: Open Feedback ────────────────────────────────────────────────

export const SECTION_8_OPEN_FEEDBACK: AdvancedPollQuestion[] = [
  {
    id: "s8q1",
    type: "text",
    question: "What's the ONE thing you'd change about the Reach system?",
    description: "Your most impactful suggestion",
    placeholder: "If I could change one thing, it would be...",
    required: false,
    maxLength: 500,
  },
  {
    id: "s8q2",
    type: "text",
    question: "What feature would make you use VeggaStare daily?",
    description: "What's missing that would drive daily engagement?",
    placeholder: "I would visit daily if...",
    required: false,
    maxLength: 500,
  },
  {
    id: "s8q3",
    type: "slider",
    question: "Overall, how satisfied are you with VeggaStare?",
    description: "A = Very dissatisfied, G = Very satisfied",
    sliderLabels: ["Very dissatisfied", "Dissatisfied", "Somewhat dissatisfied", "Neutral", "Somewhat satisfied", "Satisfied", "Very satisfied"],
    required: true,
  },
  {
    id: "s8q4",
    type: "slider",
    question: "How likely are you to recommend VeggaStare to a friend?",
    description: "Net Promoter Score (A = 0, G = 10)",
    sliderLabels: ["0 - Never", "2", "4", "5 - Maybe", "6", "8", "10 - Absolutely"],
    required: true,
  },
  {
    id: "s8q5",
    type: "image-upload",
    question: "Have a mockup or screenshot to share?",
    description: "Upload any visual feedback (Ctrl+V to paste)",
    required: false,
    maxImages: 3,
    acceptedFormats: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  },
];

// ─── Combined Poll Export ────────────────────────────────────────────────────

export const REACH_AUDIT_POLL_SECTIONS = [
  { id: "section-1", title: "About You", description: "Help us understand your perspective", questions: SECTION_1_USER_CONTEXT },
  { id: "section-2", title: "Current 6 Pillars", description: "Evaluate each existing pillar", questions: SECTION_2_PILLAR_EVALUATION },
  { id: "section-3", title: "The 7th Pillar: Velocity", description: "Should we add realtime momentum tracking?", questions: SECTION_3_VELOCITY_PILLAR },
  { id: "section-4", title: "Auth & Poll Power", description: "How should verification affect voting weight?", questions: SECTION_4_AUTH_POLL_POWER },
  { id: "section-5", title: "View Strength & Anti-Gaming", description: "How should we count and protect views?", questions: SECTION_5_VIEW_STRENGTH },
  { id: "section-6", title: "UI/UX Preferences", description: "How should Reach be displayed?", questions: SECTION_6_UI_PREFERENCES },
  { id: "section-7", title: "Feature Priorities", description: "What should we build next?", questions: SECTION_7_FEATURE_PRIORITY },
  { id: "section-8", title: "Open Feedback", description: "Share your thoughts freely", questions: SECTION_8_OPEN_FEEDBACK },
];

export const TOTAL_QUESTIONS = REACH_AUDIT_POLL_SECTIONS.reduce(
  (total, section) => total + section.questions.length,
  0
);

// Approximately 75 questions across 8 sections
