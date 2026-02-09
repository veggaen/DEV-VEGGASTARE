import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { z } from 'zod';
import { PollQuestionType } from '@/generated/prisma/browser';

const LOG_PREFIX = '[api/polls/import]';

// Schema for validating imported poll data
const ImportedOptionSchema = z.object({
  orderIndex: z.number().optional(),
  text: z.string().min(1, 'Option text is required'),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  value: z.number().optional().nullable(),
  isDefault: z.boolean().optional(),
});

const ImportedQuestionSchema = z.object({
  orderIndex: z.number().optional(),
  text: z.string().min(1, 'Question text is required'),
  description: z.string().optional().nullable(),
  type: z.enum(['SINGLE_CHOICE', 'MULTI_CHOICE', 'TEXT', 'SLIDER', 'SCALE', 'RANKING']),
  isRequired: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  sliderConfig: z.any().optional().nullable(),
  options: z.array(ImportedOptionSchema).optional(),
});

const ImportedPollSchema = z.object({
  _exportVersion: z.number().optional(),
  _exportedAt: z.string().optional(),
  _sourceId: z.string().optional(),
  _note: z.string().optional(),
  
  title: z.string().min(1, 'Poll title is required'),
  description: z.string().optional().nullable(),
  type: z.string().optional(),
  requiresAuth: z.boolean().optional(),
  isAnonymous: z.boolean().optional(),
  allowPartial: z.boolean().optional(),
  
  questions: z.array(ImportedQuestionSchema).min(1, 'At least one question is required'),
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
  })).optional(),
});

// Map imported type to valid PollQuestionType
function mapToPollQuestionType(type: string): PollQuestionType {
  const map: Record<string, PollQuestionType> = {
    'SINGLE_CHOICE': PollQuestionType.SINGLE_CHOICE,
    'MULTI_CHOICE': PollQuestionType.MULTI_CHOICE,
    'TEXT': PollQuestionType.TEXT,
    'SLIDER': PollQuestionType.SLIDER,
    'SCALE': PollQuestionType.SCALE,
    'RANKING': PollQuestionType.SCALE, // Map RANKING to SCALE
    'choice': PollQuestionType.SINGLE_CHOICE,
    'multi-choice': PollQuestionType.MULTI_CHOICE,
    'text': PollQuestionType.TEXT,
    'slider': PollQuestionType.SLIDER,
    'scale': PollQuestionType.SCALE,
    'ranking': PollQuestionType.SCALE,
  };
  return map[type] || PollQuestionType.TEXT;
}

// POST /api/polls/import - Validate and create a poll from JSON
export async function POST(req: NextRequest) {
  try {
    const currentUser = await MyLibUserAuth();
    if (!currentUser?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { pollData, draft = false, pulseOptions } = body;

    // Validate the imported data
    const parseResult = ImportedPollSchema.safeParse(pollData);
    if (!parseResult.success) {
      return NextResponse.json({
        error: 'Invalid poll data',
        issues: parseResult.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      }, { status: 400 });
    }

    const data = parseResult.data;

    // Create the poll using a transaction
    const poll = await dbPrisma.$transaction(async (tx) => {
      // Create the poll
      const newPoll = await tx.advancedPoll.create({
        data: {
          title: data.title,
          description: data.description || null,
          type: 'SURVEY',
          Creator: { connect: { id: currentUser.id } },
          requiresAuth: data.requiresAuth ?? false,
          isAnonymous: data.isAnonymous ?? false,
          allowPartial: data.allowPartial ?? true,
          publishedAt: draft ? null : new Date(),
        },
      });

      // Create questions with options
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        
        const question = await tx.pollQuestion.create({
          data: {
            advancedPollId: newPoll.id,
            text: q.text,
            description: q.description || null,
            type: mapToPollQuestionType(q.type),
            order: q.orderIndex || i + 1,
            isRequired: q.isRequired ?? true,
            allowComments: q.allowComments ?? false,
            sliderConfig: q.sliderConfig || null,
          },
        });

        // Create options if the question type supports them
        if (q.options && q.options.length > 0) {
          await tx.pollQuestionOption.createMany({
            data: q.options.map((opt, optIdx) => ({
              questionId: question.id,
              text: opt.text,
              value: opt.value ?? null,
              order: opt.orderIndex || optIdx + 1,
              imageUrl: opt.imageUrl || null,
            })),
          });
        }
      }

      return newPoll;
    });

    // Optionally create a pulse with this poll
    let pulseId = null;
    if (pulseOptions?.createPulse) {
      const pulse = await dbPrisma.conversation.create({
        data: {
          userId: currentUser.id,
          title: pulseOptions.pulseTitle || data.title,
          type: 'PUBLIC_THREAD',
          visibility: 'PUBLIC',
          tags: pulseOptions.tags || ['poll', 'community'],
          replyPermission: 'EVERYONE',
          AdvancedPoll: {
            connect: { id: poll.id }
          }
        },
      });

      // Update poll with conversationId
      await dbPrisma.advancedPoll.update({
        where: { id: poll.id },
        data: { conversationId: pulse.id }
      });

      // Create initial message
      if (pulseOptions.pulseMessage) {
        await dbPrisma.message.create({
          data: {
            conversationId: pulse.id,
            senderId: currentUser.id,
            content: pulseOptions.pulseMessage,
          },
        });
      }

      pulseId = pulse.id;
    }

    return NextResponse.json({
      success: true,
      poll: {
        id: poll.id,
        title: poll.title,
        questionCount: data.questions.length,
        isDraft: draft,
      },
      pulseId,
    }, { status: 201 });

  } catch (error) {
    console.error(LOG_PREFIX, 'Error importing poll:', error);
    return NextResponse.json(
      { error: 'Failed to import poll' },
      { status: 500 }
    );
  }
}

// GET /api/polls/import/validate - Validate poll JSON without creating
export async function GET(req: NextRequest) {
  try {
    const jsonParam = req.nextUrl.searchParams.get('json');
    
    if (!jsonParam) {
      return NextResponse.json({ error: 'JSON parameter required' }, { status: 400 });
    }

    let pollData;
    try {
      pollData = JSON.parse(decodeURIComponent(jsonParam));
    } catch {
      return NextResponse.json({
        valid: false,
        error: 'Invalid JSON format',
      });
    }

    const parseResult = ImportedPollSchema.safeParse(pollData);
    
    return NextResponse.json({
      valid: parseResult.success,
      issues: parseResult.success ? [] : parseResult.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
      summary: parseResult.success ? {
        title: parseResult.data.title,
        questionCount: parseResult.data.questions.length,
        hasDescription: !!parseResult.data.description,
      } : null,
    });

  } catch (error) {
    console.error(LOG_PREFIX, 'Error validating poll:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
