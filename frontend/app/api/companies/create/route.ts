// frontend/app/api/companies/create/route.ts

import { dbPrisma } from '@/lib/db';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    try {
        const data = await req.json();
        // Simple validation example
        if (!data.name) {
            throw new Error('Company name is required');
        }

        const newCompany = await dbPrisma.company.create({
            data,
        });

        return new Response(JSON.stringify(newCompany), {
            status: 201, // Resource created
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