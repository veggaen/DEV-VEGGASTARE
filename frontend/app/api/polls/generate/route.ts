import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sanitizeApiKey, normalizeProvider } from "@/lib/ai-key-crypto";
import { MyLibUserAuth } from "@/lib/user-auth";
import { ensureUser } from "@/lib/ensure-user";
import { getUserAiKeyForGeneration, upsertUserAiKey } from "@/lib/ai-key-store";

// System prompt that instructs the AI to generate poll data in the exact format PollBuilder expects
const SYSTEM_PROMPT = `You are a rigorous, research-oriented educational quiz designer working for VeggaStare.

Generate a complete poll/quiz in JSON format.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "title": "string",
  "description": "string",
  "type": "SURVEY" | "QUIZ" | "FEEDBACK" | "SIMPLE" | "REACH_ASSESSMENT",
  "questions": [
    {
      "id": "q1",
      "type": "SINGLE_CHOICE" | "MULTI_CHOICE" | "SLIDER" | "SCALE" | "TEXT" | "RANKING" | "SHAPE_MATCH" | "UI_ARRANGE",
      "questionText": "string",
      "description": "string",
      "required": true,
      "allowImages": false,
      "options": [
        { "id": "o1", "text": "string" }
      ],
      "correctAnswer": "string or string[]",
      "explanation": "Why the answer is correct",
      "wrongExplanation": "Why an incorrect answer is wrong",
      "deepExplanation": "Second-layer clarification shown on 'Still don't understand?'"
    }
  ],
  "sections": [],
  "flow": [
    { "type": "QUESTION", "id": "q1" }
  ]
}

Rules:
- Generate unique sequential IDs: q1, q2, q3... for questions; o1, o2, o3... for options (globally unique across all questions)
- The "flow" array must list every question in order as { "type": "QUESTION", "id": "qN" }
- For SLIDER questions, add "sliderConfig": { "min": 1, "max": 7, "step": 1, "minLabel": "Low", "maxLabel": "High", "showValue": true }
- For SCALE questions, no extra config needed (defaults to 1-10)
- For TEXT questions, options should be an empty array
- For RANKING questions, provide options that the user will drag to rank
- If generating a quiz, set type to "QUIZ" and include correctAnswer for EVERY question
- For SINGLE_CHOICE: correctAnswer must be one option ID
- For MULTI_CHOICE and RANKING: correctAnswer must be an array of option IDs (ordered for RANKING)
- For TEXT / SLIDER / SCALE: correctAnswer must be a concrete string/number-like value
- For quiz questions, ALWAYS include: explanation, wrongExplanation, deepExplanation
- explanation: concise and encouraging, shown on "Why?" click
- wrongExplanation: explicitly address common mistakes
- deepExplanation: must be layered with TWO paragraphs:
  1) immediate "why" clarification
  2) deeper insight (common mistake, real-world example, or practical application), shown on "Still don't understand?"
- Keep questions clear, concise, and well-written
- Generate 5-15 questions unless the user specifies a count
- Use a variety of question types for richness unless the user specifies types
- Prefer multiple sections for longer quizzes (8+ questions)
- Every option must have a unique "id" across the entire poll
- Every fact, formula, and concept must be accurate and relevant. Prefer practical, real-world examples where possible.
- Do NOT claim perfect certainty. If topic is factual/scientific, keep wording honest and avoid overclaiming.
- Avoid ambiguous prompts with multiple valid answers unless explicitly intended. Favor single, unambiguous correctness conditions.
`;

const QUESTION_TYPES = new Set([
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "SLIDER",
  "SCALE",
  "TEXT",
  "RANKING",
  "SHAPE_MATCH",
  "UI_ARRANGE",
]);

const GenerationRequestSchema = z.object({
  prompt: z.string().min(3),
  aiAuth: z
    .object({
      mode: z.enum(["platform", "one_time", "saved"]).optional(),
      provider: z.string().optional(),
      apiKey: z.string().optional(),
      rememberKey: z.boolean().optional(),
      model: z.string().optional(),
    })
    .optional(),
});

