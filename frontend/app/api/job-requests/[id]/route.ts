import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db'; // Adjust the import according to your project structure
import { MyLibUserAuth } from '@/lib/user-auth';

const LOG_PREFIX = '[frontend/app/api/job-requests/[id]/route.ts]';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await MyLibUserAuth();
    const userId = session?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    console.log(LOG_PREFIX, 'Job request for ID: ', id);

    // Fetch the job request along with the user who created it
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

    // Fetch the companies the current user is associated with (owned, created, or employed)
    const userCompanies = await dbPrisma.company.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            employees: {
              some: { userId },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    // Extract company IDs the user is associated with
    const userCompanyIds = userCompanies.map(company => company.id);

    console.log(LOG_PREFIX, 'User Company IDs:', userCompanyIds);

    // Check if the user is authorized to view the job request
    const isAuthorized = 
      jobRequest.companyIds.length === 0 || // Public job request
      jobRequest.userId === userId || // The user is the creator of the job request
      jobRequest.companyIds.some(companyId => userCompanyIds.includes(companyId)); // The user is associated with the companies in the job request

    if (!isAuthorized) {
      console.log(LOG_PREFIX, 'User is not authorized to view this job request.');
      
      return NextResponse.json({ success: false, error: 'You are not authorized to view this job request.' }, { status: 403 });
    }

    console.log(LOG_PREFIX, 'Fetched job request:', jobRequest);
    return NextResponse.json(jobRequest);
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching job request:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}