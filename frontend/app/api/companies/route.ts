// frontend\app\api\companies\route.ts

import { dbPrisma } from '@/lib/db';
import { Company } from '@prisma/client';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID is required' }), {
            status: 400, // Bad Request
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        console.log('trying to get compaines for user', userId)
        const companies = await dbPrisma.company.findMany({
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
            include: {
                employees: true, // Include related employees data
            },
        });

        const response = JSON.stringify(companies)
        const rawResponse = companies
        var val = rawResponse.map(((singleResponse: Company) => (singleResponse.name)))
        console.log('[frontend/app/api/companies/route.ts]','User companies is:', val)
        return new Response(JSON.stringify(companies), {
            status: 200, // OK
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error: unknown) {
        console.error('Failed to create company:', error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}