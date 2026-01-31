import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db'; // Adjust the import according to your project structure
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { z } from 'zod';
import {
  JobRequestCreateResponseSchema,
  JobRequestDtoSchema,
  JobRequestErrorResponseSchema,
  JobRequestsListResponseSchema,
} from '@/lib/types/job-requests';

const LOG_PREFIX = '[frontend/app/api/job-requests/route.ts]';
const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

const createJobRequestSchema = z.object({
  descriptions: z.array(z.string().trim().min(1).max(1000)).min(1).max(50),
  title: z.string().trim().max(200).nullish(),
  images: z.array(z.string().trim().max(2048)).max(50).default([]),
  links: z.array(z.string().trim().max(2048)).max(50).default([]),
  docs: z.array(z.string().trim().max(2048)).max(50).default([]),
  price: z.string().trim().max(50).nullish(),
  negotiable: z.boolean().nullish(),
  paymentMethod: z.string().trim().max(200).nullish(),
  delivery: z.string().trim().max(200).nullish(),
  additionalNotes: z.string().trim().max(2000).nullish(),
  companyIds: z.array(z.string().trim().min(1).max(200)).max(200).default([]),
  sendToAll: z.boolean(),
  userId: z.string().trim().min(1).max(200),
});

type JobRequestData = z.infer<typeof createJobRequestSchema>;

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

export async function POST(req: NextRequest) {
  try {
    const session = await MyLibUserAuth();
    if (!session?.id) {
      const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: 'Unauthorized' });
      return NextResponse.json(parsed.success ? parsed.data : { success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const bodyResult = await parseJsonOrError(req, createJobRequestSchema);
    if (!bodyResult.ok) return bodyResult.response;

    const data = bodyResult.data;

    const isAdmin = session.role === 'ADMIN' || session.role === 'OWNER';
    if (!isAdmin && data.userId !== session.id) {
      const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: 'Forbidden' });
      return NextResponse.json(parsed.success ? parsed.data : { success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Validate userId
    const user = await dbPrisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      console.error(LOG_PREFIX, 'Invalid userId:', data.userId);
      const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: 'Invalid userId' });
      return NextResponse.json(parsed.success ? parsed.data : { success: false, error: 'Invalid userId' }, { status: 400 });
    }
    if (!user.email) {
      const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: 'Invalid userId' });
      return NextResponse.json(parsed.success ? parsed.data : { success: false, error: 'Invalid userId' }, { status: 400 });
    }

    const jobRequest = await dbPrisma.jobRequest.create({
      data: {
        title: data.title ? data.title : null,
        descriptions: data.descriptions, // Use descriptions as an array
        images: data.images ?? [], // Store images as an array
        links: (data.links ?? []).filter(link => link.trim() !== ''), // Filter out empty links
        docs: (data.docs ?? []).filter(doc => doc.trim() !== ''), // Filter out empty docs
        price: data.price ? parseFloat(data.price) : null, // Convert price to number if provided, else set to null
        negotiable: data.negotiable ?? null, // Set to null if not provided
        paymentMethod: data.paymentMethod ?? null, // Set to null if not provided
        delivery: data.delivery ?? null, // Set to null if not provided
        additionalNotes: data.additionalNotes ?? null, // Set to null if not provided
        companyIds: data.sendToAll ? [] : (data.companyIds ?? []),
        userId: user.id,
        email: user.email
      },
      include: {
        User: { select: { id: true, name: true, image: true } },
      },
    });

    const dto = toJobRequestDto(jobRequest);
    const parsedDto = JobRequestDtoSchema.safeParse(dto);
    if (!parsedDto.success) {
      console.error(LOG_PREFIX, 'Invalid POST jobRequest DTO:', parsedDto.error);
      return NextResponse.json(
        { success: false, error: 'Internal server error', ...(isDev ? { issues: parsedDto.error.issues } : {}) },
        { status: 500 }
      );
    }

    const parsedResponse = JobRequestCreateResponseSchema.safeParse({ success: true, jobRequest: parsedDto.data });
    if (!parsedResponse.success) {
      console.error(LOG_PREFIX, 'Invalid POST response DTO:', parsedResponse.error);
      return NextResponse.json(
        { success: false, error: 'Internal server error', ...(isDev ? { issues: parsedResponse.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedResponse.data);
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating job request:', (error as Error).message);
    const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: (error as Error).message });
    return NextResponse.json(parsed.success ? parsed.data : { success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await MyLibUserAuth();
    const userId = session?.id;

    if (!userId) {
      const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: 'Unauthorized' });
      return NextResponse.json(parsed.success ? parsed.data : { success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the user's companies
    const user = await dbPrisma.user.findUnique({
      where: { id: userId },
      include: {
        Employee: { include: { Company: true } },
        Company_Company_ownerIdToUser: true,
        Company_Company_creatorIdToUser: true,
      },
    });

    // Extract all associated company IDs
    const userCompanyIds = [
      ...user?.Employee.map(emp => emp.companyId) || [],
      ...user?.Company_Company_ownerIdToUser.map(company => company.id) || [],
      ...user?.Company_Company_creatorIdToUser.map(company => company.id) || [],
    ];

    // Fetch job requests
    const jobRequests = await dbPrisma.jobRequest.findMany({
      include: {
        User: { select: { id: true, name: true, image: true } }, // Include only safe user summary
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

    const dto = filteredJobRequests.map(toJobRequestDto);
    const parsed = JobRequestsListResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { success: false, error: 'Internal server error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching job requests:', error);
    const parsed = JobRequestErrorResponseSchema.safeParse({ success: false, error: (error as Error).message });
    return NextResponse.json(parsed.success ? parsed.data : { success: false, error: (error as Error).message }, { status: 500 });
  }
}