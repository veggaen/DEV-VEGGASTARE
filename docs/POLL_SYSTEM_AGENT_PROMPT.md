# AGENT PROMPT: Poll System Upgrade + First Poll Creation

## CONTEXT
You are upgrading the poll system for Veggat (https://www.veggat.com/), a premium digital marketplace with Web3 + realtime stack (Next.js 16, React 19, Prisma, PostgreSQL, Pusher, EdgeStore).

## CRITICAL CONSTRAINTS
1. **DO NOT BREAK** existing poll system (Poll, PollOption, PollVote models)
2. **EXTEND** with new AdvancedPoll models
3. Existing simple polls must continue working unchanged

## WHAT TO BUILD

### 1. DATABASE (Add to `frontend/prisma/schema.prisma`)
New models: `AdvancedPoll`, `PollQuestion`, `PollQuestionOption`, `PollResponse`, `PollAnswer`, `PollAnswerImage`, `PollTemplate`

Question types supported:
- SINGLE_CHOICE (A, B, C, D buttons)
- MULTI_CHOICE (select multiple)
- SLIDER (smooth animated steps with labels)
- SCALE (1-10)
- TEXT (free text)
- NESTED (sub-questions)

### 2. API ROUTES (Create in `frontend/app/api/`)
```
/api/advanced-polls/
├── route.ts                    # GET (list), POST (create)
├── [pollId]/
│   ├── route.ts                # GET, PATCH, DELETE
│   ├── respond/route.ts        # POST (submit answers)
│   └── analytics/route.ts      # GET (poll analytics)
├── templates/route.ts          # GET, POST templates
└── parse/route.ts              # POST (text → poll structure)
```

### 3. UI COMPONENTS (Create in `frontend/components/uicustom/polls/`)
- `AdvancedPollDisplay.tsx` — Main poll renderer
- `SliderQuestion.tsx` — Drag slider with smooth animation, step labels (A,B,C,D,E,F,G)
- `ChoiceQuestion.tsx` — Click to select options
- `ImagePasteInput.tsx` — Ctrl+V image paste, upload to EdgeStore, detect portrait/landscape
- `PollCommentInput.tsx` — Optional comment per question
- `PollProgressBar.tsx` — Completion percentage
- `PollAnalyticsCarousel.tsx` — Swipeable charts (Radar, Bar, Pie, Line, Heatmap)
- `PollBuilder/` — Manual builder with buttons + text import modal

### 4. KEY FEATURES
- **Partial completion**: Users can submit incomplete polls with weighted results
- **Response quality scoring**: Incomplete responses count less in aggregation
- **Image paste support**: Ctrl+V inline images with auto-sizing by aspect ratio
- **Templates**: Pre-structured text users can copy to AI or use directly
- **Bot security**: Min time between answers, rate limiting, suspicious pattern detection
- **Analytics carousel**: Multiple chart types showing response distribution

### 5. FIRST POLL TO CREATE
**Title:** "How should the 'Reach' be upgraded (6→7 Pillars)?"

7 questions total:
1. (SLIDER 1-7) How excited about 7th pillar?
2. (CHOICE A-E) What should 7th pillar focus on?
3. (CHOICE A-G) Which current pillar to reduce?
4. (SLIDER 5%-20%) What weight for 7th pillar?
5. (CHOICE A-D) Do you participate in live events?
6. (SLIDER 1-7) Importance of real-time social proof?
7. (TEXT) Additional thoughts (optional)

### 6. THE 7 PILLARS OF REACH (New Framework)
Upgrading from 6 to 7 pillars:
1. Foundation & Discovery (baseline)
2. Killer Content (2-5× engagement)
3. Psychological Drivers (trust + urgency)
4. Community & Belonging (retention)
5. Amplification Tactics (5-20× impressions)
6. Analytics & Iteration (efficiency)
7. **NEW: Realtime Pulse & Network Effects** (10-100×+ — the rocket layer)

## FILES TO REFERENCE
- Current schema: `frontend/prisma/schema.prisma`
- Current poll API: `frontend/app/api/polls/route.ts`
- Current poll UI: `frontend/components/uicustom/chats/poll-display.tsx`
- Reach system: `frontend/app/profile/[userId]/page.tsx` (REACH_PILLARS constant)
- Full specification: `docs/POLL_SYSTEM_UPGRADE_MASTER_QUERY.md`

## VALIDATION REQUIREMENTS
- Zod schemas for all API inputs
- Industrial-grade security (rate limiting, bot detection)
- Proper TypeScript types
- Error handling with meaningful messages

## OUTPUT
Implement all features, run `prisma migrate dev`, and create the first "Reach 6→7" poll using the new system.
