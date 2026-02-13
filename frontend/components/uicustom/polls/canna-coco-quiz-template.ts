/**
 * Canna Coco A+B Mastery Test — Green Crack Punch + AN CalMag Xtra Edition
 *
 * Ultra-detailed QUIZ for CANNA COCO PROFESSIONAL+ with Canna Coco A+B
 * (equal parts, A first) + Advanced Nutrients Sensi Cal-Mag Xtra (2 ml/L,
 * kelp for organic boost / trace minerals) instead of Canna CalMag.
 *
 * Strain: Green Crack Punch (RQS, Green Crack × Purple Punch,
 * 55-60 days flower, forgiving but stretchy 2-3× in early flower).
 *
 * Key rules tested: mixing order, EC/pH runoff, CalMag substitution,
 * strain timing, troubleshooting.
 *
 * 6 SECTIONS with 22 QUESTIONS:
 *
 * Section 1: Mixing & Dosage Basics (4 questions)
 * - Peak ml/10L slider, CalMag dosage slider, A-before-B scale, veg dosage
 *
 * Section 2: pH & EC Mastery (4 questions)
 * - pH targets multi-choice, veg EC single, flower EC slider, runoff EC rule
 *
 * Section 3: Mixing Order & Timelines (4 questions)
 * - Order ranking, flower timeline ranking, pre-soak slider, CalMag frequency
 *
 * Section 4: Knowledge Check (3 questions)
 * - CalMag substitution why, A+B equal rule text, exact dosage text
 *
 * Section 5: Strain + Challenge (4 questions)
 * - GCP flower time, deficiency signs, stretch management, PK boost timing
 *
 * Section 6: Advanced / Troubleshooting (3 questions)
 * - Kelp benefit text, runoff EC trick, final confidence scale
 *
 * Updated: 2026-02-13
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

export const CANNA_COCO_QUIZ_TEMPLATE: {
  title: string;
  description: string;
  type: string;
  allowPartialSubmission: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  questions: TemplateQuestion[];
} = {
  title: "🧪 Canna Coco A+B Mastery Test — Green Crack Punch + AN CalMag Xtra Edition",
  description: `Ultra-detailed test for **CANNA COCO PROFESSIONAL+** with **Canna Coco A+B** (equal parts, A first) **+ Advanced Nutrients Sensi Cal-Mag Xtra** (2 ml/L, kelp for organic boost & trace minerals) instead of Canna CalMag Agent.

Strain: **Green Crack Punch** (RQS, Green Crack × Purple Punch, 55-60 days flower, forgiving but stretchy 2-3× in early flower).

**Key rules tested:** mixing order, EC/pH runoff, CalMag substitution, strain timing, troubleshooting.

📏 **Section 1:** Mixing & Dosage Basics  
✅ **Section 2:** pH & EC Mastery  
🔢 **Section 3:** Mixing Order & Timelines  
✏️ **Section 4:** Knowledge Check  
🎯 **Section 5:** Strain + Challenge  
🔥 **Section 6:** Advanced / Troubleshooting

**22 questions · 6 sections · Your friend will learn everything.**`,
  type: "QUIZ",
  allowPartialSubmission: true,
  showProgressBar: true,
  randomizeQuestions: false,
  questions: [
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: MIXING & DOSAGE BASICS (4 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 1,
      type: "SLIDER",
      questionText: "How many ml of Canna Coco A (and equal B) per 10 L for peak flowering (weeks 4-6)?",
      description: "Standard aggressive schedule for Green Crack Punch in CANNA COCO PROFESSIONAL+ (hand-water or DTW, 10-20% runoff).",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 20,
        max: 50,
        step: 5,
        minLabel: "20 ml",
        maxLabel: "50 ml",
        stepLabels: ["20", "25", "30", "35", "40", "45", "50"],
      },
    },
    {
      order: 2,
      type: "SLIDER",
      questionText: "Standard preventive AN Sensi Cal-Mag Xtra dosage (ml per Liter) with Canna A+B in coco?",
      description: "Regular program (RO or soft tap water), not deficiency correction.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 4,
        step: 1,
        minLabel: "1 ml/L",
        maxLabel: "4 ml/L",
        stepLabels: ["1", "2", "3", "4"],
      },
    },
    {
      order: 3,
      type: "SCALE",
      questionText: "Rate the importance of ALWAYS adding Canna A BEFORE B (1 = optional, 10 = critical)",
      description: "This tests both instruction-following and your understanding of the chemistry.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        minLabel: "Optional",
        maxLabel: "Critical",
        stepLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
    },
    {
      order: 4,
      type: "SLIDER",
      questionText: "Canna Coco A+B dosage (ml each per 10 L) for early veg — weeks 1-2 seedling/clone?",
      description: "Light feed for young plants that just rooted into CANNA COCO PROFESSIONAL+.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 5,
        max: 30,
        step: 5,
        minLabel: "5 ml",
        maxLabel: "30 ml",
        stepLabels: ["5", "10", "15", "20", "25", "30"],
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: pH & EC MASTERY (4 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 5,
      type: "MULTI_CHOICE",
      questionText: "Select ALL true statements about pH in CANNA COCO PROFESSIONAL+ (A+B + AN CalMag)",
      description: "Runoff monitoring is key in coco — select every correct statement.",
      required: true,
      allowImages: false,
      options: [
        { text: "🎯 Target input pH: 5.8–6.1" },
        { text: "📊 Runoff pH should stay 6.0–6.3 (no big drop)" },
        { text: "⚠️ pH 5.5 or lower = lockout risk" },
        { text: "❌ Always use 5.5 in veg / 6.2 in flower (fixed)" },
      ],
    },
    {
      order: 6,
      type: "SINGLE_CHOICE",
      questionText: "Target total EC (tap 0.4–0.6) for veg weeks 2-3 on Green Crack Punch?",
      description: "Aggressive but safe for a vigorous sativa-dominant hybrid.",
      required: true,
      allowImages: false,
      options: [
        { text: "1.2–1.5 EC (light feed)" },
        { text: "1.6–1.9 EC (standard veg)" },
        { text: "2.0+ EC (heavy)" },
      ],
    },
    {
      order: 7,
      type: "SLIDER",
      questionText: "Target total EC for peak flower (weeks 4-6) with 40 ml A+B + CalMag?",
      description: "Tap water 0.4–0.6 + nutrients. Green Crack Punch dense-bud zone.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 10,
        max: 30,
        step: 1,
        minLabel: "1.0",
        maxLabel: "3.0",
        stepLabels: ["1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "3.0"],
      },
    },
    {
      order: 8,
      type: "SINGLE_CHOICE",
      questionText: "Healthy coco runoff EC should be _____ compared to input EC",
      description: "Fundamental coco drainage rule — monitors salt buildup.",
      required: true,
      allowImages: false,
      options: [
        { text: "📊 Similar or slightly lower than input" },
        { text: "📈 Much higher (2×+ input = normal)" },
        { text: "📉 Zero EC (pure water runoff)" },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: MIXING ORDER & TIMELINES (4 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 9,
      type: "RANKING",
      questionText: "Rank the EXACT order of addition (1st → last, water already in tank)",
      description: "CalMag Xtra, Canna A, Canna B, enzymes/boosters. Order matters for chemistry!",
      required: true,
      allowImages: false,
      options: [
        { text: "🧪 AN Sensi Cal-Mag Xtra" },
        { text: "🅰️ Canna Coco A" },
        { text: "🅱️ Canna Coco B" },
        { text: "⚡ Cannazym / Cannaboost" },
      ],
    },
    {
      order: 10,
      type: "RANKING",
      questionText: "Green Crack Punch flower timeline — put in chronological order (earliest → latest)",
      description: "55-60 day flowering. Put the stages in the right sequence.",
      required: true,
      allowImages: false,
      options: [
        { text: "🌱 Stretch + first pistils (week 1-2)" },
        { text: "🌸 Bud formation + PK ramp-up (week 3-4)" },
        { text: "💎 Bud swell + trichome production (week 5-6)" },
        { text: "🍂 Ripening + flush (week 7-8)" },
      ],
    },
    {
      order: 11,
      type: "SLIDER",
      questionText: "Recommended pre-soak amount: ml each of A+B per 10 L for new CANNA COCO PROFESSIONAL+?",
      description: "Before transplanting. Together with ~40 ml/10 L Rhizotonic for root stimulation.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 15,
        max: 40,
        step: 5,
        minLabel: "15 ml",
        maxLabel: "40 ml",
        stepLabels: ["15", "20", "25", "30", "35", "40"],
      },
    },
    {
      order: 12,
      type: "SINGLE_CHOICE",
      questionText: "How often should you add AN CalMag Xtra to your feed in coco?",
      description: "Regular preventive schedule, not deficiency correction.",
      required: true,
      allowImages: false,
      options: [
        { text: "📅 Every watering (each feed)" },
        { text: "📅 Once per week" },
        { text: "📅 Only when you see deficiency signs" },
        { text: "📅 Just the first 2 weeks then stop" },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: KNOWLEDGE CHECK (3 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 13,
      type: "SINGLE_CHOICE",
      questionText: "Why prefer AN Sensi Cal-Mag Xtra (with kelp) over Canna CalMag Agent?",
      description: "User experience + real horticultural benefit. Think about what kelp actually provides.",
      required: true,
      allowImages: false,
      options: [
        { text: "🌿 Kelp adds natural auxins, vitamins, amino acids + better chelated trace minerals (less 'synthetic harsh')" },
        { text: "💰 Just cheaper per liter" },
        { text: "🧪 Higher Ca ppm per ml" },
      ],
    },
    {
      order: 14,
      type: "TEXT",
      questionText: "Type the golden rule for mixing A and B (short phrase)",
      description: "Case-insensitive, punctuation flexible. What's the #1 rule everyone should know?",
      required: true,
      allowImages: false,
      options: [],
    },
    {
      order: 15,
      type: "TEXT",
      questionText: "Exact AN Sensi Cal-Mag Xtra regular dosage — just the number in ml/L",
      description: "One number. Standard preventive dosage per liter.",
      required: true,
      allowImages: false,
      options: [],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: STRAIN + CHALLENGE (4 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 16,
      type: "SINGLE_CHOICE",
      questionText: "Green Crack Punch flowering time indoors?",
      description: "RQS breeder data. How long from flip to chop?",
      required: true,
      allowImages: false,
      options: [
        { text: "⚡ 55–60 days (fast finisher)" },
        { text: "🕐 70+ days (long flower)" },
        { text: "🏃 49 days or less (autoflower fast)" },
      ],
    },
    {
      order: 17,
      type: "MULTI_CHOICE",
      questionText: "Select ALL signs that you need MORE AN CalMag Xtra in coco",
      description: "Multiple deficiency patterns can appear simultaneously. Select every correct sign.",
      required: true,
      allowImages: false,
      options: [
        { text: "🍂 Lower leaf interveinal yellowing (Mg deficiency)" },
        { text: "🟤 Spotty necrotic (brown dead) spots on older leaves (Ca deficiency)" },
        { text: "💜 Purple stems + sluggish growth unresponsive to pH fix" },
        { text: "🔥 Leaf tips burning upward (N toxicity — NOT CalMag)" },
      ],
    },
    {
      order: 18,
      type: "SINGLE_CHOICE",
      questionText: "Green Crack Punch stretches 2-3× in early flower. Best management strategy?",
      description: "She's vigorous and sativa-leaning. What do experienced growers do?",
      required: true,
      allowImages: false,
      options: [
        { text: "✂️ Top + LST in late veg, flip early (before she fills the tent)" },
        { text: "🚫 Never top sativas — just let her grow" },
        { text: "💡 Switch to 10/14 light to stunt stretch" },
      ],
    },
    {
      order: 19,
      type: "SINGLE_CHOICE",
      questionText: "When should you start adding PK boost (Cannaboost / PK 13/14) for this strain?",
      description: "GCP has a 55-60 day flower cycle — timing PK is critical.",
      required: true,
      allowImages: false,
      options: [
        { text: "🌸 Week 3-4 of flower (after stretch, bud sites forming)" },
        { text: "🌱 From day 1 of flip" },
        { text: "🍂 Last 2 weeks only" },
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: ADVANCED / TROUBLESHOOTING (3 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 20,
      type: "TEXT",
      questionText: "Why does kelp in AN CalMag Xtra help vs plain mineral CalMag? (one main reason)",
      description: "Short answer — think about what kelp provides that calcium nitrate alone doesn't.",
      required: true,
      allowImages: false,
      options: [],
    },
    {
      order: 21,
      type: "SINGLE_CHOICE",
      questionText: "🎭 TRICK: Your runoff EC is 3.2 but input was 1.8. What does this mean?",
      description: "Real-world coco troubleshooting scenario.",
      required: true,
      allowImages: false,
      trickQuestion: true,
      options: [
        { text: "🧂 Salt buildup — flush with half-strength nutes + CalMag until runoff drops" },
        { text: "✅ Totally normal in coco — ignore it" },
        { text: "💧 Add more water volume to fix it" },
      ],
    },
    {
      order: 22,
      type: "SCALE",
      questionText: "How confident are you now about running Canna Coco A+B + AN CalMag Xtra on Green Crack Punch?",
      description: "Be honest — this is for you to gauge how much you learned! Every answer is valid here.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        minLabel: "Still learning",
        maxLabel: "Master grower",
        stepLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
    },
  ],
};

/**
 * Generates the Canna Coco quiz template with fresh IDs, correct answers,
 * explanations, and proper section mapping.
 */
