/**
 * POST /api/polls/verify-answer
 *
 * Lightweight AI fallback for TEXT quiz answers.
 * When fuzzy-text-match rejects an answer, call this endpoint to get
 * a second opinion from Groq using GPT-OSS 20B.
 *
 * Body: { userAnswer: string; correctAnswer: string; questionText?: string }
 * Returns: { isCorrect: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { generateMeteredText, aiErrorResponse } from "@/lib/ai-chat/generation";
import { guardAiRequest, readAiJson } from "@/lib/ai-chat/request";
export const maxDuration = 60;

const VerifyAnswerSchema = z.object({
  userAnswer: z.string().min(1).max(1000),
  correctAnswer: z.string().min(1).max(1000),
  questionText: z.string().max(2000).optional(),
});



export async function POST(req: NextRequest) {
  try {
    const user = await MyLibUserAuth();
    await guardAiRequest(req, user?.id);
    const json = await readAiJson(req);
    const parsed = VerifyAnswerSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ isCorrect: false, error: "Invalid payload" }, { status: 400 });
    }
    const { userAnswer, correctAnswer, questionText } = parsed.data;

    const contextLine = questionText
      ? `\nThe quiz question was: "${questionText}"`
      : "";

    const prompt = `You are a quiz answer checker. Be strict but fair.${contextLine}
The correct answer is: "${correctAnswer}"
The student typed: "${userAnswer}"

Considering common typos, abbreviations, synonyms, and partial answers — does the student's answer demonstrate they know the correct answer?

Rules:
- Accept minor typos and spelling errors (e.g. "algea" for "algae")
- Accept partial answers that contain the key concept (e.g. "algae" for "algae oil")
- Accept common synonyms (e.g. "algal oil" for "algae oil")
- Reject completely different answers (e.g. "fish oil" for "algae oil")
- Reject vague/generic answers that don't show specific knowledge

Reply with ONLY the word YES or NO.`;

    const reply = (await generateMeteredText({ request: req, userId: user?.id, provider: "GROQ", model: "openai/gpt-oss-20b",
      useSavedKey: false, messages: [{ role: "user", content: prompt }], systemPrompt: "Check the quiz answer. Output YES or NO only.",
    })).trim().toUpperCase();
    const isCorrect = reply === "YES";

    return NextResponse.json({ isCorrect });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
