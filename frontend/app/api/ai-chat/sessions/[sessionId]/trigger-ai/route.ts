/** @fileOverview Metered participant replies; only the key owner can spend BYOK. @stability experimental */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { dbPrisma } from '@/lib/db';
import { getUserAiKeyForGeneration } from '@/lib/ai-key-store';
import { buildAiParticipantSystemPrompt } from '@/lib/ai-chat/safety';
import { generateMeteredStream, aiErrorResponse } from '@/lib/ai-chat/generation';
import { guardAiRequest, readAiJson } from '@/lib/ai-chat/request';
import { AiCreditError } from '@/lib/ai-credit-ledger';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
const schema = z.object({ participantId: z.string().cuid(), requestId: z.string().uuid().optional() });
const providerSchema = z.enum(['GOOGLE','OPENAI','GROQ','GROK','ANTHROPIC','VERCEL','OPENROUTER']);

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await MyLibUserAuth();
    if (!user?.id) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    await guardAiRequest(request, user.id);
    const body = schema.parse(await readAiJson(request));
    const { sessionId } = await params;
    const conv = await dbPrisma.aiConversation.findUnique({ where: { id: sessionId }, include: {
      participants: true, messages: { orderBy: { createdAt: 'desc' }, take: 20, select: { role: true, content: true } },
    } });
    if (!conv || conv.isDeleted || conv.isSuspended) throw new AiCreditError('CONVERSATION_UNAVAILABLE', 403);
    const participant = conv.participants.find(p => p.id === body.participantId && p.isActive && (p.type === 'AI_BYOK' || p.type === 'AI_PLATFORM'));
    if (!participant) throw new AiCreditError('PARTICIPANT_NOT_FOUND', 404);
    const member = conv.creatorId === user.id || conv.participants.some(p => p.userId === user.id && p.isActive);
    if (!member) throw new AiCreditError('FORBIDDEN', 403);
    const provider = providerSchema.parse(participant.aiProvider ?? 'GOOGLE');
    let key: { apiKey: string } | undefined;
    if (participant.type === 'AI_BYOK') {
      // Owning the conversation does not grant access to another person's key.
      if (participant.byokUserId !== user.id) throw new AiCreditError('FORBIDDEN', 403);
      const saved = await getUserAiKeyForGeneration({ userId: user.id, provider });
      if (!saved?.apiKey || saved.provider !== provider) throw new AiCreditError('BYOK_KEY_NOT_FOUND', 404);
      key = { apiKey: saved.apiKey };
    } else if (conv.creatorId !== user.id) throw new AiCreditError('FORBIDDEN', 403);
    const messages = conv.messages.reverse().filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 4000) }));
    if (!messages.length) throw new AiCreditError('INVALID_REQUEST', 400);
    const response = await generateMeteredStream({ request, userId: user.id, requestId: body.requestId, provider,
      model: participant.aiModel ?? undefined, messages, key, useSavedKey: false,
      systemPrompt: buildAiParticipantSystemPrompt({ displayName: participant.displayName ?? 'AI assistant',
        mode: participant.responseMode, brief: participant.responseBrief }),
      beforeComplete: async content => {
        await dbPrisma.$transaction([
          dbPrisma.aiConvMessage.create({ data: { conversationId: conv.id, participantId: participant.id,
            content, role: 'assistant', senderType: participant.type, modelUsed: participant.aiModel,
            providerUsed: provider, sensitiveTypes: [] } }),
          dbPrisma.aiConversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } }),
        ]);
      },
    });
    const headers = new Headers(response.headers); headers.set('X-Participant-Id', participant.id);
    return new Response(response.body, { status: response.status, headers });
  } catch (error) { return aiErrorResponse(error); }
}
