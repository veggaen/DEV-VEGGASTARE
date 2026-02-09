'use server';

import { dbPrisma } from '@/lib/db'; // Adjust the import according to your project structure
import { MyLibUserAuth } from '@/lib/user-auth';
import { JobRequest } from '@/generated/prisma/browser';

interface JobRequestData {
  descriptions: string[];
  images: string[]; // Assuming images are uploaded and URLs are stored
  links: string[];
  docs: string[];
  price: string;
  negotiable: boolean;
  paymentMethod: string;
  delivery: string;
  additionalNotes: string;
  companyIds: string[] | undefined; // Use undefined instead of null
  sendToAll: boolean;
}

const LOG_PREFIX = '[frontend/actions/job-request.ts]'

type CreateJobRequestResult = { success: true; jobRequest: JobRequest };

export async function createJobRequest(data: JobRequestData): Promise<CreateJobRequestResult> {
    // Authentication required
    const session = await MyLibUserAuth();
    if (!session?.id || !session?.email) {
      throw new Error('Unauthorized - Please log in to create a job request');
    }

    console.log('createJobRequest:', data);
  try {
    const jobRequest = await dbPrisma.jobRequest.create({
      data: {
        descriptions: data.descriptions,
        images: data.images, // Keep as array
        links: data.links,   // Keep as array
        docs: data.docs,     // Keep as array
        price: parseFloat(data.price), // Convert price to number
        negotiable: data.negotiable,
        paymentMethod: data.paymentMethod,
        delivery: data.delivery,
        additionalNotes: data.additionalNotes,
        companyIds: data.sendToAll ? [] : (data.companyIds ?? []),
        userId: session.id,
        email: session.email,
      },
    });

    console.log(LOG_PREFIX,'Job request created:', jobRequest);
    return { success: true, jobRequest };
  } catch (error) {
    console.error('Error creating job request:', error);
    throw new Error('Failed to create job request');
  }
}