/**
 * POST /api/polls/verify-answer
 *
 * Lightweight AI fallback for TEXT quiz answers.
 * When fuzzy-text-match rejects an answer, call this endpoint to get
 * a second opinion from Groq (free tier, Llama 3.3 70B, ~200ms).
 *
 * Body: { userAnswer: string; correctAnswer: string; questionText?: string }
 * Returns: { isCorrect: boolean }
 */

import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userAnswer, correctAnswer, questionText } = body as {
      userAnswer?: string;
      correctAnswer?: string;
      questionText?: string;
    };

    if (!userAnswer || !correctAnswer) {
      return NextResponse.json({ isCorrect: false, error: "Missing fields" }, { status: 400 });
    }

    if (!GROQ_API_KEY) {
      // No API key configured — fail closed (fuzzy result stands)
      return NextResponse.json({ isCorrect: false, error: "AI not configured" }, { status: 200 });
    }

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

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 4,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ isCorrect: false, error: "AI provider error" }, { status: 200 });
    }

    const data = await res.json();
    const reply = (data.choices?.[0]?.message?.content ?? "").trim().toUpperCase();
    const isCorrect = reply.startsWith("YES");

    return NextResponse.json({ isCorrect });
  } catch {
    return NextResponse.json({ isCorrect: false, error: "Internal error" }, { status: 200 });
  }
}
