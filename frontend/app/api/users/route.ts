// frontend/app/api/users/route.ts

import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';

export async function GET() {
    // Authentication check - only admins can list all users
    const session = await MyLibUserAuth();
    if (!session?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    try {
        console.log('GET USERS')
        const users = await dbPrisma.user.findMany({
            select: {
                id: true, 
                name: true, 
                email: true, 
                emailVerified: true,
                image: true,
                referredBy: true,
                role: true,
                isTwoFactorEnabled: true,
                createdAt: true,
                updatedAt: true,

            },
        });
        // Post-process users to handle null/undefined fields
        const processedUsers = users.map(user => ({
            ...user,
            name: user.name || '', // Provide a default name if null/undefined
            email: user.email || '', // Provide a default email if
            emailVerified: user.emailVerified || false, // Provide a default emailVerified if null/undefined
            image: user.image || '', // Provide a default image path if null/undefined
            referredBy: user.referredBy || '', // Provide a default referrer if null/undefined
            role: user.role || '', // Provide a default role if null/undefined
            isTwoFactorEnabled: user.isTwoFactorEnabled || false, // Provide a default isTwoFactorEnabled if null/undefined
            createdAt: user.createdAt || new Date().toISOString(), // Provide a default createdAt if null/undefined
            updatedAt: user.updatedAt || new Date().toISOString(),
            // Handle other fields similarly if needed
        }));

        return new Response(JSON.stringify(processedUsers), {
            status: 201, // Resource created
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error: unknown) {
        console.error('Failed to get users:', error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}