import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';

const LOG_PREFIX = '[api/polls/export]';

// GET /api/polls/export?pollId=xxx - Export a poll as JSON for copying/editing
export async function GET(req: NextRequest) {
  try {
    const pollId = req.nextUrl.searchParams.get('pollId');
    
    if (!pollId) {
      return NextResponse.json({ error: 'Poll ID required' }, { status: 400 });
    }

    // Fetch the poll with all its questions and options
    const poll = await dbPrisma.advancedPoll.findUnique({
      where: { id: pollId },
      include: {
        Questions: {
          orderBy: { order: 'asc' },
          include: {
            Options: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    // Format the poll for export
    const exportData = {
      _exportVersion: 1,
      _exportedAt: new Date().toISOString(),
      _sourceId: poll.id,
      _note: 'VeggaStare Poll Export - Edit and import to create your own poll',
      
      // Poll metadata
      title: poll.title,
      description: poll.description,
      type: poll.type,
      requiresAuth: poll.requiresAuth,
      isAnonymous: poll.isAnonymous,
      allowPartial: poll.allowPartial,
      
      // Questions
      questions: poll.Questions.map((q, qIdx) => ({
        orderIndex: qIdx + 1,
        text: q.text,
        description: q.description,
        type: q.type,
        isRequired: q.isRequired,
        allowComments: q.allowComments,
        sliderConfig: q.sliderConfig,
        options: q.Options.map((opt, optIdx) => ({
          orderIndex: optIdx + 1,
          text: opt.text,
          value: opt.value,
          imageUrl: opt.imageUrl,
        })),
      })),
      
      // Sections (if using structured sections)
      sections: poll.Questions.reduce((acc: Array<{id: string, title: string}>, q) => {
        // Group by sliderConfig.section if available
        const sectionInfo = q.sliderConfig as Record<string, unknown> | null;
        if (sectionInfo?.sectionId && !acc.find((s) => s.id === sectionInfo.sectionId)) {
          acc.push({
            id: sectionInfo.sectionId as string,
            title: (sectionInfo.sectionTitle as string) || 'Section',
          });
        }
        return acc;
      }, []),
    };

    return NextResponse.json({
      success: true,
      poll: exportData,
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error exporting poll:', error);
    return NextResponse.json(
      { error: 'Failed to export poll' },
      { status: 500 }
    );
  }
}
