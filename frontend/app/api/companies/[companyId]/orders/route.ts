/**
 * @fileOverview Company order fulfilment queue API
 * @stability experimental
 *
 * Returns orders containing products from a specific company,
 * used by warehouse workers/managers to see what needs shipping.
 */

import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { auth } from "@/auth";

type Params = { companyId: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyId } = await params;

    // Verify user is employee of this company
    const employee = await dbPrisma.employee.findUnique({
      where: { userId_companyId: { userId: session.user.id, companyId } },
    });

    if (!employee) {
      return NextResponse.json({ error: "Not an employee" }, { status: 403 });
    }

    // Parse query params
    const url = new URL(req.url);
    const status = url.searchParams.get("fulfilmentStatus") || "UNFULFILLED";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
    const skip = (page - 1) * limit;

    // Find orders that contain products from this company
    // Only show COMPLETED orders (payment confirmed) for fulfilment
    const where = {
      status: "COMPLETED" as const,
      fulfilmentStatus: status as any,
      OrderItem: {
        some: {
          Product: {
            companyId,
          },
        },
      },
    };

    const [orders, total] = await Promise.all([
      dbPrisma.order.findMany({
        where,
        include: {
          User: {
            select: { id: true, name: true, email: true },
          },
          OrderItem: {
            where: { Product: { companyId } },
            include: {
              Product: {
                select: {
                  id: true,
                  title: true,
                  image: true,
                  productType: true,
                  companyId: true,
                },
              },
            },
          },
          Payment: {
            select: { method: true, status: true },
          },
        },
        orderBy: { createdAt: "asc" }, // oldest first (FIFO)
        skip,
        take: limit,
      }),
      dbPrisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount,
        status: o.status,
        fulfilmentStatus: o.fulfilmentStatus,
        shippedAt: o.shippedAt,
        deliveredAt: o.deliveredAt,
        trackingNumber: o.trackingNumber,
        trackingUrl: o.trackingUrl,
        labelUrl: o.labelUrl,
        shippingServiceName: o.shippingServiceName,
        estimatedDelivery: o.estimatedDelivery,
        // Shipping address
        shipping: {
          name: o.shippingName,
          address: o.shippingAddress,
          city: o.shippingCity,
          postalCode: o.shippingPostalCode,
          country: o.shippingCountry,
          phone: o.shippingPhone,
          email: o.shippingEmail,
          method: o.shippingMethod,
          cost: o.shippingCost,
        },
        customer: o.User,
        items: o.OrderItem.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          priceAtTime: item.priceAtTime,
          title: item.title,
          product: item.Product,
        })),
        payment: o.Payment,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[company-orders] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
