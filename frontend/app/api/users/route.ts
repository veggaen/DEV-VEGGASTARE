// frontend/app/api/users/route.ts

import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { AdminUsersListResponseSchema } from '@/lib/types/users';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' && value) return value;
    return new Date(String(value)).toISOString();
}

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
            id: user.id,
            name: user.name || '',
            email: user.email || '',
            emailVerified: Boolean(user.emailVerified),
            image: user.image || '',
            referredBy: user.referredBy || '',
            role: user.role || '',
            isTwoFactorEnabled: Boolean(user.isTwoFactorEnabled),
            createdAt: toIsoString(user.createdAt),
            updatedAt: toIsoString(user.updatedAt),
        }));

        const validated = AdminUsersListResponseSchema.safeParse(processedUsers);
        if (!validated.success) {
            console.error('Invalid admin users list DTO:', validated.error);
            return NextResponse.json(
                { error: 'Failed to get users', ...(isDev ? { issues: validated.error.issues } : {}) },
                { status: 500 }
            );
        }

        return NextResponse.json(validated.data, { status: 200 });
    } catch (error: unknown) {
        console.error('Failed to get users:', error);
        return NextResponse.json(
            { error: (error as Error).message || 'Failed to get users' },
            { status: 500 }
        );
    }
}