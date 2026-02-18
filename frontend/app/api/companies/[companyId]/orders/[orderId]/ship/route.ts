/**
 * @fileOverview Ship order API — books Bring shipment and updates order fulfilment
 * @stability experimental
 *
 * POST: Book a shipment via Bring and update order tracking
 * PATCH: Manually update fulfilment status (e.g. mark as delivered)
 */

import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";

type Params = { companyId: string; orderId: string };

// ─── Ship Order (calls Bring Booking API) ─────────────────────

const ShipOrderSchema = z.object({
  warehouseId: z.string().min(1),
  serviceCode: z.string().default("5800"), // Default: Express neste dag
  packageWeight: z.number().positive().default(1000), // grams
  packageDimensions: z
    .object({
      height: z.number().positive(),
      width: z.number().positive(),
      length: z.number().positive(),
    })
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyId, orderId } = await params;

    // Verify employee with shipping permission
    const employee = await dbPrisma.employee.findUnique({
      where: { userId_companyId: { userId: session.user.id, companyId } },
    });

    if (!employee) {
      return NextResponse.json({ error: "Not an employee" }, { status: 403 });
    }

    const perms = (employee.permissions as Record<string, boolean>) || {};
    const canShip =
      employee.role === "OWNER" ||
      employee.role === "MANAGER" ||
      employee.role === "WAREHOUSE_MANAGER" ||
      perms.CAN_SHIP_ORDERS;

    if (!canShip) {
      return NextResponse.json(
        { error: "No permission to ship orders" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = ShipOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { warehouseId, serviceCode, packageWeight, packageDimensions } =
      parsed.data;

    // Get order with shipping details
    const order = await dbPrisma.order.findFirst({
      where: {
        id: orderId,
        status: "COMPLETED",
        OrderItem: { some: { Product: { companyId } } },
      },
      include: {
        OrderItem: {
          where: { Product: { companyId } },
          include: { Product: { select: { title: true } } },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.fulfilmentStatus !== "UNFULFILLED" && order.fulfilmentStatus !== "PROCESSING") {
      return NextResponse.json(
        { error: `Order already ${order.fulfilmentStatus.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Get warehouse (sender address)
    const warehouse = await dbPrisma.warehouseLocation.findFirst({
      where: { id: warehouseId, companyId },
    });

    if (!warehouse) {
      return NextResponse.json(
        { error: "Warehouse not found" },
        { status: 404 }
      );
    }

    // Validate recipient address
    if (!order.shippingAddress || !order.shippingPostalCode || !order.shippingCity) {
      return NextResponse.json(
        { error: "Order missing shipping address" },
        { status: 400 }
      );
    }

    // Build goods description from order items
    const goodsDesc = order.OrderItem.map(
      (i) => `${i.quantity}x ${i.Product.title}`
    )
      .join(", ")
      .slice(0, 200);

    // Call our internal Bring Booking API route
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const bookingResponse = await fetch(`${baseUrl}/api/bring-booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: {
          name: warehouse.name || `Warehouse ${warehouse.city}`,
          address: warehouse.address,
          postalCode: warehouse.postalCode,
          city: warehouse.city,
          countryCode: warehouse.country || "NO",
        },
        recipient: {
          name: order.shippingName || "Customer",
          address: order.shippingAddress,
          postalCode: order.shippingPostalCode,
          city: order.shippingCity,
          countryCode: order.shippingCountry || "NO",
          email: order.shippingEmail || undefined,
          phone: order.shippingPhone || undefined,
        },
        packages: [
          {
            weight: packageWeight,
            dimensions: packageDimensions,
            description: goodsDesc,
          },
        ],
        serviceCode,
        orderId,
      }),
    });

    const bookingResult = await bookingResponse.json();

    if (!bookingResponse.ok || !bookingResult.success) {
      return NextResponse.json(
        {
          error: "Bring booking failed",
          details: bookingResult.error || bookingResult.details,
        },
        { status: 502 }
      );
    }

    // Update order with tracking info and fulfilment status
    const updatedOrder = await dbPrisma.order.update({
      where: { id: orderId },
      data: {
        fulfilmentStatus: "SHIPPED",
        trackingNumber: bookingResult.booking.consignmentNumber,
        trackingUrl: bookingResult.booking.trackingUrl,
        bringConsignmentId: bookingResult.booking.consignmentNumber,
        labelUrl: bookingResult.booking.labelUrl,
        shippingServiceName: serviceCode,
        shippedAt: new Date(),
        fulfilledById: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      testMode: bookingResult.testMode,
      order: {
        id: updatedOrder.id,
        fulfilmentStatus: updatedOrder.fulfilmentStatus,
        trackingNumber: updatedOrder.trackingNumber,
        trackingUrl: updatedOrder.trackingUrl,
        labelUrl: updatedOrder.labelUrl,
        shippedAt: updatedOrder.shippedAt,
      },
    });
  } catch (error) {
    console.error("[ship-order] Error:", error);
    return NextResponse.json(
      { error: "Failed to ship order" },
      { status: 500 }
    );
  }
}

// ─── Update Fulfilment Status ─────────────────────────────────

const UpdateFulfilmentSchema = z.object({
  fulfilmentStatus: z.enum([
    "UNFULFILLED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "RETURNED",
    "CANCELLED",
  ]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyId, orderId } = await params;

    const employee = await dbPrisma.employee.findUnique({
      where: { userId_companyId: { userId: session.user.id, companyId } },
    });

    if (!employee) {
      return NextResponse.json({ error: "Not an employee" }, { status: 403 });
    }

    const perms = (employee.permissions as Record<string, boolean>) || {};
    const canProcess =
      employee.role === "OWNER" ||
      employee.role === "MANAGER" ||
      employee.role === "WAREHOUSE_MANAGER" ||
      perms.CAN_PROCESS_ORDERS ||
      perms.CAN_SHIP_ORDERS;

    if (!canProcess) {
      return NextResponse.json({ error: "No permission" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateFulfilmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { fulfilmentStatus } = parsed.data;

    const updateData: Record<string, any> = { fulfilmentStatus };
    if (fulfilmentStatus === "DELIVERED") {
      updateData.deliveredAt = new Date();
    }

    const updated = await dbPrisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        fulfilmentStatus: updated.fulfilmentStatus,
      },
    });
  } catch (error) {
    console.error("[update-fulfilment] Error:", error);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}
