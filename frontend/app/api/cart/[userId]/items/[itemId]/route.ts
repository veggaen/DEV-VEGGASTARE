import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';

export async function PATCH(request: NextRequest, { params }: { params: { userId: string, itemId: string } }) {
  const user = await MyLibUserAuth(); // Authenticate the user

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, itemId } = params;

  if (user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { changeType } = await request.json();

  try {
    const updatedCartItem = await dbPrisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: changeType === 'increment' ? { increment: 1 } : { decrement: 1 },
      },
      include: { product: true },
    });

    return NextResponse.json(updatedCartItem);
  } catch (error) {
    console.error('Error updating cart item quantity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { userId: string, itemId: string } }) {
  const user = await MyLibUserAuth(); // Authenticate the user

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, itemId } = params;

  if (user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await dbPrisma.cartItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}