export function generateCannaCocoQuizTemplate(): PollBuilderData {
  const template = CANNA_COCO_QUIZ_TEMPLATE;

  // 6 section IDs
  const section1Id = generateId();
  const section2Id = generateId();
  const section3Id = generateId();
  const section4Id = generateId();
  const section5Id = generateId();
  const section6Id = generateId();

  const sections: PollSection[] = [
    {
      id: section1Id,
      title: "📏 Mixing & Dosage Basics",
      description: "Sliders + scales — exact ml/10L and order",
      isCollapsed: false,
      icon: "📏",
      flow: [],
    },
    {
      id: section2Id,
      title: "✅ pH & EC Mastery",
      description: "pH targets, EC goals, runoff monitoring",
      isCollapsed: false,
      icon: "✅",
      flow: [],
    },
    {
      id: section3Id,
      title: "🔢 Mixing Order & Timelines",
      description: "Order of addition + flower stages + scheduling",
      isCollapsed: false,
      icon: "🔢",
      flow: [],
    },
    {
      id: section4Id,
      title: "✏️ Knowledge Check",
      description: "Precise phrases, numbers, and reasoning",
      isCollapsed: false,
      icon: "✏️",
      flow: [],
    },
    {
      id: section5Id,
      title: "🎯 Strain + Challenge",
      description: "Green Crack Punch specifics & grow management",
      isCollapsed: false,
      icon: "🎯",
      flow: [],
    },
    {
      id: section6Id,
      title: "🔥 Advanced / Troubleshooting",
      description: "Deep why + real-world scenarios",
      isCollapsed: false,
      icon: "🔥",
      flow: [],
    },
  ];

  const getSectionId = (i: number) => {
    if (i < 4) return section1Id;   // 0-3:  Mixing & Dosage
    if (i < 8) return section2Id;   // 4-7:  pH & EC
    if (i < 12) return section3Id;  // 8-11: Mixing Order & Timelines
    if (i < 15) return section4Id;  // 12-14: Knowledge Check
    if (i < 19) return section5Id;  // 15-18: Strain + Challenge
    return section6Id;              // 19-21: Advanced / Troubleshooting
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
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: MIXING & DOSAGE BASICS (Q0–Q3)
    // ═══════════════════════════════════════════════════════════════════════

    // Q0: Peak flowering ml/10L → 40
    if (i === 0 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "40" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "40";
      question.explanation = "✅ 40 ml A + 40 ml B per 10 L (4 ml/L each). This hits ~1.8–2.2 EC total (tap 0.4–0.6 + nutes) — the sweet spot for dense, resinous buds.";
      question.wrongExplanation = "Too low = underdeveloped buds lacking density. Too high = salt burn, especially on the stretchy sativa side of Green Crack Punch. The Canna feeding chart peaks at 30-40 ml/10L flower.";
      question.deepExplanation = "Canna's official chart peaks at 30–40 ml/10L in mid-flower. 40 ml is the common sweet spot for dense resinous buds on strains like GCP.\n\n**Always match A = B exactly.** A contains calcium nitrate, B contains phosphates/potassium. Unequal ratios create nutrient imbalances that mimic deficiency even when EC is correct.\n\n🔬 At 40 ml each: ~1.8–2.2 EC total provides the maximum nutrient density GCP can handle without tip burn.";
    }

    // Q1: CalMag dosage ml/L → 2
    if (i === 1 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "2" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "2";
      question.explanation = "✅ 2 ml/L — add FIRST before A+B. This is the standard preventive dosage.";
      question.wrongExplanation = "1 ml/L is insufficient for coco's Ca/Mg buffering demand. 3-4 ml/L is deficiency correction, not regular feed. 2 ml/L is the AN label recommendation + coco community consensus.";
      question.deepExplanation = "AN Sensi Cal-Mag Xtra at 2 ml/L provides:\n\n• ~80–100 ppm Ca\n• ~40–50 ppm Mg\n• Kelp extract (vitamins, auxins, cytokinins)\n• Chelated Mn, Zn, Fe\n\nMany 2024–2026 grow diaries report Canna CalMag Agent feels 'hot' or causes tip burn / lockout in sensitive sativas. Xtra's kelp extract smooths uptake and supports root exudates + microbial health.\n\nRepeat weekly or until runoff EC stabilizes.";
    }

    // Q2: A before B importance → 10 (critical)
    if (i === 2 && q.type === "SCALE" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "10" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "10";
      question.explanation = "🔴 Critical (10/10). A contains calcium nitrate; B contains phosphates/potassium. Concentrated A+B mixed together = insoluble calcium phosphate precipitate → permanent nutrient loss.";
      question.wrongExplanation = "This is NOT optional. Mixing A+B concentrated together causes an irreversible chemical reaction. The calcium-phosphate precipitate (white sludge) cannot be redissolved — those nutrients are gone forever.";
      question.deepExplanation = "**The chemistry:**\n\nCa²⁺ (from A) + PO₄³⁻ (from B) → Ca₃(PO₄)₂ ↓ (insoluble precipitate)\n\nThis is why ALL two-part nutrient systems require sequential addition with dilution between.\n\n**Real-world example:** Growers who 'dump both parts in at once' see white sludge floating in their reservoir + develop Ca/Mg deficiencies within days despite 'feeding correctly.' The calcium literally fell out of solution.\n\nAlways: Water → CalMag → stir → A → stir 1-2 min → B → stir → pH adjust → boosters.";
    }

    // Q3: Early veg ml/10L → 15
    if (i === 3 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "15" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "15";
      question.explanation = "✅ 15 ml A + 15 ml B per 10 L (1.5 ml/L each). Light feed for seedlings/clones — about 0.8–1.2 EC total.";
      question.wrongExplanation = "5-10 ml is too light for even well-rooted seedlings in coco (which drains fast and holds very little inherent nutrients). 20-30 ml is veg weeks 2-4 territory. New transplants need ~15 ml each to establish.";
      question.deepExplanation = "Canna's early veg schedule:\n\n• Week 1 (fresh transplant): 10-15 ml A+B /10L (~0.8-1.0 EC)\n• Week 2: 15-20 ml A+B /10L (~1.0-1.4 EC)\n• Week 3: 20-30 ml A+B /10L (~1.4-1.8 EC)\n• Week 4+: 25-35 ml A+B /10L (~1.6-1.9 EC)\n\nCoco has ZERO inherent nutrients (unlike soil). The cation exchange sites are pre-loaded with Na/K that the plant can't use. CalMag buffers these sites with Ca/Mg the plant actually needs.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: pH & EC MASTERY (Q4–Q7)
    // ═══════════════════════════════════════════════════════════════════════

    // Q4: pH truths multi-choice → first 3 are correct
    if (i === 4 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[2]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[2].id];
      question.explanation = "✅ Input 5.8–6.1, runoff 6.0–6.3 stable = healthy. pH 5.5 or below = lockout danger zone. The 'fixed 5.5 veg / 6.2 flower' rule is a soil myth — coco needs 5.8–6.1 throughout.";
      question.wrongExplanation = "Option 4 is FALSE. The '5.5 veg / 6.2 flower' split is a soil guideline, NOT for coco. In coco, 5.8–6.1 is the sweet spot for the entire lifecycle because the cation exchange dynamics are different from soil.";
      question.deepExplanation = "**Why coco pH is different from soil:**\n\nCoco's cation exchange capacity (CEC) holds Ca²⁺/Mg²⁺ → natural pH drift upward if underfed. A big runoff pH drop (<5.8) signals:\n\n• Over-acidification (too much pH down)\n• K excess displacing Ca/Mg from exchange sites\n• Salt accumulation lowering buffer capacity\n\n**Monitoring runoff pH is more valuable than obsessing over input pH.** If runoff stays 6.0–6.3 = root zone is healthy. If it drops below 5.8 = investigate salt buildup or adjust input upward.";
    }

    // Q5: Veg EC for GCP → 1.6–1.9 (second option)
    if (i === 5 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.explanation = "✅ 1.6–1.9 EC (25-30 ml A+B /10L). GCP is a vigorous sativa hybrid that can handle standard veg feeding.";
      question.wrongExplanation = "1.2–1.5 = too light for a vigorous sativa like GCP → stretchy weak stems from insufficient nitrogen. 2.0+ is flower territory and burns sensitive veg-stage leaf tips.";
      question.deepExplanation = "Green Crack Punch EC schedule:\n\n🌱 Seedling: 0.8–1.2 EC\n🌿 Veg week 2-3: 1.6–1.9 EC ← sweet spot\n🌿 Late veg: 1.8–2.0 EC\n🌸 Early flower: 1.6–1.8 EC (stretch period)\n💎 Peak flower: 1.8–2.2 EC\n🍂 Late flower: 1.4–1.6 EC\n💧 Flush: 0.2–0.4 EC (plain water + enzymes)\n\nGCP is vigorous — lower feeding = stretchy weak internodes from the Green Crack sativa genetics.";
    }

    // Q6: Peak flower EC → 20 (representing 2.0 on the 1.0-3.0 slider)
    if (i === 6 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "20" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "20";
      question.explanation = "✅ ~2.0 EC total (1.8–2.2 range). At 40 ml A+B /10L + 2 ml/L CalMag + tap water 0.4–0.6, total lands around 2.0 EC.";
      question.wrongExplanation = "Below 1.6 = buds lack density in peak flower. Above 2.4 = salt burn risk, especially on GCP's sativa side. The 1.8–2.2 window is optimal for maximum yield without toxicity.";
      question.deepExplanation = "EC breakdown at peak flower:\n\n• Tap water base: 0.4–0.6 EC\n• AN CalMag Xtra (2 ml/L): +0.2–0.3 EC\n• Canna A+B (40 ml each /10L): +1.2–1.4 EC\n• **Total: ~1.8–2.2 EC** ✅\n\nAlways measure AFTER mixing everything + pH adjusting. EC pen reads total dissolved salts, not individual nutrients — so you need runoff monitoring to confirm the plant is actually absorbing at this rate.";
    }

    // Q7: Runoff EC rule → similar/slightly lower (first option)
    if (i === 7 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.explanation = "✅ Similar or slightly lower = clean root zone, nutrients being absorbed. This is the #1 monitoring rule in coco.";
      question.wrongExplanation = "'Much higher' = salt accumulation (danger!). 'Zero' is impossible unless you're flushing with RO water. Healthy coco runoff EC should mirror or be slightly below your input EC.";
      question.trickQuestion = true;
      question.deepExplanation = "**The runoff EC rule in detail:**\n\n• Runoff ≈ Input EC → ✅ Plant eating well, no buildup\n• Runoff < Input EC → ✅ Plant actually consuming more than you're feeding (hungry, increase slightly)\n• Runoff > Input EC by 0.3+ → ⚠️ Salt accumulation beginning\n• Runoff > Input EC by 0.5+ → 🚨 Flush needed! (half-strength nutes + CalMag, 20-30% runoff)\n\nGCP hates high-salt root zones → causes foxtailing (loose airy buds), lack of density, and crispy leaf edges. Monitor runoff EC weekly minimum.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: MIXING ORDER & TIMELINES (Q8–Q11)
    // ═══════════════════════════════════════════════════════════════════════

    // Q8: Mixing order ranking → CalMag, A, B, Enzymes/Boost
    if (i === 8 && q.type === "RANKING") {
      question.correctAnswer = opts.map((o) => o.id);
      question.explanation = "✅ Perfect order: CalMag first (buffers Ca/Mg) → A (calcium nitrate dissolves) → stir → B (phosphate/potassium) → stir → enzymes/boosters last.";
      question.wrongExplanation = "CalMag MUST go first to buffer cation exchange sites before phosphates in B can bind free calcium. A before B prevents calcium-phosphate precipitation. Boosters last because they're pH-sensitive.";
      question.deepExplanation = "**Why this exact order:**\n\n1️⃣ **CalMag first** — Pre-loads the solution with Ca²⁺/Mg²⁺ so they're available before phosphates enter. Kelp in Xtra also stabilizes pH for subsequent additions.\n\n2️⃣ **A second** — Calcium nitrate needs to dissolve fully (stir 1-2 min). Ca²⁺ ions are now buffered by available Mg²⁺ from CalMag.\n\n3️⃣ **B third** — Phosphates and potassium. By now Ca²⁺ is dilute enough to avoid precipitation. Stir again.\n\n4️⃣ **Boosters last** — Enzymes (Cannazym) and bloom boosters (Cannaboost) are pH/EC sensitive and work best in a stabilized solution.\n\n⏱️ Always stir between additions. Total mixing time: 5-8 minutes.";
    }

    // Q9: Flower timeline → correct chronological order (already in order)
    if (i === 9 && q.type === "RANKING") {
      question.correctAnswer = opts.map((o) => o.id);
      question.explanation = "✅ Correct timeline: Stretch (wk 1-2) → Bud formation (wk 3-4) → Bud swell (wk 5-6) → Ripening/flush (wk 7-8). GCP finishes in 55-60 days.";
      question.wrongExplanation = "Green Crack Punch flower stages follow a strict chronological order. The stretch ALWAYS comes first (weeks 1-2), followed by bud formation, then swell, then ripening.";
      question.deepExplanation = "**Green Crack Punch flower timeline detail:**\n\n📅 **Week 1-2:** Stretch phase. GCP stretches HARD (2-3× height). Mostly vertical growth + first white pistils appearing at nodes. Keep feeding veg-level nutes → transition mix.\n\n📅 **Week 3-4:** Bud formation. Stretch slows/stops. Small calyxes stacking. Start PK boost (Cannaboost). EC ramp to peak.\n\n📅 **Week 5-6:** Bud swell. This is where GCP puts on major weight. Dense, frosty buds. Peak EC (40 ml A+B). Trichomes milky.\n\n📅 **Week 7-8:** Ripening + flush. Reduce nutes, flush last 7-10 days. Trichomes turning amber. Fan leaves yellow naturally.\n\n💡 **Pro tip:** Top in late veg, NOT during stretch! GCP responds well to HST if done before flip.";
    }

    // Q10: Pre-soak ml → 25
    if (i === 10 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "25" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "25";
      question.explanation = "✅ 25 ml each (A+B) per 10 L + ~40 ml Rhizotonic = proper pre-soak charge for CANNA COCO PROFESSIONAL+.";
      question.wrongExplanation = "15 ml is too weak — won't properly buffer the coco cation exchange sites. 30-40 ml is feed-strength, not pre-soak. 25 ml charges the medium without oversaturating.";
      question.deepExplanation = "**Why pre-soaking matters:**\n\nFresh CANNA COCO PROFESSIONAL+ has cation exchange sites loaded with Na⁺/K⁺ from the coir processing. Pre-soaking with 25 ml A+B /10L:\n\n• Displaces Na⁺/K⁺ with Ca²⁺/Mg²⁺\n• Buffers pH to 5.8-6.0\n• Creates a nutrient-available starting environment\n\nAdd 40 ml Rhizotonic per 10L for root-growth stimulation (contains oligosaccharides and vitamins).\n\n**Pre-soak method:** Soak for 12-24 hours, let drain, transplant. Skip this step = CalMag deficiency in week 1 guaranteed.";
    }

    // Q11: CalMag frequency → every watering (first option)
    if (i === 11 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.explanation = "✅ Every watering. Coco's cation exchange continuously strips Ca/Mg from solution — it's not a one-time charge, it's an ongoing demand.";
      question.wrongExplanation = "Once per week = Ca/Mg drops between feeds → interveinal yellowing. Deficiency-only = you're always behind. First 2 weeks only = the cations keep exchanging throughout the entire grow cycle.";
      question.deepExplanation = "**The science behind 'every feed':**\n\nCoco coir is a unique medium — its cation exchange capacity (CEC) preferentially binds Ca²⁺ and Mg²⁺. Every time you water:\n\n1. Fresh nutrient solution flows through\n2. Coco grabs Ca²⁺/Mg²⁺ from solution → locks them onto exchange sites\n3. Releases Na⁺/K⁺ back into solution\n\nThis exchange NEVER stops. It slows down after 3-4 weeks as sites saturate, but never reaches zero. That's why coco ALWAYS needs supplemental CalMag.\n\n**AN Xtra advantage:** The kelp extract helps roots actively transport Ca²⁺ faster than pure mineral CalMag — reducing the 'lag' between feeding and availability.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: KNOWLEDGE CHECK (Q12–Q14)
    // ═══════════════════════════════════════════════════════════════════════

    // Q12: Why AN CalMag Xtra → kelp + chelation (first option)
    if (i === 12 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.explanation = "✅ Kelp provides natural plant growth regulators (auxins, cytokinins), amino acids, vitamins, and superior chelated trace minerals (Fe, Mn, Zn). Less 'synthetic harsh' than pure calcium nitrate CalMag products.";
      question.wrongExplanation = "It's NOT cheaper (it's actually slightly more expensive). Ca ppm per ml is similar. The real advantage is the KELP component — organic buffering + natural hormones + better chelation that many diaries report reduces the 'hot' tip burn common with Canna CalMag Agent.";
      question.deepExplanation = "**AN Sensi Cal-Mag Xtra vs Canna CalMag Agent:**\n\n| Feature | AN Xtra | Canna Agent |\n|---|---|---|\n| Kelp extract | ✅ Yes | ❌ No |\n| Auxins/cytokinins | ✅ Natural | ❌ None |\n| Chelation type | EDTA + organic | EDTA only |\n| N source | Mixed amino+nitrate | High nitrate |\n| Tip burn reports | Low | Common |\n| Microbial support | ✅ Promotes | Neutral |\n\nMany 2024-2026 diaries (especially sativa-heavy strains like GCP) report switching from Canna CalMag to AN Xtra resolved persistent tip burn and improved terpene expression.";
    }

    // Q13: A+B mixing rule → "always add A then B" (or similar)
    if (i === 13 && q.type === "TEXT") {
      question.correctAnswer = "always add A then B";
      question.explanation = "✅ 'Always add A then B' (or 'A before B'). This prevents calcium-phosphate precipitation — the #1 mistake new growers make with two-part nutrients.";
      question.wrongExplanation = "The rule is: A first, B second. Never simultaneously, never reversed. Calcium nitrate (A) + phosphates (B) in concentrated form = insoluble precipitate.";
      question.deepExplanation = "**Acceptable answers include:** 'A before B', 'always A first then B', 'add A then B', 'A first B second'\n\n**Why this matters:** The precipitation reaction Ca²⁺ + PO₄³⁻ → Ca₃(PO₄)₂ ↓ is irreversible. Once calcium phosphate forms, those nutrients are permanently locked up as sediment. No amount of stirring or pH adjustment will fix it.\n\n**Visual check:** If your res looks milky/cloudy after mixing → you mixed wrong. Proper solution should be clear amber/gold.";
    }

    // Q14: CalMag dosage → 2
    if (i === 14 && q.type === "TEXT") {
      question.correctAnswer = "2";
      question.explanation = "✅ 2 ml/L. The standard preventive dosage per the AN label and coco community consensus.";
      question.wrongExplanation = "The number is 2. Not 1 (too low for coco), not 3-4 (that's deficiency correction dose). Standard preventive = 2 ml per liter.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: STRAIN + CHALLENGE (Q15–Q18)
    // ═══════════════════════════════════════════════════════════════════════

    // Q15: GCP flower time → 55-60 days (first option)
    if (i === 15 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.explanation = "✅ 55–60 days (very fast finisher for a sativa hybrid). This compressed timeline means you need to ramp PK at week 3-4, not week 6 like longer-flowering strains.";
      question.wrongExplanation = "70+ days is for long sativas (Haze, Thai). 49 days is autoflower speed. GCP finishes in 55-60 days per RQS breeder data, making it one of the fastest photoperiod sativa hybrids available.";
      question.deepExplanation = "**Green Crack Punch genetics:**\n\n🧬 Green Crack (sativa, energetic, fast) × Purple Punch (indica, dense, fruity)\n\n📅 Flower: 55-60 days (inherits speed from both parents)\n📏 Stretch: 2-3× (sativa influence)\n💎 Yield: 450-550g/m² indoor\n🔬 THC: 18-22%\n🍋 Terpenes: Limonene, Caryophyllene, Myrcene\n\n**Growing implications of fast flower:**\n• Start PK week 3-4 (not 5-6 like 70-day strains)\n• Flush starts week 7 (only 7-10 days)\n• Don't over-defoliate — she needs every leaf for the compressed timeline.";
    }

    // Q16: CalMag deficiency signs → first 3 correct, last one is NOT CalMag
    if (i === 16 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[2]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[2].id];
      question.explanation = "✅ Interveinal yellowing (Mg), necrotic spots (Ca), and purple stems (trace mineral issues) are all CalMag-related. Burning leaf tips upward is N toxicity — that's from too much base nutrients, NOT CalMag deficiency!";
      question.wrongExplanation = "Leaf tips burning upward (clawing) is nitrogen toxicity — the opposite problem! CalMag deficiency shows as interveinal yellowing (Mg), brown dead spots (Ca), and purple stems (trace mineral chelation issues).";
      question.deepExplanation = "**CalMag deficiency ID guide for coco:**\n\n🟡 **Magnesium (Mg) deficiency:**\n• Interveinal chlorosis on LOWER/OLDER leaves first\n• Veins stay green, leaf tissue yellows between veins\n• Progresses upward if uncorrected\n\n🟤 **Calcium (Ca) deficiency:**\n• Brown/rust necrotic spots on OLDER leaves\n• New growth may be distorted/curled\n• Stems may feel hollow/weak\n\n💜 **Trace mineral issues:**\n• Purple stems (Mg/Fe transport issues)\n• Sluggish growth that doesn't respond to pH fixes\n• GCP is ESPECIALLY prone to purple stems when Ca/Mg deficient due to its anthocyanin genetics from Purple Punch\n\n🔥 **NOT CalMag:** Tip burn upward = N toxicity. Dark green clawed leaves = too much nitrogen from base nutes. Reduce A+B, not CalMag.";
    }

    // Q17: Stretch management → Top + LST, flip early (first option)
    if (i === 17 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.explanation = "✅ Top in late veg + LST + flip early. GCP's 2-3× stretch means you need to control height BEFORE the flip. If she's 40cm at flip, she'll be 80-120cm by week 2 of flower!";
      question.wrongExplanation = "'Never top sativas' is outdated advice — GCP handles topping well (RQS confirms). 10/14 light schedule reduces yield significantly and isn't necessary. The answer is training + early flip.";
      question.deepExplanation = "**Managing GCP stretch:**\n\n✂️ **Top at node 4-5** during veg → creates 2 dominant colas. She recovers in 3-5 days.\n\n🌿 **LST (Low Stress Training):** Bend branches outward from week 3-4 veg. GCP's flexible sativa stems handle this well.\n\n⏱️ **Flip early:** If your tent is 180cm (6ft), flip when she's 30-40cm. She'll stretch to 60-120cm — perfect canopy height.\n\n🔬 **Supercropping (HST):** Works during early stretch (flower week 1-2) if she gets too tall. Pinch + bend the tallest branch 90° — GCP heals the knuckle in 3-4 days and that branch becomes the densest cola.\n\n❌ **Don't defoliate during stretch** — she needs leaf mass for the energy to stretch. Lollipop later at week 3 when stretch stops.";
    }

    // Q18: PK boost timing → week 3-4 (first option)
    if (i === 18 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.explanation = "✅ Week 3-4 of flower, after stretch ends and bud sites are forming. On GCP's compressed 55-60 day cycle, this is the critical PK window.";
      question.wrongExplanation = "Day 1 of flip = still stretching, P/K gets wasted and can lock out N. Last 2 weeks = too late, buds are already ripening. Week 3-4 = sweet spot where calyxes are stacking and the plant demands phosphorus + potassium.";
      question.deepExplanation = "**PK boost schedule for GCP (55-60 day flower):**\n\n📅 **Week 1-2:** NO PK boost. Plant is stretching + needs nitrogen. Transition feed.\n📅 **Week 3:** Start Cannaboost at 1-2 ml/L. Bud sites visible.\n📅 **Week 4-5:** Peak PK. Cannaboost 2-4 ml/L. Can add PK 13/14 at 0.5-1 ml/L during week 5 for extra swell.\n📅 **Week 6:** Reduce PK. Buds swelling, trichomes milky.\n📅 **Week 7-8:** Stop all PK. Flush with enzymes (Cannazym 2 ml/L) + plain water.\n\n⚠️ **Common mistake:** Running PK 13/14 too early or too long → locks out Ca/Mg → brown spots appear during the most critical bud-building phase. Always monitor runoff EC when adding PK boosters.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: ADVANCED / TROUBLESHOOTING (Q19–Q21)
    // ═══════════════════════════════════════════════════════════════════════

    // Q19: Kelp benefit → natural hormones + trace minerals + root boost
    if (i === 19 && q.type === "TEXT") {
      question.correctAnswer = "natural hormones trace minerals root boost";
      question.explanation = "✅ Kelp = natural auxins/cytokinins + chelated trace minerals + root stimulation. This is what separates AN Xtra from basic mineral CalMag products.";
      question.wrongExplanation = "The main benefit of kelp isn't 'more calcium' — it's the ORGANIC compounds: natural plant hormones (auxins, cytokinins), amino acids, vitamins, and naturally chelated trace minerals that boost root health and nutrient uptake.";
      question.deepExplanation = "**What kelp (Ascophyllum nodosum) provides:**\n\n🌿 **Plant growth regulators:**\n• Auxins → root elongation, cell differentiation\n• Cytokinins → cell division, shoot branching\n• Betaines → osmotic stress resistance\n\n🔬 **Trace minerals (naturally chelated):**\n• Iron (Fe) — chlorophyll production\n• Manganese (Mn) — enzyme activation\n• Zinc (Zn) — auxin synthesis, node spacing\n• Boron (B) — cell wall integrity, Ca transport\n\n🦠 **Microbial support:**\n• Oligosaccharides = food for beneficial microbes\n• Root exudate stimulation → healthier rhizosphere\n\nResult: more efficient nutrient uptake from LESS input → less salt stress → better terpene expression that pure mineral CalMag can't match.";
    }

    // Q20: TRICK — High runoff EC → salt buildup (first option)
    if (i === 20 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.trickQuestion = true;
      question.explanation = "🧂 Salt buildup! Runoff EC 3.2 vs input 1.8 = the root zone is accumulating 1.4 EC of unused salts. Flush immediately with half-strength nutes + CalMag until runoff EC drops to match input.";
      question.wrongExplanation = "'Totally normal' = WRONG. A gap this large (1.4+ EC difference) means salts are concentrated in the root zone, blocking nutrient uptake. 'Add more water' partially helps but doesn't address the nutrient ratio — you need to flush with half-strength solution.";
      question.deepExplanation = "**The flush protocol for salt buildup:**\n\n1️⃣ Mix half-strength feed: 20 ml A+B /10L + 2 ml/L CalMag → ~1.0 EC\n2️⃣ Water with 30-40% runoff (more than usual 10-20%)\n3️⃣ Check runoff EC after flush — aim for < input EC + 0.3\n4️⃣ If still high, repeat next watering\n5️⃣ Add 2 ml/L Cannazym to help break down dead root matter holding salts\n\n**Why half-strength, not plain water?**\nPure water can cause osmotic shock — the plant cells are adjusted to high EC. Sudden zero EC causes roots to over-absorb water → swelling → membrane damage.\n\n**GCP-specific:** This strain HATES salt buildup. The #1 reason for foxtailing and airy buds on GCP is root zone salt accumulation, not genetics.";
    }

    // Q21: Confidence scale — any answer is valid (feel-good closer)
    if (i === 21 && q.type === "SCALE" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig } as unknown as PollQuestion["sliderConfig"];
      question.explanation = "Every answer is valid here! 🎉 Whether you scored 100% or learned something new — you now know more about running Canna Coco A+B + AN CalMag Xtra on Green Crack Punch than most growers. Go grow some fire! 🌱🔥";
      question.wrongExplanation = "There's no wrong answer for this one — it's a self-assessment! The fact that you took this quiz means you care about doing it right.";
      question.deepExplanation = "**Quick reference card for your grow:**\n\n🧪 **CalMag:** AN Sensi Cal-Mag Xtra, 2 ml/L, every feed, add FIRST\n🅰️ **Canna A:** Add second, stir 1-2 min\n🅱️ **Canna B:** Add third, stir, equal to A\n📏 **Peak feed:** 40 ml each /10L (week 4-6 flower)\n📊 **EC:** Veg 1.6-1.9, Flower 1.8-2.2\n📐 **pH:** 5.8-6.1 input, 6.0-6.3 runoff\n✂️ **Stretch:** Top + LST, flip at 30-40cm\n🌸 **PK boost:** Week 3-4 flower\n💧 **Flush:** Last 7-10 days, enzymes only\n⏱️ **Total flower:** 55-60 days\n\nGood luck with your Green Crack Punch grow! 🌿";
    }

    return question;
  });

  // Assign questions to sections
  sections[0].flow = questions.slice(0, 4).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[1].flow = questions.slice(4, 8).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[2].flow = questions.slice(8, 12).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[3].flow = questions.slice(12, 15).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[4].flow = questions.slice(15, 19).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[5].flow = questions.slice(19, 22).map((q) => ({ type: "QUESTION" as const, id: q.id }));

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
      { type: "SECTION" as const, id: section6Id },
    ],
  };
}
