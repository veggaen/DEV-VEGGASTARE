/**
 * Verify Poll Demo — Comprehensive test demo for all question types.
 *
 * 6 SECTIONS with 22+ QUESTIONS:
 * 
 * Section 1: Numeric Questions (4 questions)
 * - Slider to 6, Scale to 7, Slider to 3, TRICK: "Don't slide to 5"
 * 
 * Section 2: Choice Questions (6 questions)
 * - Single choice (easy), Multi choice, Single with reading comprehension
 * - TRICK: "Which is NOT correct?", Multi-choice partial trap
 * 
 * Section 3: Ranking Questions (3 questions)
 * - 6-item ranking, 3-item ABC, TRICK: Reverse order ranking
 * 
 * Section 4: Text Questions (3 questions)
 * - Type "Hello, World!", Type a color name, Type a number as text
 * 
 * Section 5: Shape Match Questions (2 questions)
 * - Basic shapes, Color matching
 * 
 * Section 6: Mixed Challenge (4 questions)
 * - Final slider, Color question, TRICK questions
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
  title: "🧪 Ultimate Quiz Demo — All Question Types",
  description: `A comprehensive demo to verify ALL poll features work correctly.

**6 Sections with 22 Questions:**

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
    // SECTION 1: NUMERIC QUESTIONS (4 questions)
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
      questionText: "Choose any number EXCEPT five on this slider.",
      description: "Read carefully! Some numbers are off-limits.",
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
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: CHOICE QUESTIONS (6 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 5,
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
      order: 6,
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
      order: 7,
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
      order: 8,
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
      order: 9,
      type: "MULTI_CHOICE",
      questionText: "Select exactly TWO primary colors (RGB model)",
      description: "In the RGB color model, the primary colors are Red, Green, and Blue. Pick any two.",
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
      order: 10,
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
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: RANKING QUESTIONS (3 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 11,
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
      order: 12,
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
      order: 13,
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
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: TEXT QUESTIONS (3 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 14,
      type: "TEXT",
      questionText: "Type exactly: Hello, World!",
      description: "Type the classic programming greeting. Case and punctuation must be exact (no extra spaces, capital H and W).",
      required: true,
      allowImages: false,
      options: [],
    },
    {
      order: 15,
      type: "TEXT",
      questionText: "What color is the sky on a clear day? (one word)",
      description: "Type a single color word. Think about what you see when you look up!",
      required: true,
      allowImages: false,
      options: [],
    },
    {
      order: 16,
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
      order: 17,
      type: "SHAPE_MATCH",
      questionText: "Match each shape to its matching OUTLINE",
      description: "Drag the filled shapes into the matching black outlines (circle → circle, square → square, triangle → triangle).",
      required: true,
      allowImages: false,
      options: [],
      shapeMatchPreset: "outlineMatch",
    },
    {
      order: 18,
      type: "SHAPE_MATCH",
      questionText: "Match each shape to its matching COLOR zone",
      description: "Drag each shape to the zone with the same color (ignore shape, match colors only).",
      required: true,
      allowImages: false,
      options: [],
      shapeMatchPreset: "colorMatch",
    },
    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: MIXED CHALLENGE (4 questions)
    // ═══════════════════════════════════════════════════════════════════════
    {
      order: 19,
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
      order: 20,
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
      order: 21,
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
      order: 22,
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
  // 0-3: Numeric (4 questions)
  // 4-9: Choice (6 questions)
  // 10-12: Ranking (3 questions)
  // 13-15: Text (3 questions)
  // 16-17: Shape Match (2 questions)
  // 18-21: Mixed (4 questions)
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
    // SECTION 1: NUMERIC (Questions 0-3)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q0: Slider to 6
    if (i === 0 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "6" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "6";
      question.explanation = "Correct. You selected exactly 6. This slider highlights a contiguous range from 1 up to your chosen value, so 1–6 are selected.";
      question.wrongExplanation = "You did not stop at 6. The exact target for this question is 6.";
      question.deepExplanation = "Follow-up check: after selecting 6, which values are NOT selected (greyed out)?\n\nAnswer: 7, 8, 9, 10.\n\nReason: this slider highlights all values from 1 up to your chosen value with no gaps.";
    }

    // Q1: Scale to 7
    if (i === 1 && q.type === "SCALE" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "7" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "7";
      question.explanation = "Correct. You followed the explicit instruction and selected the maximum value, 7.";
      question.wrongExplanation = "This item asks for the maximum value. On a 1–7 scale, that is 7.";
      question.deepExplanation = "Why this question exists: it checks whether you follow the stated instruction rather than answering by personal opinion.\n\nEven if you personally rate the demo lower, this test item is marked correct only when you select 7.";
    }

    // Q2: Slider to 3 (middle)
    if (i === 2 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "3" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "3";
      question.explanation = "Correct. The middle of 1, 2, 3, 4, 5 is 3 because two values are below it (1, 2) and two are above it (4, 5).";
      question.wrongExplanation = "The exact middle of 1–5 is 3.";
      question.deepExplanation = "Follow-up check: if you selected 3, how many values are highlighted on this slider?\n\nAnswer: 3 values (1, 2, 3).\n\nReason: this slider highlights a contiguous range from 1 up to your selected value.";
    }

    // Q3: TRICK - NOT 5, correct is 4
    if (i === 3 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "4" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "4";
      question.trickQuestion = true;
      question.explanation = "Correct. Stopping at 4 keeps the highlighted set as 1, 2, 3, 4. This satisfies the instruction to avoid including 5.";
      question.wrongExplanation = "If you stop at 5 or higher, then 5 is highlighted too. To exclude 5, stop at 4.";
      question.deepExplanation = "Extra clarification — why 4 is the only valid stop for this rule\n\nThis slider always highlights from 1 up to your chosen number.\n\n• Choose 4 → highlights 1, 2, 3, 4 ✅\n• Choose 5 → highlights 1, 2, 3, 4, 5 ❌\n• Choose 6 → highlights 1, 2, 3, 4, 5, 6 ❌\n\nSo if 5 must stay unselected, you must stop at 4.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2: CHOICE (Questions 4-9)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q4: Single choice - "Select me" is first option
    if (i === 4 && q.type === "SINGLE_CHOICE" && opts[0]) {
      question.correctAnswer = opts[0].id;
      question.explanation = "The option 'Select me' is correct.";
      question.wrongExplanation = "The correct option clearly says 'Select me'.";
    }

    // Q5: Multi choice - both options containing "correct" (opts 0 and 1)
    if (i === 5 && q.type === "MULTI_CHOICE" && opts[0] && opts[1]) {
      question.correctAnswer = [opts[0].id, opts[1].id];
      question.explanation = "Correct options are the ones where 'correct' appears as a standalone word: 'This is correct (A)' and 'This is also correct (B)'.";
      question.wrongExplanation = "'Incorrect option' is not correct here: although it includes the same letters, it is a different single word ('incorrect'), not the standalone word 'correct'.";
    }

    // Q6: Single - "The Answer" is second option
    if (i === 6 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.explanation = "The option labeled 'The Answer' is correct.";
      question.wrongExplanation = "Look for the exact label 'The Answer' — not 'Not The Answer' or 'An Answer'.";
    }

    // Q7: TRICK - NOT a fruit = Carrot (third option)
    if (i === 7 && q.type === "SINGLE_CHOICE" && opts[2]) {
      question.correctAnswer = opts[2].id;
      question.trickQuestion = true;
      question.explanation = "🥕 Carrot is NOT a fruit — it's a vegetable! Good job catching the trick.";
      question.wrongExplanation = "The question asked what is NOT a fruit. Apples, bananas, and oranges are fruits. Carrot is a vegetable!";
    }

    // Q8: Multi - Two primary RGB colors (any 2 of first 3)
    if (i === 8 && q.type === "MULTI_CHOICE" && opts[0] && opts[1]) {
      question.correctAnswer = [opts[0].id, opts[1].id]; // Red and Green (any 2 of 3 primaries works)
      question.explanation = "In RGB, Red, Green, and Blue are primary. You needed to select any 2 of them.";
      question.wrongExplanation = "Yellow is NOT a primary in RGB (it's in CMYK). Pick from Red, Green, or Blue.";
    }

    // Q9: TRICK (but actually easy) - 2 + 2 = 4 (second option)
    if (i === 9 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.trickQuestion = true;
      question.explanation = "2 + 2 = 4. This was labeled as a trick but was actually straightforward!";
      question.wrongExplanation = "The answer is simply 4. '22' would be string concatenation in programming, not addition!";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3: RANKING (Questions 10-12)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q10: Ranking 6 items 1-6 ascending
    if (i === 10 && q.type === "RANKING") {
      question.correctAnswer = opts.map((o) => o.id);
      question.explanation = "Perfect. Ascending order from top to bottom.";
      question.wrongExplanation = "Order should be 1st → 2nd → 3rd → 4th → 5th → 6th from top to bottom.";
      question.deepExplanation = "If two neighboring rows are swapped, the order is almost correct but still not exact. Use the extra clarification panel to see how many positions were correct and which positions must be swapped.";
    }

    // Q11: Ranking A,B,C
    if (i === 11 && q.type === "RANKING") {
      question.correctAnswer = opts.map((o) => o.id);
      question.explanation = "Simple ABC order — A first, B second, C third.";
      question.wrongExplanation = "Alphabetical order: A → B → C from top to bottom.";
    }

    // Q12: TRICK - Reverse order Z,Y,X,A
    if (i === 12 && q.type === "RANKING") {
      question.correctAnswer = opts.map((o) => o.id);
      question.trickQuestion = true;
      question.explanation = "This was a reverse order trick! Z at top, A at bottom.";
      question.wrongExplanation = "The question said REVERSE order — Z should be at TOP, A at BOTTOM.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4: TEXT (Questions 13-15)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q13: Type "Hello, World!"
    if (i === 13 && q.type === "TEXT") {
      question.correctAnswer = "Hello, World!";
      question.explanation = "Perfect. Exact match: 'Hello, World!'";
      question.wrongExplanation = "Must be exactly 'Hello, World!' (capital H, capital W, comma, exclamation mark, no extra spaces).";
      question.deepExplanation = "This check is deliberately strict:\n• Case-sensitive\n• Punctuation-sensitive\n• No extra spaces\n\nOnly the exact string 'Hello, World!' is accepted.";
    }

    // Q14: Type "blue" (sky color)
    if (i === 14 && q.type === "TEXT") {
      question.correctAnswer = "blue";
      question.explanation = "The sky is blue on a clear day!";
      question.wrongExplanation = "On a clear day, the sky appears blue.";
    }

    // Q15: Type "42" (the number)
    if (i === 15 && q.type === "TEXT") {
      question.correctAnswer = "42";
      question.explanation = "42 — the answer to life, the universe, and everything!";
      question.wrongExplanation = "Forty-two in digits is 42.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5: SHAPE MATCH (Questions 16-17)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q16: Basic shapes - no correctAnswer needed, ShapeMatchQuestion handles it
    if (i === 16 && q.type === "SHAPE_MATCH") {
      question.shapeMatchPreset = "outlineMatch";
      question.explanation = "Correct. Every shape is in its matching outline.";
      question.wrongExplanation = "Drag each filled shape into the black outline with the same form.";
      question.deepExplanation = "Tip: the outlines are empty black frames. Drop each colored shape directly onto the matching frame.";
    }

    // Q17: Color match - no correctAnswer needed, ShapeMatchQuestion handles it
    if (i === 17 && q.type === "SHAPE_MATCH") {
      question.shapeMatchPreset = "colorMatch";
      question.explanation = "Correct. All shapes are in the zone of the same color.";
      question.wrongExplanation = "Focus only on color, not the target shape.";
      question.deepExplanation = "The target zones are the large colored areas. Any shape is valid if its color matches the zone color.";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6: MIXED CHALLENGE (Questions 18-21)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Q18: Slider to 8
    if (i === 18 && q.type === "SLIDER" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "8" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "8";
      question.explanation = "The correct answer is 8.";
      question.wrongExplanation = "The target is 8 on this 1-10 scale.";
    }

    // Q19: Green is success (second option)
    if (i === 19 && q.type === "SINGLE_CHOICE" && opts[1]) {
      question.correctAnswer = opts[1].id;
      question.explanation = "🟢 Green universally represents success, correctness, and approval!";
      question.wrongExplanation = "Green is the color of success. Red = error, Blue = info, Yellow = warning.";
    }

    // Q20: TRICK - Even numbers (2, 4, 6 = opts 0, 1, 3)
    if (i === 20 && q.type === "MULTI_CHOICE" && opts[0] && opts[1] && opts[3]) {
      question.correctAnswer = [opts[0].id, opts[1].id, opts[3].id];
      question.trickQuestion = true;
      question.explanation = "Even numbers: 2, 4, 6. The number 5 is odd!";
      question.wrongExplanation = "5 is odd (not divisible by 2). The even numbers are 2, 4, and 6.";
    }

    // Q21: Scale to 1 (minimum)
    if (i === 21 && q.type === "SCALE" && question.sliderConfig) {
      question.sliderConfig = { ...question.sliderConfig, correctAnswer: "1" } as unknown as PollQuestion["sliderConfig"];
      question.correctAnswer = "1";
      question.explanation = "The correct answer is 1 — the minimum value as instructed.";
      question.wrongExplanation = "The question asked for the LOWEST value, which is 1.";
    }

    return question;
  });

  // Assign questions to sections by index ranges
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
