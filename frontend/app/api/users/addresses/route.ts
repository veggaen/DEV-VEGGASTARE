// frontend/app/api/users/addresses/route.ts
// CRUD for user addresses

import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// =============================================================================
// SCHEMAS
// =============================================================================

const AddressLabelEnum = z.enum(['HOME', 'WORK', 'WAREHOUSE', 'PICKUP_POINT', 'OTHER']);

const CreateAddressSchema = z.object({
  label: AddressLabelEnum.default('OTHER'),
  customLabel: z.string().max(50).optional(),
  addressLine1: z.string().min(1, 'Street address is required').max(100),
  addressLine2: z.string().max(100).optional(),
  postalCode: z.string().min(4, 'Postal code must be at least 4 characters').max(10),
  city: z.string().min(1, 'City is required').max(100),
  municipality: z.string().max(100).optional(),
  county: z.string().max(100).optional(),
  country: z.string().default('NO'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().default(false),
});

const UpdateAddressSchema = CreateAddressSchema.partial();

// =============================================================================
// GET - List user's addresses
// =============================================================================

export async function GET() {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const addresses = await dbPrisma.address.findMany({
      where: { userId: session.id },
      orderBy: [
        { isDefault: 'desc' },
        { label: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('[addresses] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch addresses' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create new address
// =============================================================================

export async function POST(request: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CreateAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid address data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await dbPrisma.address.updateMany({
        where: { userId: session.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check max addresses limit (prevent abuse)
    const count = await dbPrisma.address.count({
      where: { userId: session.id },
    });
    if (count >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 addresses allowed. Please delete an existing address first.' },
        { status: 400 }
      );
    }

    const address = await dbPrisma.address.create({
      data: {
        userId: session.id,
        label: data.label,
        customLabel: data.label === 'OTHER' ? data.customLabel : null,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        postalCode: data.postalCode,
        city: data.city,
        municipality: data.municipality,
        county: data.county,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        isDefault: data.isDefault,
      },
    });

    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    console.error('[addresses] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create address' },
      { status: 500 }
    );
  }
}
