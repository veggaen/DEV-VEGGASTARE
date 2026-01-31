import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db'; // Adjust the import according to your project structure
import { MyLibUserAuth } from '@/lib/user-auth';
import { JobRequestDtoSchema, JobRequestErrorResponseSchema } from '@/lib/types/job-requests';

const LOG_PREFIX = '[frontend/app/api/job-requests/[id]/route.ts]';
const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

function toJobRequestDto(jobRequest: {
  id: string;
  userId: string;
  title: string | null;
  descriptions: string[];
  images: string[];
  links: string[];
  docs: string[];
  price: number | null;
  negotiable: boolean | null;
  paymentMethod: string | null;
  delivery: string | null;
  additionalNotes: string | null;
  companyIds: string[];
  createdAt: Date;
  updatedAt: Date;
  User: { id: string; name: string | null; image: string | null };
}) {
  return {
    id: jobRequest.id,
    userId: jobRequest.userId,
    title: jobRequest.title ?? null,
    descriptions: jobRequest.descriptions ?? [],
    images: jobRequest.images ?? [],
    links: jobRequest.links ?? [],
    docs: jobRequest.docs ?? [],
    price: jobRequest.price ?? null,
    negotiable: jobRequest.negotiable ?? null,
    paymentMethod: jobRequest.paymentMethod ?? null,
    delivery: jobRequest.delivery ?? null,
    additionalNotes: jobRequest.additionalNotes ?? null,
    companyIds: jobRequest.companyIds ?? [],
    createdAt: toIsoString(jobRequest.createdAt),
    updatedAt: toIsoString(jobRequest.updatedAt),
    user: {
      id: jobRequest.User.id,
      name: jobRequest.User.name ?? null,
      image: jobRequest.User.image ?? null,
    },
  };
}

// Next.js 16+ params type
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await MyLibUserAuth();
    const userId = session?.id;

    if (!userId) {
      const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: 'Unauthorized' });
      return NextResponse.json(parsed.success ? parsed.data : { success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    console.log(LOG_PREFIX, 'Job request for ID: ', id);

    // Fetch the job request along with the user who created it
    const jobRequest = await dbPrisma.jobRequest.findUnique({
      where: { id },
      include: {
        User: { select: { id: true, name: true, image: true } },
      },
    });

    if (!jobRequest) {
      console.error(LOG_PREFIX, 'Job request not found:', id);
      const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: 'Job request not found' });
      return NextResponse.json(parsed.success ? parsed.data : { success: false, error: 'Job request not found' }, { status: 404 });
    }

    // Fetch the companies the current user is associated with (owned, created, or employed)
    const userCompanies = await dbPrisma.company.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            Employee: {
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
      
      const parsed = JobRequestErrorResponseSchema.safeParse({
        success: false,
        error: 'You are not authorized to view this job request.',
      });
      return NextResponse.json(
        parsed.success ? parsed.data : { success: false, error: 'You are not authorized to view this job request.' },
        { status: 403 }
      );
    }

    const dto = toJobRequestDto(jobRequest);
    const parsed = JobRequestDtoSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { success: false, error: 'Internal server error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    console.log(LOG_PREFIX, 'Fetched job request:', jobRequest.id);
    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching job request:', error);
    const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: (error as Error).message });
    return NextResponse.json(parsed.success ? parsed.data : { success: false, error: (error as Error).message }, { status: 500 });
  }
}