import { NextRequest, NextResponse } from "next/server";

// System prompt that instructs the AI to generate poll data in the exact format PollBuilder expects
const SYSTEM_PROMPT = `You are a poll/quiz generator. Given a user's description, generate a complete poll in JSON format.

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
      "required": true,
      "allowImages": false,
      "options": [
        { "id": "o1", "text": "string" }
      ]
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
- If the user asks for a quiz, set type to "QUIZ" and add "correctAnswer" to each question (the option ID that is correct for SINGLE_CHOICE, or comma-separated IDs for MULTI_CHOICE)
- For quiz questions, optionally add "explanation": "Why this is correct..." 
- Keep questions clear, concise, and well-written
- Generate 5-15 questions unless the user specifies a count
- Use a variety of question types for richness unless the user specifies types
- sections should be an empty array unless the user explicitly asks for sections/categories
- Every option must have a unique "id" across the entire poll
`;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return NextResponse.json(
        { error: "Please provide a description of the poll you want to generate." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI generation is not configured. Please add OPENAI_API_KEY to your environment variables." },
        { status: 503 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt.trim() },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error:", response.status, errText);
      return NextResponse.json(
        { error: `AI service error (${response.status}). Please try again.` },
        { status: 502 }
      );
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from AI. Please try again." },
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

    // Ensure all questions have required fields
    pollData.questions = pollData.questions.map((q: any) => ({
      id: q.id,
      type: q.type || "SINGLE_CHOICE",
      questionText: q.questionText || "",
      required: q.required ?? true,
      allowImages: q.allowImages ?? false,
      options: q.options || [],
      ...(q.sliderConfig && { sliderConfig: q.sliderConfig }),
      ...(q.correctAnswer && { correctAnswer: q.correctAnswer }),
      ...(q.explanation && { explanation: q.explanation }),
    }));

    return NextResponse.json(pollData);
  } catch (err: any) {
    console.error("Poll generate error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
