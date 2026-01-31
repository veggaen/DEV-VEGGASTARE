import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { parseJsonOrError } from "@/lib/api-validate";
import { z } from "zod";
import { CartItemResponseSchema, CartMessageResponseSchema, CartResponseSchema } from "@/lib/types/carts";

const isDev = process.env.NODE_ENV !== "production";

function toCartDto(cart: {
  id: string;
  userId: string;
  CartItem: Array<{ id: string; quantity: number; Product: { id: string; title: string; price: number; image: string[] } }>;
}) {
  return {
    id: cart.id,
    userId: cart.userId,
    items: cart.CartItem.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      product: {
        id: item.Product.id,
        title: item.Product.title,
        price: item.Product.price,
        image: item.Product.image ?? [],
      },
    })),
  };
}

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

// Next.js 16+ params type
type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await MyLibUserAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;

  if (user.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const cart = await dbPrisma.cart.findUnique({
      where: { userId },
      include: { CartItem: { include: { Product: true } } },
    });

    if (!cart) {
      const emptyDto = { id: null, userId, items: [] };
      const parsedEmpty = CartResponseSchema.safeParse(emptyDto);
      if (!parsedEmpty.success) {
        console.error("[api/cart/[userId]] Invalid GET empty DTO:", parsedEmpty.error);
        return NextResponse.json(
          { error: "Internal Server Error", ...(isDev ? { issues: parsedEmpty.error.issues } : {}) },
          { status: 500 }
        );
      }
      return NextResponse.json(parsedEmpty.data, { status: 200 });
    }

    const dto = toCartDto(cart);
    const parsed = CartResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error("[api/cart/[userId]] Invalid GET DTO:", parsed.error);
      return NextResponse.json(
        { error: "Internal Server Error", ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error("Error fetching cart:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await MyLibUserAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;

  if (user.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(request, addItemSchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { productId } = bodyResult.data;
  const quantity = bodyResult.data.quantity ?? 1;

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
      include: { CartItem: { include: { Product: true } } },
    });

    if (!updated) {
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

    const dto = toCartDto(updated);
    const parsed = CartResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error("[api/cart/[userId]] Invalid POST DTO:", parsed.error);
      return NextResponse.json(
        { error: "Internal Server Error", ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error("Error adding item to cart:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await MyLibUserAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;

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
      include: { Product: true },
    });

    const dto = {
      id: updatedCartItem.id,
      quantity: updatedCartItem.quantity,
      product: {
        id: updatedCartItem.Product.id,
        title: updatedCartItem.Product.title,
        price: updatedCartItem.Product.price,
        image: updatedCartItem.Product.image ?? [],
      },
    };

    const parsed = CartItemResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error("[api/cart/[userId]] Invalid PATCH DTO:", parsed.error);
      return NextResponse.json(
        { error: "Internal Server Error", ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error("Error updating cart item quantity:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await MyLibUserAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;

  if (user.id !== userId) {
    console.log("userId:", userId);
    console.log("user.id:", user.id);
    return NextResponse.json({ error: "Forbidden (user.id !== userId)" }, { status: 403 });
  }

  try {
    const cart = await dbPrisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      // For "clear cart" semantics, treat missing cart as success.
      const parsed = CartMessageResponseSchema.safeParse({ message: "Cart cleared" });
      return NextResponse.json(parsed.success ? parsed.data : { message: "Cart cleared" }, { status: 200 });
    }

    // Support both:
    // - DELETE with no body: clear cart (used by checkout)
    // - DELETE with { itemId }: remove single item (legacy / alternate client)
    const raw = await request.text();
    const trimmed = raw.trim();

    if (!trimmed) {
      await dbPrisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      const parsed = CartMessageResponseSchema.safeParse({ message: "Cart cleared" });
      return NextResponse.json(parsed.success ? parsed.data : { message: "Cart cleared" }, { status: 200 });
    }

    let body: unknown;
    try {
      body = JSON.parse(trimmed);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const bodyResult = removeItemSchema.safeParse(body);
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", ...(isDev ? { issues: bodyResult.error.issues } : {}) },
        { status: 400 }
      );
    }

    const { itemId } = bodyResult.data;
    const existingItem = await dbPrisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await dbPrisma.cartItem.delete({ where: { id: existingItem.id } });

    const parsed = CartMessageResponseSchema.safeParse({ message: "Item removed from cart" });
    return NextResponse.json(parsed.success ? parsed.data : { message: "Item removed from cart" }, { status: 200 });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}