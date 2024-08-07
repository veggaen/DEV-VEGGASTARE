import { dbPrisma } from '@/lib/db'; // Adjust the import according to your project structure

interface JobRequestData {
  descriptions: string[];
  images: string[]; // Assuming images are uploaded and URLs are stored
  links: string;
  docs: string | null; // Assuming docs are uploaded and URLs are stored
  price: string;
  negotiable: boolean;
  paymentMethod: string;
  delivery: string;
  additionalNotes: string;
  companyIds: string[] | undefined; // Use undefined instead of null
  sendToAll: boolean;
}

const LOG_PREFIX = '[frontend/actions/job-request.ts]'

export async function createJobRequest(data: JobRequestData) {
    console.log('createJobRequest:', data);
  try {
    const jobRequest = await dbPrisma.jobRequest.create({
      data: {
        descriptions: data.descriptions,
        images: data.images.join(','), // Store images as a comma-separated string
        links: data.links,
        docs: data.docs,
        price: parseFloat(data.price), // Convert price to number
        negotiable: data.negotiable,
        paymentMethod: data.paymentMethod,
        delivery: data.delivery,
        additionalNotes: data.additionalNotes,
        companyIds: data.sendToAll ? undefined : data.companyIds, // Handle logic for sending to all companies
      },
    });

    console.log(LOG_PREFIX,'Job request created:', jobRequest);
    return { success: true, jobRequest };
  } catch (error) {
    console.error('Error creating job request:', error);
    throw new Error('Failed to create job request');
  }
}