// frontend/app/api/companies/create/route.ts

import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { CompanyCreateResponseSchema } from '@/lib/types/company';

const isDev = process.env.NODE_ENV !== 'production';

const createCompanySchema = z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    websiteUrl: z.string().trim().max(2048).optional().nullable(),
    logo: z.array(z.string().trim().max(2048)).max(20).optional().default([]),
    bannerImage: z.array(z.string().trim().max(2048)).max(20).optional().default([]),
    colorScheme: z.string().trim().max(100).optional().nullable(),
    usesShipping: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
    const session = await MyLibUserAuth();
    if (!session?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const bodyResult = await parseJsonOrError(req, createCompanySchema);
        if (!bodyResult.ok) return bodyResult.response;

        const data = bodyResult.data;

        const newCompany = await dbPrisma.company.create({
            data: {
                ...data,
                creatorId: session.id,
                ownerId: session.id,
            },
        });

        const dto = {
            id: String(newCompany.id),
            name: String(newCompany.name),
            description: newCompany.description ?? null,
            websiteUrl: (newCompany as any).websiteUrl ?? null,
            logo: Array.isArray((newCompany as any).logo) ? (newCompany as any).logo : [],
            bannerImage: Array.isArray((newCompany as any).bannerImage) ? (newCompany as any).bannerImage : [],
            colorScheme: (newCompany as any).colorScheme ?? null,
            usesShipping: Boolean((newCompany as any).usesShipping),
            ownerId: String((newCompany as any).ownerId),
            creatorId: String((newCompany as any).creatorId),
            createdAt: newCompany.createdAt instanceof Date ? newCompany.createdAt.toISOString() : String(newCompany.createdAt),
            updatedAt: newCompany.updatedAt instanceof Date ? newCompany.updatedAt.toISOString() : String(newCompany.updatedAt),
        };

        const parsed = CompanyCreateResponseSchema.safeParse(dto);
        if (!parsed.success) {
            console.error('[frontend/app/api/companies/create/route.ts] Invalid POST DTO:', parsed.error);
            return NextResponse.json(
                { error: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
                { status: 500 }
            );
        }

        return NextResponse.json(parsed.data, { status: 201 });
    } catch (error: unknown) {
        console.error('Failed to create company:', error);
        return NextResponse.json(
            { error: 'Failed to create company', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
            { status: 500 }
        );
    }
}