type ResolvedAuth = {
  provider: "OPENAI" | "OPENROUTER" | "ANTHROPIC";
  apiKey: string;
  model?: string;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toId(prefix: string, index: number): string {
  return `${prefix}${index + 1}`;
}

function estimateTruthfulness(questions: any[]): {
  score: number;
  explanation: string;
  trustFactor: "Low" | "Medium" | "High";
  researchDepth: "Low" | "Medium" | "High";
  researchSummary: string;
} {
  if (!questions.length) {
    return {
      score: 45,
      explanation: "No questions were generated, so confidence is low.",
      trustFactor: "Low",
      researchDepth: "Low",
      researchSummary: "No question set was returned, so research coverage cannot be evaluated.",
    };
  }

  const withExplanation = questions.filter((q) => q.explanation).length;
  const withWrong = questions.filter((q) => q.wrongExplanation).length;
  const withDeep = questions.filter((q) => q.deepExplanation).length;
  const withCorrect = questions.filter((q) => q.correctAnswer != null).length;

  const explanationCoverage = withExplanation / questions.length;
  const wrongCoverage = withWrong / questions.length;
  const deepCoverage = withDeep / questions.length;
  const answerCoverage = withCorrect / questions.length;

  const withLayeredDeep = questions.filter((q) => {
    const deep = asString(q?.deepExplanation);
    return deep.includes("\n\n") || deep.split("\n").filter((line) => line.trim().length > 0).length >= 4;
  }).length;

  const withRealWorldSignals = questions.filter((q) => {
    const text = `${asString(q?.questionText)} ${asString(q?.description)} ${asString(q?.deepExplanation)}`.toLowerCase();
    return (
      text.includes("real-world") ||
      text.includes("example") ||
      text.includes("practical") ||
      text.includes("application") ||
      text.includes("common mistake")
    );
  }).length;

  const layeredCoverage = withLayeredDeep / questions.length;
  const realWorldCoverage = withRealWorldSignals / questions.length;

  const score = Math.max(
    35,
    Math.min(
      96,
      Math.round(
        30 +
          explanationCoverage * 20 +
          wrongCoverage * 16 +
          deepCoverage * 16 +
          answerCoverage * 20 +
          layeredCoverage * 14 +
          realWorldCoverage * 10
      )
    )
  );

  const trustFactor: "Low" | "Medium" | "High" = score >= 80 ? "High" : score >= 65 ? "Medium" : "Low";

  const researchDepth: "Low" | "Medium" | "High" =
    layeredCoverage >= 0.8 && realWorldCoverage >= 0.5
      ? "High"
      : layeredCoverage >= 0.5
      ? "Medium"
      : "Low";

  let explanation =
    `AI confidence ${score}/100. This score reflects structure quality (answer coverage + explanation depth + research signals), not guaranteed factual truth.`;

  if (score < 60) {
    explanation += " Coverage is limited, so verify critical claims manually.";
  } else if (score < 75) {
    explanation += " Decent quality, but factual claims should still be reviewed for sensitive topics.";
  } else {
    explanation += " Strong structure quality; still review time-sensitive or scientific claims.";
  }

  const researchSummary = [
    `Layered deep explanations: ${withLayeredDeep}/${questions.length}`,
    `Real-world/application signals: ${withRealWorldSignals}/${questions.length}`,
    `Answer key coverage: ${withCorrect}/${questions.length}`,
  ].join(" • ");

  return { score, explanation, trustFactor, researchDepth, researchSummary };
}

function ensureQuestionQuality(q: any, questionIndex: number, globalOptionCounterRef: { value: number }) {
  const questionId = asString(q?.id, toId("q", questionIndex));
  const type = QUESTION_TYPES.has(q?.type) ? q.type : "SINGLE_CHOICE";
  const questionText = asString(q?.questionText, `Question ${questionIndex + 1}`);
  const description = asString(q?.description, "");

  const normalizedOptions = Array.isArray(q?.options)
    ? q.options.map((opt: any, optionIndex: number) => {
        const text = asString(opt?.text, `Option ${optionIndex + 1}`);
        const id = asString(opt?.id, toId("o", globalOptionCounterRef.value++));
        return {
          id,
          text,
          ...(opt?.description ? { description: asString(opt.description) } : {}),
        };
      })
    : [];

  const optionIds = normalizedOptions.map((opt: any) => opt.id);
  let correctAnswer = q?.correctAnswer;

  if (type === "SINGLE_CHOICE") {
    if (!normalizedOptions.length) {
      normalizedOptions.push({ id: toId("o", globalOptionCounterRef.value++), text: "Option A" });
      normalizedOptions.push({ id: toId("o", globalOptionCounterRef.value++), text: "Option B" });
    }
    if (typeof correctAnswer !== "string" || !optionIds.includes(correctAnswer)) {
      correctAnswer = normalizedOptions[0]?.id;
    }
  }

  if (type === "MULTI_CHOICE" || type === "RANKING") {
    if (!Array.isArray(correctAnswer)) {
      correctAnswer = normalizedOptions.slice(0, Math.min(2, normalizedOptions.length)).map((opt: any) => opt.id);
    } else {
      correctAnswer = correctAnswer.filter((id: string) => optionIds.includes(id));
      if (!correctAnswer.length) {
        correctAnswer = normalizedOptions.slice(0, Math.min(2, normalizedOptions.length)).map((opt: any) => opt.id);
      }
    }
  }

  if ((type === "TEXT" || type === "SLIDER" || type === "SCALE") && (correctAnswer == null || correctAnswer === "")) {
    correctAnswer = type === "TEXT" ? "sample answer" : "1";
  }

  const explanation = asString(
    q?.explanation,
    `Correct. ${questionText} is answered using the expected response for this quiz item.`
  );
  const wrongExplanation = asString(
    q?.wrongExplanation,
    `Not quite. Re-read the question carefully and compare your selection to the expected rule.`
  );
  const deepExplanation = asString(
    q?.deepExplanation,
    `Still don't understand?\n\nBreak the question into parts:\n1) Identify exactly what is being asked\n2) Eliminate mismatched options\n3) Verify your final choice against the instruction.`
  );

  return {
    id: questionId,
    type,
    questionText,
    ...(description ? { description } : {}),
    required: q?.required ?? true,
    allowImages: q?.allowImages ?? false,
    options: type === "TEXT" || type === "SLIDER" || type === "SCALE" || type === "SHAPE_MATCH" ? [] : normalizedOptions,
    ...(q?.sliderConfig && { sliderConfig: q.sliderConfig }),
    ...(correctAnswer != null && { correctAnswer }),
    explanation,
    wrongExplanation,
    deepExplanation,
    ...(q?.trickQuestion ? { trickQuestion: true } : {}),
  };
}

async function resolveGenerationAuth(reqBody: z.infer<typeof GenerationRequestSchema>): Promise<ResolvedAuth> {
  const mode = reqBody.aiAuth?.mode || "platform";
  const provider = normalizeProvider(reqBody.aiAuth?.provider);
  const model = reqBody.aiAuth?.model?.trim() || undefined;

  if (mode === "one_time") {
    const oneTimeKey = sanitizeApiKey(reqBody.aiAuth?.apiKey);
    if (!oneTimeKey) {
      throw new Error("Please paste an API key for one-time generation.");
    }

    if (reqBody.aiAuth?.rememberKey) {
      const session = await MyLibUserAuth();
      if (!session?.id) {
        throw new Error("You must be signed in to save an API key.");
      }

      const ensured = await ensureUser(session);
      if (!ensured.success) {
        throw new Error("Failed to initialize your account for saving API keys.");
      }

      await upsertUserAiKey({
        userId: ensured.userId,
        provider,
        apiKey: oneTimeKey,
        setDefault: true,
      });
    }

    return { provider, apiKey: oneTimeKey, model };
  }

  if (mode === "saved") {
    const session = await MyLibUserAuth();
    if (!session?.id) {
      throw new Error("You must be signed in to use saved API keys.");
    }

    const ensured = await ensureUser(session);
    if (!ensured.success) {
      throw new Error("Failed to initialize your account.");
    }

    const saved = await getUserAiKeyForGeneration({ userId: ensured.userId, provider });
    if (!saved) {
      throw new Error("No saved API key found. Add one in Settings or use one-time mode.");
    }

    return { provider: saved.provider, apiKey: saved.apiKey, model };
  }

  const platformKey = sanitizeApiKey(process.env.OPENAI_API_KEY);
  if (!platformKey) {
    throw new Error("AI generation is not configured. Use your own API key (one-time or saved), or add OPENAI_API_KEY.");
  }

  return {
    provider: "OPENAI",
    apiKey: platformKey,
    model: process.env.OPENAI_MODEL || model || "gpt-4o-mini",
  };
}

async function callProvider(input: {
  provider: "OPENAI" | "OPENROUTER" | "ANTHROPIC";
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<string> {
  if (input.provider === "ANTHROPIC") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model || "claude-3-5-haiku-latest",
        max_tokens: 4000,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: input.prompt.trim() }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      throw new Error(`AI service error (${response.status}). Please try again.`);
    }

    const completion = await response.json();
    const content = completion?.content?.find((item: any) => item?.type === "text")?.text;
    if (!content) {
      throw new Error("No response from AI. Please try again.");
    }

    return content;
  }

  const endpoint =
    input.provider === "OPENROUTER"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

  const model =
    input.model ||
    (input.provider === "OPENROUTER" ? "openai/gpt-4o-mini" : process.env.OPENAI_MODEL || "gpt-4o-mini");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
      ...(input.provider === "OPENROUTER"
        ? {
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://veggat.com",
            "X-Title": "VeggaStare Poll Generator",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input.prompt.trim() },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`${input.provider} API error:`, response.status, errText);
    throw new Error(`AI service error (${response.status}). Please try again.`);
  }

  const completion = await response.json();
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI. Please try again.");
  }

  return content;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsedBody = GenerationRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Please provide a valid prompt for poll generation." },
        { status: 400 }
      );
    }

    const { prompt } = parsedBody.data;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return NextResponse.json(
        { error: "Please provide a description of the poll you want to generate." },
        { status: 400 }
      );
    }

    let auth: ResolvedAuth;
    try {
      auth = await resolveGenerationAuth(parsedBody.data);
    } catch (authErr: any) {
      return NextResponse.json(
        { error: authErr?.message || "Failed to resolve AI credentials." },
        { status: 400 }
      );
    }

    let content: string;
    try {
      content = await callProvider({
        provider: auth.provider,
        apiKey: auth.apiKey,
        prompt,
        model: auth.model,
      });
    } catch (providerErr: any) {
      return NextResponse.json(
        { error: providerErr?.message || "AI provider request failed." },
        { status: 502 }
      );
    }

    // Parse the JSON response
    let pollData;
    try {
      pollData = JSON.parse(content);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json(
        { error: "AI returned invalid data. Please try a different prompt." },
        { status: 422 }
      );
    }

    // Validate minimum structure
    if (!pollData.title || !Array.isArray(pollData.questions) || pollData.questions.length === 0) {
      return NextResponse.json(
        { error: "AI generated incomplete poll data. Please try a more specific prompt." },
        { status: 422 }
      );
    }

    // Ensure flow is present
    if (!pollData.flow || !Array.isArray(pollData.flow)) {
      pollData.flow = pollData.questions.map((q: any) => ({
        type: "QUESTION",
        id: q.id,
      }));
    }

    // Ensure sections array exists
    if (!pollData.sections) {
      pollData.sections = [];
    }

    // Ensure all questions have required fields and high-quality quiz explanation fields
    const optionCounterRef = { value: 0 };
    pollData.questions = pollData.questions.map((q: any, i: number) =>
      ensureQuestionQuality(q, i, optionCounterRef)
    );

    // Ensure flow contains every question in order
    pollData.flow = pollData.questions.map((q: any) => ({
      type: "QUESTION",
      id: q.id,
    }));

    // Add transparent AI quality/truthfulness note
    const truthfulness = estimateTruthfulness(pollData.questions);
    const qualityBlock = `\n\n---\nAI Verification\n- Estimated truthfulness/quality: ${truthfulness.score}/100\n- ${truthfulness.explanation}\n- For critical domains (medical/legal/financial/science), verify with trusted sources before publishing.`;
    pollData.description = `${asString(pollData.description).trim()}${qualityBlock}`.trim();

    pollData.aiGenerated = true;
    pollData.trustFactor = truthfulness.trustFactor;
    pollData.trustScore = truthfulness.score;
    pollData.researchDepth = truthfulness.researchDepth;
    pollData.researchSummary = truthfulness.researchSummary;

    return NextResponse.json({
      ...pollData,
      _meta: {
        aiGenerated: true,
        trustFactor: truthfulness.trustFactor,
        trustScore: truthfulness.score,
        researchDepth: truthfulness.researchDepth,
        researchSummary: truthfulness.researchSummary,
        provider: auth.provider,
        mode: parsedBody.data.aiAuth?.mode || "platform",
      },
    });
  } catch (err: any) {
    console.error("Poll generate error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
