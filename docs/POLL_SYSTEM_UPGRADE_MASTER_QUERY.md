> **Status: HISTORICAL** — This spec was used to build the advanced poll system. The schema, API routes, and UI components described here have been implemented. Kept for audit trail and reference.

# 🚀 POLL SYSTEM UPGRADE - MASTER QUERY FOR AGENT

> **Context:** Veggat Platform (https://www.veggat.com/) - Secure premium digital marketplace with Web3 + realtime stack
> **First Poll Title:** "How should the 'Reach' be upgraded? (6→7 Pillars)"
> **Goal:** MASSIVE poll system upgrade WITHOUT breaking current functionality — SCALE IT UP

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current System Analysis](#2-current-system-analysis)
3. [The 7 Pillars of Reach Framework](#3-the-7-pillars-of-reach-framework)
4. [Poll System Architecture Upgrade](#4-poll-system-architecture-upgrade)
5. [Database Schema Additions](#5-database-schema-additions)
6. [API Routes to Create/Modify](#6-api-routes-to-createmodify)
7. [UI Components Specification](#7-ui-components-specification)
8. [Poll Creation System](#8-poll-creation-system)
9. [Poll Response Analytics](#9-poll-response-analytics)
10. [Security & Anti-Gaming](#10-security--anti-gaming)
11. [The First Poll Content](#11-the-first-poll-content)
12. [Implementation Checklist](#12-implementation-checklist)

---

## 1. EXECUTIVE SUMMARY

### What We're Building
A **scaled-up poll system** that supports:
- **Multi-question polls** (surveys) with nested questions
- **Slider-based answers** (smooth animated steps A, B, C, D)
- **Image paste support** (Ctrl+V inline images)
- **Comment/feedback per question**
- **Partial completion** with weighted results
- **Template generation** for AI-assisted poll creation
- **Manual poll builder** with button-based UX
- **Bot security** and industrial-grade validation
- **Analytics carousel** with React-2 (recharts/chartjs) visualizations

### Key Constraints
- ✅ **DO NOT BREAK** existing poll functionality
- ✅ **EXTEND** existing Prisma models (Poll, PollOption, PollVote)
- ✅ **BACKWARD COMPATIBLE** API responses
- ✅ Existing simple polls continue to work as-is

---

## 2. CURRENT SYSTEM ANALYSIS

### Existing Prisma Models (DO NOT MODIFY, ONLY EXTEND)
```prisma
model Poll {
  id             String       @id @default(cuid())
  question       String
  conversationId String       @unique
  creatorId      String
  allowMultiple  Boolean      @default(false)
  isAnonymous    Boolean      @default(false)
  expiresAt      DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  Conversation   Conversation @relation(...)
  PollOption     PollOption[]
}

model PollOption {
  id        String     @id @default(cuid())
  pollId    String
  text      String
  order     Int        @default(0)
  createdAt DateTime   @default(now())
  Poll      Poll       @relation(...)
  PollVote  PollVote[]
}

model PollVote {
  id         String     @id @default(cuid())
  optionId   String
  userId     String
  createdAt  DateTime   @default(now())
  PollOption PollOption @relation(...)
  @@unique([optionId, userId])
}
```

### Current 6 Pillars of Reach (TO BECOME 7)
```typescript
visibility: number;       // 20% - Unique exposures deduped
engagementDepth: number;  // 30% - Quality interactions
conversionImpact: number; // 20% - Marketplace actions
loyalty: number;          // 15% - Repeat engagers
growth: number;           // 10% - Organic expansion
recall: number;           // 5%  - Return rate/stickiness
```

---

## 3. THE 7 PILLARS OF REACH FRAMEWORK

### The Upgrade: 6→7 Pillars

| Layer | Name | Core Focus | Multiplier | Stack Fit | Type |
|-------|------|------------|------------|-----------|------|
| 1 | **Foundation & Discovery** | SEO + Platform-native discoverability | Baseline | Product pages, Next.js SSR | Battle-tested |
| 2 | **Killer Content** | Relevance, Truth, Passion, Humanity, Surprise, Originality | 2–5× | Product trailers, creator stories | Creative+proven |
| 3 | **Psychological Drivers** | Solis 6 pillars (Proof, Scarcity, Authority…) | Trust + urgency | Limited editions, social proof | Battle-tested |
| 4 | **Community & Belonging** | Real relationships & loyalty | Retention | Wallet-gated, fan groups | Battle-tested |
| 5 | **Amplification Tactics** | Paid, Influencers, Viral Contests | 5–20× | Referral rewards, paid boosts | Battle-tested |
| 6 | **Analytics & Iteration** | Real-time data → fast pivots | Efficiency | Prisma + charts + SWR + Pusher | Battle-tested |
| 7 | **🆕 Realtime Pulse & Network Effects** | Scheduled high-energy "Pulses" + Live Distribution + Viral Loops | 10–100×+ | **THE NEW ROCKET LAYER** | Creative but solid |

### The 7th Layer Deep Dive — "Realtime Pulse & Network Effects"
**Definition:** A timed, high-intensity, multi-platform content/product release event ("Pulse") that is live, social, and incentivized — engineered to trigger network effects and self-sustaining virality.

**Key Mechanics:**
- Pulse Scheduler → Creators schedule a "Pulse" (product drop + video + live chat) → shows countdown everywhere
- Universal Video Player → One player that pulls from YouTube + Twitch + Vimeo + custom HLS
- Live Realtime Layer → Pusher/Socket.io shows live sales counter, buyer avatars, live chat, notifications
- Web3 Flywheel → Buyer gets auto-referral link + small % commission or NFT badge for sharing
- Cross-platform Blast → Pulse auto-posts teaser + countdown to X, Instagram, TikTok, Telegram, Discord

**Realistic Outcomes:**
- One well-executed Pulse → 30–150× normal daily reach in 2–4 hours
- Creates "I was there" FOMO → massive social proof
- Referral loop often turns 1 buyer into 4–12 new users

---

## 4. POLL SYSTEM ARCHITECTURE UPGRADE

### New Concept: Multi-Question Polls (Surveys)

```
AdvancedPoll (NEW)
├── metadata (title, description, type)
├── questions[] (ordered)
│   ├── PollQuestion
│   │   ├── text
│   │   ├── type (SINGLE_CHOICE, SLIDER, MULTI_CHOICE, NESTED)
│   │   ├── options[] (for choice types)
│   │   ├── sliderConfig (for slider type)
│   │   ├── allowImages (boolean)
│   │   ├── allowComments (boolean)
│   │   └── childQuestions[] (for nested)
│   └── ...
├── responses[]
│   └── PollResponse
│       ├── userId
│       ├── completionPercentage
│       ├── answers[]
│       └── images[] + comments[]
└── analytics
```

### Question Types Supported
1. **SINGLE_CHOICE** — Traditional A, B, C, D (click one)
2. **MULTI_CHOICE** — Select multiple options
3. **SLIDER** — Drag slider with steps (smooth animation between A, B, C, D, E, F, G)
4. **SCALE** — 1-10 numeric rating
5. **TEXT** — Free text response
6. **NESTED** — A question that contains sub-questions based on answer

### Answer Input Structures
Parsing formats the system must understand:
```
question?A,B,C,D         → 4-option single/slider
question?A,B,C           → 3-option
question?A,B,C,D,E,F,G   → 7-option (for reach pillar polls!)
question?1,2,3           → Numeric scale
question?1               → Yes/No (1=Yes)
question?A               → Yes/No (A=Yes)
```

---

## 5. DATABASE SCHEMA ADDITIONS

### New Models (ADD TO schema.prisma)

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED POLL SYSTEM - Scales existing Poll without breaking it
// ─────────────────────────────────────────────────────────────────────────────

model AdvancedPoll {
  id                String             @id @default(cuid())
  title             String             // "How should the 'Reach' be upgraded?"
  description       String?            // Detailed context/instructions
  type              AdvancedPollType   @default(SURVEY)
  creatorId         String
  conversationId    String?            @unique // Optional: can exist standalone
  isAnonymous       Boolean            @default(false)
  allowPartial      Boolean            @default(true) // Can submit incomplete
  requiresAuth      Boolean            @default(true)
  expiresAt         DateTime?
  publishedAt       DateTime?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  
  // Relations
  Creator           User               @relation(fields: [creatorId], references: [id])
  Conversation      Conversation?      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  Questions         PollQuestion[]
  Responses         PollResponse[]
  Templates         PollTemplate[]
  
  // Analytics cache
  totalResponses    Int                @default(0)
  avgCompletionPct  Float              @default(0)
  
  @@index([creatorId])
  @@index([conversationId])
  @@index([type])
}

enum AdvancedPollType {
  SIMPLE           // Single question (backward compat)
  SURVEY           // Multi-question
  QUIZ             // With correct answers
  FEEDBACK         // Open-ended focus
  REACH_ASSESSMENT // Special type for reach pillar polls
}

model PollQuestion {
  id                String              @id @default(cuid())
  advancedPollId    String
  parentQuestionId  String?             // For nested questions
  text              String
  description       String?             // Additional context
  type              PollQuestionType    @default(SINGLE_CHOICE)
  order             Int                 @default(0)
  isRequired        Boolean             @default(true)
  allowImages       Boolean             @default(false)
  allowComments     Boolean             @default(false)
  
  // Slider-specific config (JSON)
  sliderConfig      Json?               // { min: 0, max: 100, steps: 7, labels: ['A','B','C','D','E','F','G'] }
  
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  // Relations
  AdvancedPoll      AdvancedPoll        @relation(fields: [advancedPollId], references: [id], onDelete: Cascade)
  ParentQuestion    PollQuestion?       @relation("NestedQuestions", fields: [parentQuestionId], references: [id])
  ChildQuestions    PollQuestion[]      @relation("NestedQuestions")
  Options           PollQuestionOption[]
  Answers           PollAnswer[]
  
  @@index([advancedPollId])
  @@index([parentQuestionId])
}

enum PollQuestionType {
  SINGLE_CHOICE
  MULTI_CHOICE
  SLIDER
  SCALE
  TEXT
  NESTED
}

model PollQuestionOption {
  id              String         @id @default(cuid())
  questionId      String
  text            String
  order           Int            @default(0)
  value           Int?           // Numeric value for scoring
  imageUrl        String?        // Option can have image
  
  // Relations
  Question        PollQuestion   @relation(fields: [questionId], references: [id], onDelete: Cascade)
  Answers         PollAnswer[]
  
  @@index([questionId])
}

model PollResponse {
  id                String         @id @default(cuid())
  advancedPollId    String
  userId            String?        // Nullable for anonymous
  sessionId         String?        // For anonymous tracking
  completionPct     Float          @default(0)
  startedAt         DateTime       @default(now())
  completedAt       DateTime?
  ipHash            String?        // For anti-bot
  userAgent         String?
  
  // Quality scoring
  responseQuality   Float          @default(1.0) // 0-1, lower for incomplete/suspicious
  
  // Relations
  AdvancedPoll      AdvancedPoll   @relation(fields: [advancedPollId], references: [id], onDelete: Cascade)
  User              User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  Answers           PollAnswer[]
  
  @@unique([advancedPollId, userId])
  @@index([advancedPollId])
  @@index([userId])
}

model PollAnswer {
  id              String              @id @default(cuid())
  responseId      String
  questionId      String
  optionId        String?             // For choice questions
  sliderValue     Float?              // For slider questions (0-100 or custom range)
  scaleValue      Int?                // For scale questions
  textValue       String?             // For text questions
  comment         String?             // Optional comment on any answer
  createdAt       DateTime            @default(now())
  
  // Relations
  Response        PollResponse        @relation(fields: [responseId], references: [id], onDelete: Cascade)
  Question        PollQuestion        @relation(fields: [questionId], references: [id], onDelete: Cascade)
  Option          PollQuestionOption? @relation(fields: [optionId], references: [id], onDelete: SetNull)
  Images          PollAnswerImage[]
  
  @@unique([responseId, questionId])
  @@index([responseId])
  @@index([questionId])
}

model PollAnswerImage {
  id          String     @id @default(cuid())
  answerId    String
  url         String
  caption     String?
  order       Int        @default(0)
  width       Int?       // For smart display
  height      Int?
  aspectRatio String?    // 'portrait', 'landscape', 'square'
  createdAt   DateTime   @default(now())
  
  Answer      PollAnswer @relation(fields: [answerId], references: [id], onDelete: Cascade)
  
  @@index([answerId])
}

// Template system for generating poll structures
model PollTemplate {
  id              String         @id @default(cuid())
  name            String
  description     String?
  structure       Json           // The full poll structure as JSON
  category        String?        // 'reach', 'feedback', 'product', etc.
  isPublic        Boolean        @default(false)
  usageCount      Int            @default(0)
  creatorId       String?
  advancedPollId  String?        // If template was derived from a poll
  createdAt       DateTime       @default(now())
  
  Creator         User?          @relation(fields: [creatorId], references: [id], onDelete: SetNull)
  AdvancedPoll    AdvancedPoll?  @relation(fields: [advancedPollId], references: [id], onDelete: SetNull)
  
  @@index([category])
  @@index([isPublic])
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD TO User model (relations)
// ─────────────────────────────────────────────────────────────────────────────
// AdvancedPolls     AdvancedPoll[]
// PollResponses     PollResponse[]
// PollTemplates     PollTemplate[]
```

---

## 6. API ROUTES TO CREATE/MODIFY

### New Routes Structure
```
/api/advanced-polls/
├── route.ts                    # GET (list), POST (create)
├── [pollId]/
│   ├── route.ts                # GET (single), PATCH (update), DELETE
│   ├── questions/
│   │   ├── route.ts            # POST (add question)
│   │   └── [questionId]/
│   │       └── route.ts        # PATCH, DELETE question
│   ├── respond/
│   │   └── route.ts            # POST (submit response/answers)
│   ├── analytics/
│   │   └── route.ts            # GET (poll analytics + charts data)
│   └── export/
│       └── route.ts            # GET (export results as CSV/JSON)
├── templates/
│   ├── route.ts                # GET (list templates), POST (create)
│   └── [templateId]/
│       └── route.ts            # GET, apply template
└── parse/
    └── route.ts                # POST (parse text/txt to poll structure)
```

### Key API Specifications

#### POST /api/advanced-polls
```typescript
// Request body
{
  title: string;
  description?: string;
  type: 'SIMPLE' | 'SURVEY' | 'QUIZ' | 'FEEDBACK' | 'REACH_ASSESSMENT';
  conversationId?: string;
  isAnonymous?: boolean;
  allowPartial?: boolean;
  expiresAt?: string; // ISO date
  questions: Array<{
    text: string;
    type: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'SLIDER' | 'SCALE' | 'TEXT' | 'NESTED';
    order: number;
    isRequired?: boolean;
    allowImages?: boolean;
    allowComments?: boolean;
    sliderConfig?: {
      min: number;
      max: number;
      steps: number;
      labels: string[];
    };
    options?: Array<{ text: string; order: number; value?: number; }>;
    childQuestions?: Array</* recursive */>;
  }>;
}
```

#### POST /api/advanced-polls/[pollId]/respond
```typescript
// Request body
{
  answers: Array<{
    questionId: string;
    optionId?: string;
    sliderValue?: number;
    scaleValue?: number;
    textValue?: string;
    comment?: string;
    images?: Array<{ url: string; caption?: string; }>;
  }>;
  isPartial?: boolean; // If user hasn't finished all questions
}
```

#### POST /api/advanced-polls/parse
```typescript
// Request body (parses text into poll structure)
{
  content: string; // Raw text or .txt content
  format?: 'auto' | 'simple' | 'structured';
}

// Example input:
// "What is your favorite color?A,B,C,D"
// "Rate the feature 1-7?1,2,3,4,5,6,7"

// Response: full poll structure JSON ready for creation
```

---

## 7. UI COMPONENTS SPECIFICATION

### Component Tree
```
components/
├── uicustom/
│   └── polls/
│       ├── AdvancedPollDisplay.tsx      # Main poll renderer
│       ├── PollQuestionCard.tsx         # Single question display
│       ├── SliderQuestion.tsx           # Animated slider input
│       ├── ChoiceQuestion.tsx           # A,B,C,D buttons
│       ├── ImagePasteInput.tsx          # Ctrl+V image handler
│       ├── PollCommentInput.tsx         # Comment textarea
│       ├── PollProgressBar.tsx          # Completion progress
│       ├── PollAnalyticsCarousel.tsx    # Charts carousel
│       ├── PollBuilder/
│       │   ├── PollBuilderMain.tsx      # Main builder interface
│       │   ├── QuestionTypeSelector.tsx # Choose question type
│       │   ├── TextImportModal.tsx      # Paste/upload text
│       │   └── TemplateSelector.tsx     # Pre-made templates
│       └── PollResultsOverview.tsx      # User's response tendencies
```

### SliderQuestion Component Specification
```tsx
interface SliderQuestionProps {
  question: PollQuestion;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

// Features:
// - Smooth CSS transitions between steps
// - Labels appear on each step (A, B, C, D, E, F, G)
// - Haptic feedback on mobile (if supported)
// - Keyboard accessible (arrow keys)
// - Visual indicator shows current position
// - Optional: tooltip shows label meaning on hover
```

### ImagePasteInput Component Specification
```tsx
interface ImagePasteInputProps {
  onImageAdd: (image: { url: string; width: number; height: number; aspectRatio: string }) => void;
  maxImages?: number;
  children?: React.ReactNode;
}

// Features:
// - Listens for Ctrl+V / Cmd+V paste events
// - Accepts clipboard images
// - Uploads to EdgeStore and returns URL
// - Detects resolution → determines portrait/landscape/square
// - Inline display: portraits shown tall, landscapes wide, squares as-is
// - User can add captions
// - Shows loading state during upload
```

### PollAnalyticsCarousel Component
```tsx
interface PollAnalyticsCarouselProps {
  pollId: string;
}

// Features:
// - Embla carousel (already in deps)
// - Multiple chart types user can swipe through:
//   1. Radar chart (pillar distribution)
//   2. Bar chart (response counts per option)
//   3. Pie chart (percentage breakdown)
//   4. Line chart (responses over time)
//   5. Heatmap (for slider questions)
// - Uses Chart.js or Recharts (Chart.js already in deps)
// - Auto-updates via SWR
```

---

## 8. POLL CREATION SYSTEM

### Three Ways to Create a Poll

#### 1. Text Import (Paste/Upload)
User can paste or upload a `.txt` file with structured content:
```
POLL: How should the 'Reach' be upgraded?
DESCRIPTION: We're upgrading from 6 to 7 pillars. Help us decide the best approach.
TYPE: REACH_ASSESSMENT

Q1: Which pillar should get the most weight increase?
TYPE: SLIDER
OPTIONS: Visibility, Engagement, Conversion, Loyalty, Growth, Recall, Realtime
ALLOW_COMMENT: true

Q2: Should the 7th pillar (Realtime Pulse) focus more on live events or scheduled drops?
TYPE: SINGLE_CHOICE
OPTIONS: A) Live events, B) Scheduled drops, C) Both equally, D) Neither (different approach)
ALLOW_IMAGES: true

Q3: Rate your excitement for real-time notifications (1-7)?
TYPE: SCALE
RANGE: 1,7
```

#### 2. AI Template Generation
Pre-structured templates user can copy to any AI:
```
TEMPLATE 1 - Reach Assessment (7 questions, slider-heavy)
TEMPLATE 2 - Feature Feedback (5 questions, mixed)
TEMPLATE 3 - Quick Poll (1-3 questions, choice only)
TEMPLATE 4 - Deep Survey (10+ questions, all types)
```

#### 3. Manual Builder (Button-Based)
```
[Add Question] button → Modal opens:
├── Question text input
├── Type selector (Single Choice | Multi | Slider | Scale | Text)
├── Options builder (Add Option + / Remove -)
├── Toggle: Allow images?
├── Toggle: Allow comments?
├── [Add Sub-Question] (for nested)
└── [Save Question]

After adding: Questions shown in list, can reorder via drag
```

### Template Examples (Pre-Structured Text)

#### Template 1: Reach Pillar Assessment
```
POLL: How should the 'Reach' be upgraded (6→7 Pillars)?
TYPE: REACH_ASSESSMENT
ALLOW_PARTIAL: true

Q1: The 7th pillar will focus on "Realtime Pulse & Network Effects". Rate your agreement (1-7):
TYPE: SLIDER
LABELS: Strongly Disagree, Disagree, Neutral, Slight Agree, Agree, Strongly Agree, 100% Yes
ALLOW_COMMENT: true

Q2: Which existing pillar should have its weight INCREASED to make room for the 7th?
TYPE: SINGLE_CHOICE
OPTIONS: A) Visibility (20%→25%), B) Engagement (30%→35%), C) Growth (10%→15%), D) None - take equally from all
ALLOW_IMAGES: true

Q3: Which existing pillar could have its weight DECREASED?
TYPE: SINGLE_CHOICE  
OPTIONS: A) Recall (5%→3%), B) Loyalty (15%→12%), C) Conversion (20%→17%), D) Spread equally

Q4: What should the 7th pillar's weight be?
TYPE: SLIDER
LABELS: 5%, 7%, 10%, 12%, 15%, 17%, 20%

Q5: (NESTED) Do you participate in live events on social platforms?
TYPE: SINGLE_CHOICE
OPTIONS: A) Yes regularly, B) Sometimes, C) Rarely, D) Never
CHILD_IF_A_OR_B:
  Q5.1: What makes you join a live event?
  TYPE: MULTI_CHOICE
  OPTIONS: Exclusive content, FOMO, Community, Rewards, Other

