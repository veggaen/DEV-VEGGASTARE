/**
 * Plant-Forward + Eggs Performance Quiz -- Tony Robbins-Style Energy (Evidence-Based)
 *
 * A practical performance quiz for a plant-forward pattern that includes eggs (ovo-vegetarian).
 *
 * Educational focus:
 * - Public-health energy baselines that actually compound
 * - Balanced nutrition truths (B12, iodine, omega-3, eggs & cholesterol)
 * - Foundations-first priorities + Tony-style routines
 * - Triad + Priming + key nutrition anchors
 * - UI & memory retention shape match
 * - Challenge mix of real facts + traps
 *
 * 6 sections, 22 questions
 * Educational only -- not medical advice.
 * Updated: 2026-02-13
 */

import type { PollBuilderData, PollQuestion, PollSection, PollType } from "./PollBuilder";

const generateId = () => Math.random().toString(36).substring(2, 15);

/* -------------------------------------------------------------------------- */
/*  Inline question type -- carries ALL quiz metadata directly                */
/* -------------------------------------------------------------------------- */
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
  correctAnswer?: string | string[] | null;
  explanation?: string | null;
  wrongExplanation?: string | null;
  deepExplanation?: string | null;
}

export const TONY_VEGAN_EGGS_MASTERY_TEMPLATE: {
  title: string;
  description: string;
  type: string;
  allowPartialSubmission: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  questions: TemplateQuestion[];
} = {
  title: "Plant-Forward + Eggs Performance Quiz - Tony Robbins-Style Energy (Evidence-Based)",
  description: `A practical performance quiz for a plant-forward pattern that includes eggs (ovo-vegetarian).

**6 Sections - 22 Questions**

**Section 1: Energy Baselines** - public-health habits that actually move the needle
**Section 2: Nutrition Truths** - B12, iodine, omega-3, eggs & cholesterol (balanced)
**Section 3: Ranking** - foundations-first priorities + Tony-style routines
**Section 4: Recall** - Triad + Priming + key nutrition anchors
**Section 5: Shape Match** - UI + memory retention checks
**Section 6: Challenge** - mix of real facts + one trap

Educational only - not medical advice.`,
  type: "QUIZ",
  allowPartialSubmission: true,
  showProgressBar: true,
  randomizeQuestions: false,
  questions: [
    /* ====================================================================== */
    /*  SECTION 1 - Energy Baselines  (Q1-4)                                  */
    /* ====================================================================== */
    {
      // Q1
      order: 1,
      type: "SLIDER",
      questionText: "Public-health baseline: what is the minimum daily target for fruit + vegetables in many guidelines?",
      description: "This is the classic 5-a-day minimum (approx 400 g total fruit + veg).",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 0, max: 10, step: 1,
        minLabel: "0", maxLabel: "10",
        stepLabels: ["0","1","2","3","4","5","6","7","8","9","10"],
      },
      correctAnswer: "5",
      explanation: "Correct. 5-a-day is the common minimum baseline (often described as ~400 g of fruit + veg per day).",
      wrongExplanation: "This question is checking the common public-health baseline: **5 portions/day**.",
      deepExplanation: "Why this matters: if your baseline is below 5, energy, fiber, and micronutrient intake often drift low. More than 5 can be great - but 5 is the widely used minimum target.",
    },
    {
      // Q2
      order: 2,
      type: "SCALE",
      questionText: "Minimum sleep baseline: how many hours do most adult guidelines say you should get each night (at least)?",
      description: "This is the minimum baseline, not the perfect night.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 4, max: 10, step: 1,
        minLabel: "4", maxLabel: "10",
        stepLabels: ["4","5","6","7","8","9","10"],
      },
      correctAnswer: "7",
      explanation: "Correct. Many adult sleep guidelines use **7 hours** as the minimum baseline.",
      wrongExplanation: "This item is checking the common minimum baseline: **7 hours**.",
      deepExplanation: "Performance framing: sleep is not a luxury - it is the multiplier for training, mood, appetite regulation, and focus.",
    },
    {
      // Q3
      order: 3,
      type: "SINGLE_CHOICE",
      questionText: "Tony-style morning routine: about how long does Priming take in his own descriptions?",
      description: "This checks if the routine feels doable, not mystical.",
      required: true,
      allowImages: false,
      options: [
        { text: "5 minutes", description: "Very short - often too rushed" },
        { text: "10 minutes", description: "The commonly stated Priming length" },
        { text: "45 minutes", description: "Not the typical claim" },
      ],
      correctAnswer: "__OPT_1__",
      explanation: "Correct. Priming is commonly described as a **10-minute** routine (breathwork + gratitude + visualization).",
      wrongExplanation: "The typical stated length for Priming is **10 minutes**.",
      deepExplanation: "The power is consistency. A short daily ritual beats a perfect ritual you never repeat.",
    },
    {
      // Q4
      order: 4,
      type: "MULTI_CHOICE",
      questionText: "Select ALL foundations-first habits most likely to improve energy within 2-4 weeks",
      description: "Pick the ones with the strongest real-world signal for most people.",
      required: true,
      allowImages: false,
      options: [
        { text: "Consistent sleep/wake time (most days)", description: "Stabilizes energy + mood" },
        { text: "Hit the 5-a-day fruit + veg minimum baseline", description: "Fiber + micronutrient floor" },
        { text: "2+ strength sessions per week", description: "Health + resilience baseline" },
        { text: "Use Priming (or similar) daily for state management", description: "Focus + emotion regulation" },
        { text: "Just add supplements and keep everything else the same", description: "The trap" },
      ],
      correctAnswer: "__OPTS_0_1_2_3__",
      explanation: "Correct. Sleep rhythm, food quality baseline, strength work, and state rituals are the compounding stack.",
      wrongExplanation: "The trap is thinking supplements can replace foundations. Foundations usually come first.",
      deepExplanation: "Tony-style framing: **state + strategy** wins. Strategy fails if sleep, fuel, and training are collapsing.",
    },

    /* ====================================================================== */
    /*  SECTION 2 - Nutrition Truths  (Q5-10)                                 */
    /* ====================================================================== */
    {
      // Q5
      order: 5,
      type: "SINGLE_CHOICE",
      questionText: "Most evidence-based first-line B12 strategy for plant-forward diets is:",
      description: "Pick the safest default (simple and reliable).",
      required: true,
      allowImages: false,
      options: [
        { text: "Use fortified foods and/or a reliable B12 supplement", description: "Best default" },
        { text: "Rely only on spirulina", description: "Contains analogue B12 - unreliable as sole source" },
        { text: "No plan needed if you eat eggs", description: "Eggs have some B12, but may not cover full needs alone" },
      ],
      correctAnswer: "__OPT_0__",
      explanation: "Correct. Fortified foods and/or a reliable B12 supplement is the evidence-based first-line strategy.",
      wrongExplanation: "Spirulina contains B12 analogues that may not be bioavailable. Eggs provide some B12 but coverage varies widely by intake.",
      deepExplanation: "B12 deficiency is preventable but common. A simple supplement or fortified-food routine is cheap insurance. Monitor with serum B12 or MMA if in doubt.",
    },
    {
      // Q6
      order: 6,
      type: "MULTI_CHOICE",
      questionText: "Select ALL nutrients that deserve intentional planning on vegan + eggs patterns",
      description: "Be practical - where do people commonly drift low?",
      required: true,
      allowImages: false,
      options: [
        { text: "Vitamin B12", description: "Low in plant foods; eggs help but may not fully cover" },
        { text: "Iodine", description: "Often overlooked unless using iodized salt or seaweed" },
        { text: "Omega-3 DHA/EPA", description: "ALA conversion is limited; algae oil is reliable" },
        { text: "Iron status (especially in high-risk groups)", description: "Non-heme absorption lower; pair with vitamin C" },
      ],
      correctAnswer: "__OPTS_ALL__",
      explanation: "All four deserve intentional planning in many plant-forward patterns.",
      wrongExplanation: "These are common drift points. Even great diets can miss one or more without explicit planning.",
      deepExplanation: "The goal is not fear - it is foresight. Smart planning prevents avoidable fatigue, brain fog, and stalled progress. Periodic blood panels help track real status.",
    },
    {
      // Q7
      order: 7,
      type: "SINGLE_CHOICE",
      questionText: "What nutrient makes two eggs per day especially valuable for many ovo-vegetarians?",
      description: "Think about which nutrient is hard to get enough of on pure plant diets.",
      required: true,
      allowImages: false,
      options: [
        { text: "Choline (~300 mg from 2 eggs, close to half the AI)", description: "Brain + liver function" },
        { text: "Vitamin C", description: "Not significant in eggs" },
        { text: "Dietary fiber", description: "Eggs contain zero fiber" },
      ],
      correctAnswer: "__OPT_0__",
      explanation: "Correct. Two eggs deliver ~300 mg choline - roughly half the adequate intake (AI) for most adults.",
      wrongExplanation: "Eggs are not fiber or vitamin C sources. Their standout nutrient contribution here is **choline**.",
      deepExplanation: "Choline supports cell membranes, neurotransmitter synthesis, and liver function. Pure vegan diets can run low unless soy, quinoa, or cruciferous vegetables are emphasized.",
    },
    {
      // Q8
      order: 8,
      type: "SINGLE_CHOICE",
      questionText: "Best honest statement about dietary cholesterol from eggs in healthy adults:",
      description: "Avoid black-and-white takes - nutrition is rarely absolute.",
      required: true,
      allowImages: false,
      options: [
        { text: "For most healthy adults the impact on blood cholesterol is modest, but individual LDL response varies - so monitor if concerned", description: "Balanced evidence summary" },
        { text: "Egg cholesterol always has zero effect for everyone", description: "Overly absolute - ignores hyper-responders" },
        { text: "One egg per day always causes significant cardiovascular harm", description: "Not supported by current meta-analyses" },
      ],
      correctAnswer: "__OPT_0__",
      explanation: "Balanced and correct. Population studies show modest average impact, but ~25% of people are cholesterol hyper-responders.",
      wrongExplanation: "Absolute claims on either side are misleading. The honest answer acknowledges individual variability.",
      deepExplanation: "Use biomarkers, context, and personal response. If LDL rises meaningfully, adapt intake pattern rather than debating ideology. Labs > opinions.",
    },
    {
      // Q9
      order: 9,
      type: "SINGLE_CHOICE",
      questionText: "If your ferritin is persistently low despite good plant-based iron intake, the best next step is:",
      description: "Use a responsible, evidence-first process.",
      required: true,
      allowImages: false,
      options: [
        { text: "Work with a clinician - get labs, rule out absorption issues, then personalize strategy", description: "Evidence-first approach" },
        { text: "Ignore labs and continue as usual", description: "Risky: symptoms may worsen" },
        { text: "Mega-dose iron supplements without supervision", description: "Can cause GI distress and iron overload" },
      ],
      correctAnswer: "__OPT_0__",
      explanation: "Correct. Persistent low ferritin requires structured follow-up with clinician-guided interpretation.",
      wrongExplanation: "Guessing with megadoses or ignoring low labs can prolong symptoms and create new problems.",
      deepExplanation: "Performance nutrition is measurement-driven. Labs + symptoms + dietary context gives the best decisions. Non-heme iron tips: pair with vitamin C, avoid coffee/tea at meals.",
    },
    {
      // Q10
      order: 10,
      type: "SLIDER",
      questionText: "Set the realistic weekly strength-training sessions target for metabolic health (public-health minimum)",
      description: "Major guidelines recommend at least 2 sessions/week of muscle-strengthening activity.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 0, max: 7, step: 1,
        minLabel: "0", maxLabel: "7",
        stepLabels: ["0","1","2","3","4","5","6","7"],
      },
      correctAnswer: "2",
      explanation: "Correct. WHO and most national guidelines recommend **at least 2 sessions/week** of muscle-strengthening activity.",
      wrongExplanation: "The public-health minimum baseline is **2 sessions** per week. More can be beneficial, but this is the floor.",
      deepExplanation: "Two to four sessions can work depending on goals and recovery. Two is the evidence-based floor for health; three is often the sweet spot for progressive overload and adherence.",
    },

    /* ====================================================================== */
    /*  SECTION 3 - Ranking  (Q11-13)                                         */
    /* ====================================================================== */
    {
      // Q11
      order: 11,
      type: "RANKING",
      questionText: "Rank by impact on consistent daily energy (highest first)",
      description: "Use practical real-world impact, not hype. Foundations before optimization.",
      required: true,
      allowImages: false,
      options: [
        { text: "Sleep quality and consistent timing", description: "The #1 performance multiplier" },
        { text: "Whole-food meal consistency (5-a-day+)", description: "Energy + micronutrient floor" },
        { text: "Hydration and basic electrolytes", description: "Often overlooked but high-impact" },
        { text: "Supplements and optimization extras", description: "Last - after foundations are solid" },
      ],
      explanation: "Good prioritization: fundamentals first (sleep > food > hydration), optimization extras last.",
      wrongExplanation: "The intended order starts with sleep, then meal quality, hydration, and finally supplement optimization.",
      deepExplanation: "Most performance plateaus are systems failures, not supplement failures. Fix sleep and nutrition first - then optimize.",
    },
    {
      // Q12
      order: 12,
      type: "RANKING",
      questionText: "Rank Tony Robbins' ideal morning routine sequence (his described order)",
      description: "Think: what does he do first after waking?",
      required: true,
      allowImages: false,
      options: [
        { text: "Cold exposure (cold plunge or cold shower)", description: "Wake-up signal + nervous system reset" },
        { text: "Priming (breathwork + gratitude + visualization)", description: "State-setting ritual - 10 min" },
        { text: "Movement / exercise", description: "Physical training block" },
        { text: "Fuel (first meal - often plant-forward)", description: "Strategic nutrition after training" },
      ],
      explanation: "Correct sequence: cold > Priming > movement > fuel.",
      wrongExplanation: "Tony's typical described order is: cold exposure first, then Priming, then exercise, then eat.",
      deepExplanation: "The sequence matters because each step primes the next: cold wakes the nervous system, Priming sets focus, movement builds state, and food supports recovery.",
    },
    {
      // Q13
      order: 13,
      type: "RANKING",
      questionText: "Rank nutrient monitoring priorities for many ovo-vegetarians (highest priority first)",
      description: "Think: which nutrient gap has the most serious consequences if missed?",
      required: true,
      allowImages: false,
      options: [
        { text: "B12", description: "Neurological damage if chronically deficient" },
        { text: "Omega-3 DHA/EPA", description: "Brain + cardiovascular long-term" },
        { text: "Iodine", description: "Thyroid function - especially if no dairy" },
        { text: "Iron status", description: "Context-dependent: higher risk for menstruating individuals" },
      ],
      explanation: "Correct priority: B12 (most serious consequences) > omega-3 > iodine > iron.",
      wrongExplanation: "B12 deficiency has the most severe irreversible consequences, so it gets top monitoring priority.",
      deepExplanation: "Different contexts may reorder this, but B12 monitoring is nearly universal advice for plant-forward patterns. The others are important but consequences are generally less severe or more reversible.",
    },

    /* ====================================================================== */
    /*  SECTION 4 - Recall  (Q14-16)                                          */
    /* ====================================================================== */
    {
      // Q14
      order: 14,
      type: "TEXT",
      questionText: "Tony's Triad has three parts: physiology, ______, and meaning. Fill in the blank.",
      description: "This is from his core coaching model about emotional state.",
      required: true,
      allowImages: false,
      options: [],
      correctAnswer: "focus",
      explanation: "Correct: **focus**. The Triad = physiology + focus + meaning (language).",
      wrongExplanation: "The three parts are: physiology, **focus**, and meaning/language.",
      deepExplanation: "The Triad explains that your emotional state is controlled by what you do with your body, what you focus on, and the meaning you assign to events. Change any one leg to shift your state.",
    },
    {
      // Q15
      order: 15,
      type: "TEXT",
      questionText: "Complete the principle: \"______ first, then strategy.\"",
      description: "Two-word coaching rule from Tony. Hint: it is about your internal condition before planning.",
      required: true,
      allowImages: false,
      options: [],
      correctAnswer: "state",
      explanation: "Correct: **state** first, then strategy.",
      wrongExplanation: "The coaching principle is: **state** first, then strategy.",
      deepExplanation: "In coaching terms: if your physiology and focus are collapsed, even the best strategy fails. Get into a peak state *before* making decisions or executing plans.",
    },
    {
      // Q16
      order: 16,
      type: "TEXT",
      questionText: "Name the plant-based omega-3 source that converts to DHA/EPA most reliably (it is made from microorganisms, not fish).",
      description: "One or two words. Hint: it is the supplement, not a whole food.",
      required: true,
      allowImages: false,
      options: [],
      correctAnswer: "algae oil",
      explanation: "Correct: **algae oil** (microalgae-derived DHA/EPA).",
      wrongExplanation: "The answer is **algae oil** - it provides pre-formed DHA/EPA without relying on fish.",
      deepExplanation: "ALA from flax/chia/walnuts has very limited conversion to DHA/EPA (~5-10%). Algae oil provides pre-formed long-chain omega-3s, the same source fish get theirs from. It is the most reliable plant-based option.",
    },

    /* ====================================================================== */
    /*  SECTION 5 - Shape Match  (Q17-18)                                     */
    /* ====================================================================== */
    {
      // Q17
      order: 17,
      type: "SHAPE_MATCH",
      questionText: "Visual match: connect each food source to its primary nutrient contribution",
      description: "Memory anchor: eggs = choline, algae oil = DHA/EPA, legumes = iron + protein, iodized salt = iodine.",
      required: true,
      allowImages: false,
      options: [],
      shapeMatchPreset: "outlineMatch",
      explanation: "Nice match! Visual pairing strengthens retention of food-to-nutrient mapping.",
      wrongExplanation: "Match by nutrient logic: eggs/choline, algae oil/DHA+EPA, legumes/iron+protein, iodized salt/iodine.",
      deepExplanation: "Memory improves when abstract facts are attached to visual anchors and repeated in context. This exercise builds your intuitive shopping and meal-planning muscle.",
    },
    {
      // Q18
      order: 18,
      type: "SHAPE_MATCH",
      questionText: "Visual match: connect each daily habit with its primary performance outcome",
      description: "Hydration = cognitive focus, sleep consistency = recovery + mood, meal prep = adherence, Priming = emotional state.",
      required: true,
      allowImages: false,
      options: [],
      shapeMatchPreset: "colorMatch",
      explanation: "Great. Habit-to-outcome mapping is a fast way to coach behavior change.",
      wrongExplanation: "Link each behavior to its likely performance result rather than motivation alone.",
      deepExplanation: "Behavioral design wins: environment and routines matter more than bursts of willpower. When you know *why* each habit matters, you protect it during busy weeks.",
    },

    /* ====================================================================== */
    /*  SECTION 6 - Challenge  (Q19-22)                                       */
    /* ====================================================================== */
    {
      // Q19
      order: 19,
      type: "MULTI_CHOICE",
      questionText: "Select ALL scientifically cautious-and-accurate statements (one is a trap!)",
      description: "Read carefully. Three are evidence-based; one is intentionally false.",
      required: true,
      allowImages: false,
      trickQuestion: true,
      options: [
        { text: "Egg cholesterol response varies - some people show higher LDL, so individual monitoring matters", description: "True - hyper-responder variability is real" },
        { text: "Plant-forward diets can support high performance when protein + key micronutrients are planned", description: "True - with intentional planning" },
        { text: "Supplements can fully replace the benefits of quality sleep and consistent training", description: "FALSE - this is the trap" },
        { text: "B12 and iodine planning are often essential on vegan-leaning patterns", description: "True - especially without dairy" },
      ],
      correctAnswer: "__OPTS_0_1_3__",
      explanation: "Correct. Three statements are accurate; the supplements-replace-sleep-and-training claim is the trap - it is false.",
      wrongExplanation: "The false option is the supplement-over-foundations claim. No supplement stack replaces sleep and training quality.",
      deepExplanation: "Honest high-performance nutrition is **additive** to sleep, training, and recovery - never a replacement. This is the #1 mistake in health marketing.",
    },
    {
      // Q20
      order: 20,
      type: "SINGLE_CHOICE",
      questionText: "Your friend wants to start a plant-forward + eggs plan. Best 30-day mindset to recommend:",
      description: "Pick the most sustainable psychological frame for the first month.",
      required: true,
      allowImages: false,
      options: [
        { text: "Progress over perfection: execute a simple baseline daily, review weekly, improve incrementally", description: "Sustainable and evidence-aligned" },
        { text: "All-or-nothing: miss one day, restart next month", description: "High failure rate - perfectionism trap" },
        { text: "Chase novelty: try a new diet trend every week", description: "No consistency = no adaptation" },
      ],
      correctAnswer: "__OPT_0__",
      explanation: "Progress-over-perfection is the most sustainable and well-supported approach for lasting behavior change.",
      wrongExplanation: "All-or-nothing and novelty-chasing both predict relapse. Sustainable adherence beats extreme starts.",
      deepExplanation: "Small repeatable wins create identity shift and long-term momentum. Tony's framing: it is not what we do once in a while that shapes our lives, but what we do consistently.",
    },
    {
      // Q21
      order: 21,
      type: "SCALE",
      questionText: "How many grams of protein per kg of body weight do most guidelines suggest for active adults maintaining muscle? (select the number)",
      description: "This is the commonly used range floor for active people, not sedentary RDA.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 0, max: 3, step: 0.5,
        minLabel: "0.0", maxLabel: "3.0",
        stepLabels: ["0.0", "0.5", "1.0", "1.5", "2.0", "2.5", "3.0"],
      },
      correctAnswer: "1.5",
      explanation: "Correct. Most sport nutrition guidelines suggest **1.4-2.0 g/kg/day** for active adults; 1.5 is a solid practical floor.",
      wrongExplanation: "The commonly cited range for active adults is **1.4-2.0 g/kg/day**. The sedentary RDA (0.8 g/kg) is insufficient for active individuals.",
      deepExplanation: "On a plant-forward plan, hitting 1.5 g/kg requires intentional protein stacking: legumes, tofu/tempeh, seitan, eggs, and possibly protein supplements. Track for one week to calibrate portions.",
    },
    {
      // Q22
      order: 22,
      type: "SCALE",
      questionText: "Final confidence check: can you now build an honest, evidence-based, high-energy vegan + eggs plan for a friend?",
      description: "No wrong answer - this is your learning confidence checkpoint.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1, max: 10, step: 1,
        minLabel: "Need more study", maxLabel: "Ready to coach",
        stepLabels: ["1","2","3","4","5","6","7","8","9","10"],
      },
      explanation: "Any answer is valid - this is your confidence checkpoint after completing the quiz.",
      wrongExplanation: "No wrong answer on this final confidence item.",
      deepExplanation: "If confidence is low, simplify your starting plan to five anchors: (1) protein per meal, (2) B12 strategy, (3) hydration, (4) sleep schedule, (5) weekly review. Master those before adding complexity.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Generator -- converts flat template into PollBuilderData with sections    */
