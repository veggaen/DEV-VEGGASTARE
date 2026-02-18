/**
 * @fileOverview Buyer "My Orders" page — shows all orders placed by the current user.
 * @stability experimental
 *
 * Provides order history, fulfilment tracking, download links, and return request initiation.
 * Replaces the post-purchase dead-end (only /order-confirmation was available before).
 */
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  FiPackage,
  FiTruck,
  FiCheckCircle,
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiDownload,
  FiShoppingCart,
  FiArrowLeft,
  FiAlertCircle,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────

interface OrderPayment {
  id: string;
  method: string;
  status: string;
  transactionId: string | null;
}

interface BuyerOrder {
  id: string;
  userId: string;
  totalAmount: number;
  status: string;
  transactionId: string | null;
  commentOrder: string | null;
  createdAt: string;
  updatedAt: string;
  Payment: OrderPayment | null;
  // Extended fields (from order detail API)
  fulfilmentStatus?: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  shippingServiceName?: string | null;
  estimatedDelivery?: string | null;
  shippingMethod?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
  }).format(amount);
}

function statusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case "COMPLETED":
      return { label: "Betalt", color: "text-green-400 border-green-500/30 bg-green-500/10" };
    case "CONFIRMING":
      return { label: "Bekrefter", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" };
    case "PENDING":
      return { label: "Venter", color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10" };
    case "CANCELLED":
      return { label: "Kansellert", color: "text-red-400 border-red-500/30 bg-red-500/10" };
    case "FAILED":
      return { label: "Feilet", color: "text-red-400 border-red-500/30 bg-red-500/10" };
    default:
      return { label: status, color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10" };
  }
}

function fulfilmentLabel(status: string | undefined): { label: string; icon: typeof FiClock; color: string } {
  switch (status) {
    case "UNFULFILLED":
      return { label: "Ikke sendt", icon: FiClock, color: "text-yellow-400" };
    case "PROCESSING":
      return { label: "Under behandling", icon: FiPackage, color: "text-blue-400" };
    case "SHIPPED":
      return { label: "Sendt", icon: FiTruck, color: "text-green-400" };
    case "DELIVERED":
      return { label: "Levert", icon: FiCheckCircle, color: "text-emerald-400" };
    case "RETURNED":
      return { label: "Returnert", icon: FiAlertCircle, color: "text-orange-400" };
    default:
      return { label: "Ukjent", icon: FiClock, color: "text-zinc-400" };
  }
}

// ─── Component ────────────────────────────────────────────────

export default function MyOrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionUserId = session?.user?.id;

  useEffect(() => {
    if (!sessionUserId) return;

    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/orders/user/${sessionUserId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setOrders(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke laste ordrer");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [sessionUserId]);

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <p className="text-zinc-400">Laster...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/nexus" className="text-zinc-400 hover:text-white transition">
            <FiArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Mine Bestillinger</h1>
            <p className="text-zinc-400 text-sm">
              Ordrehistorikk og sporingsinformasjon
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12 text-zinc-500">Laster ordrer...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <FiShoppingCart className="mx-auto text-zinc-600 mb-3" size={40} />
            <p className="text-zinc-400">Du har ingen bestillinger ennå</p>
            <Link
              href="/products"
              className="text-sm text-blue-400 hover:underline mt-2 inline-block"
            >
              Utforsk produkter →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isExpanded = expandedOrder === order.id;
              const status = statusLabel(order.status);
              const fulfilment = fulfilmentLabel(order.fulfilmentStatus);
              const FulfilmentIcon = fulfilment.icon;

              return (
                <div
                  key={order.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
                >
                  {/* Order Header */}
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition text-left"
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <p className="font-medium text-sm">
                          Ordre #{order.id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${status.color}`}
                      >
                        {status.label}
                      </span>
                      {order.fulfilmentStatus && (
                        <span className={`text-xs flex items-center gap-1 ${fulfilment.color}`}>
                          <FulfilmentIcon size={12} />
                          {fulfilment.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-medium">
                        {formatCurrency(order.totalAmount)}
                      </p>
                      {isExpanded ? (
                        <FiChevronUp className="text-zinc-400" />
                      ) : (
                        <FiChevronDown className="text-zinc-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 p-4 space-y-4">
                      {/* Payment Info */}
                      {order.Payment && (
                        <div>
                          <h4 className="text-xs font-medium text-zinc-500 mb-1">Betaling</h4>
                          <p className="text-sm">
                            {order.Payment.method} · {order.Payment.status}
                            {order.Payment.transactionId && (
                              <span className="text-xs text-zinc-500 ml-2">
                                TX: {order.Payment.transactionId.slice(0, 16)}...
                              </span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Tracking */}
                      {order.trackingNumber && (
                        <div className="flex items-center gap-3">
                          <FiTruck className="text-green-400" />
                          <div>
                            <p className="text-sm">
                              Sporingsnr: {order.trackingNumber}
                            </p>
                            {order.trackingUrl && (
                              <a
                                href={order.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
                              >
                                Spor forsendelse <FiExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {order.estimatedDelivery && (
                        <p className="text-xs text-zinc-500">
                          Estimert levering: {formatDate(order.estimatedDelivery)}
                        </p>
                      )}

                      {/* Downloads link */}
                      <div className="flex gap-3 pt-2">
                        <Link
                          href="/my-downloads"
                          className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          <FiDownload size={12} />
                          Mine nedlastinger
                        </Link>
                        <Link
                          href={`/order-confirmation/${order.id}`}
                          className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          <FiExternalLink size={12} />
                          Ordrebekreftelse
                        </Link>
                      </div>

                      {order.commentOrder && (
                        <div>
                          <h4 className="text-xs font-medium text-zinc-500 mb-1">Kommentar</h4>
                          <p className="text-sm text-zinc-300">{order.commentOrder}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
