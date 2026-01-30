import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { z } from 'zod';

const patchBodySchema = z.object({
  changeType: z.enum(['increment', 'decrement']),
});

// Next.js 16+ params type
type RouteContext = { params: Promise<{ userId: string; itemId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await MyLibUserAuth(); // Authenticate the user

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, itemId } = await context.params;

  if (user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(request, patchBodySchema);
  if (!bodyResult.ok) return bodyResult.response;
  const { changeType } = bodyResult.data;

  try {
    const cart = await dbPrisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    const item = await dbPrisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const newQuantity = changeType === 'increment' ? item.quantity + 1 : Math.max(1, item.quantity - 1);

    const updatedCartItem = await dbPrisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: newQuantity },
      include: { Product: true },
    });

    return NextResponse.json(updatedCartItem);
  } catch (error) {
    console.error('Error updating cart item quantity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await MyLibUserAuth(); // Authenticate the user

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, itemId } = await context.params;

  if (user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const cart = await dbPrisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    const item = await dbPrisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await dbPrisma.cartItem.delete({ where: { id: item.id } });

    return NextResponse.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}