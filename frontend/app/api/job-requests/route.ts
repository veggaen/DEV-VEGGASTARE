import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db'; // Adjust the import according to your project structure
import { MyLibUserAuth } from '@/lib/user-auth';

interface JobRequestData {
  descriptions: string[];
  title?: string;
  images: string[];
  links: string[];
  docs: string[];
  price?: string; // Optional
  negotiable?: boolean; // Optional
  paymentMethod?: string; // Optional
  delivery?: string; // Optional
  additionalNotes?: string; // Optional
  companyIds?: string[]; // Optional
  sendToAll: boolean;
  userId: string;
}

const LOG_PREFIX = '[frontend/app/api/job-requests/route.ts]';

export async function POST(req: NextRequest) {
  try {
    const data: JobRequestData = await req.json();
    console.log(LOG_PREFIX, 'Received job request data:', data);

    // Validate userId
    console.log('Start validation of user by ID: ', data.userId);
    const user = await dbPrisma.user.findUnique({
      where: { id: data.userId },
      
    });

    if (!user) {
      console.error(LOG_PREFIX, 'Invalid userId:', data.userId);
      return NextResponse.json({ success: false, error: 'Invalid userId' }, { status: 400 });
    }
    if (user) {
        console.log(LOG_PREFIX, 'User is valid:', user.id);
    }

    const jobRequest = await dbPrisma.jobRequest.create({
      data: {
        title: data.title ? data.title : null,
        descriptions: data.descriptions, // Use descriptions as an array
        images: data.images, // Store images as an array
        links: data.links.filter(link => link.trim() !== ''), // Filter out empty links
        docs: data.docs.filter(doc => doc.trim() !== ''), // Filter out empty docs
        price: data.price ? parseFloat(data.price) : null, // Convert price to number if provided, else set to null
        negotiable: data.negotiable ?? null, // Set to null if not provided
        paymentMethod: data.paymentMethod ?? null, // Set to null if not provided
        delivery: data.delivery ?? null, // Set to null if not provided
        additionalNotes: data.additionalNotes ?? null, // Set to null if not provided
        companyIds: data.sendToAll ? [] : data.companyIds,
        userId: user.id,
      },
    });

    console.log(LOG_PREFIX, 'Job request created:', jobRequest);
    return NextResponse.json({ success: true, jobRequest });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating job request:', (error as Error).message);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await MyLibUserAuth();
    const userId = session?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the user's companies
    const user = await dbPrisma.user.findUnique({
      where: { id: userId },
      include: {
        Employee: { include: { company: true } },
        ownedCompanies: true,
        createdCompanies: true,
      },
    });

    // Extract all associated company IDs
    const userCompanyIds = [
      ...user?.Employee.map(emp => emp.companyId) || [],
      ...user?.ownedCompanies.map(company => company.id) || [],
      ...user?.createdCompanies.map(company => company.id) || [],
    ];

    // Fetch job requests
    const jobRequests = await dbPrisma.jobRequest.findMany({
      include: {
        user: true, // Include the user who created the job request
      },
    });

    // Filter job requests based on the logic:
    // 1. Job request is visible to everyone if companyIds is empty.
    // 2. Job request is visible to the creator or employees of the companies in companyIds.
    const filteredJobRequests = jobRequests.filter(jobRequest => {
      return (
        jobRequest.companyIds.length === 0 || // Visible to everyone
        jobRequest.userId === userId || // Visible to the creator
        jobRequest.companyIds.some(companyId => userCompanyIds.includes(companyId)) // Visible to employees of the specified companies
      );
    });

    return NextResponse.json(filteredJobRequests);
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching job requests:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}