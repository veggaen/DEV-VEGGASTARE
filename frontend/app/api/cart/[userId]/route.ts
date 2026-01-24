import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const user = await MyLibUserAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = params;

  if (user.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const cart = await dbPrisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      return NextResponse.json({ id: null, userId, items: [] }, { status: 200 });
    }

    return NextResponse.json(cart);
  } catch (error) {
    console.error("Error fetching cart:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const user = await MyLibUserAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = params;

  if (user.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const productId: string = body.productId;
  let quantity: number = Number(body.quantity) || 1;
  if (quantity < 1) quantity = 1;

  try {
    let cart = await dbPrisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await dbPrisma.cart.create({ data: { userId } });
    }

    const existingItem = await dbPrisma.cartItem.findFirst({
      where: { cartId: cart.id, productId },
    });

    if (existingItem) {
      await dbPrisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: { increment: quantity } },
      });
    } else {
      await dbPrisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }

    const updated = await dbPrisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error adding item to cart:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  const user = await MyLibUserAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = params;

  if (user.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { itemId, type } = body;

  try {
    const item = await dbPrisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const newQuantity = type === "increment" ? item.quantity + 1 : Math.max(1, item.quantity - 1);

    const updatedCartItem = await dbPrisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: newQuantity },
      include: { product: true },
    });

    return NextResponse.json(updatedCartItem);
  } catch (error) {
    console.error("Error updating cart item quantity:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { userId: string } }) {
  const user = await MyLibUserAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = params;

  if (user.id !== userId) {
    console.log("userId:", userId);
    console.log("user.id:", user.id);
    return NextResponse.json({ error: "Forbidden (user.id !== userId)" }, { status: 403 });
  }

  const body = await request.json();
  const { itemId } = body;

  try {
    await dbPrisma.cartItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}