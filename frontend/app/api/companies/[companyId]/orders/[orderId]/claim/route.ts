/**
 * POST /api/companies/[companyId]/orders/[orderId]/claim
 * Claim an order for packing — prevents double-processing in warehouse.
 *
 * DELETE /api/companies/[companyId]/orders/[orderId]/claim
 * Release a claim (only the claimer or a manager/owner can release).
 */

import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { auth } from "@/auth";

type Params = { companyId: string; orderId: string };

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

    // Verify employee
    const employee = await dbPrisma.employee.findUnique({
      where: { userId_companyId: { userId: session.user.id, companyId } },
    });

    if (!employee) {
      return NextResponse.json({ error: "Not an employee" }, { status: 403 });
    }

    // Only warehouse roles, managers, and owners can claim
    const canClaim =
      employee.role === "OWNER" ||
      employee.role === "MANAGER" ||
      employee.role === "WAREHOUSE_MANAGER" ||
      employee.role === "WAREHOUSE_WORKER" ||
      ((employee.permissions as Record<string, boolean>) || {}).CAN_PROCESS_ORDERS;

    if (!canClaim) {
      return NextResponse.json({ error: "No permission to claim orders" }, { status: 403 });
    }

    // Check the order belongs to this company and is claimable
    const order = await dbPrisma.order.findFirst({
      where: {
        id: orderId,
        status: "COMPLETED",
        OrderItem: { some: { Product: { companyId } } },
      },
      select: {
        id: true,
        fulfilmentStatus: true,
        claimedByUserId: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only UNFULFILLED or PROCESSING orders can be claimed
    if (order.fulfilmentStatus !== "UNFULFILLED" && order.fulfilmentStatus !== "PROCESSING") {
      return NextResponse.json(
        { error: `Cannot claim — order is ${order.fulfilmentStatus}` },
        { status: 400 }
      );
    }

    // If already claimed by someone else, reject
    if (order.claimedByUserId && order.claimedByUserId !== session.user.id) {
      return NextResponse.json(
        { error: "Order already claimed by another worker" },
        { status: 409 }
      );
    }

    // Claim the order
    const updated = await dbPrisma.order.update({
      where: { id: orderId },
      data: {
        claimedByUserId: session.user.id,
        claimedAt: new Date(),
        // Auto-move to PROCESSING if still UNFULFILLED
        ...(order.fulfilmentStatus === "UNFULFILLED"
          ? { fulfilmentStatus: "PROCESSING" }
          : {}),
      },
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        fulfilmentStatus: updated.fulfilmentStatus,
        claimedByUserId: updated.claimedByUserId,
        claimedAt: updated.claimedAt,
      },
    });
  } catch (error) {
    console.error("[claim-order] Error:", error);
    return NextResponse.json({ error: "Failed to claim order" }, { status: 500 });
  }
}

export async function DELETE(
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

    const order = await dbPrisma.order.findFirst({
      where: {
        id: orderId,
        OrderItem: { some: { Product: { companyId } } },
      },
      select: { id: true, claimedByUserId: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only the claimer or a manager/owner can release
    const isOwnerOrManager =
      employee.role === "OWNER" ||
      employee.role === "MANAGER" ||
      employee.role === "WAREHOUSE_MANAGER";

    if (order.claimedByUserId !== session.user.id && !isOwnerOrManager) {
      return NextResponse.json({ error: "Cannot release another worker's claim" }, { status: 403 });
    }

    const updated = await dbPrisma.order.update({
      where: { id: orderId },
      data: {
        claimedByUserId: null,
        claimedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        fulfilmentStatus: updated.fulfilmentStatus,
        claimedByUserId: null,
        claimedAt: null,
      },
    });
  } catch (error) {
    console.error("[unclaim-order] Error:", error);
    return NextResponse.json({ error: "Failed to release claim" }, { status: 500 });
  }
}
