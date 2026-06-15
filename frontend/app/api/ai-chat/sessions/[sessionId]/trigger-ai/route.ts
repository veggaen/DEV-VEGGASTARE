import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { getUserAiKeyForGeneration } from "@/lib/ai-key-store";
import { buildAiParticipantSystemPrompt, buildGeminiContents, stripHtml } from "@/lib/ai-chat/safety";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const schema = z.object({
  participantId: z.string().cuid(),
});

/**
 * POST /api/ai-chat/sessions/[sessionId]/trigger-ai
 * Manually trigger a specific BYOK AI participant to respond.
 * Only the human who "owns" the BYOK AI (byokUserId === session.userId) can trigger it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  // Load conversation + target AI participant
  const conv = await dbPrisma.aiConversation.findUnique({
    where: { id: sessionId },
    include: {
      participants: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 40,
        select: {
          role: true,
          content: true,
          participant: { select: { displayName: true, type: true } },
        },
      },
    },
  });

  if (!conv) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (conv.isDeleted) return NextResponse.json({ error: "DELETED" }, { status: 410 });
  if (conv.isSuspended) return NextResponse.json({ error: "SUSPENDED" }, { status: 403 });

  // Find the target AI participant
  const aiParticipant = conv.participants.find(
    (p) => p.id === body.participantId && (p.type === "AI_BYOK" || p.type === "AI_PLATFORM")
  );

  if (!aiParticipant) {
    return NextResponse.json({ error: "PARTICIPANT_NOT_FOUND" }, { status: 404 });
  }

  // Auth check: only the BYOK key owner or conversation creator can trigger this AI
  const isByokOwner = aiParticipant.byokUserId === session.id;
  const isConvCreator = conv.creatorId === session.id;
  if (!isByokOwner && !isConvCreator) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Get API key
  let apiKey: string;
  let provider = aiParticipant.aiProvider ?? "GOOGLE";
  const model = aiParticipant.aiModel ?? "gemini-1.5-flash";

  if (aiParticipant.type === "AI_BYOK" && aiParticipant.byokUserId) {
    const keyResult = await getUserAiKeyForGeneration({
      userId: aiParticipant.byokUserId,
      provider: provider,
    });
    if (!keyResult?.apiKey) {
      return NextResponse.json({ error: "BYOK_KEY_NOT_FOUND" }, { status: 400 });
    }
    apiKey = keyResult.apiKey;
  } else {
    apiKey = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_AI_API_KEY ?? "";
    if (!apiKey) return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  }

  // Build system prompt based on AI participant settings
  const systemPrompt = buildAiParticipantSystemPrompt({
    displayName: aiParticipant.displayName ?? "AI Assistant",
    mode: (aiParticipant.responseMode as "CONTEXT_ONLY" | "DEEP_ANALYSIS") ?? "CONTEXT_ONLY",
    brief: aiParticipant.responseBrief ?? false,
  });

  // Build conversation history for context
  const contents = buildGeminiContents(
    conv.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))
  );

  // Call Gemini (or extend for other providers based on aiParticipant.aiProvider)
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const upstream = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
    }),
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "AI_UPSTREAM_ERROR", status: upstream.status }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const parsed = JSON.parse(raw);
              const text: string = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: stripHtml(text), participantId: aiParticipant.id })}\n\n`)
                );
              }
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch { /* stream error */ } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Participant-Id": aiParticipant.id,
      "X-Participant-Name": aiParticipant.displayName ?? "AI",
    },
  });
}
