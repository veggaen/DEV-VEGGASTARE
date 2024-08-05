import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const user = await MyLibUserAuth(); // Authenticate the user

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = params;

  if (user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const cart = await dbPrisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    return NextResponse.json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const user = await MyLibUserAuth(); // Authenticate the user

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = params;

  if (user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { productId, quantity } = body;

  try {
    const existingCart = await dbPrisma.cart.findUnique({ where: { userId } });

    if (!existingCart) {
      const newCart = await dbPrisma.cart.create({
        data: {
          userId,
          items: { create: { productId, quantity } },
        },
        include: { items: { include: { product: true } } },
      });
      return NextResponse.json(newCart, { status: 201 });
    } else {
      const updatedCart = await dbPrisma.cart.update({
        where: { id: existingCart.id },
        data: {
          items: {
            upsert: {
              where: { id: productId },
              update: { quantity: { increment: quantity } },
              create: { productId, quantity },
            },
          },
        },
        include: { items: { include: { product: true } } },
      });
      return NextResponse.json(updatedCart);
    }
  } catch (error) {
    console.error('Error adding item to cart:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  const user = await MyLibUserAuth(); // Authenticate the user

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = params;

  if (user.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { itemId, type } = body;

  try {
    const item = await dbPrisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const newQuantity = type === 'increment' ? item.quantity + 1 : item.quantity - 1;

    const updatedCartItem = await dbPrisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: newQuantity },
      include: { product: true },
    });

    return NextResponse.json(updatedCartItem);
  } catch (error) {
    console.error('Error updating cart item quantity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { userId: string } }) {
  const user = await MyLibUserAuth(); // Authenticate the user

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = params;

  if (user.id !== userId) {
    console.log('userId:', userId);
    console.log('user.id:', user.id);
    return NextResponse.json({ error: 'Forbidden (user.id !== userId)' }, { status: 403 });
  }

  const body = await request.json();
  const { itemId } = body;

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