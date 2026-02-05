import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import crypto from 'crypto';
import { z } from 'zod';

const LOG_PREFIX = '[api/reach-feedback]';

// Schema for REACH feedback submission
const ReachFeedbackSchema = z.object({
  answers: z.record(z.string(), z.any()),
  completionPct: z.number().min(0).max(100),
  voteWeight: z.number().min(0).max(100),
  phaseCompletion: z.record(z.string(), z.number()).optional(),
  totalTime: z.number().optional(), // Time spent in ms
});

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.AUTH_SECRET || 'fallback')).digest('hex').slice(0, 16);
}

// POST /api/reach-feedback - Submit REACH algorithm feedback
export async function POST(req: NextRequest) {
  try {
    const currentUser = await MyLibUserAuth();
    const body = await req.json();
    
    const parsed = ReachFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request data', errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { answers, completionPct, voteWeight, phaseCompletion, totalTime } = parsed.data;

    // Get IP hash for anonymous tracking
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';
    const ipHash = hashIp(ip);
    const userAgent = req.headers.get('user-agent') || null;

    // Check for existing feedback from this user
    if (currentUser?.id) {
      const existing = await dbPrisma.reachFeedback.findUnique({
        where: { userId: currentUser.id },
      });

      if (existing) {
        // Track what changed for "why did you change your mind" feature
        const previousAnswers = existing.answers as Record<string, any> || {};
        const changedAnswers: Record<string, { previous: any; current: any }> = {};
        
        for (const [key, value] of Object.entries(answers)) {
          if (previousAnswers[key] !== undefined && 
              JSON.stringify(previousAnswers[key]) !== JSON.stringify(value)) {
            changedAnswers[key] = {
              previous: previousAnswers[key],
              current: value,
            };
          }
        }

        // Update existing feedback
        const updated = await dbPrisma.reachFeedback.update({
          where: { id: existing.id },
          data: {
            answers,
            completionPct,
            voteWeight,
            phaseCompletion: phaseCompletion || {},
            totalTime,
            changedAnswers: Object.keys(changedAnswers).length > 0 ? changedAnswers : undefined,
            submissionCount: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          feedbackId: updated.id,
          message: 'Feedback updated successfully',
          changedCount: Object.keys(changedAnswers).length,
        });
      }
    }

    // Create new feedback
    const feedback = await dbPrisma.reachFeedback.create({
      data: {
        userId: currentUser?.id || null,
        sessionId: crypto.randomUUID(),
        answers,
        completionPct,
        voteWeight,
        phaseCompletion: phaseCompletion || {},
        totalTime,
        ipHash,
        userAgent,
        submissionCount: 1,
      },
    });

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
      message: 'Feedback submitted successfully',
    }, { status: 201 });

  } catch (error) {
    console.error(LOG_PREFIX, 'Error:', error);
    return NextResponse.json(
      { message: 'Error submitting feedback' },
      { status: 500 }
    );
  }
}

// GET /api/reach-feedback - Get user's previous feedback (for resume)
export async function GET(req: NextRequest) {
  try {
    const currentUser = await MyLibUserAuth();
    
    if (!currentUser?.id) {
      return NextResponse.json({ feedback: null });
    }

    const feedback = await dbPrisma.reachFeedback.findUnique({
      where: { userId: currentUser.id },
      select: {
        id: true,
        answers: true,
        completionPct: true,
        voteWeight: true,
        phaseCompletion: true,
        submissionCount: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error:', error);
    return NextResponse.json({ feedback: null });
  }
}
