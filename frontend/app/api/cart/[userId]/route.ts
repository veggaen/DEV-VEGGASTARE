import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { parseJsonOrError } from "@/lib/api-validate";
import { z } from "zod";

const addItemSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(1000).optional().default(1),
});

const updateItemSchema = z.object({
  itemId: z.string().trim().min(1).max(200),
  type: z.enum(["increment", "decrement"]),
});

const removeItemSchema = z.object({
  itemId: z.string().trim().min(1).max(200),
});

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

  const bodyResult = await parseJsonOrError(request, addItemSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { productId } = bodyResult.data;
  let quantity = bodyResult.data.quantity;

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

  const bodyResult = await parseJsonOrError(request, updateItemSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { itemId, type } = bodyResult.data;

  try {
    const cart = await dbPrisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    const item = await dbPrisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
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

  const bodyResult = await parseJsonOrError(request, removeItemSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { itemId } = bodyResult.data;

  try {
    const cart = await dbPrisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    const existingItem = await dbPrisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await dbPrisma.cartItem.delete({ where: { id: existingItem.id } });

    return NextResponse.json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}