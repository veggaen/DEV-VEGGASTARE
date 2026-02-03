// frontend/app/api/users/addresses/[addressId]/route.ts
// Single address operations: GET, PUT, DELETE

import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// =============================================================================
// SCHEMAS
// =============================================================================

const AddressLabelEnum = z.enum(['HOME', 'WORK', 'WAREHOUSE', 'PICKUP_POINT', 'OTHER']);

const UpdateAddressSchema = z.object({
  label: AddressLabelEnum.optional(),
  customLabel: z.string().max(50).optional().nullable(),
  addressLine1: z.string().min(1).max(100).optional(),
  addressLine2: z.string().max(100).optional().nullable(),
  postalCode: z.string().min(4).max(10).optional(),
  city: z.string().min(1).max(100).optional(),
  municipality: z.string().max(100).optional().nullable(),
  county: z.string().max(100).optional().nullable(),
  country: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isDefault: z.boolean().optional(),
});

// =============================================================================
// GET - Get single address
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ addressId: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { addressId } = await params;

  try {
    const address = await dbPrisma.address.findFirst({
      where: {
        id: addressId,
        userId: session.id,
      },
    });

    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    return NextResponse.json({ address });
  } catch (error) {
    console.error('[addresses/[id]] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update address
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ addressId: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { addressId } = await params;

  try {
    // Verify ownership
    const existing = await dbPrisma.address.findFirst({
      where: {
        id: addressId,
        userId: session.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid address data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If setting as default, unset other defaults first
    if (data.isDefault === true) {
      await dbPrisma.address.updateMany({
        where: {
          userId: session.id,
          isDefault: true,
          id: { not: addressId },
        },
        data: { isDefault: false },
      });
    }

    // Clean up customLabel if label is not OTHER
    const updateData: Record<string, unknown> = { ...data };
    if (data.label && data.label !== 'OTHER') {
      updateData.customLabel = null;
    }

    const address = await dbPrisma.address.update({
      where: { id: addressId },
      data: updateData,
    });

    return NextResponse.json({ address });
  } catch (error) {
    console.error('[addresses/[id]] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update address' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete address
// =============================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ addressId: string }> }
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { addressId } = await params;

  try {
    // Verify ownership
    const existing = await dbPrisma.address.findFirst({
      where: {
        id: addressId,
        userId: session.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    await dbPrisma.address.delete({
      where: { id: addressId },
    });

    // If this was the default address, make the most recent one the new default
    if (existing.isDefault) {
      const nextAddress = await dbPrisma.address.findFirst({
        where: { userId: session.id },
        orderBy: { createdAt: 'desc' },
      });
      if (nextAddress) {
        await dbPrisma.address.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[addresses/[id]] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete address' },
      { status: 500 }
    );
  }
}