/* -------------------------------------------------------------------------- */
export function generateTonyVeganEggsMasteryTemplate(): PollBuilderData {
  const template = TONY_VEGAN_EGGS_MASTERY_TEMPLATE;

  const section1Id = generateId();
  const section2Id = generateId();
  const section3Id = generateId();
  const section4Id = generateId();
  const section5Id = generateId();
  const section6Id = generateId();

  const sections: PollSection[] = [
    { id: section1Id, title: "Energy Baselines", description: "Public-health habits that actually move the needle", isCollapsed: false, icon: "chart_with_upwards_trend", flow: [] },
    { id: section2Id, title: "Nutrition Truths", description: "Accurate, practical, non-dogmatic", isCollapsed: false, icon: "white_check_mark", flow: [] },
    { id: section3Id, title: "Ranking", description: "Put foundations first", isCollapsed: false, icon: "trophy", flow: [] },
    { id: section4Id, title: "Recall", description: "Triad + Priming + key nutrition anchors", isCollapsed: false, icon: "memo", flow: [] },
    { id: section5Id, title: "Shape Match", description: "UI + memory retention checks", isCollapsed: false, icon: "large_blue_diamond", flow: [] },
    { id: section6Id, title: "Challenge", description: "Final mixed questions", isCollapsed: false, icon: "dart", flow: [] },
  ];

  const getSectionId = (i: number) => {
    if (i < 4) return section1Id;
    if (i < 10) return section2Id;
    if (i < 13) return section3Id;
    if (i < 16) return section4Id;
    if (i < 18) return section5Id;
    return section6Id;
  };

  const questions: (PollQuestion & { sectionId: string })[] = template.questions.map((q, i) => {
    const opts = q.options.map((o) => ({ ...o, id: generateId() }));

    // --- Resolve correctAnswer placeholders into real option IDs ---
    let resolvedCorrectAnswer: string | string[] | null | undefined = q.correctAnswer;

    if (typeof resolvedCorrectAnswer === "string") {
      if (resolvedCorrectAnswer === "__OPTS_ALL__") {
        resolvedCorrectAnswer = opts.map((o) => o.id);
      } else if (resolvedCorrectAnswer.startsWith("__OPTS_")) {
        // e.g. "__OPTS_0_1_2_3__" or "__OPTS_0_1_3__"
        const indices = resolvedCorrectAnswer.replace(/__/g, "").replace("OPTS_", "").split("_").map(Number);
        resolvedCorrectAnswer = indices.filter((idx) => opts[idx]).map((idx) => opts[idx].id);
      } else if (resolvedCorrectAnswer.startsWith("__OPT_")) {
        // e.g. "__OPT_0__" or "__OPT_1__"
        const idx = parseInt(resolvedCorrectAnswer.replace(/__/g, "").replace("OPT_", ""), 10);
        resolvedCorrectAnswer = opts[idx]?.id ?? null;
      }
      // Otherwise it is a literal value (slider/scale/text answers like "5", "7", "focus", etc.)
    }

    // --- Resolve sliderConfig correctAnswer for slider/scale types ---
    let resolvedSliderConfig = q.sliderConfig;
    if (resolvedSliderConfig && (q.type === "SLIDER" || q.type === "SCALE") && typeof q.correctAnswer === "string" && !q.correctAnswer.startsWith("__")) {
      resolvedSliderConfig = { ...resolvedSliderConfig, correctAnswer: q.correctAnswer } as PollQuestion["sliderConfig"];
    }

    // --- For RANKING questions, correctAnswer is the options in their given order ---
    if (q.type === "RANKING" && !resolvedCorrectAnswer) {
      resolvedCorrectAnswer = opts.map((o) => o.id);
    }

    const question: PollQuestion & { sectionId: string } = {
      id: generateId(),
      type: q.type,
      questionText: q.questionText,
      description: q.description,
      required: q.required,
      allowImages: q.allowImages,
      order: i + 1,
      sectionId: getSectionId(i),
      options: opts,
      sliderConfig: resolvedSliderConfig,
      shapeMatchPreset: q.shapeMatchPreset,
      trickQuestion: q.trickQuestion,
      correctAnswer: resolvedCorrectAnswer,
      explanation: q.explanation,
      wrongExplanation: q.wrongExplanation,
      deepExplanation: q.deepExplanation,
    };

    return question;
  });

  sections[0].flow = questions.slice(0, 4).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[1].flow = questions.slice(4, 10).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[2].flow = questions.slice(10, 13).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[3].flow = questions.slice(13, 16).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[4].flow = questions.slice(16, 18).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[5].flow = questions.slice(18, 22).map((q) => ({ type: "QUESTION" as const, id: q.id }));

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
