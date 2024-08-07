import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db'; // Adjust the import according to your project structure

interface JobRequestData {
  descriptions: string[];
  images: string[];
  links: string[];
  docs: string[];
  price: string;
  negotiable: boolean;
  paymentMethod: string;
  delivery: string;
  additionalNotes: string;
  companyIds: string[] | undefined;
  sendToAll: boolean;
  userId: string;
}

const LOG_PREFIX = '[frontend/app/api/job-requests/route.ts]';

export async function POST(req: NextRequest) {
  try {
    const data: JobRequestData = await req.json();
    console.log(LOG_PREFIX, 'createJobRequest:', data);

    const jobRequest = await dbPrisma.jobRequest.create({
      data: {
        descriptions: data.descriptions, // Use descriptions as an array
        images: data.images, // Store images as an array
        links: data.links,
        docs: data.docs,
        price: parseFloat(data.price), // Convert price to number
        negotiable: data.negotiable,
        paymentMethod: data.paymentMethod,
        delivery: data.delivery,
        additionalNotes: data.additionalNotes,
        companyIds: data.sendToAll ? [] : data.companyIds,
        userId: data.userId,
      },
    });

    console.log(LOG_PREFIX, 'Job request created:', jobRequest);
    return NextResponse.json({ success: true, jobRequest });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating job request:', error);
    return new NextResponse('Failed to create job request', { status: 500 });
  }
}

export async function GET() {
    try {
      const jobRequests = await dbPrisma.jobRequest.findMany();
      console.log(LOG_PREFIX, 'Fetched job requests:', jobRequests);
      return NextResponse.json(jobRequests);
    } catch (error) {
      console.error(LOG_PREFIX, 'Error fetching job requests:', error);
      return NextResponse.error();
    }
}