Q6: Would you prefer real-time notifications for new pulses?
TYPE: SLIDER
LABELS: Never, Rarely, Sometimes, Often, Always, Instant-Push-Everything
ALLOW_COMMENT: true

Q7: Any other thoughts on the 7-pillar Reach system?
TYPE: TEXT
ALLOW_IMAGES: true
```

---

## 9. POLL RESPONSE ANALYTICS

### Partial Completion Weighting
```typescript
// Response quality calculation
function calculateResponseQuality(response: PollResponse): number {
  const completionWeight = response.completionPct / 100; // 0-1
  const timeWeight = calculateTimeQuality(response.startedAt, response.completedAt); // Was it rushed?
  const consistencyWeight = checkAnswerConsistency(response.answers); // Did they just click randomly?
  
  return (completionWeight * 0.5) + (timeWeight * 0.3) + (consistencyWeight * 0.2);
}

// Aggregate results weighting
function aggregatePollResults(responses: PollResponse[]): AggregatedResults {
  return responses.reduce((acc, response) => {
    const weight = response.responseQuality;
    // Each answer's contribution is multiplied by weight
    // A 30% complete response contributes less than 100% complete
  }, initialAccumulator);
}
```

### User Tendency Overview
After completing polls, users see their "tendency profile":
```typescript
interface UserPollTendency {
  userId: string;
  pollsCompleted: number;
  avgCompletionRate: number;
  tendencies: {
    // For slider questions: where do they usually land?
    sliderTendency: 'low' | 'middle' | 'high' | 'varied';
    // For choice questions: do they pick first option often?
    choicePattern: 'diverse' | 'firstOption' | 'lastOption' | 'balanced';
    // Comment frequency
    commentFrequency: 'never' | 'rarely' | 'sometimes' | 'often' | 'always';
    // Time spent per question
    responseSpeed: 'very_fast' | 'fast' | 'moderate' | 'thoughtful' | 'very_slow';
  };
  // Radar chart data for their reach pillar preferences
  reachPillarPreferences: {
    visibility: number;
    engagementDepth: number;
    conversionImpact: number;
    loyalty: number;
    growth: number;
    recall: number;
    realtimePulse: number; // The new 7th!
  };
}
```

### Chart Visualizations (Carousel)
1. **Radar Chart** — Pillar distribution across all respondents
2. **Bar Chart** — Response counts per option for each question
3. **Pie Chart** — Overall percentage breakdown
4. **Line Chart** — Responses over time (for time-series analysis)
5. **Heatmap** — Slider value distribution (where do people cluster?)
6. **Sankey Diagram** — Flow from question to question (for nested polls)

---

## 10. SECURITY & ANTI-GAMING

### Bot Prevention
```typescript
// Validation rules
const POLL_SECURITY_CONFIG = {
  // Minimum time between starting and first answer
  minTimeToFirstAnswer: 2000, // 2 seconds
  
  // Minimum time per question (avg)
  minTimePerQuestion: 1500, // 1.5 seconds
  
  // Maximum answers per minute (anti-spam)
  maxAnswersPerMinute: 30,
  
  // Require authentication for certain poll types
  requireAuthForTypes: ['REACH_ASSESSMENT', 'QUIZ'],
  
  // IP rate limiting
  maxResponsesPerIpPerHour: 5,
  
  // Suspicious patterns
  flagPatterns: {
    allSameChoice: true,        // User selected A for everything
    linearSlider: true,         // 1,2,3,4,5,6,7 in order
    tooFast: true,              // Completed 20 questions in 10 seconds
    duplicateSessionId: true,   // Same browser session voting multiple times
  },
  
  // VPN detection (basic)
  flagKnownVpnIps: true,
};
```

### Input Validation (Industrial Grade)
```typescript
// Zod schemas for all inputs
const PollAnswerInputSchema = z.object({
  questionId: z.string().cuid(),
  optionId: z.string().cuid().optional(),
  sliderValue: z.number().min(0).max(100).optional(),
  scaleValue: z.number().int().min(1).max(10).optional(),
  textValue: z.string().max(5000).optional(),
  comment: z.string().max(2000).optional(),
  images: z.array(z.object({
    url: z.string().url(),
    caption: z.string().max(500).optional(),
  })).max(5).optional(),
}).refine(data => {
  // At least one answer type must be provided
  return data.optionId || data.sliderValue !== undefined || 
         data.scaleValue !== undefined || data.textValue;
}, { message: 'Answer required' });
```

---

## 11. THE FIRST POLL CONTENT

### Poll: "How should the 'Reach' be upgraded (6→7 Pillars)?"

```json
{
  "title": "How should the 'Reach' be upgraded (6→7 Pillars)?",
  "description": "We're expanding the Reach system from 6 to 7 pillars. The new 7th pillar is 'Realtime Pulse & Network Effects' — focusing on live events, scheduled drops, viral loops, and real-time engagement. Help us decide how to best integrate it!",
  "type": "REACH_ASSESSMENT",
  "allowPartial": true,
  "isAnonymous": false,
  "questions": [
    {
      "order": 1,
      "text": "How excited are you about adding a 7th pillar focused on real-time engagement?",
      "type": "SLIDER",
      "sliderConfig": {
        "min": 0,
        "max": 100,
        "steps": 7,
        "labels": ["Not at all", "Slightly", "Somewhat", "Moderately", "Quite", "Very", "Extremely"]
      },
      "allowComments": true,
      "isRequired": true
    },
    {
      "order": 2,
      "text": "The 7th pillar 'Realtime Pulse' should primarily focus on:",
      "type": "SINGLE_CHOICE",
      "options": [
        { "text": "A) Live streaming events (real-time drops)", "order": 0 },
        { "text": "B) Scheduled pulse releases (countdown timers)", "order": 1 },
        { "text": "C) Viral referral loops (share to earn)", "order": 2 },
        { "text": "D) All of the above equally", "order": 3 },
        { "text": "E) Something else (comment below)", "order": 4 }
      ],
      "allowComments": true,
      "isRequired": true
    },
    {
      "order": 3,
      "text": "Which current pillar's weight would you reduce to make room for the 7th?",
      "type": "SINGLE_CHOICE",
      "options": [
        { "text": "A) Visibility (currently 20%)", "order": 0 },
        { "text": "B) Engagement Depth (currently 30%)", "order": 1 },
        { "text": "C) Conversion Impact (currently 20%)", "order": 2 },
        { "text": "D) Loyalty (currently 15%)", "order": 3 },
        { "text": "E) Growth (currently 10%)", "order": 4 },
        { "text": "F) Recall (currently 5%)", "order": 5 },
        { "text": "G) Take equally from all", "order": 6 }
      ],
      "allowImages": true,
      "allowComments": true,
      "isRequired": true
    },
    {
      "order": 4,
      "text": "What weight should the new 7th pillar have?",
      "type": "SLIDER",
      "sliderConfig": {
        "min": 5,
        "max": 20,
        "steps": 7,
        "labels": ["5%", "7%", "10%", "12%", "15%", "17%", "20%"]
      },
      "allowComments": true,
      "isRequired": true
    },
    {
      "order": 5,
      "text": "Do you participate in live/real-time events on social platforms?",
      "type": "SINGLE_CHOICE",
      "options": [
        { "text": "A) Yes, regularly", "order": 0 },
        { "text": "B) Sometimes", "order": 1 },
        { "text": "C) Rarely", "order": 2 },
        { "text": "D) Never", "order": 3 }
      ],
      "isRequired": true
    },
    {
      "order": 6,
      "text": "How important is real-time social proof (e.g., 'X just bought this', live counters) to you?",
      "type": "SLIDER",
      "sliderConfig": {
        "min": 0,
        "max": 100,
        "steps": 7,
        "labels": ["Not at all", "Slightly", "Somewhat", "Moderately", "Quite", "Very", "Essential"]
      },
      "allowComments": true,
      "isRequired": false
    },
    {
      "order": 7,
      "text": "Any additional thoughts on the 7-pillar Reach system? (Optional)",
      "type": "TEXT",
      "allowImages": true,
      "isRequired": false
    }
  ]
}
```

---

## 12. IMPLEMENTATION CHECKLIST

### Phase 1: Database & Core API (Critical Path)
- [ ] Add new Prisma models to `schema.prisma`
- [ ] Run `npx prisma migrate dev --name add-advanced-poll-system`
- [ ] Create `/api/advanced-polls/route.ts` (GET, POST)
- [ ] Create `/api/advanced-polls/[pollId]/route.ts` (GET, PATCH, DELETE)
- [ ] Create `/api/advanced-polls/[pollId]/respond/route.ts` (POST)
- [ ] Create `/api/advanced-polls/[pollId]/analytics/route.ts` (GET)
- [ ] Add Zod schemas in `lib/types/advanced-polls.ts`

### Phase 2: UI Components
- [ ] Create `SliderQuestion.tsx` with smooth animations
- [ ] Create `ChoiceQuestion.tsx` for A,B,C,D selection
- [ ] Create `ImagePasteInput.tsx` for Ctrl+V images
- [ ] Create `PollCommentInput.tsx`
- [ ] Create `PollProgressBar.tsx`
- [ ] Create `AdvancedPollDisplay.tsx` (main renderer)
- [ ] Create `PollQuestionCard.tsx`

### Phase 3: Poll Builder
- [ ] Create `PollBuilder/PollBuilderMain.tsx`
- [ ] Create `TextImportModal.tsx` for paste/upload
- [ ] Create `TemplateSelector.tsx`
- [ ] Implement text parsing in `/api/advanced-polls/parse/route.ts`

### Phase 4: Analytics & Visualization
- [ ] Create `PollAnalyticsCarousel.tsx`
- [ ] Add Chart.js radar, bar, pie, line charts
- [ ] Create `PollResultsOverview.tsx` for user tendencies
- [ ] Implement weighted aggregation logic

### Phase 5: Security & Polish
- [ ] Implement bot detection rules
- [ ] Add rate limiting middleware
- [ ] Test partial completion weighting
- [ ] Add VPN/suspicious IP flagging
- [ ] Comprehensive input validation

### Phase 6: First Poll Launch
- [ ] Create the "Reach 6→7" poll using the system
- [ ] Add poll to a prominent location (feed, profile, dashboard)
- [ ] Enable analytics tracking

---

## 📎 APPENDIX: Quick Reference

### Routes Overview (Existing App)
The poll system should integrate with these existing routes:
- `/feed` — Where pulses/conversations appear
- `/pulse` — Individual pulse view
- `/profile/[userId]` — User profile with reach analytics
- `/settings` — User privacy/tracking preferences
- `/analytics` — Analytics dashboard

### Tech Stack Reminder
- **Frontend:** Next.js 16, React 19, TailwindCSS, Chart.js, SWR, Pusher-js
- **Backend:** Prisma, PostgreSQL, Zod, Next.js API routes
- **Realtime:** Pusher, Socket.io
- **File Storage:** EdgeStore
- **Auth:** NextAuth v5

### Key Dependencies Already Installed
```json
"chart.js": "^4.5.1",
"react-chartjs-2": "^5.3.1",
"embla-carousel-react": "^8.0.0-rc22",
"@edgestore/react": "^0.1.7",
"pusher-js": "^8.4.0-rc2",
"zod": "^3.25.76"
```

---

**END OF MASTER QUERY**

> This document is the complete specification for upgrading the poll system. An agent can use this to implement all features in a single comprehensive pass.
