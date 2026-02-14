/**
 * Verify Poll Demo — Comprehensive test demo for all question types.
 *
 * 6 SECTIONS with 27 QUESTIONS:
 * 
 * Section 1: Numeric Questions (6 questions)
 * - Core sliders/scales + unambiguous boundary checks
 * 
 * Section 2: Choice Questions (7 questions)
 * - Single choice (easy), Multi choice, Single with reading comprehension
 * - TRICK: "Which is NOT correct?", Multi-choice partial trap
 * 
 * Section 3: Ranking Questions (4 questions)
 * - 6-item ranking, 3-item ABC, TRICK: Reverse order ranking
 * 
 * Section 4: Text Questions (3 questions)
 * - Type "Hello, World!", Type a color name, Type a number as text
 * 
 * Section 5: Shape Match Questions (2 questions)
 * - Basic shapes, Color matching
 * 
 * Section 6: Mixed Challenge (5 questions)
 * - Final slider, UI color semantics, trust-factor principle
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

export const VERIFY_POLL_DEMO_TEMPLATE: {
  title: string;
  description: string;
  type: string;
  allowPartialSubmission: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  questions: TemplateQuestion[];
} = {
  title: "🧪 Ultimate Quiz Demo — All Question Types (High-Quality Educational)",
  description: `A comprehensive demo to verify ALL poll features work correctly.

Every question is crafted to be unambiguous and includes layered explanations for the "Why?" and "Still do not understand?" buttons.

**6 Sections with 27 Questions:**

📊 **Section 1: Numeric** — Sliders & scales  
✅ **Section 2: Choice** — Single & multi-select  
🏆 **Section 3: Ranking** — Reorder items  
📝 **Section 4: Text** — Type exact answers  
🔷 **Section 5: Shapes** — Drag & drop shape matching  
🎯 **Section 6: Challenge** — Mixed final questions

Good luck!`,
  type: "QUIZ",
  allowPartialSubmission: true,
  showProgressBar: true,
  randomizeQuestions: false,
  questions: [
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1: NUMERIC QUESTIONS (6 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 1,
      type: "SLIDER",
      questionText: "Slide the slider to option 6",
      description: "Lock in your answer to see feedback and a short follow-up check.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        minLabel: "1",
        maxLabel: "10",
        stepLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
    },
    {
      order: 2,
      type: "SCALE",
      questionText: "Rate this demo from 1 (very easy) to 7 (very hard) — but for this test, follow the instruction and slide to the maximum",
      description: "This checks instruction-following. The expected answer here is 7.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 7,
        step: 1,
        minLabel: "Low",
        maxLabel: "High",
        stepLabels: ["1", "2", "3", "4", "5", "6", "7"],
      },
    },
    {
      order: 3,
      type: "SLIDER",
      questionText: "Slide to the MIDDLE value on this 1-5 scale",
      description: "The middle value has exactly two numbers below it and two numbers above it.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 5,
        step: 1,
        minLabel: "1",
        maxLabel: "5",
        stepLabels: ["1", "2", "3", "4", "5"],
      },
    },
    {
      order: 4,
      type: "SLIDER",
      questionText: "Slide to the highest number that still excludes five",
      description: "The slider highlights everything from 1 up to your choice. Five must stay unselected.",
      required: true,
      allowImages: false,
      options: [],
      trickQuestion: true,
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        minLabel: "1",
        maxLabel: "10",
        stepLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
    },
    {
      order: 5,
      type: "SLIDER",
      questionText: "Slide to 7 — the number of days in a week",
      description: "Straightforward factual check on a 1–10 scale.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        minLabel: "1",
        maxLabel: "10",
        stepLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
    },
    {
      order: 6,
      type: "SLIDER",
      questionText: "Slide to the number of continents on Earth",
      description: "Factual check on a 1–10 scale.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        minLabel: "1",
        maxLabel: "10",
        stepLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: CHOICE QUESTIONS (7 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 7,
      type: "SINGLE_CHOICE",
      questionText: "Select the option that says 'Select me'",
      description: "Only one answer is correct.",
      required: true,
      allowImages: false,
      options: [
        { text: "Select me", description: "This is the correct answer" },
        { text: "Don't select me", description: "This is wrong" },
        { text: "Not this one", description: "Also wrong" },
      ],
    },
    {
      order: 8,
      type: "MULTI_CHOICE",
      questionText: "Select ALL options that contain the standalone word 'correct'",
      description: "Only whole-word matches count. Letter substrings inside another word (like 'incorrect') do NOT count.",
      required: true,
      allowImages: false,
      options: [
        { text: "This is correct (A)", description: "Contains 'correct'" },
        { text: "This is also correct (B)", description: "Contains 'correct'" },
        { text: "This is wrong", description: "Says 'wrong' not 'correct'" },
        { text: "Incorrect option", description: "Contains 'incorrect' which is different" },
      ],
    },
    {
      order: 9,
      type: "SINGLE_CHOICE",
      questionText: "Which option is labeled 'The Answer'?",
      description: "Read the options carefully — only one is labeled correctly.",
      required: true,
      allowImages: false,
      options: [
        { text: "Not The Answer", description: "Close but no" },
        { text: "The Answer", description: "This is it!" },
        { text: "An Answer", description: "Almost but not quite" },
        { text: "Maybe The Answer?", description: "Nope" },
      ],
    },
    {
      order: 10,
      type: "SINGLE_CHOICE",
      questionText: "Which of these is NOT a fruit?",
      description: "Select the option that doesn't belong in the fruit category.",
      required: true,
      allowImages: false,
      trickQuestion: true,
      options: [
        { text: "🍎 Apple" },
        { text: "🍌 Banana" },
        { text: "🥕 Carrot" },
        { text: "🍊 Orange" },
      ],
    },
    {
      order: 11,
      type: "MULTI_CHOICE",
      questionText: "Select ALL primary colors in the RGB model",
      description: "Red, Green and Blue are the three additive primaries used by screens.",
      required: true,
      allowImages: false,
      options: [
        { text: "🔴 Red", description: "Primary color" },
        { text: "🟢 Green", description: "Primary color" },
        { text: "🔵 Blue", description: "Primary color" },
        { text: "🟡 Yellow", description: "Not a primary in RGB (it's in CMYK)" },
      ],
    },
    {
      order: 12,
      type: "SINGLE_CHOICE",
      questionText: "What is 2 + 2?",
      required: true,
      allowImages: false,
      trickQuestion: true,
      options: [
        { text: "3" },
        { text: "4" },
        { text: "5" },
        { text: "22" },
      ],
    },
    {
      order: 13,
      type: "MULTI_CHOICE",
      questionText: "Select ALL the three basic states of matter",
      description: "Solid, liquid, gas (plasma is a fourth, more advanced state).",
      required: true,
      allowImages: false,
      options: [
        { text: "Solid" },
        { text: "Liquid" },
        { text: "Gas" },
        { text: "Plasma" },
      ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: RANKING QUESTIONS (4 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 14,
      type: "RANKING",
      questionText: "Arrange 1-6: Put 1st at TOP, 6th at BOTTOM",
      description: "Drag to reorder — ascending order (1,2,3,4,5,6 from top to bottom).",
      required: true,
      allowImages: false,
      options: [
        { text: "🥇 1st place (top)" },
        { text: "🥈 2nd place" },
        { text: "🥉 3rd place" },
        { text: "4️⃣ 4th place" },
        { text: "5️⃣ 5th place" },
        { text: "6️⃣ 6th place (bottom)" },
      ],
    },
    {
      order: 15,
      type: "RANKING",
      questionText: "Alphabetical order: A first, then B, then C",
      description: "Simple ABC order — A at top, C at bottom.",
      required: true,
      allowImages: false,
      options: [
        { text: "A - First" },
        { text: "B - Second" },
        { text: "C - Third" },
      ],
    },
    {
      order: 16,
      type: "RANKING",
      questionText: "Arrange these letters from Z at the TOP to A at the BOTTOM",
      description: "Put them in reverse alphabetical order.",
      required: true,
      allowImages: false,
      trickQuestion: true,
      options: [
        { text: "Z" },
        { text: "Y" },
        { text: "X" },
        { text: "A" },
      ],
    },
    {
      order: 17,
      type: "RANKING",
      questionText: "Arrange these numbers from smallest to largest",
      description: "Drag to order: 3, 5, 8, 12",
      required: true,
      allowImages: false,
      options: [
        { text: "8" },
        { text: "3" },
        { text: "12" },
        { text: "5" },
      ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: TEXT QUESTIONS (3 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 18,
      type: "TEXT",
      questionText: "Type exactly: Hello, World!",
      description: "Type the classic programming greeting. Case and punctuation must be exact (no extra spaces, capital H and W).",
      required: true,
      allowImages: false,
      options: [],
    },
    {
      order: 19,
      type: "TEXT",
      questionText: "What color is the sky on a clear day? (one word)",
      description: "Type a single color word. Think about what you see when you look up!",
      required: true,
      allowImages: false,
      options: [],
    },
    {
      order: 20,
      type: "TEXT",
      questionText: "Type the number 'forty-two' using digits",
      description: "Write this famous number from Hitchhiker's Guide using numbers, not words.",
      required: true,
      allowImages: false,
      options: [],
    },
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: SHAPE MATCH (2 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 21,
      type: "SHAPE_MATCH",
      questionText: "Match each shape to its matching OUTLINE",
      description: "Drag the filled shapes into the matching black outlines (circle → circle, square → square, triangle → triangle).",
      required: true,
      allowImages: false,
      options: [],
      shapeMatchPreset: "outlineMatch",
    },
    {
      order: 22,
      type: "SHAPE_MATCH",
      questionText: "Match each shape to its matching COLOR zone",
      description: "Drag each shape to the zone with the same color (ignore shape, match colors only).",
      required: true,
      allowImages: false,
      options: [],
      shapeMatchPreset: "colorMatch",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: MIXED CHALLENGE (5 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 23,
      type: "SLIDER",
      questionText: "Final slider challenge: Pick exactly 8",
      description: "Almost at the end! The correct answer is 8.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 10,
        step: 1,
        minLabel: "Start",
        maxLabel: "End",
        stepLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
    },
    {
      order: 24,
      type: "SINGLE_CHOICE",
      questionText: "What color represents 'success' or 'correct' in most UIs?",
      description: "Think about check marks, confirmations, and positive feedback.",
      required: true,
      allowImages: false,
      options: [
        { text: "🔴 Red", description: "Usually means error or danger" },
        { text: "🟢 Green", description: "The universal color of success!" },
        { text: "🔵 Blue", description: "More informational" },
        { text: "🟡 Yellow", description: "Warning or caution" },
      ],
    },
    {
      order: 25,
      type: "MULTI_CHOICE",
      questionText: "Select ALL the even numbers",
      description: "Remember: even numbers divide evenly by 2.",
      required: true,
      allowImages: false,
      trickQuestion: true,
      options: [
        { text: "2" },
        { text: "4" },
        { text: "5" },
        { text: "6" },
      ],
    },
    {
      order: 26,
      type: "SCALE",
      questionText: "Rate your experience: Pick the LOWEST value (1)",
      description: "For this demo, the correct answer is 1 — the minimum.",
      required: true,
      allowImages: false,
      options: [],
      sliderConfig: {
        min: 1,
        max: 5,
        step: 1,
        minLabel: "Lowest",
        maxLabel: "Highest",
        stepLabels: ["1", "2", "3", "4", "5"],
      },
    },
    {
      order: 27,
      type: "SINGLE_CHOICE",
      questionText: "What gives an AI-generated quiz the highest trust factor?",
      description: "Choose the best practice used by VeggaStare.",
      required: true,
      allowImages: false,
      options: [
        { text: "User brings their own API key + strong educational prompt" },
        { text: "Platform uses a single shared key" },
        { text: "Skipping deep explanations to save time" },
        { text: "Allowing ambiguous or 'any two' answers" },
      ],
    },
  ],
};

export function generateVerifyPollDemoTemplate(): PollBuilderData {
  const template = VERIFY_POLL_DEMO_TEMPLATE;

  const section1Id = generateId();
  const section2Id = generateId();
  const section3Id = generateId();
  const section4Id = generateId();
  const section5Id = generateId();
  const section6Id = generateId();
  const sections: PollSection[] = [
    {
      id: section1Id,
      title: "🎚️ Numeric Questions",
      description: "Sliders & scales (including a trick!)",
      isCollapsed: false,
      icon: "📊",
      flow: [],
    },
    {
      id: section2Id,
      title: "✅ Choice Questions",
      description: "Single & multi-select + tricky wording",
      isCollapsed: false,
      icon: "✓",
      flow: [],
    },
    {
      id: section3Id,
      title: "🏆 Ranking Questions",
      description: "Reorder items (watch for reverse!)",
      isCollapsed: false,
      icon: "🔢",
      flow: [],
    },
    {
      id: section4Id,
      title: "📝 Text Questions",
      description: "Type exact answers",
      isCollapsed: false,
      icon: "✏️",
      flow: [],
    },
    {
      id: section5Id,
      title: "🔷 Shape Match",
      description: "Drag shapes to targets",
      isCollapsed: false,
      icon: "🔷",
      flow: [],
    },
    {
      id: section6Id,
      title: "🎯 Mixed Challenge",
      description: "Final mixed questions",
      isCollapsed: false,
      icon: "🎯",
      flow: [],
    },
  ];

  // Map question indices to sections:
  // 0-5: Numeric (6 questions)
  // 6-12: Choice (7 questions)
  // 13-16: Ranking (4 questions)
  // 17-19: Text (3 questions)
  // 20-21: Shape Match (2 questions)
  // 22-26: Mixed (5 questions)
  const getSectionId = (i: number) => {
    if (i < 6) return section1Id;
    if (i < 13) return section2Id;
    if (i < 17) return section3Id;
    if (i < 20) return section4Id;
    if (i < 22) return section5Id;
    return section6Id;
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
    // SECTION 1: NUMERIC (Questions 0-5)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q1: Slider to 6
    if (q.order === 1 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "6" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "6";
      question.explanation = "Correct. You selected exactly 6. This slider highlights a contiguous range from 1 up to your chosen value, so 1–6 are selected.";
      question.wrongExplanation = "You did not stop at 6. The exact target for this question is 6.";
      question.deepExplanation = "Follow-up check: after selecting 6, which values are NOT selected (greyed out)?\n\nAnswer: 7, 8, 9, 10.\n\nReason: this slider highlights all values from 1 up to your chosen value with no gaps.";
    }

    // Q2: Scale to 7
    if (q.order === 2 && q.type === "SCALE" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "7" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "7";
      question.explanation = "Correct. You followed the explicit instruction and selected the maximum value, 7.";
      question.wrongExplanation = "This item asks for the maximum value. On a 1–7 scale, that is 7.";
      question.deepExplanation = "Why this question exists: it checks whether you follow the stated instruction rather than answering by personal opinion.\n\nEven if you personally rate the demo lower, this test item is marked correct only when you select 7.";
    }

    // Q3: Slider to 3 (middle)
    if (q.order === 3 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "3" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "3";
      question.explanation = "Correct. The middle of 1, 2, 3, 4, 5 is 3 because two values are below it (1, 2) and two are above it (4, 5).";
      question.wrongExplanation = "The exact middle of 1–5 is 3.";
      question.deepExplanation = "Follow-up check: if you selected 3, how many values are highlighted on this slider?\n\nAnswer: 3 values (1, 2, 3).\n\nReason: this slider highlights a contiguous range from 1 up to your selected value.";
    }

    // Q4: TRICK - highest valid stop excluding 5 is 4
    if (q.order === 4 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "4" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "4";
      question.trickQuestion = true;
      question.explanation = "Correct. 4 is the highest stop that still keeps 5 unselected.";
      question.wrongExplanation = "To keep 5 greyed out you must stop at 4 or lower. The expected highest valid answer is 4.";
      question.deepExplanation = "This slider always highlights 1 through your chosen value with no gaps.\n\n• Stop at 4 → highlights 1-4 ✅\n• Stop at 5 or higher → 5 becomes highlighted ❌\n\nOnly 4 satisfies the rule as the maximum valid stop.";
    }

    // Q5: Days in a week
    if (q.order === 5 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "7" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "7";
      question.explanation = "Correct! There are exactly 7 days in a week.";
      question.wrongExplanation = "The correct value is 7.";
      question.deepExplanation = "A calendar week has seven days in this order: Monday to Sunday (or Sunday to Saturday depending on locale).\n\nThis is a stable foundational fact often used in planning, reporting cycles, and school timetables.";
    }

    // Q6: Continents on Earth
    if (q.order === 6 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "7" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "7";
      question.explanation = "Correct! There are 7 continents: Africa, Antarctica, Asia, Europe, North America, South America, and Australia/Oceania.";
      question.wrongExplanation = "The correct value is 7. The seven continents are Africa, Antarctica, Asia, Europe, North America, South America, and Australia/Oceania.";
      question.deepExplanation = "The seven commonly taught continents are Africa, Antarctica, Asia, Europe, North America, South America, and Australia/Oceania.\n\nDifferent geographic conventions exist (some models merge Europe and Asia into Eurasia, giving 6), but most school-level quizzes and standardized tests use the 7-continent model.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: CHOICE (Questions 6-12)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q7: Single choice - "Select me" is first option
    if (q.order === 7 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.explanation = "The option labeled 'Select me' is the correct answer. This tests basic single-choice selection.";
      question.wrongExplanation = "Read each option carefully — the one that literally says 'Select me' is correct.";
      question.deepExplanation = "Single-choice questions allow exactly one selection. The UI disables other options once you pick one. This is the simplest question type in the system.";
    }

    // Q8: Multi choice - both options containing "correct" (opts 0 and 1)
    if (q.order === 8 && q.type === "MULTI_CHOICE" && opts[0] && opts[1]) {
      question.correctAnswer = [opts[0].id, opts[1].id];
      question.explanation = "Correct options are the ones where 'correct' appears as a standalone word: 'This is correct (A)' and 'This is also correct (B)'. The word 'incorrect' is a different word — it contains the letters but is NOT a standalone match.";
      question.wrongExplanation = "'Incorrect option' is not correct here: although it includes the same letters, it is a different single word ('incorrect'), not the standalone word 'correct'.";
      question.deepExplanation = "This tests whole-word matching vs substring matching — a concept familiar from search engines and programming.\n\n• 'This is correct' → contains the standalone word 'correct' ✅\n• 'Incorrect option' → 'incorrect' is a single word that happens to contain the letters c-o-r-r-e-c-t, but it is NOT the standalone word 'correct' ❌\n\nIn regex terms, this is the difference between /correct/ (substring) and /\\bcorrect\\b/ (whole word).";
    }

    // Q9: Single - "The Answer" is second option
    if (q.order === 9 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.explanation = "The exact label 'The Answer' appears on the second option. Close variants like 'Not The Answer' or 'An Answer' are traps.";
      question.wrongExplanation = "Look for the EXACT label 'The Answer' — not 'Not The Answer', 'An Answer', or 'Maybe The Answer?'.";
      question.deepExplanation = "This tests reading comprehension under mild distraction. In real polls, option text should be distinct enough to avoid confusion.";
    }

    // Q10: TRICK - NOT a fruit = Carrot (third option)
    if (q.order === 10 && q.type === "SINGLE_CHOICE" && opts[2]) {
      question.correctAnswer = opts[2].id;
      question.trickQuestion = true;
      question.explanation = "🥕 Carrot is NOT a fruit — it's a vegetable! Good job catching the trick.";
      question.wrongExplanation = "The question asked what is NOT a fruit. Apples, bananas, and oranges are fruits. Carrot is a vegetable!";
      question.deepExplanation = "Botanically, a fruit develops from the flower of a plant and contains seeds. A carrot is the root of the plant — it grows underground and has no seeds.\n\n• 🍎 Apple → fruit (seeds inside)\n• 🍌 Banana → fruit (tiny seeds)\n• 🍊 Orange → fruit (segments with seeds)\n• 🥕 Carrot → root vegetable (no seeds, grows underground)\n\nFun fact: tomatoes are botanically fruits, but culinarily treated as vegetables!";
    }

    // Q11: Multi - all RGB primaries (R,G,B)
    if (q.order === 11 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[2]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[2].id];
      question.explanation = "All three are required in RGB: Red, Green, and Blue.";
      question.wrongExplanation = "Select Red, Green, and Blue. Yellow is primary in CMYK, not RGB.";
      question.deepExplanation = "RGB (Red, Green, Blue) is the additive color model used by screens. CMYK (Cyan, Magenta, Yellow, Key/black) is the subtractive model used by printers. Yellow is primary in CMYK but NOT in RGB.";
    }

    // Q12: TRICK (but actually easy) - 2 + 2 = 4 (second option)
    if (q.order === 12 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.trickQuestion = true;
      question.explanation = "2 + 2 = 4. This was labeled as a trick question but the math is straightforward!";
      question.wrongExplanation = "The answer is simply 4. '22' would be string concatenation in programming, not addition!";
      question.deepExplanation = "The trick here is that there IS no trick — the 🎭 trick label is itself the misdirection. In JavaScript, '2' + '2' would indeed give '22' (string concatenation), but the question asks about mathematical addition.";
    }

    // Q13: States of matter (solid, liquid, gas)
    if (q.order === 13 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[2]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[2].id];
      question.explanation = "The three basic states are solid, liquid and gas.";
      question.wrongExplanation = "Select solid, liquid and gas. Plasma is commonly taught as the fourth state.";
      question.deepExplanation = "At basic level, matter is taught as solid, liquid, and gas because these are the most familiar forms in daily life.\n\nIn deeper physics, plasma is included as an additional state, but this question specifically asked for the three basic states.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: RANKING (Questions 13-16)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q14: Ranking 6 items 1-6 ascending
    if (q.order === 14 && q.type === "RANKING") {
      question.correctAnswer = opts.map((o) => o.id);
      question.explanation = "Perfect. Ascending order from top to bottom.";
      question.wrongExplanation = "Order should be 1st → 2nd → 3rd → 4th → 5th → 6th from top to bottom.";
      question.deepExplanation = "If two neighboring rows are swapped, the order is almost correct but still not exact. Use the extra clarification panel to see how many positions were correct and which positions must be swapped.";
    }

    // Q15: Ranking A,B,C
    if (q.order === 15 && q.type === "RANKING") {
      question.correctAnswer = opts.map((o) => o.id);
      question.explanation = "Simple ABC order — A first, B second, C third.";
      question.wrongExplanation = "Alphabetical order: A → B → C from top to bottom.";
      question.deepExplanation = "This ranking uses standard Latin alphabetical order. The letters appear in the order A (1st), B (2nd), C (3rd).\n\nRanking questions require exact positional matching — every row must be in the correct slot for it to count as correct.";
    }

    // Q16: TRICK - Reverse order Z,Y,X,A
    if (q.order === 16 && q.type === "RANKING") {
      question.correctAnswer = opts.map((o) => o.id);
      question.trickQuestion = true;
      question.explanation = "This was a reverse order trick! Z at top, A at bottom.";
      question.wrongExplanation = "The question said REVERSE order — Z should be at TOP, A at BOTTOM.";
      question.deepExplanation = "The trick is in the wording: 'from Z at the TOP to A at the BOTTOM'. Most people instinctively sort A→Z (ascending). This question asks for Z→A (descending).\n\nAlways read the exact phrasing before assuming the expected direction. Trick questions test whether you follow the stated instruction rather than a habitual pattern.";
    }

    // Q17: Ranking numbers smallest to largest (3,5,8,12)
    if (q.order === 17 && q.type === "RANKING" && opts[1] && opts[3] && opts[0] && opts[2]) {
      question.correctAnswer = [opts[1].id, opts[3].id, opts[0].id, opts[2].id];
      question.explanation = "Correct order: 3 → 5 → 8 → 12.";
      question.wrongExplanation = "Smallest to largest should be 3, then 5, then 8, then 12.";
      question.deepExplanation = "Ranking questions test both numeric understanding and careful ordering.\n\nA quick strategy: first identify min and max, place them, then sort the middle values.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: TEXT (Questions 17-19)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q18: Type "Hello, World!"
    if (q.order === 18 && q.type === "TEXT") {
      question.correctAnswer = "Hello, World!";
      question.explanation = "Perfect. Exact match: 'Hello, World!'";
      question.wrongExplanation = "Must be exactly 'Hello, World!' (capital H, capital W, comma, exclamation mark, no extra spaces).";
      question.deepExplanation = "This check is deliberately strict:\n• Case-sensitive\n• Punctuation-sensitive\n• No extra spaces\n\nOnly the exact string 'Hello, World!' is accepted.";
    }

    // Q19: Type "blue" (sky color)
    if (q.order === 19 && q.type === "TEXT") {
      question.correctAnswer = "blue";
      question.explanation = "The sky is blue on a clear day!";
      question.wrongExplanation = "On a clear day, the sky appears blue due to Rayleigh scattering of sunlight.";
      question.deepExplanation = "Text answers are compared case-insensitively, so 'Blue', 'blue', or 'BLUE' all work. The system trims whitespace and normalizes case before comparison.";
    }

    // Q20: Type "42" (the number)
    if (q.order === 20 && q.type === "TEXT") {
      question.correctAnswer = "42";
      question.explanation = "42 — the answer to life, the universe, and everything!";
      question.wrongExplanation = "Forty-two in digits is 42.";
      question.deepExplanation = "The reference is to Douglas Adams' 'The Hitchhiker's Guide to the Galaxy', where a supercomputer called Deep Thought calculates that the Answer to the Ultimate Question of Life, the Universe, and Everything is simply 42.\n\nFor this text question, the answer must be the digits '42' — not the words 'forty-two'. Text matching is case-insensitive but must match the expected content.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: SHAPE MATCH (Questions 20-21)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q21: Basic shapes - no correctAnswer needed, ShapeMatchQuestion handles it
    if (q.order === 21 && q.type === "SHAPE_MATCH") {
      question.shapeMatchPreset = "outlineMatch";
      question.explanation = "Correct. Every shape is in its matching outline.";
      question.wrongExplanation = "Drag each filled shape into the black outline with the same form.";
      question.deepExplanation = "Tip: the outlines are empty black frames. Drop each colored shape directly onto the matching frame.";
    }

    // Q22: Color match - no correctAnswer needed, ShapeMatchQuestion handles it
    if (q.order === 22 && q.type === "SHAPE_MATCH") {
      question.shapeMatchPreset = "colorMatch";
      question.explanation = "Correct. All shapes are in the zone of the same color.";
      question.wrongExplanation = "Focus only on color, not the target shape.";
      question.deepExplanation = "The target zones are the large colored areas. Any shape is valid if its color matches the zone color.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: MIXED CHALLENGE (Questions 22-26)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q23: Slider to 8
    if (q.order === 23 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "8" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "8";
      question.explanation = "Correct! The slider asks for exactly 8 — a straightforward final check to confirm you can follow explicit slider instructions after completing four previous sections.";
      question.wrongExplanation = "The target is 8 on this 1-10 scale. Move the slider thumb to the step labeled '8'.";
      question.deepExplanation = "This question appears in the Mixed Challenge section as a warm-up. It deliberately has no trick — it checks basic slider proficiency one last time before the quiz ends.\n\nAfter answering, notice the highlighted range covers 1 through 8, while 9 and 10 stay unselected.";
    }

    // Q24: Green is success (second option)
    if (q.order === 24 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.explanation = "🟢 Green universally represents success, correctness, and approval in UI design!";
      question.wrongExplanation = "Green is the color of success. Red = error/danger, Blue = info/neutral, Yellow = warning/caution.";
      question.deepExplanation = "UI color conventions:\n• 🟢 Green → success, confirm, correct\n• 🔴 Red → error, danger, destructive action\n• 🔵 Blue → information, primary action\n• 🟡 Yellow/Amber → warning, caution\n\nVeggaStare uses emerald green (#10b981) as its primary accent for this exact reason — it signals positivity and growth.";
    }

    // Q25: TRICK - Even numbers (2, 4, 6 = opts 0, 1, 3)
    if (q.order === 25 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[3]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[3].id];
      question.trickQuestion = true;
      question.explanation = "Even numbers: 2, 4, 6. The number 5 is odd!";
      question.wrongExplanation = "5 is odd (not divisible by 2). The even numbers are 2, 4, and 6.";
      question.deepExplanation = "An even number is any integer divisible by 2 with no remainder.\n\n• 2 ÷ 2 = 1 (remainder 0) → even ✅\n• 4 ÷ 2 = 2 (remainder 0) → even ✅\n• 5 ÷ 2 = 2 (remainder 1) → odd ❌\n• 6 ÷ 2 = 3 (remainder 0) → even ✅\n\nThe trick label is mild misdirection — the question itself is straightforward, but the 🎭 badge might make you second-guess a simple math check.";
    }

    // Q26: Scale to 1 (minimum)
    if (q.order === 26 && q.type === "SCALE" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "1" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "1";
      question.explanation = "Correct — the minimum (lowest) value on a 1–5 scale is 1. This tests whether you follow the explicit instruction rather than giving a personal rating.";
      question.wrongExplanation = "The question asked for the LOWEST value, which is 1. This is not asking for your personal opinion — it's an instruction-following check.";
      question.deepExplanation = "Scale questions typically collect subjective opinions (e.g. 'Rate this 1-5'). This question flips that convention by asking for a specific objective value.\n\nLike Q2 (which asked for 7 — the max), this tests instruction-following over personal impulse. Both sliders and scales work the same way mechanically: slide or click to set a value.";
    }

    // Q27: Trust-factor best practice
    if (q.order === 27 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.explanation = "Correct! BYOK + a strong educational prompt is the highest-trust approach.";
      question.wrongExplanation = "Highest trust comes from user-provided key usage with strict, educational prompt constraints and layered explanations.";
      question.deepExplanation = "Bring-your-own-key gives user-level cost control and transparency over provider/model quality.\n\nWhen combined with a rigorous prompt (accuracy, unambiguous answers, and layered explanations), the resulting quizzes are more reliable, more teachable, and easier to audit.";
    }

    return question;
  });

  // Assign questions to sections by index ranges
  sections[0].flow = questions.slice(0, 6).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[1].flow = questions.slice(6, 13).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[2].flow = questions.slice(13, 17).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[3].flow = questions.slice(17, 20).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[4].flow = questions.slice(20, 22).map((q) => ({ type: "QUESTION" as const, id: q.id }));
  sections[5].flow = questions.slice(22, 27).map((q) => ({ type: "QUESTION" as const, id: q.id }));

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
