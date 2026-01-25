// frontend/app/api/companies/create/route.ts

import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

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

        return NextResponse.json(newCompany, { status: 201 });
    } catch (error: unknown) {
        console.error('Failed to create company:', error);
        return NextResponse.json(
            { error: 'Failed to create company', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
            { status: 500 }
        );
    }
}