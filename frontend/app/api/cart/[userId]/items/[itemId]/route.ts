import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { z } from 'zod';
import { CartItemResponseSchema, CartMessageResponseSchema } from '@/lib/types/carts';
import { CartCreditError, cartCreditAmountSchema, creditCartData, cartItemDto } from '@/lib/cart-credit-policy';

const isDev = process.env.NODE_ENV !== 'production';

const patchBodySchema = z
  .object({
    changeType: z.enum(['increment', 'decrement']).optional(),
    quantity: z.coerce.number().int().min(1).max(1000).optional(),
    creditAmount: cartCreditAmountSchema,
  })
  .refine((value) => Boolean(value.changeType) || typeof value.quantity === 'number' || value.creditAmount !== undefined, {
    message: 'changeType or quantity is required',
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
  const { changeType, quantity, creditAmount } = bodyResult.data;

  try {
    const cart = await dbPrisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    const item = await dbPrisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const newQuantity =
      typeof quantity === 'number'
        ? quantity
        : changeType === 'increment'
          ? item.quantity + 1
          : changeType === 'decrement' ? Math.max(1, item.quantity - 1) : item.quantity;

    const updatedCartItem = await dbPrisma.cartItem.update({
      where: { id: item.id },
      data: creditCartData(item.productId, creditAmount === undefined ? newQuantity : 1, creditAmount ?? item.creditAmount ?? undefined),
      include: { Product: true },
    });

    const dto = cartItemDto(updatedCartItem);

    const parsed = CartItemResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[api/cart/[userId]/items/[itemId]] Invalid PATCH DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    if (error instanceof CartCreditError) return NextResponse.json({ error: error.message }, { status: 400 });
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

    const parsed = CartMessageResponseSchema.safeParse({ message: 'Item removed from cart' });
    return NextResponse.json(parsed.success ? parsed.data : { message: 'Item removed from cart' }, { status: 200 });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
