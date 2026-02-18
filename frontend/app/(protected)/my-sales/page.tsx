/**
 * @fileOverview Solo seller dashboard — "My Sales"
 * @stability experimental
 *
 * Shows all orders containing the current user's products.
 * Works for both solo sellers (products with companyId: null)
 * and company owners (products under their companies).
 * Provides order visibility, fulfilment status tabs, and basic metrics.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
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
  FiDollarSign,
  FiShoppingBag,
  FiArrowLeft,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────

interface SellerOrderItem {
  id: string;
  quantity: number;
  priceAtTime: number;
  title: string;
  product: {
    id: string;
    title: string;
    image: string[];
    productType: string;
    companyId: string | null;
  };
}

interface SellerOrder {
  id: string;
  createdAt: string;
  totalAmount: number;
  status: string;
  fulfilmentStatus: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  shippingServiceName: string | null;
  estimatedDelivery: string | null;
  shipping: {
    name: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    method: string | null;
    cost: number | null;
  };
  customer: { id: string; name: string | null; email: string | null };
  items: SellerOrderItem[];
  payment: { method: string; status: string } | null;
}

// ─── Status Helpers ───────────────────────────────────────────

const STATUS_TABS = [
  { key: "ALL", label: "Alle", icon: FiShoppingBag, color: "text-zinc-400" },
  { key: "UNFULFILLED", label: "Ikke sendt", icon: FiClock, color: "text-yellow-400" },
  { key: "PROCESSING", label: "Under behandling", icon: FiPackage, color: "text-blue-400" },
  { key: "SHIPPED", label: "Sendt", icon: FiTruck, color: "text-green-400" },
  { key: "DELIVERED", label: "Levert", icon: FiCheckCircle, color: "text-emerald-400" },
] as const;

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

// ─── Component ────────────────────────────────────────────────

export default function MySalesPage() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/seller/orders?fulfilmentStatus=${activeTab}&page=${page}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
        setTotalPages(data.pagination.totalPages);
        setTabCounts((prev) => ({ ...prev, [activeTab]: data.pagination.total }));
      }
    } catch (err) {
      console.error("Failed to fetch seller orders:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  // Fetch counts on mount
  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        STATUS_TABS.map(async (tab) => {
          try {
            const res = await fetch(
              `/api/seller/orders?fulfilmentStatus=${tab.key}&page=1&limit=1`
            );
            if (res.ok) {
              const data = await res.json();
              counts[tab.key] = data.pagination.total;
            }
          } catch { /* ignore */ }
        })
      );
      setTabCounts(counts);
    };
    fetchCounts();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Metrics ──
  const totalRevenue = orders.reduce((sum, o) => {
    const itemsTotal = o.items.reduce((s, i) => s + i.priceAtTime * i.quantity, 0);
    return sum + itemsTotal;
  }, 0);
  const unfulfilledCount = tabCounts["UNFULFILLED"] ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/nexus"
            className="text-zinc-400 hover:text-white transition"
          >
            <FiArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Mine Salg</h1>
            <p className="text-zinc-400 text-sm">
              Ordre som inneholder dine produkter
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <FiShoppingBag size={14} />
              Totalt ordrer
            </div>
            <p className="text-2xl font-bold">{tabCounts["ALL"] ?? orders.length}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <FiDollarSign size={14} />
              Omsetning (viste)
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
              <FiClock size={14} />
              Venter på sending
            </div>
            <p className="text-2xl font-bold">{unfulfilledCount}</p>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tabCounts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? "bg-zinc-800 text-white border border-zinc-600"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"
                }`}
              >
                <Icon size={14} className={isActive ? tab.color : ""} />
                {tab.label}
                {count !== undefined && (
                  <span className="bg-zinc-800 text-xs px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="text-center py-12 text-zinc-500">Laster ordrer...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <FiShoppingBag className="mx-auto text-zinc-600 mb-3" size={40} />
            <p className="text-zinc-400">Ingen ordrer funnet</p>
            <p className="text-zinc-500 text-sm mt-1">
              Ordrer vil dukke opp her når noen kjøper produktene dine.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isExpanded = expandedOrder === order.id;
              return (
                <div
                  key={order.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
                >
                  {/* Order Header */}
                  <button
                    onClick={() =>
                      setExpandedOrder(isExpanded ? null : order.id)
                    }
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-sm">
                          #{order.id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          order.fulfilmentStatus === "UNFULFILLED"
                            ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
                            : order.fulfilmentStatus === "SHIPPED"
                            ? "border-green-500/30 text-green-400 bg-green-500/10"
                            : order.fulfilmentStatus === "DELIVERED"
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : "border-blue-500/30 text-blue-400 bg-blue-500/10"
                        }`}
                      >
                        {order.fulfilmentStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-medium">
                        {formatCurrency(
                          order.items.reduce(
                            (s, i) => s + i.priceAtTime * i.quantity,
                            0
                          )
                        )}
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
                      {/* Customer */}
                      <div>
                        <h4 className="text-xs font-medium text-zinc-500 mb-1">
                          Kunde
                        </h4>
                        <p className="text-sm">
                          {order.customer.name ?? "Ukjent"} ·{" "}
                          <span className="text-zinc-400">
                            {order.customer.email}
                          </span>
                        </p>
                      </div>

                      {/* Items */}
                      <div>
                        <h4 className="text-xs font-medium text-zinc-500 mb-2">
                          Produkter
                        </h4>
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 py-2"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{item.title}</p>
                              <p className="text-xs text-zinc-500">
                                {item.quantity}x {formatCurrency(item.priceAtTime)}
                                {" · "}
                                <span className="uppercase text-zinc-600">
                                  {item.product.productType}
                                </span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Shipping */}
                      {order.shipping.address && (
                        <div>
                          <h4 className="text-xs font-medium text-zinc-500 mb-1">
                            Leveringsadresse
                          </h4>
                          <p className="text-sm text-zinc-300">
                            {order.shipping.name}
                            <br />
                            {order.shipping.address}
                            <br />
                            {order.shipping.postalCode} {order.shipping.city},{" "}
                            {order.shipping.country}
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
                            {order.labelUrl && (
                              <a
                                href={order.labelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1 ml-3"
                              >
                                Last ned etikett <FiDownload size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Payment */}
                      {order.payment && (
                        <div className="text-xs text-zinc-500">
                          Betaling: {order.payment.method} · {order.payment.status}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 bg-zinc-800 rounded text-sm disabled:opacity-40"
            >
              Forrige
            </button>
            <span className="px-3 py-1.5 text-sm text-zinc-400">
              Side {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 bg-zinc-800 rounded text-sm disabled:opacity-40"
            >
              Neste
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
