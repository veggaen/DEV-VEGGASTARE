import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db'; // Adjust the import according to your project structure

interface JobRequestData {
  descriptions: string[];
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

export async function GET() {
  try {
    const jobRequests = await dbPrisma.jobRequest.findMany();
    console.log(LOG_PREFIX, 'Fetched job requests:', jobRequests);
    return NextResponse.json(jobRequests);
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching job requests:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}