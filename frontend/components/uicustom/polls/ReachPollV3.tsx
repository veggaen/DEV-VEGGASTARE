"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  X,
  ArrowRight,
  Target,
  Layers,
  Gauge,
  Scale,
  Lightbulb,
  Compass,
  Trophy,
  Rocket,
  Shield,
  Zap,
  Users,
  BarChart3,
  MessageSquare,
} from "lucide-react";

// Interactive Components
import { DragToSort } from "./interactive/DragToSort";
import { DragToZone } from "./interactive/DragToZone";
import { VisualSlider } from "./interactive/VisualSlider";
import { WeightAdjuster } from "./interactive/WeightAdjuster";
import { BranchingChoice } from "./interactive/BranchingChoice";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type QuestionType =
  | "branching"
  | "visual-slider"
  | "drag-sort"
  | "drag-zone"
  | "weight-adjuster"
  | "quick-choice"
  | "scenario"
  | "open-text";

interface Question {
  id: string;
  type: QuestionType;
  title: string;
  subtitle?: string;
  data: any;
  optional?: boolean;
}

interface Phase {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  questions: Question[];
}

interface ReachPollV3Props {
  pollId: string | null;
  onClose: () => void;
  onComplete?: (responseId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// REACH Algorithm Research Questions
// Designed like professional user research interviews
// Focus: Building algorithm to replace followers with meaningful REACH metric
// ─────────────────────────────────────────────────────────────────────────────

const PHASES: Phase[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: UNDERSTANDING YOUR PERSPECTIVE (16 questions)
  // Warm-up + understanding user context and motivations
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "your-perspective",
    title: "Your Perspective",
    description: "Understanding how you use social platforms",
    icon: Compass,
    color: "#10b981",
    questions: [
      // Q1: Warm-up - Build rapport
      {
        id: "p1-q1-experience",
        type: "branching",
        title: "What draws you to platforms that emphasize discovery over follower counts?",
        subtitle: "Tell us about your social media experience",
        data: {
          question: {
            id: "experience",
            question: "What draws you to platforms that emphasize discovery over follower counts?",
            options: [
              { id: "creator", text: "I create content and want it discovered by the right people", icon: "🎨" },
              { id: "discover", text: "I love finding new creators that match my interests", icon: "🔍" },
              { id: "community", text: "I'm looking for genuine community, not vanity metrics", icon: "👥" },
              { id: "business", text: "I need to reach potential customers authentically", icon: "💼" },
              { id: "curious", text: "I'm just exploring what makes this different", icon: "🤔" },
            ],
          },
        },
      },
      // Q2: Reflection on past visibility
      {
        id: "p1-q2-visibility-reflection",
        type: "open-text",
        title: "Think of a post you shared that performed unexpectedly. What made it reach more (or fewer) people than you expected?",
        subtitle: "Your real experience helps us understand what matters",
        data: {
          placeholder: "Describe what you posted, who engaged, and what surprised you...",
          minLength: 20,
        },
      },
      // Q3: Quality vs Quantity scenario
      {
        id: "p1-q3-quality-vs-quantity",
        type: "scenario",
        title: "Scenario: Two creators post similar content",
        subtitle: "Creator A: 50 passionate fans who comment and save everything. Creator B: 5,000 followers who rarely engage. Whose content should appear more prominently?",
        data: {
          options: [
            { id: "quality", text: "Creator A — Deep engagement signals genuine value", icon: "💎" },
            { id: "quantity", text: "Creator B — More followers means broader appeal", icon: "📊" },
            { id: "balanced", text: "Balance both — but weight engagement rate higher", icon: "⚖️" },
            { id: "context", text: "Depends on the viewer's preferences", icon: "🎯" },
          ],
        },
      },
      // Q4: Commonality importance
      {
        id: "p1-q4-commonality",
        type: "visual-slider",
        title: "How much should shared interests affect what appears in your feed?",
        subtitle: "Strong filtering vs. serendipitous discovery",
        data: {
          min: 1,
          max: 5,
          minLabel: "Show me anything popular",
          maxLabel: "Only show relevant content",
          previewType: "emoji",
          emojis: ["🌐", "🔀", "⚖️", "🎯", "🔒"],
          colors: { from: "#3b82f6", to: "#22c55e" },
        },
      },
      // Q5: Platform comparison
      {
        id: "p1-q5-platform-frustration",
        type: "quick-choice",
        title: "What frustrates you most about how other platforms rank content?",
        subtitle: "Pick the biggest problem we should solve",
        data: {
          options: [
            { id: "echo", text: "Echo chambers — same voices dominate", icon: "🔁" },
            { id: "viral", text: "Viral junk over quality content", icon: "🗑️" },
            { id: "pay", text: "Pay-to-play — rich accounts win", icon: "💰" },
            { id: "game", text: "Bots and engagement farming", icon: "🤖" },
            { id: "unclear", text: "No transparency in how it works", icon: "❓" },
            { id: "stale", text: "Old accounts monopolize attention", icon: "⏳" },
          ],
        },
      },
      // Q6: Visible metrics motivation
      {
        id: "p1-q6-metrics-motivation",
        type: "branching",
        title: "If you had a visible 'REACH' score, how would it affect your behavior?",
        subtitle: "Understanding the psychology of visible metrics",
        data: {
          question: {
            id: "motivation",
            question: "If you had a visible 'REACH' score, how would it affect your behavior?",
            options: [
              {
                id: "motivate",
                text: "It would motivate me to create better content",
                icon: "🚀",
                followUp: {
                  id: "motivate-type",
                  question: "What kind of content would you focus on?",
                  options: [
                    { id: "quality", text: "Higher quality, more effort", icon: "✨" },
                    { id: "niche", text: "More niche, targeted content", icon: "🎯" },
                    { id: "frequent", text: "More frequent posting", icon: "📅" },
                  ],
                },
              },
              { id: "neutral", text: "I'd just create what I want regardless", icon: "🎨" },
              { id: "worried", text: "I might feel pressured or anxious about it", icon: "😰" },
              { id: "game", text: "Honestly? I'd try to optimize for it", icon: "📈" },
            ],
          },
        },
      },
      // Q7: Time decay preference
      {
        id: "p1-q7-time-decay",
        type: "visual-slider",
        title: "Should recent activity matter more than historical reputation?",
        subtitle: "Active newcomer vs. established but quiet creator",
        data: {
          min: 1,
          max: 5,
          minLabel: "History matters most",
          maxLabel: "Only recent activity counts",
          previewType: "bar",
          colors: { from: "#8b5cf6", to: "#22c55e" },
        },
      },
      // Q8: Content type fairness
      {
        id: "p1-q8-content-types",
        type: "drag-sort",
        title: "Rank which content types deserve algorithmic priority",
        subtitle: "What should REACH reward most?",
        data: {
          items: [
            { id: "original", text: "Original creative work", icon: "🎨", description: "Art, music, writing, videos" },
            { id: "educational", text: "Educational content", icon: "📚", description: "Tutorials, explainers" },
            { id: "discussion", text: "Thought-provoking discussion", icon: "💭", description: "Ideas that spark conversation" },
            { id: "community", text: "Community building", icon: "🤝", description: "Events, collaborations" },
            { id: "commercial", text: "Products & services", icon: "🛍️", description: "Marketplace content" },
          ],
        },
      },
      // Q9: Anonymous engagement value
      {
        id: "p1-q9-anonymous-engagement",
        type: "scenario",
        title: "Scenario: Anonymous views vs. logged-in engagement",
        subtitle: "100 anonymous views or 10 logged-in users who pulse and comment?",
        data: {
          options: [
            { id: "anon", text: "100 views — reach is reach", icon: "👀" },
            { id: "logged", text: "10 engaged users — quality over quantity", icon: "💬" },
            { id: "weighted", text: "Count both, but weight logged-in higher", icon: "⚖️" },
            { id: "depends", text: "Depends on the content type", icon: "🎯" },
          ],
        },
      },
      // Q10: Network effect fairness
      {
        id: "p1-q10-network-effects",
        type: "visual-slider",
        title: "Should having many syncs boost your base REACH?",
        subtitle: "This affects whether established creators have an advantage",
        data: {
          min: 1,
          max: 5,
          minLabel: "No — everyone starts equal per post",
          maxLabel: "Yes — syncs should multiply reach",
          previewType: "emoji",
          emojis: ["⚖️", "📊", "📈", "🚀", "👑"],
          colors: { from: "#6b7280", to: "#f59e0b" },
        },
      },
      // Q11: Viral vs steady growth
      {
        id: "p1-q11-growth-pattern",
        type: "quick-choice",
        title: "Which growth pattern should REACH reward more?",
        subtitle: "Viral spikes vs. consistent building",
        data: {
          options: [
            { id: "viral", text: "Viral moments — catching lightning", icon: "⚡" },
            { id: "steady", text: "Steady growth — reliable value", icon: "📈" },
            { id: "both", text: "Both equally valuable", icon: "⚖️" },
            { id: "recovery", text: "Reward those who maintain after viral", icon: "🏆" },
          ],
        },
      },
      // Q12: Cross-platform identity
      {
        id: "p1-q12-cross-platform",
        type: "branching",
        title: "Should your reputation on other platforms affect your starting REACH?",
        subtitle: "Verified presence on X, YouTube, etc.",
        data: {
          question: {
            id: "cross-platform",
            question: "Should your reputation on other platforms affect your starting REACH?",
            options: [
              {
                id: "yes",
                text: "Yes — import credibility",
                icon: "✅",
                followUp: {
                  id: "import-how",
                  question: "How should we verify and weight it?",
                  options: [
                    { id: "oauth", text: "OAuth verification of follower count", icon: "🔗" },
                    { id: "manual", text: "Manual review of quality", icon: "👁️" },
                    { id: "decay", text: "Import with time decay", icon: "⏳" },
                  ],
                },
              },
              { id: "no", text: "No — everyone earns it fresh here", icon: "🆕" },
              { id: "minor", text: "Small initial boost only", icon: "➕" },
            ],
          },
        },
      },
      // Q13: First-hour importance
      {
        id: "p1-q13-first-hour",
        type: "visual-slider",
        title: "How critical is engagement in the first hour after posting?",
        subtitle: "Early momentum vs. slow-burn discovery",
        data: {
          min: 1,
          max: 5,
          minLabel: "Content should get time",
          maxLabel: "First hour is decisive",
          previewType: "circle",
          colors: { from: "#06b6d4", to: "#ef4444" },
        },
      },
      // Q14: Transparency preference
      {
        id: "p1-q14-transparency",
        type: "quick-choice",
        title: "How much should users understand about how REACH works?",
        subtitle: "Full transparency vs. preventing gaming",
        data: {
          options: [
            { id: "full", text: "Publish the exact formula", icon: "📖" },
            { id: "factors", text: "Show which factors matter, not weights", icon: "📋" },
            { id: "tips", text: "Give improvement tips without revealing formula", icon: "💡" },
            { id: "minimal", text: "Keep it private to prevent gaming", icon: "🔒" },
          ],
        },
      },
      // Q15: Personal definition of reach
      {
        id: "p1-q15-reach-definition",
        type: "open-text",
        title: "In your own words, what should 'REACH' measure?",
        subtitle: "Not followers, not likes — what does true reach mean to you?",
        data: {
          placeholder: "Describe your ideal definition of meaningful social reach...",
          minLength: 15,
        },
      },
      // Q16: Core value trade-off
      {
        id: "p1-q16-core-tradeoff",
        type: "scenario",
        title: "If we can only optimize for one, which matters most?",
        subtitle: "This shapes the entire algorithm philosophy",
        data: {
          options: [
            { id: "fairness", text: "Fairness — give everyone a chance", icon: "⚖️" },
            { id: "quality", text: "Quality — surface the best content", icon: "⭐" },
            { id: "relevance", text: "Relevance — right content to right people", icon: "🎯" },
            { id: "growth", text: "Growth — help creators build audiences", icon: "📈" },
          ],
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: ENGAGEMENT SIGNALS & WEIGHTING (16 questions)
  // Deep dive into what signals to track and how to weight them
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "signals-weighting",
    title: "Signals & Weighting",
    description: "What engagement truly means",
    icon: Gauge,
    color: "#f97316",
    questions: [
      // Q1: Core engagement ranking
      {
        id: "p2-q1-engagement-ranking",
        type: "drag-sort",
        title: "Rank these engagement signals by their true value",
        subtitle: "What actually indicates someone valued your content?",
        data: {
          items: [
            { id: "comment", text: "Thoughtful comment", icon: "💬", description: "Shows genuine thought" },
            { id: "save", text: "Save/Bookmark", icon: "🔖", description: "Wants to return" },
            { id: "repulse", text: "Repulse (share)", icon: "🔄", description: "Worth sharing" },
            { id: "time", text: "Time spent viewing", icon: "⏱️", description: "Held attention" },
            { id: "sync", text: "Sync (follow)", icon: "🔗", description: "Wants more" },
            { id: "pulse", text: "Pulse (like)", icon: "💗", description: "Quick approval" },
            { id: "click", text: "Profile visit", icon: "👤", description: "Curious about creator" },
          ],
        },
      },
      // Q2: Weight adjuster for signals
      {
        id: "p2-q2-signal-weights",
        type: "weight-adjuster",
        title: "Assign importance to each signal type",
        subtitle: "How should we balance different engagement types?",
        data: {
          items: [
            { id: "comments", label: "Comments", icon: "💬", color: "#3b82f6", defaultWeight: 25 },
            { id: "shares", label: "Shares/Repulse", icon: "🔄", color: "#22c55e", defaultWeight: 20 },
            { id: "saves", label: "Saves", icon: "🔖", color: "#8b5cf6", defaultWeight: 15 },
            { id: "time", label: "View time", icon: "⏱️", color: "#f97316", defaultWeight: 20 },
            { id: "pulses", label: "Pulses", icon: "💗", color: "#ef4444", defaultWeight: 10 },
            { id: "syncs", label: "New syncs", icon: "🔗", color: "#06b6d4", defaultWeight: 10 },
          ],
        },
      },
      // Q3: View duration threshold
      {
        id: "p2-q3-view-threshold",
        type: "visual-slider",
        title: "Minimum view time to count as 'engaged'?",
        subtitle: "Quick scroll vs. genuine viewing",
        data: {
          min: 1,
          max: 15,
          step: 1,
          minLabel: "1 second",
          maxLabel: "15 seconds",
          previewType: "bar",
          colors: { from: "#ef4444", to: "#22c55e" },
        },
      },
      // Q4: Comment quality
      {
        id: "p2-q4-comment-quality",
        type: "scenario",
        title: "Scenario: Which comment indicates more value?",
        subtitle: "Both are positive — but which helps REACH more?",
        data: {
          options: [
            { id: "emoji", text: "🔥🔥🔥 (emoji reaction)", icon: "😀" },
            { id: "short", text: "Love this! (short positive)", icon: "❤️" },
            { id: "question", text: "How did you achieve this effect? (question)", icon: "❓" },
            { id: "discussion", text: "This reminds me of... (starts discussion)", icon: "💭" },
          ],
        },
      },
      // Q5: Negative signal handling
      {
        id: "p2-q5-negative-signals",
        type: "drag-zone",
        title: "How should negative signals affect REACH?",
        subtitle: "Categorize by impact severity",
        data: {
          items: [
            { id: "hide", text: "Hide this post", icon: "🙈" },
            { id: "report", text: "Report content", icon: "🚩" },
            { id: "unsync", text: "Unsync creator", icon: "❌" },
            { id: "block", text: "Block user", icon: "🚫" },
            { id: "skip", text: "Scroll past quickly", icon: "⏩" },
            { id: "mute", text: "Mute creator", icon: "🔇" },
          ],
          zones: [
            { id: "severe", label: "Major penalty", accepts: ["report", "block"], color: "#ef4444" },
            { id: "moderate", label: "Moderate penalty", accepts: ["unsync", "hide"], color: "#f97316" },
            { id: "minor", label: "Minor signal", accepts: ["skip", "mute"], color: "#eab308" },
          ],
        },
      },
      // Q6: Repeat engagement value
      {
        id: "p2-q6-repeat-engagement",
        type: "visual-slider",
        title: "How valuable is repeat engagement from the same user?",
        subtitle: "Loyal fan vs. diverse audience",
        data: {
          min: 1,
          max: 5,
          minLabel: "Diminishing returns",
          maxLabel: "Equally valuable each time",
          previewType: "emoji",
          emojis: ["📉", "➖", "⚖️", "➕", "🔄"],
          colors: { from: "#ef4444", to: "#22c55e" },
        },
      },
      // Q7: Mutual engagement
      {
        id: "p2-q7-mutual-engagement",
        type: "quick-choice",
        title: "How should we treat 'mutual engagement' (you like me, I like you)?",
        subtitle: "Genuine community or gaming the system?",
        data: {
          options: [
            { id: "full", text: "Count it fully — community matters", icon: "✅" },
            { id: "reduced", text: "Reduced weight — potential gaming", icon: "📉" },
            { id: "capped", text: "Cap at X mutual interactions per pair", icon: "🔢" },
            { id: "ignore", text: "Don't count it at all", icon: "🚫" },
          ],
        },
      },
      // Q8: Engagement timing
      {
        id: "p2-q8-engagement-timing",
        type: "branching",
        title: "Should engagement on old content count toward REACH?",
        subtitle: "Evergreen value vs. recency focus",
        data: {
          question: {
            id: "old-content",
            question: "Should engagement on old content count toward REACH?",
            options: [
              {
                id: "yes-full",
                text: "Yes, fully — good content is good content",
                icon: "✅",
              },
              {
                id: "yes-decay",
                text: "Yes, but with time decay",
                icon: "📉",
                followUp: {
                  id: "decay-rate",
                  question: "How quickly should old engagement decay?",
                  options: [
                    { id: "fast", text: "50% value after 7 days", icon: "⚡" },
                    { id: "medium", text: "50% value after 30 days", icon: "📅" },
                    { id: "slow", text: "50% value after 90 days", icon: "🐢" },
                  ],
                },
              },
              { id: "only-recent", text: "Only count engagement from last 30 days", icon: "📆" },
            ],
          },
        },
      },
      // Q9: Creator's own engagement
      {
        id: "p2-q9-self-engagement",
        type: "scenario",
        title: "Scenario: Should creators' own actions on their content count?",
        subtitle: "Responding to comments, pinning, etc.",
        data: {
          options: [
            { id: "no", text: "Never — too easy to game", icon: "🚫" },
            { id: "responses", text: "Only responses to comments (rewards engagement)", icon: "↩️" },
            { id: "limited", text: "Count but heavily discounted", icon: "📉" },
            { id: "yes", text: "Yes — active creators should be rewarded", icon: "✅" },
          ],
        },
      },
      // Q10: Engagement source quality
      {
        id: "p2-q10-source-quality",
        type: "visual-slider",
        title: "Should engagement from verified accounts count more?",
        subtitle: "Account credibility affecting engagement value",
        data: {
          min: 1,
          max: 5,
          minLabel: "All engagement equal",
          maxLabel: "Verified = 2x weight",
          previewType: "circle",
          colors: { from: "#6b7280", to: "#8b5cf6" },
        },
      },
      // Q11: Hashtag/discovery signals
      {
        id: "p2-q11-discovery-signals",
        type: "quick-choice",
        title: "How should good hashtag/category choices affect REACH?",
        subtitle: "Rewarding discoverability efforts",
        data: {
          options: [
            { id: "boost", text: "Boost if hashtags match engaged audience", icon: "📈" },
            { id: "neutral", text: "No effect — let content speak", icon: "⚖️" },
            { id: "penalize", text: "Penalize irrelevant hashtag spam", icon: "📉" },
            { id: "both", text: "Boost relevance, penalize spam", icon: "🎯" },
          ],
        },
      },
      // Q12: Conversion tracking
      {
        id: "p2-q12-conversion-signals",
        type: "drag-sort",
        title: "Rank conversion signals by importance",
        subtitle: "When engagement leads to action",
        data: {
          items: [
            { id: "sync", text: "Viewer syncs with creator", icon: "🔗", description: "New relationship" },
            { id: "profile", text: "Profile visit after viewing", icon: "👤", description: "Curiosity sparked" },
            { id: "more", text: "Views more content", icon: "📚", description: "Wants more" },
            { id: "purchase", text: "Makes a purchase", icon: "💳", description: "Transaction" },
            { id: "message", text: "Sends a message", icon: "💬", description: "Direct contact" },
          ],
        },
      },
      // Q13: Engagement diversity
      {
        id: "p2-q13-diversity-bonus",
        type: "branching",
        title: "Should diverse engagement patterns be rewarded?",
        subtitle: "Engagement from different users/times vs. concentrated",
        data: {
          question: {
            id: "diversity",
            question: "Should diverse engagement patterns be rewarded?",
            options: [
              {
                id: "yes",
                text: "Yes — diversity signals broad appeal",
                icon: "🌈",
                followUp: {
                  id: "diversity-type",
                  question: "What type of diversity matters most?",
                  options: [
                    { id: "users", text: "Many different users", icon: "👥" },
                    { id: "time", text: "Spread over time", icon: "📅" },
                    { id: "geo", text: "Different locations", icon: "🌍" },
                  ],
                },
              },
              { id: "no", text: "No — passionate niches are valid", icon: "🎯" },
            ],
          },
        },
      },
      // Q14: Platform activity
      {
        id: "p2-q14-platform-activity",
        type: "visual-slider",
        title: "Should overall platform activity affect content REACH?",
        subtitle: "Active participants vs. drive-by posters",
        data: {
          min: 1,
          max: 5,
          minLabel: "Each post judged alone",
          maxLabel: "Active users get boost",
          previewType: "bar",
          colors: { from: "#6b7280", to: "#22c55e" },
        },
      },
      // Q15: Engagement velocity
      {
        id: "p2-q15-velocity",
        type: "scenario",
        title: "Scenario: Engagement velocity patterns",
        subtitle: "100 engagements in 1 hour vs. 100 engagements over 7 days",
        data: {
          options: [
            { id: "spike", text: "Spike is better — viral potential", icon: "⚡" },
            { id: "steady", text: "Steady is better — lasting value", icon: "📈" },
            { id: "equal", text: "Same total = same value", icon: "⚖️" },
            { id: "context", text: "Depends on content type", icon: "🎯" },
          ],
        },
      },
      // Q16: Ideal engagement formula input
      {
        id: "p2-q16-formula-input",
        type: "open-text",
        title: "If you could write the engagement formula, what would you prioritize?",
        subtitle: "Describe your ideal balance of signals",
        data: {
          placeholder: "I think the formula should emphasize... because...",
          minLength: 20,
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: TRUST, FAIRNESS & ANTI-GAMING (16 questions)
  // Verification, bot prevention, and edge cases
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "trust-fairness",
    title: "Trust & Fairness",
    description: "Preventing abuse while staying fair",
    icon: Shield,
    color: "#8b5cf6",
    questions: [
      // Q1: Verification impact
      {
        id: "p3-q1-verification-impact",
        type: "visual-slider",
        title: "How much should identity verification affect REACH potential?",
        subtitle: "Verified users vs. anonymous participation",
        data: {
          min: 1,
          max: 5,
          minLabel: "No difference",
          maxLabel: "Verified = 2x potential",
          previewType: "circle",
          colors: { from: "#6b7280", to: "#8b5cf6" },
        },
      },
      // Q2: Verification trust ranking
      {
        id: "p3-q2-verification-trust",
        type: "drag-sort",
        title: "Rank verification methods by trustworthiness",
        subtitle: "What proves someone is a real, valuable participant?",
        data: {
          items: [
            { id: "wallet", text: "Crypto wallet", icon: "🔗", description: "On-chain identity" },
            { id: "social", text: "Social OAuth (Google/X)", icon: "🔵", description: "Existing account" },
            { id: "phone", text: "Phone number", icon: "📱", description: "SMS verification" },
            { id: "payment", text: "Payment method", icon: "💳", description: "Financial tie" },
            { id: "email", text: "Email verification", icon: "📧", description: "Basic verification" },
            { id: "age", text: "Account age + activity", icon: "📅", description: "Proven history" },
          ],
        },
      },
      // Q3: New user handling
      {
        id: "p3-q3-new-users",
        type: "branching",
        title: "How should we handle brand new accounts?",
        subtitle: "Preventing spam while welcoming newcomers",
        data: {
          question: {
            id: "new-users",
            question: "How should we handle brand new accounts?",
            options: [
              {
                id: "probation",
                text: "Probation period with limited reach",
                icon: "⏳",
                followUp: {
                  id: "probation-length",
                  question: "How long should the probation last?",
                  options: [
                    { id: "1day", text: "24 hours of activity", icon: "🌅" },
                    { id: "1week", text: "1 week", icon: "📅" },
                    { id: "actions", text: "Until X quality actions", icon: "✅" },
                  ],
                },
              },
              { id: "verify", text: "Full access if verified", icon: "✓" },
              { id: "gradual", text: "Gradually increasing limits", icon: "📈" },
              { id: "equal", text: "Same as everyone — monitor for abuse", icon: "⚖️" },
            ],
          },
        },
      },
      // Q4: Bot detection signals
      {
        id: "p3-q4-bot-signals",
        type: "drag-zone",
        title: "How suspicious are these behavior patterns?",
        subtitle: "Help us calibrate bot detection",
        data: {
          items: [
            { id: "rapid-engage", text: "100+ pulses per minute", icon: "⚡" },
            { id: "same-comment", text: "Identical comments repeatedly", icon: "📋" },
            { id: "mass-sync", text: "Syncing 500+ users in an hour", icon: "🔗" },
            { id: "3am-active", text: "Only active at unusual hours", icon: "🌙" },
            { id: "new-burst", text: "New account with sudden activity burst", icon: "🌱" },
            { id: "no-profile", text: "No profile picture or bio", icon: "👤" },
          ],
          zones: [
            { id: "auto-flag", label: "Auto-flag for review", accepts: ["rapid-engage", "same-comment"], color: "#ef4444" },
            { id: "monitor", label: "Monitor closely", accepts: ["mass-sync", "3am-active"], color: "#f97316" },
            { id: "probably-fine", label: "Probably legitimate", accepts: ["new-burst", "no-profile"], color: "#22c55e" },
          ],
        },
      },
      // Q5: Bought engagement
      {
        id: "p3-q5-bought-engagement",
        type: "scenario",
        title: "Scenario: We detect someone bought fake engagement",
        subtitle: "How should the algorithm respond?",
        data: {
          options: [
            { id: "zero", text: "Zero out the fake engagement only", icon: "❌" },
            { id: "penalty", text: "Penalty to overall REACH score", icon: "📉" },
            { id: "shadow", text: "Reduce visibility without telling them", icon: "👻" },
            { id: "warn", text: "Warning first, then penalties", icon: "⚠️" },
            { id: "ban", text: "Account suspension", icon: "🚫" },
          ],
        },
      },
      // Q6: Appeal system
      {
        id: "p3-q6-appeals",
        type: "branching",
        title: "Should users be able to appeal REACH penalties?",
        subtitle: "False positives happen",
        data: {
          question: {
            id: "appeals",
            question: "Should users be able to appeal REACH penalties?",
            options: [
              {
                id: "yes-human",
                text: "Yes, with human review",
                icon: "👤",
                followUp: {
                  id: "appeal-cost",
                  question: "Should appeals have any cost or limit?",
                  options: [
                    { id: "free", text: "Free, but limited per month", icon: "🆓" },
                    { id: "stake", text: "Stake tokens (returned if successful)", icon: "💎" },
                    { id: "earn", text: "Earn appeal rights through activity", icon: "⭐" },
                  ],
                },
              },
              { id: "auto-only", text: "Automated appeals only", icon: "🤖" },
              { id: "no", text: "No appeals — trust the system", icon: "🔒" },
            ],
          },
        },
      },
      // Q7: Rich-get-richer prevention
      {
        id: "p3-q7-equity",
        type: "visual-slider",
        title: "How aggressively should we prevent 'rich get richer' effects?",
        subtitle: "Established accounts vs. newcomers",
        data: {
          min: 1,
          max: 5,
          minLabel: "Let success compound",
          maxLabel: "Actively boost underdogs",
          previewType: "emoji",
          emojis: ["👑", "📊", "⚖️", "🌱", "🆕"],
          colors: { from: "#f59e0b", to: "#22c55e" },
        },
      },
      // Q8: Engagement pods/groups
      {
        id: "p3-q8-pods",
        type: "quick-choice",
        title: "How should we handle 'engagement pods' (groups agreeing to engage with each other)?",
        subtitle: "Coordinated boosting",
        data: {
          options: [
            { id: "allow", text: "Allow it — it's community", icon: "👥" },
            { id: "discount", text: "Detect and discount the engagement", icon: "📉" },
            { id: "penalize", text: "Penalize participants", icon: "⚠️" },
            { id: "cap", text: "Cap mutual engagement between members", icon: "🔢" },
          ],
        },
      },
      // Q9: Algorithmic transparency
      {
        id: "p3-q9-transparency",
        type: "visual-slider",
        title: "How transparent should we be about REACH calculations?",
        subtitle: "Transparency vs. gaming prevention",
        data: {
          min: 1,
          max: 5,
          minLabel: "Keep it secret",
          maxLabel: "Open source the formula",
          previewType: "bar",
          colors: { from: "#ef4444", to: "#22c55e" },
        },
      },
      // Q10: Content moderation integration
      {
        id: "p3-q10-moderation",
        type: "scenario",
        title: "Scenario: Content gets reported but not removed. What happens to REACH?",
        subtitle: "Integrating moderation signals",
        data: {
          options: [
            { id: "no-effect", text: "No effect until action taken", icon: "⚖️" },
            { id: "temp-reduce", text: "Temporarily reduce while reviewing", icon: "⏸️" },
            { id: "threshold", text: "Reduce only if reports exceed threshold", icon: "📊" },
            { id: "quality", text: "Depends on reporter trustworthiness", icon: "✓" },
          ],
        },
      },
      // Q11: Network manipulation
      {
        id: "p3-q11-network-manipulation",
        type: "quick-choice",
        title: "Should we analyze relationship patterns for authenticity?",
        subtitle: "Detecting fake networks",
        data: {
          options: [
            { id: "yes-penalize", text: "Yes, and penalize suspicious patterns", icon: "🔍" },
            { id: "yes-discount", text: "Yes, and discount suspicious engagement", icon: "📉" },
            { id: "minimal", text: "Only obvious cases", icon: "🎯" },
            { id: "privacy", text: "No — privacy concerns", icon: "🔒" },
          ],
        },
      },
      // Q12: Geographic fairness
      {
        id: "p3-q12-geographic",
        type: "branching",
        title: "Should REACH normalize for geographic differences?",
        subtitle: "Some regions have more active users",
        data: {
          question: {
            id: "geo-normalize",
            question: "Should REACH normalize for geographic differences?",
            options: [
              {
                id: "yes",
                text: "Yes — level the playing field",
                icon: "🌍",
                followUp: {
                  id: "geo-how",
                  question: "How should we normalize?",
                  options: [
                    { id: "regional", text: "Regional percentile rankings", icon: "📊" },
                    { id: "boost", text: "Boost underrepresented regions", icon: "⬆️" },
                    { id: "timezone", text: "Adjust for timezone activity patterns", icon: "🕐" },
                  ],
                },
              },
              { id: "no", text: "No — global competition is fair", icon: "🌐" },
            ],
          },
        },
      },
      // Q13: Unintended consequences
      {
        id: "p3-q13-unintended",
        type: "open-text",
        title: "What unintended consequences worry you most about REACH?",
        subtitle: "Help us anticipate problems",
        data: {
          placeholder: "I'm worried that the algorithm might cause... because...",
          minLength: 20,
        },
      },
      // Q14: Recovery from penalties
      {
        id: "p3-q14-recovery",
        type: "visual-slider",
        title: "How fast should users recover from REACH penalties?",
        subtitle: "Allowing redemption vs. lasting consequences",
        data: {
          min: 1,
          max: 5,
          minLabel: "Quick recovery (days)",
          maxLabel: "Slow recovery (months)",
          previewType: "emoji",
          emojis: ["🏃", "🚶", "⚖️", "🐢", "🪨"],
          colors: { from: "#22c55e", to: "#ef4444" },
        },
      },
      // Q15: Creator tiers
      {
        id: "p3-q15-creator-tiers",
        type: "weight-adjuster",
        title: "How should different account types compare in base REACH potential?",
        subtitle: "Balancing different user segments",
        data: {
          items: [
            { id: "verified-creator", label: "Verified Creator", icon: "⭐", color: "#f59e0b", defaultWeight: 30 },
            { id: "active-user", label: "Active Regular User", icon: "💪", color: "#22c55e", defaultWeight: 25 },
            { id: "new-verified", label: "New but Verified", icon: "🆕", color: "#3b82f6", defaultWeight: 20 },
            { id: "lurker", label: "Mostly Views, Rarely Posts", icon: "👀", color: "#6b7280", defaultWeight: 15 },
            { id: "anonymous", label: "Anonymous/Unverified", icon: "❓", color: "#9ca3af", defaultWeight: 10 },
          ],
        },
      },
      // Q16: Final fairness reflection
      {
        id: "p3-q16-fairness-reflection",
        type: "scenario",
        title: "Final question: Which principle should guide REACH when conflicts arise?",
        subtitle: "The north star for difficult decisions",
        data: {
          options: [
            { id: "meritocracy", text: "Best content wins, regardless of creator status", icon: "🏆" },
            { id: "opportunity", text: "Everyone deserves fair visibility", icon: "⚖️" },
            { id: "authenticity", text: "Genuine engagement over everything", icon: "💎" },
            { id: "community", text: "What's best for the community overall", icon: "👥" },
            { id: "creator", text: "Support creator success and growth", icon: "🌱" },
          ],
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: FEED ALGORITHM & DISCOVERY (16 questions)
  // How content appears in feeds, trending calculations, and polls
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "feed-discovery",
    title: "Feed & Discovery",
    description: "How content should appear in your feed",
    icon: Rocket,
    color: "#06b6d4",
    questions: [
      // Q1: Trending definition
      {
        id: "p4-q1-trending-definition",
        type: "quick-choice",
        title: "What should make content 'Trending'?",
        subtitle: "Define what trending means on this platform",
        data: {
          options: [
            { id: "velocity", text: "Engagement velocity — fast growth in short time", icon: "⚡" },
            { id: "volume", text: "Total engagement — most likes/comments overall", icon: "📊" },
            { id: "diversity", text: "Diverse engagement — many different people engaging", icon: "🌈" },
            { id: "recency", text: "Recent + popular — newer content with good engagement", icon: "🆕" },
            { id: "momentum", text: "Sustained momentum — consistent engagement over time", icon: "📈" },
          ],
        },
      },
      // Q2: Trending time window
      {
        id: "p4-q2-trending-window",
        type: "visual-slider",
        title: "What time window should 'Trending' consider?",
        subtitle: "How recent should content be to qualify?",
        data: {
          min: 1,
          max: 7,
          step: 1,
          minLabel: "Last 1 hour",
          maxLabel: "Last 7 days",
          previewType: "bar",
          colors: { from: "#ef4444", to: "#22c55e" },
        },
      },
      // Q3: Trending engagement threshold
      {
        id: "p4-q3-trending-threshold",
        type: "scenario",
        title: "Scenario: Minimum engagement for trending",
        subtitle: "A post has 10 heartbeats in 1 hour. Is it trending?",
        data: {
          options: [
            { id: "yes", text: "Yes — that's fast growth", icon: "🔥" },
            { id: "relative", text: "Depends — compare to average for that time", icon: "📊" },
            { id: "no", text: "No — needs more absolute engagement", icon: "❌" },
            { id: "context", text: "Depends on the content type/category", icon: "🏷️" },
          ],
        },
      },
      // Q4: Feed default sort
      {
        id: "p4-q4-default-sort",
        type: "branching",
        title: "What should be the default feed sorting?",
        subtitle: "When you first open the app",
        data: {
          question: {
            id: "default-sort",
            question: "What should be the default feed sorting?",
            options: [
              {
                id: "trending",
                text: "Trending — show what's hot right now",
                icon: "🔥",
                followUp: {
                  id: "trending-mix",
                  question: "Should trending include some latest content too?",
                  options: [
                    { id: "pure", text: "Pure trending only", icon: "🎯" },
                    { id: "mixed", text: "Mix in some new content for discovery", icon: "🔀" },
                  ],
                },
              },
              { id: "latest", text: "Latest — chronological, newest first", icon: "🆕" },
              { id: "personalized", text: "For You — based on my interests", icon: "🎯" },
              { id: "reach", text: "Top Reach — highest reach scores", icon: "📊" },
            ],
          },
        },
      },
      // Q5: Polls vs Pulses
      {
        id: "p4-q5-polls-vs-pulses",
        type: "visual-slider",
        title: "How should polls be weighted compared to regular pulses in feeds?",
        subtitle: "Should polls get more/less visibility?",
        data: {
          min: 1,
          max: 5,
          minLabel: "Polls shown less",
          maxLabel: "Polls prioritized",
          previewType: "emoji",
          emojis: ["📉", "➖", "⚖️", "➕", "📊"],
          colors: { from: "#6b7280", to: "#3b82f6" },
        },
      },
      // Q6: Poll engagement value
      {
        id: "p4-q6-poll-engagement",
        type: "drag-sort",
        title: "Rank poll interactions by their engagement value",
        subtitle: "What should count most for a poll's reach?",
        data: {
          items: [
            { id: "vote", text: "Voting in the poll", icon: "🗳️", description: "Direct participation" },
            { id: "comment", text: "Commenting on poll", icon: "💬", description: "Discussion starter" },
            { id: "share", text: "Sharing the poll", icon: "🔄", description: "Spreading reach" },
            { id: "complete", text: "Completing full survey", icon: "✅", description: "Deep engagement" },
            { id: "heartbeat", text: "Heartbeat on poll", icon: "💗", description: "Quick approval" },
          ],
        },
      },
      // Q7: Content mixing
      {
        id: "p4-q7-content-mix",
        type: "weight-adjuster",
        title: "In a mixed feed, how should content types be balanced?",
        subtitle: "Adjust the ideal content mix",
        data: {
          items: [
            { id: "pulses", label: "Regular Pulses", icon: "💬", color: "#22c55e", defaultWeight: 50 },
            { id: "polls", label: "Polls & Surveys", icon: "📊", color: "#3b82f6", defaultWeight: 20 },
            { id: "reposts", label: "Repulses (Shares)", icon: "🔄", color: "#f97316", defaultWeight: 15 },
            { id: "media", label: "Media Content", icon: "🖼️", color: "#8b5cf6", defaultWeight: 15 },
          ],
        },
      },
      // Q8: Filter preferences
      {
        id: "p4-q8-filter-preferences",
        type: "quick-choice",
        title: "How do you prefer to filter content?",
        subtitle: "Your content browsing style",
        data: {
          options: [
            { id: "all", text: "Usually see everything mixed", icon: "🌐" },
            { id: "type", text: "Filter by type (pulses/polls)", icon: "📁" },
            { id: "topic", text: "Filter by topic/tags", icon: "🏷️" },
            { id: "creator", text: "Focus on specific creators", icon: "👤" },
            { id: "dynamic", text: "Changes based on my mood", icon: "🎭" },
          ],
        },
      },
      // Q9: Discovery vs Following
      {
        id: "p4-q9-discovery-balance",
        type: "visual-slider",
        title: "Balance between content from people you sync vs. discovery",
        subtitle: "How much new content should appear?",
        data: {
          min: 1,
          max: 5,
          minLabel: "Only synced creators",
          maxLabel: "Mostly discovery",
          previewType: "emoji",
          emojis: ["🔒", "👥", "⚖️", "🔍", "🌍"],
          colors: { from: "#8b5cf6", to: "#22c55e" },
        },
      },
      // Q10: Trending categories
      {
        id: "p4-q10-trending-categories",
        type: "scenario",
        title: "Should 'Trending' be global or category-specific?",
        subtitle: "One trending list or many?",
        data: {
          options: [
            { id: "global", text: "Global trending — one list for everyone", icon: "🌍" },
            { id: "category", text: "Category trending — trending in each topic", icon: "📂" },
            { id: "both", text: "Both — global + category tabs", icon: "⚖️" },
            { id: "personalized", text: "Personalized — trending in my interests", icon: "🎯" },
          ],
        },
      },
      // Q11: Viral content handling
      {
        id: "p4-q11-viral-handling",
        type: "branching",
        title: "How should truly viral content be handled?",
        subtitle: "When something blows up",
        data: {
          question: {
            id: "viral",
            question: "How should truly viral content be handled?",
            options: [
              {
                id: "boost",
                text: "Let it ride — amplify viral success",
                icon: "🚀",
                followUp: {
                  id: "boost-limit",
                  question: "For how long?",
                  options: [
                    { id: "unlimited", text: "As long as it's engaging", icon: "♾️" },
                    { id: "capped", text: "Cap after reaching threshold", icon: "🔒" },
                  ],
                },
              },
              { id: "organic", text: "Let it grow organically without extra boost", icon: "🌱" },
              { id: "diverse", text: "Ensure diverse viral content (not same creators)", icon: "🌈" },
              { id: "skeptical", text: "Verify it's not artificially boosted first", icon: "🔍" },
            ],
          },
        },
      },
      // Q12: Negative trending
      {
        id: "p4-q12-negative-trending",
        type: "quick-choice",
        title: "Should controversial content trend?",
        subtitle: "High engagement but divisive",
        data: {
          options: [
            { id: "yes", text: "Yes — engagement is engagement", icon: "📈" },
            { id: "sentiment", text: "Check sentiment — only positive engagement", icon: "💚" },
            { id: "reduced", text: "Trend but with reduced visibility", icon: "📉" },
            { id: "no", text: "No — controversy shouldn't be rewarded", icon: "🚫" },
          ],
        },
      },
      // Q13: Sort persistence
      {
        id: "p4-q13-sort-persistence",
        type: "scenario",
        title: "Should your sort preference persist across sessions?",
        subtitle: "Remember your last sort choice",
        data: {
          options: [
            { id: "always", text: "Always remember my preference", icon: "💾" },
            { id: "session", text: "Only during current session", icon: "⏱️" },
            { id: "default", text: "Always start with default sort", icon: "🔄" },
            { id: "smart", text: "Smart — use default but remember if I change often", icon: "🧠" },
          ],
        },
      },
      // Q14: Refresh behavior
      {
        id: "p4-q14-refresh-behavior",
        type: "visual-slider",
        title: "How often should the feed auto-refresh?",
        subtitle: "Balance between freshness and reading stability",
        data: {
          min: 1,
          max: 5,
          minLabel: "Never (manual only)",
          maxLabel: "Real-time updates",
          previewType: "bar",
          colors: { from: "#6b7280", to: "#22c55e" },
        },
      },
      // Q15: Poll visibility features
      {
        id: "p4-q15-poll-features",
        type: "drag-zone",
        title: "Which poll features should affect their feed visibility?",
        subtitle: "Categorize by importance",
        data: {
          items: [
            { id: "response-rate", text: "High response rate", icon: "📊" },
            { id: "completion", text: "High completion %", icon: "✅" },
            { id: "creator-rep", text: "Creator's reputation", icon: "⭐" },
            { id: "controversy", text: "Interesting/divisive results", icon: "🔥" },
            { id: "recency", text: "How new the poll is", icon: "🆕" },
            { id: "relevance", text: "Topic relevance to viewer", icon: "🎯" },
          ],
          zones: [
            { id: "critical", label: "Critical factor", accepts: ["response-rate", "relevance"], color: "#22c55e" },
            { id: "important", label: "Important factor", accepts: ["completion", "creator-rep"], color: "#3b82f6" },
            { id: "minor", label: "Minor factor", accepts: ["controversy", "recency"], color: "#f59e0b" },
          ],
        },
      },
      // Q16: Feed algorithm philosophy
      {
        id: "p4-q16-algorithm-philosophy",
        type: "open-text",
        title: "Describe your ideal feed experience in one sentence",
        subtitle: "This helps us understand your core expectation",
        data: {
          placeholder: "My ideal feed would show me...",
          minLength: 20,
        },
      },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: TRUST, GROWTH & FUTURE VISION (16 questions)
  // Platform trust, user growth, and vision for the future
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "trust-future",
    title: "Trust & Future",
    description: "Building trust and shaping tomorrow",
    icon: Shield,
    color: "#8b5cf6",
    questions: [
      // Q1: Trust factors
      {
        id: "p5-q1-trust-factors",
        type: "drag-sort",
        title: "What builds trust in a social platform?",
        subtitle: "Rank from most to least important",
        data: {
          items: [
            { id: "transparency", text: "Transparent algorithms", icon: "🔍" },
            { id: "privacy", text: "Strong privacy controls", icon: "🔒" },
            { id: "moderation", text: "Fair content moderation", icon: "⚖️" },
            { id: "ownership", text: "User data ownership", icon: "📦" },
            { id: "accountability", text: "Platform accountability", icon: "📜" },
            { id: "community", text: "Healthy community culture", icon: "🤝" },
          ],
        },
      },
      // Q2: Verification value
      {
        id: "p5-q2-verification-value",
        type: "visual-slider",
        title: "How much do you value verified accounts?",
        subtitle: "Should verification affect REACH?",
        data: {
          min: 1,
          max: 5,
          minLabel: "No difference",
          maxLabel: "Major advantage",
          previewType: "emoji",
          emojis: ["❓", "🤷", "⚖️", "✓", "✅"],
        },
      },
      // Q3: Bot protection
      {
        id: "p5-q3-bot-protection",
        type: "quick-choice",
        title: "How aggressive should bot detection be?",
        subtitle: "Balance between security and false positives",
        data: {
          options: [
            { id: "strict", text: "Very strict — might catch some real users", icon: "🛡️" },
            { id: "balanced", text: "Balanced — moderate filtering", icon: "⚖️" },
            { id: "lenient", text: "Lenient — only obvious bots", icon: "🌱" },
            { id: "user", text: "Let users flag/report bots", icon: "🚩" },
          ],
        },
      },
      // Q4: New user experience
      {
        id: "p5-q4-new-user-boost",
        type: "branching",
        title: "Should new users get a temporary REACH boost?",
        subtitle: "Help newcomers get discovered",
        data: {
          question: {
            id: "new-user-boost",
            question: "Should new users get a temporary REACH boost?",
            options: [
              {
                id: "yes",
                text: "Yes — help them get started",
                icon: "🚀",
                followUp: {
                  id: "boost-duration",
                  question: "For how long?",
                  options: [
                    { id: "week", text: "First week", icon: "📅" },
                    { id: "month", text: "First month", icon: "🗓️" },
                    { id: "earned", text: "Until they earn enough engagement", icon: "📈" },
                  ],
                },
              },
              { id: "no", text: "No — earn reach like everyone else", icon: "⚖️" },
              { id: "gradual", text: "Gradual unlock — starts low, increases with activity", icon: "📊" },
            ],
          },
        },
      },
      // Q5: Creator tiers
      {
        id: "p5-q5-creator-tiers",
        type: "scenario",
        title: "Should there be different creator tiers?",
        subtitle: "Like Emerging → Established → Star",
        data: {
          options: [
            { id: "yes", text: "Yes — motivates growth", icon: "🏆" },
            { id: "hidden", text: "Yes but keep them hidden from others", icon: "🔒" },
            { id: "no", text: "No — creates hierarchy/elitism", icon: "🚫" },
            { id: "earned", text: "Only based on quality, not quantity", icon: "⭐" },
          ],
        },
      },
      // Q6: Decay vs permanence
      {
        id: "p5-q6-reach-decay",
        type: "visual-slider",
        title: "Should REACH decay over time without activity?",
        subtitle: "Use it or lose it?",
        data: {
          min: 1,
          max: 5,
          minLabel: "No decay (permanent)",
          maxLabel: "Fast decay (stay active)",
          previewType: "bar",
          colors: { from: "#22c55e", to: "#ef4444" },
        },
      },
      // Q7: Negative reach
      {
        id: "p5-q7-negative-actions",
        type: "weight-adjuster",
        title: "How much should negative actions affect REACH?",
        subtitle: "Being blocked, reported, unfollowed",
        data: {
          items: [
            { id: "blocked", label: "Being blocked by users", defaultWeight: 30 },
            { id: "reported", label: "Being reported for content", defaultWeight: 40 },
            { id: "unfollowed", label: "People unfollowing you", defaultWeight: 15 },
            { id: "ignored", label: "Content being hidden/ignored", defaultWeight: 15 },
          ],
          totalWeight: 100,
        },
      },
      // Q8: Cross-platform value
      {
        id: "p5-q8-cross-platform",
        type: "quick-choice",
        title: "Should your reputation on other platforms matter?",
        subtitle: "Import credibility from Twitter, LinkedIn, etc.",
        data: {
          options: [
            { id: "yes", text: "Yes — validates authenticity", icon: "🔗" },
            { id: "optional", text: "Optional bonus — can link if wanted", icon: "⚡" },
            { id: "no", text: "No — start fresh here", icon: "🆕" },
            { id: "careful", text: "Only verified platforms", icon: "✅" },
          ],
        },
      },
      // Q9: Content diversity
      {
        id: "p5-q9-content-diversity",
        type: "visual-slider",
        title: "Should REACH reward content diversity?",
        subtitle: "Posting different types of content",
        data: {
          min: 1,
          max: 5,
          minLabel: "Specialize is fine",
          maxLabel: "Reward variety",
          previewType: "emoji",
          emojis: ["🎯", "➖", "⚖️", "➕", "🌈"],
        },
      },
      // Q10: Time-of-day effects
      {
        id: "p5-q10-timing",
        type: "branching",
        title: "Should posting at optimal times boost REACH?",
        subtitle: "Reward strategic timing",
        data: {
          question: {
            id: "timing-boost",
            question: "Should posting at optimal times boost REACH?",
            options: [
              {
                id: "yes",
                text: "Yes — reward smart creators",
                icon: "⏰",
                followUp: {
                  id: "timing-help",
                  question: "Should we show best times to post?",
                  options: [
                    { id: "show", text: "Yes, show suggestions", icon: "💡" },
                    { id: "hide", text: "No, let people figure it out", icon: "🎲" },
                  ],
                },
              },
              { id: "no", text: "No — content quality matters, not timing", icon: "🚫" },
              { id: "global", text: "Normalize for different timezones", icon: "🌍" },
            ],
          },
        },
      },
      // Q11: Monetization & REACH
      {
        id: "p5-q11-monetization",
        type: "quick-choice",
        title: "Should monetization be tied to REACH?",
        subtitle: "Higher reach = more earning potential",
        data: {
          options: [
            { id: "yes", text: "Yes — reward influence", icon: "💰" },
            { id: "separate", text: "Separate metrics for money", icon: "📊" },
            { id: "quality", text: "Based on engagement quality instead", icon: "⭐" },
            { id: "flat", text: "Equal opportunity regardless of reach", icon: "⚖️" },
          ],
        },
      },
      // Q12: Community feedback
      {
        id: "p5-q12-community-input",
        type: "scenario",
        title: "Should users vote on algorithm changes?",
        subtitle: "Community governance of REACH",
        data: {
          options: [
            { id: "yes", text: "Yes — democratic platform", icon: "🗳️" },
            { id: "advisory", text: "Advisory only — team decides", icon: "💡" },
            { id: "no", text: "No — trust the experts", icon: "👨‍💻" },
            { id: "transparent", text: "Just be transparent about changes", icon: "📢" },
          ],
        },
      },
      // Q13: Future feature priority
      {
        id: "p5-q13-future-features",
        type: "drag-sort",
        title: "Rank these future features by priority",
        subtitle: "What should we build next?",
        data: {
          items: [
            { id: "mobile", text: "Mobile app", icon: "📱" },
            { id: "creator-tools", text: "Advanced creator tools", icon: "🛠️" },
            { id: "analytics", text: "Detailed analytics", icon: "📊" },
            { id: "monetization", text: "Monetization features", icon: "💰" },
            { id: "ai", text: "AI-powered recommendations", icon: "🤖" },
            { id: "communities", text: "Interest-based communities", icon: "👥" },
          ],
        },
      },
      // Q14: Platform vision
      {
        id: "p5-q14-platform-vision",
        type: "quick-choice",
        title: "What should VeggaStare prioritize?",
        subtitle: "Our core focus as a platform",
        data: {
          options: [
            { id: "creators", text: "Creator success & monetization", icon: "🎨" },
            { id: "discovery", text: "Content discovery & exploration", icon: "🔍" },
            { id: "community", text: "Community building & connection", icon: "🤝" },
            { id: "innovation", text: "Innovation & new features", icon: "🚀" },
            { id: "simplicity", text: "Simplicity & ease of use", icon: "✨" },
          ],
        },
      },
      // Q15: Success definition
      {
        id: "p5-q15-success-definition",
        type: "open-text",
        title: "What would make VeggaStare successful for YOU?",
        subtitle: "Your personal measure of success",
        data: {
          placeholder: "VeggaStare would be successful for me if...",
          minLength: 30,
        },
      },
      // Q16: Final thoughts
      {
        id: "p5-q16-final-thoughts",
        type: "open-text",
        title: "Any final thoughts on REACH or the platform?",
        subtitle: "Share anything we haven't asked about",
        optional: true,
        data: {
          placeholder: "I'd also like to mention...",
          minLength: 0,
        },
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers for progress persistence
// ─────────────────────────────────────────────────────────────────────────────

const POLL_PROGRESS_KEY = "veggastare:reach-poll-progress";

interface SavedProgress {
  pollId: string;
  screen: "welcome" | "phase-select" | "question" | "complete";
  currentPhase: number;
  currentQuestion: number;
  answers: Record<string, any>;
  savedAt: number;
}

function loadProgress(pollId: string): SavedProgress | null {
  try {
    const saved = localStorage.getItem(POLL_PROGRESS_KEY);
    if (!saved) return null;
    const progress: SavedProgress = JSON.parse(saved);
    if (progress.pollId === pollId && Date.now() - progress.savedAt < 7 * 24 * 60 * 60 * 1000) {
      return progress;
    }
    return null;
  } catch {
    return null;
  }
}

function saveProgress(progress: SavedProgress): void {
  try {
    localStorage.setItem(POLL_PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

function clearProgress(): void {
  try {
    localStorage.removeItem(POLL_PROGRESS_KEY);
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

// Open text question component
function OpenTextQuestion({
  value,
  onChange,
  placeholder,
  minLength = 0,
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLength?: number;
}) {
  const charCount = value?.length || 0;
  const isValid = charCount >= minLength;

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <Textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[120px] text-base resize-none"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className={cn(!isValid && charCount > 0 && "text-amber-500")}>
          {minLength > 0 && !isValid ? `Minimum ${minLength} characters` : ""}
        </span>
        <span>{charCount} characters</span>
      </div>
    </div>
  );
}

// Scenario question (enhanced quick choice for scenarios)
function ScenarioQuestion({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; text: string; icon?: string }>;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
      {options.map((option, idx) => {
        const isSelected = value === option.id;
        return (
          <motion.button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              "relative p-5 rounded-2xl text-left transition-all duration-200",
              "border-2",
              isSelected
                ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                : "border-border hover:border-primary/50 bg-card/50"
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {isSelected && (
              <motion.div
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <Check className="w-4 h-4 text-white" />
              </motion.div>
            )}
            <div className="flex items-start gap-3">
              {option.icon && <span className="text-2xl mt-0.5">{option.icon}</span>}
              <span className="font-medium text-sm leading-relaxed pr-6">{option.text}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// Quick Choice (compact version)
function QuickChoiceQuestion({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; text: string; icon?: string }>;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
      {options.map((option, idx) => {
        const isSelected = value === option.id;
        return (
          <motion.button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              "relative p-4 rounded-xl text-left transition-all",
              "border-2",
              isSelected
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 bg-card/50"
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.03 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSelected && (
              <motion.div
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <Check className="w-3 h-3 text-white" />
              </motion.div>
            )}
            <div className="flex flex-col gap-1.5">
              {option.icon && <span className="text-xl">{option.icon}</span>}
              <span className="font-medium text-xs">{option.text}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// Phase Selector
function PhaseSelector({
  phases,
  currentPhase,
  completedQuestions,
  onSelectPhase,
}: {
  phases: Phase[];
  currentPhase: number;
  completedQuestions: Record<string, boolean>;
  onSelectPhase: (index: number) => void;
}) {
  const getPhaseCompletion = (phaseIndex: number) => {
    const phase = phases[phaseIndex];
    const completed = phase.questions.filter((q) => completedQuestions[q.id]).length;
    return Math.round((completed / phase.questions.length) * 100);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => onSelectPhase(-1)} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="text-center flex-1">
          <h2 className="text-2xl font-bold">Choose a Section</h2>
          <p className="text-muted-foreground text-sm">Complete any section — you can skip around!</p>
        </div>
        <div className="w-20"></div> {/* Spacer for centering */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {phases.map((phase, idx) => {
          const Icon = phase.icon;
          const completion = getPhaseCompletion(idx);
          const isActive = idx === currentPhase;

          return (
            <motion.button
              key={phase.id}
              onClick={() => onSelectPhase(idx)}
              className={cn(
                "relative p-6 rounded-2xl text-left transition-all",
                "border-2",
                isActive ? "border-primary bg-primary/5 shadow-lg" : "border-border hover:border-primary/50 bg-card/50"
              )}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg" style={{ backgroundColor: phase.color }}>
                {idx + 1}
              </div>

              {completion === 100 && (
                <motion.div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <Check className="w-5 h-5 text-white" />
                </motion.div>
              )}

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${phase.color}20` }}>
                  <Icon className="w-6 h-6" style={{ color: phase.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{phase.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{phase.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">{phase.questions.length} questions</p>
                </div>
              </div>

              <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ backgroundColor: phase.color }} initial={{ width: 0 }} animate={{ width: `${completion}%` }} transition={{ duration: 0.5, delay: idx * 0.1 }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">{completion}% complete</p>
            </motion.button>
          );
        })}
      </div>

      <motion.p className="text-center text-xs text-muted-foreground mt-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        💡 Complete all sections for maximum influence on REACH algorithm design
      </motion.p>
    </motion.div>
  );
}

// Welcome Screen
function WelcomeScreen({ onStart, onSelectPhase, phases }: { onStart: () => void; onSelectPhase: () => void; phases: Phase[] }) {
  const totalQuestions = phases.reduce((sum, p) => sum + p.questions.length, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex flex-col items-center justify-center p-8 text-center min-h-full h-full">
      {/* Gradient background that fills the entire container */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-emerald-950/10 to-background">
        <motion.div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 blur-3xl" animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 blur-3xl" animate={{ x: [0, -50, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
      </div>

      <div className="relative z-10">
        <motion.div className="relative mb-8" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.2 }}>
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-600 p-1 shadow-2xl shadow-emerald-500/30">
            <div className="w-full h-full rounded-[20px] bg-background/80 backdrop-blur-xl flex items-center justify-center">
              <Target className="w-12 h-12 text-emerald-500" />
            </div>
          </div>
          <motion.div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg" initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 10, -10, 0] }} transition={{ delay: 0.6, duration: 0.5 }}>
            <Sparkles className="w-4 h-4 text-white" />
          </motion.div>
        </motion.div>

        <motion.h1 className="text-3xl md:text-4xl font-extrabold mb-3" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 bg-clip-text text-transparent">Design REACH Together</span>
        </motion.h1>

        <motion.p className="text-base md:text-lg text-muted-foreground max-w-md mb-4" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          Help us build a social metric that matters. Your insights directly shape how <span className="text-foreground font-semibold">REACH</span> replaces followers.
        </motion.p>

        <motion.p className="text-sm text-muted-foreground/80 max-w-md mb-6" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
          Professional research questions • No repetition • Your voice matters
        </motion.p>

        <motion.div className="flex justify-center gap-6 mb-8" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-500">{phases.length}</div>
            <div className="text-xs text-muted-foreground">Sections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-500">{totalQuestions}</div>
            <div className="text-xs text-muted-foreground">Questions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">~15</div>
            <div className="text-xs text-muted-foreground">Minutes</div>
          </div>
        </motion.div>

        <motion.div className="flex flex-col sm:flex-row gap-3 justify-center" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
          <Button size="lg" onClick={onStart} className="relative group px-8 py-6 text-base font-semibold rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 hover:from-emerald-600 hover:via-cyan-600 hover:to-blue-600 text-white shadow-2xl shadow-emerald-500/30 overflow-hidden">
            <motion.span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0" animate={{ x: ["-200%", "200%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
            <span className="relative flex items-center gap-2">
              Start Research
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
          <Button size="lg" variant="outline" onClick={onSelectPhase} className="px-8 py-6 text-base font-semibold rounded-2xl">
            Choose Section
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Completion Screen
function CompletionScreen({
  answeredCount,
  totalQuestions,
  phases,
  completedQuestions,
  onSubmit,
  onClose,
  onBackToPhases,
  isSubmitting,
}: {
  answeredCount: number;
  totalQuestions: number;
  phases: Phase[];
  completedQuestions: Record<string, boolean>;
  onSubmit: () => void;
  onClose: () => void;
  onBackToPhases: () => void;
  isSubmitting: boolean;
}) {
  const percentage = Math.round((answeredCount / totalQuestions) * 100);
  const voteWeight = useMemo(() => {
    if (percentage === 100) return 100;
    if (percentage >= 75) return 80;
    if (percentage >= 50) return 60;
    if (percentage >= 25) return 40;
    return 20;
  }, [percentage]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex flex-col items-center justify-center p-8 text-center overflow-hidden">
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full" style={{ background: percentage === 100 ? "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)" : "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)" }} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 3, repeat: Infinity }} />
      </motion.div>

      <div className="relative z-10">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.2 }} className={cn("w-28 h-28 rounded-full flex items-center justify-center mb-6 shadow-2xl", percentage === 100 ? "bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 shadow-amber-500/30" : "bg-gradient-to-br from-emerald-400 via-cyan-500 to-blue-500 shadow-emerald-500/30")}>
          <Trophy className="w-14 h-14 text-white" />
        </motion.div>

        <motion.h2 className="text-3xl font-extrabold mb-2" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          {percentage === 100 ? <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Research Complete! 🎉</span> : percentage >= 75 ? <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">Great Progress!</span> : <span className="text-foreground">Getting Started!</span>}
        </motion.h2>

        <motion.p className="text-muted-foreground mb-6" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          {answeredCount} of {totalQuestions} questions answered ({percentage}%)
        </motion.p>

        <motion.div className="bg-muted/50 rounded-2xl p-4 mb-6 max-w-xs mx-auto" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55 }}>
          <p className="text-sm text-muted-foreground mb-2">Your influence on REACH design</p>
          <div className="text-3xl font-bold text-primary">{voteWeight}%</div>
          {percentage < 100 && <p className="text-xs text-muted-foreground mt-2">Complete more for higher influence!</p>}
        </motion.div>

        <motion.div className="relative w-32 h-32 mb-6 mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
            <motion.circle cx="64" cy="64" r="56" fill="none" stroke="url(#progressGradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={352} initial={{ strokeDashoffset: 352 }} animate={{ strokeDashoffset: 352 - (352 * percentage) / 100 }} transition={{ duration: 1.5, ease: "easeOut", delay: 0.7 }} />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={percentage === 100 ? "#f59e0b" : "#10b981"} />
                <stop offset="100%" stopColor={percentage === 100 ? "#ef4444" : "#3b82f6"} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span className="text-3xl font-bold" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: "spring" }}>
              {percentage}%
            </motion.span>
          </div>
        </motion.div>

        <motion.div className="flex flex-col sm:flex-row gap-3 justify-center" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9 }}>
          {percentage < 100 && (
            <Button variant="outline" onClick={onBackToPhases} className="px-6 py-3 rounded-xl">
              Continue Sections
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="px-6 py-3 rounded-xl">
            Save & Exit
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting || answeredCount === 0} className={cn("px-8 py-3 rounded-xl text-white shadow-lg", percentage === 100 ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" : "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600")}>
            {isSubmitting ? "Submitting..." : <>Submit Feedback <Sparkles className="ml-2 w-4 h-4" /></>}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ReachPollV3({ pollId, onClose, onComplete }: ReachPollV3Props) {
  const [screen, setScreen] = useState<"welcome" | "phase-select" | "question" | "complete">("welcome");
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const [startTime] = useState(Date.now());
  
  // ─── Navigation History Stack ─────────────────────────────────────────────────
  // Internal history for back/forward navigation within the poll
  const [navHistory, setNavHistory] = useState<Array<{ screen: typeof screen; phase: number; question: number }>>([
    { screen: "welcome", phase: 0, question: 0 }
  ]);
  const [navHistoryIndex, setNavHistoryIndex] = useState(0);

  // Check if we can go back/forward
  const canGoBack = navHistoryIndex > 0 || screen !== "welcome";
  const canGoForward = navHistoryIndex < navHistory.length - 1;

  // ─── Back Navigation Handler (defined first for use in useEffect) ─────────────
  const handleBackNavigation = useCallback(() => {
    // Navigate back based on current screen
    if (screen === "complete") {
      // From complete → last question
      const lastPhase = PHASES.length - 1;
      const lastQuestion = PHASES[lastPhase].questions.length - 1;
      setScreen("question");
      setCurrentPhase(lastPhase);
      setCurrentQuestion(lastQuestion);
    } else if (screen === "question") {
      if (currentQuestion > 0) {
        // Previous question in same phase
        setCurrentQuestion(currentQuestion - 1);
      } else if (currentPhase > 0) {
        // Previous phase's last question
        const newPhase = currentPhase - 1;
        setCurrentPhase(newPhase);
        setCurrentQuestion(PHASES[newPhase].questions.length - 1);
      } else {
        // First question of first phase → phase select
        setScreen("phase-select");
      }
    } else if (screen === "phase-select") {
      // Phase select → welcome
      setScreen("welcome");
    } else if (screen === "welcome") {
      // Welcome → close modal
      onClose();
    }
  }, [screen, currentPhase, currentQuestion, onClose]);

  // ─── Add to Navigation History (defined first for use by other handlers) ─────
  const pushToNavHistory = useCallback((newScreen: typeof screen, phase: number, question: number) => {
    setNavHistory(prev => {
      // Remove any forward history when navigating to new location
      const newHistory = prev.slice(0, navHistoryIndex + 1);
      newHistory.push({ screen: newScreen, phase, question });
      return newHistory;
    });
    setNavHistoryIndex(prev => prev + 1);
  }, [navHistoryIndex]);

  // ─── Forward Navigation Handler (history-based) ─────────────────────────────
  const handleForwardNavigation = useCallback(() => {
    if (navHistoryIndex < navHistory.length - 1) {
      const nextState = navHistory[navHistoryIndex + 1];
      setNavHistoryIndex(navHistoryIndex + 1);
      setScreen(nextState.screen);
      setCurrentPhase(nextState.phase);
      setCurrentQuestion(nextState.question);
    }
  }, [navHistory, navHistoryIndex]);

  // ─── Forward Button Handler (Mouse 4 - goes to NEXT question) ───────────────
  const handleForwardButton = useCallback(() => {
    if (showResumePrompt && savedProgress) {
      // If showing resume prompt, forward = continue where left off
      // Restore answers and find first unanswered question
      setAnswers(savedProgress.answers);
      setShowResumePrompt(false);
      
      // Find the FIRST unanswered question
      let targetPhase = 0;
      let targetQuestion = 0;
      let foundUnanswered = false;
      
      for (let p = 0; p < PHASES.length && !foundUnanswered; p++) {
        for (let q = 0; q < PHASES[p].questions.length; q++) {
          const questionId = PHASES[p].questions[q].id;
          const answer = savedProgress.answers[questionId];
          if (answer === undefined || answer === null || answer === "") {
            targetPhase = p;
            targetQuestion = q;
            foundUnanswered = true;
            break;
          }
        }
      }
      
      if (!foundUnanswered) {
        setScreen("complete");
      } else {
        setScreen("question");
        setCurrentPhase(targetPhase);
        setCurrentQuestion(targetQuestion);
        pushToNavHistory("question", targetPhase, targetQuestion);
      }
      return;
    }
    
    if (screen === "welcome") {
      // From welcome → go to first question
      setScreen("question");
      setCurrentPhase(0);
      setCurrentQuestion(0);
      pushToNavHistory("question", 0, 0);
    } else if (screen === "phase-select") {
      // From phase-select → go to current phase's first question
      setScreen("question");
      setCurrentQuestion(0);
      pushToNavHistory("question", currentPhase, 0);
    } else if (screen === "question") {
      // From question → go to next question
      if (currentQuestion < (PHASES[currentPhase]?.questions.length ?? 1) - 1) {
        const newQuestion = currentQuestion + 1;
        setCurrentQuestion(newQuestion);
        pushToNavHistory("question", currentPhase, newQuestion);
      } else if (currentPhase < PHASES.length - 1) {
        // Next phase
        const newPhase = currentPhase + 1;
        setCurrentPhase(newPhase);
        setCurrentQuestion(0);
        pushToNavHistory("question", newPhase, 0);
      } else {
        // Last question → complete
        setScreen("complete");
        pushToNavHistory("complete", currentPhase, currentQuestion);
      }
    }
    // On complete screen, forward does nothing (user should submit)
  }, [screen, showResumePrompt, savedProgress, currentPhase, currentQuestion, pushToNavHistory]);

  // ─── Mouse Button Navigation (Mouse 4 = Forward, Mouse 5 = Back) ──────────────
  useEffect(() => {
    if (!pollId) return;
    
    const handleMouseButton = (event: MouseEvent) => {
      // Button 3 = Back (Mouse 5 / rear thumb button)
      // Button 4 = Forward (Mouse 4 / front thumb button)
      
      // Back button (button 3) - go to previous question
      if (event.button === 3) {
        event.preventDefault();
        event.stopImmediatePropagation(); // Stop other window listeners
        handleBackNavigation();
      }
      // Forward button (button 4) - go to next question
      else if (event.button === 4) {
        event.preventDefault();
        event.stopImmediatePropagation(); // Stop other window listeners
        handleForwardButton();
      }
    };
    
    // Use capture phase so this runs BEFORE feed page handler
    window.addEventListener("mousedown", handleMouseButton, { capture: true });
    
    // Also prevent browser default navigation on these buttons
    const preventBrowserNav = (event: MouseEvent) => {
      if (event.button === 3 || event.button === 4) {
        event.preventDefault();
      }
    };
    window.addEventListener("auxclick", preventBrowserNav);
    
    return () => {
      window.removeEventListener("mousedown", handleMouseButton, { capture: true });
      window.removeEventListener("auxclick", preventBrowserNav);
    };
  }, [pollId, handleBackNavigation, handleForwardButton]);

  useEffect(() => {
    if (pollId && !hasRestoredProgress) {
      const progress = loadProgress(pollId);
      if (progress && Object.keys(progress.answers).length > 0) {
        setSavedProgress(progress);
        setShowResumePrompt(true);
      }
      setHasRestoredProgress(true);
    }
  }, [pollId, hasRestoredProgress]);

  useEffect(() => {
    if (pollId && hasRestoredProgress && Object.keys(answers).length > 0) {
      saveProgress({ pollId, screen, currentPhase, currentQuestion, answers, savedAt: Date.now() });
    }
  }, [pollId, screen, currentPhase, currentQuestion, answers, hasRestoredProgress]);

  const resumeProgress = useCallback(() => {
    if (savedProgress) {
      // Restore answers first
      setAnswers(savedProgress.answers);
      
      // Find the FIRST unanswered question across all phases
      // This ensures user continues from the next question they need to answer
      let targetPhase = 0;
      let targetQuestion = 0;
      let foundUnanswered = false;
      
      for (let p = 0; p < PHASES.length && !foundUnanswered; p++) {
        for (let q = 0; q < PHASES[p].questions.length; q++) {
          const questionId = PHASES[p].questions[q].id;
          const answer = savedProgress.answers[questionId];
          
          // Check if this question is unanswered
          if (answer === undefined || answer === null || answer === "") {
            targetPhase = p;
            targetQuestion = q;
            foundUnanswered = true;
            break;
          }
        }
      }
      
      // If all questions are answered, go to completion screen
      if (!foundUnanswered) {
        setScreen("complete");
        setCurrentPhase(PHASES.length - 1);
        setCurrentQuestion(PHASES[PHASES.length - 1].questions.length - 1);
        pushToNavHistory("complete", PHASES.length - 1, PHASES[PHASES.length - 1].questions.length - 1);
      } else {
        // Navigate to the first unanswered question
        setScreen("question");
        setCurrentPhase(targetPhase);
        setCurrentQuestion(targetQuestion);
        pushToNavHistory("question", targetPhase, targetQuestion);
      }
    }
    setShowResumePrompt(false);
  }, [savedProgress, pushToNavHistory]);

  const startFresh = useCallback(() => {
    clearProgress();
    setShowResumePrompt(false);
    // Stay on welcome screen - user can choose to start or select phase
  }, []);

  const phase = PHASES[currentPhase];
  const question = phase?.questions?.[currentQuestion] ?? null;

  const completedQuestions = useMemo(() => {
    const completed: Record<string, boolean> = {};
    Object.keys(answers).forEach((key) => {
      if (answers[key] !== undefined && answers[key] !== null && answers[key] !== "") {
        completed[key] = true;
      }
    });
    return completed;
  }, [answers]);

  const totalQuestions = useMemo(() => PHASES.reduce((sum, p) => sum + p.questions.length, 0), []);
  const answeredCount = Object.keys(completedQuestions).length;
  const overallProgress = Math.round((answeredCount / totalQuestions) * 100);

  const handleAnswer = useCallback((value: any) => {
    if (question) {
      setAnswers((prev) => ({ ...prev, [question.id]: value }));
    }
  }, [question]);

  const goNext = useCallback(() => {
    if (currentQuestion < phase.questions.length - 1) {
      const newQuestion = currentQuestion + 1;
      setCurrentQuestion(newQuestion);
      pushToNavHistory("question", currentPhase, newQuestion);
    } else if (currentPhase < PHASES.length - 1) {
      const newPhase = currentPhase + 1;
      setCurrentPhase(newPhase);
      setCurrentQuestion(0);
      pushToNavHistory("question", newPhase, 0);
    } else {
      setScreen("complete");
      pushToNavHistory("complete", currentPhase, currentQuestion);
    }
  }, [currentQuestion, currentPhase, phase?.questions.length, pushToNavHistory]);

  const goPrev = useCallback(() => {
    if (currentQuestion > 0) {
      const newQuestion = currentQuestion - 1;
      setCurrentQuestion(newQuestion);
      pushToNavHistory("question", currentPhase, newQuestion);
    } else if (currentPhase > 0) {
      const newPhase = currentPhase - 1;
      const newQuestion = PHASES[newPhase].questions.length - 1;
      setCurrentPhase(newPhase);
      setCurrentQuestion(newQuestion);
      pushToNavHistory("question", newPhase, newQuestion);
    }
  }, [currentQuestion, currentPhase, pushToNavHistory]);

  const goToPhase = useCallback((phaseIndex: number) => {
    // -1 means go back to welcome screen
    if (phaseIndex === -1) {
      setScreen("welcome");
      pushToNavHistory("welcome", 0, 0);
      return;
    }
    setCurrentPhase(phaseIndex);
    setCurrentQuestion(0);
    setScreen("question");
    pushToNavHistory("question", phaseIndex, 0);
  }, [pushToNavHistory]);

  // Callbacks that push history state for screen transitions
  const goToQuestionScreen = useCallback(() => {
    setScreen("question");
    pushToNavHistory("question", currentPhase, currentQuestion);
  }, [pushToNavHistory, currentPhase, currentQuestion]);

  const goToPhaseSelect = useCallback(() => {
    setScreen("phase-select");
    pushToNavHistory("phase-select", currentPhase, currentQuestion);
  }, [pushToNavHistory, currentPhase, currentQuestion]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const completionPct = Math.round((answeredCount / totalQuestions) * 100);
      const voteWeight = completionPct === 100 ? 100 : completionPct >= 75 ? 80 : completionPct >= 50 ? 60 : completionPct >= 25 ? 40 : 20;

      const phaseCompletion: Record<string, number> = {};
      PHASES.forEach((p) => {
        const completed = p.questions.filter((q) => completedQuestions[q.id]).length;
        phaseCompletion[p.id] = Math.round((completed / p.questions.length) * 100);
      });

      const res = await fetch("/api/reach-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          completionPct,
          voteWeight,
          phaseCompletion,
          totalTime: Date.now() - startTime,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit feedback");
      }

      const data = await res.json();
      clearProgress();
      onComplete?.(data.feedbackId || "completed");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = () => {
    if (!question) return null;

    switch (question.type) {
      case "branching":
        return <BranchingChoice question={question.data.question} value={answers[question.id]} onChange={handleAnswer} />;
      case "visual-slider":
        return <VisualSlider value={answers[question.id]} onChange={handleAnswer} {...question.data} />;
      case "drag-sort":
        return <DragToSort items={question.data.items} value={answers[question.id]} onChange={handleAnswer} />;
      case "drag-zone":
        return <DragToZone items={question.data.items} zones={question.data.zones} value={answers[question.id]} onChange={handleAnswer} />;
      case "weight-adjuster":
        return <WeightAdjuster items={question.data.items} value={answers[question.id]} onChange={handleAnswer} />;
      case "quick-choice":
        return <QuickChoiceQuestion options={question.data.options} value={answers[question.id]} onChange={handleAnswer} />;
      case "scenario":
        return <ScenarioQuestion options={question.data.options} value={answers[question.id]} onChange={handleAnswer} />;
      case "open-text":
        return <OpenTextQuestion value={answers[question.id]} onChange={handleAnswer} placeholder={question.data.placeholder} minLength={question.data.minLength} />;
      default:
        return <p className="text-center text-muted-foreground">Unknown question type</p>;
    }
  };

  if (!pollId) return null;

  return (
    <Dialog open={!!pollId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] max-h-[85vh] p-0 overflow-hidden bg-background/95 backdrop-blur-2xl border-white/10 shadow-2xl flex flex-col" hideCloseButton accessibleTitle="REACH Algorithm Research">
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          {/* Left side: Back button + Section info */}
          <div className="flex items-center gap-2">
            {/* Back Button - Always visible, closes modal on welcome screen */}
            {!showResumePrompt && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackNavigation}
                className="rounded-full h-9 w-9 hover:bg-muted"
                title={screen === "welcome" ? "Close poll" : "Go back"}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            
            {(screen === "question" || screen === "phase-select") && !showResumePrompt && (
              <>
                {screen === "question" && (
                  <button onClick={goToPhaseSelect} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${phase?.color}20` }}>
                      {phase && <phase.icon className="w-4 h-4" style={{ color: phase.color }} />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{phase?.title}</p>
                      <p className="text-xs text-muted-foreground">{currentQuestion + 1}/{phase?.questions.length}</p>
                    </div>
                  </button>
                )}
                <div className="hidden md:flex items-center gap-2 ml-2">
                  <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500" initial={{ width: 0 }} animate={{ width: `${overallProgress}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{overallProgress}%</span>
                </div>
              </>
            )}
          </div>
          
          {/* Right side: Forward button + Close button */}
          <div className="flex items-center gap-1">
            {/* Forward Button - Goes to next question (same as Mouse 4) */}
            {!showResumePrompt && screen !== "complete" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleForwardButton}
                className="rounded-full h-9 w-9 hover:bg-muted"
                title={screen === "welcome" ? "Start poll" : "Next question"}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            )}
            
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-9 w-9">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 relative">
          <AnimatePresence mode="wait">
            {showResumePrompt && savedProgress && (
              <motion.div key="resume-prompt" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
                <motion.div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-6 shadow-xl" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 100, damping: 15 }}>
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>
                <motion.h2 className="text-2xl font-bold mb-2" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>Welcome Back! 👋</motion.h2>
                <motion.p className="text-muted-foreground mb-2" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>You have progress saved</motion.p>
                <motion.div className="bg-muted/50 rounded-xl p-4 mb-8 max-w-sm" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Questions answered:</span>
                    <span className="font-semibold text-primary">{Object.keys(savedProgress.answers).length} / {totalQuestions}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" initial={{ width: 0 }} animate={{ width: `${Math.round((Object.keys(savedProgress.answers).length / totalQuestions) * 100)}%` }} transition={{ delay: 0.6, duration: 0.5 }} />
                  </div>
                </motion.div>
                <motion.div className="flex flex-col sm:flex-row gap-3" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
                  <Button variant="outline" onClick={startFresh} className="px-6 py-3 rounded-xl">Start Fresh</Button>
                  <Button onClick={resumeProgress} className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg">
                    Continue Where I Left Off <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {screen === "welcome" && !showResumePrompt && <WelcomeScreen key="welcome" onStart={goToQuestionScreen} onSelectPhase={goToPhaseSelect} phases={PHASES} />}
            {screen === "phase-select" && !showResumePrompt && <PhaseSelector key="phase-select" phases={PHASES} currentPhase={currentPhase} completedQuestions={completedQuestions} onSelectPhase={goToPhase} />}

            {screen === "question" && !showResumePrompt && question && (
              <motion.div key={`${phase.id}-${question.id}`} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }} className="p-6 md:p-8">
                <div className="text-center mb-6">
                  <motion.h2 className="text-xl md:text-2xl font-bold mb-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>{question.title}</motion.h2>
                  {question.subtitle && <motion.p className="text-muted-foreground text-sm max-w-lg mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>{question.subtitle}</motion.p>}
                </div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>{renderQuestion()}</motion.div>
              </motion.div>
            )}

            {screen === "question" && !showResumePrompt && !question && (
              <motion.div key="question-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4"><Target className="w-8 h-8 text-amber-500" /></div>
                <h3 className="text-lg font-semibold mb-2">Question not found</h3>
                <p className="text-muted-foreground mb-6 text-sm">There was an issue loading this question.</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={goToPhaseSelect}>Choose Section</Button>
                  <Button onClick={goNext}>Skip to Next <ChevronRight className="ml-1 w-4 h-4" /></Button>
                </div>
              </motion.div>
            )}

            {screen === "complete" && !showResumePrompt && <CompletionScreen key="complete" answeredCount={answeredCount} totalQuestions={totalQuestions} phases={PHASES} completedQuestions={completedQuestions} onSubmit={handleSubmit} onClose={onClose} onBackToPhases={goToPhaseSelect} isSubmitting={isSubmitting} />}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mx-4 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center flex-shrink-0">{error}</motion.div>
          )}
        </AnimatePresence>

        {screen === "question" && !showResumePrompt && (
          <div className="flex items-center justify-between p-4 border-t border-white/10 bg-muted/30 flex-shrink-0">
            <Button variant="ghost" onClick={goPrev} disabled={currentPhase === 0 && currentQuestion === 0} className="gap-1"><ChevronLeft className="w-4 h-4" /> Back</Button>
            <div className="hidden md:flex items-center gap-3">
              {PHASES.map((p, idx) => (
                <button key={p.id} onClick={() => goToPhase(idx)} className="flex items-center gap-1" title={p.title}>
                  {idx > 0 && <div className="w-4 h-px bg-muted-foreground/20" />}
                  <motion.div className={cn("w-3 h-3 rounded-full transition-colors cursor-pointer", idx < currentPhase ? "bg-emerald-500" : idx === currentPhase ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50")} animate={{ scale: idx === currentPhase ? [1, 1.2, 1] : 1 }} transition={{ repeat: idx === currentPhase ? Infinity : 0, duration: 2 }} />
                </button>
              ))}
            </div>
            <Button onClick={goNext} className="gap-1 bg-primary hover:bg-primary/90">
              {currentQuestion < phase.questions.length - 1 ? <>Next <ChevronRight className="w-4 h-4" /></> : currentPhase < PHASES.length - 1 ? <>Next Section <ChevronRight className="w-4 h-4" /></> : <>Complete <Check className="w-4 h-4" /></>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ReachPollV3;
