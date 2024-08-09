import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db'; // Adjust the import according to your project structure

const LOG_PREFIX = '[frontend/app/api/job-requests/[id]/route.ts]';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
      const { id } = params;
      console.log(LOG_PREFIX, 'Jobrequest for ID: ', id)

    const jobRequest = await dbPrisma.jobRequest.findUnique({
      where: { id },
      include: {
        user: true, // Include the user who created the job request
      },
    });

    if (!jobRequest) {
      console.error(LOG_PREFIX, 'Job request not found:', id);
      return NextResponse.json({ success: false, error: 'Job request not found' }, { status: 404 });
    }

    console.log(LOG_PREFIX, 'Fetched job request:', jobRequest);
    return NextResponse.json(jobRequest);
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching job request:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}