/**
 * @fileOverview Warehouse order fulfilment queue
 * @stability experimental
 *
 * Shows orders that need shipping from this company's warehouse.
 * Warehouse workers can view order details, book Bring shipments,
 * download labels, and track fulfilment status.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  FiPackage,
  FiTruck,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiDownload,
  FiChevronDown,
  FiChevronUp,
  FiLoader,
  FiAlertTriangle,
  FiArrowLeft,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  quantity: number;
  priceAtTime: number;
  title: string;
  product: {
    id: string;
    title: string;
    image: string[];
    productType: string;
    companyId: string;
  };
}

interface FulfilmentOrder {
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
  items: OrderItem[];
  payment: { method: string; status: string } | null;
}

// ─── Status Helpers ───────────────────────────────────────────

const STATUS_TABS = [
  { key: "UNFULFILLED", label: "Ikke sendt", icon: FiClock, color: "text-yellow-400" },
  { key: "PROCESSING", label: "Under behandling", icon: FiPackage, color: "text-blue-400" },
  { key: "SHIPPED", label: "Sendt", icon: FiTruck, color: "text-green-400" },
  { key: "DELIVERED", label: "Levert", icon: FiCheckCircle, color: "text-emerald-400" },
] as const;

const BRING_SERVICES: Record<string, string> = {
  "5800": "Express neste dag",
  "5600": "Pakke til hentested",
  "4850": "Pakke i postkassen",
  "5000": "Pakke til bedrift",
  "3584": "Hjemlevering postkasse",
};

// ─── Component ────────────────────────────────────────────────

export default function WarehouseOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const warehouseId = params.warehouseId as string;

  const [orders, setOrders] = useState<FulfilmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("UNFULFILLED");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [shippingOrder, setShippingOrder] = useState<string | null>(null);
  const [shipError, setShipError] = useState<string | null>(null);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Ship form state
  const [serviceCode, setServiceCode] = useState("5800");
  const [packageWeight, setPackageWeight] = useState(1000);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/orders?fulfilmentStatus=${activeTab}&page=${page}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
        setTotalPages(data.pagination.totalPages);
        setTabCounts((prev) => ({ ...prev, [activeTab]: data.pagination.total }));
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId, activeTab, page]);

  // Fetch counts for all tabs on mount
  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        STATUS_TABS.map(async (tab) => {
          try {
            const res = await fetch(
              `/api/companies/${companyId}/orders?fulfilmentStatus=${tab.key}&page=1&limit=1`
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
  }, [companyId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleShip = async (orderId: string) => {
    setShippingOrder(orderId);
    setShipError(null);

    try {
      const res = await fetch(
        `/api/companies/${companyId}/orders/${orderId}/ship`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            warehouseId,
            serviceCode,
            packageWeight,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setShipError(data.error || "Shipping failed");
        return;
      }

      // Refresh the list
      await fetchOrders();
      setExpandedOrder(null);

      if (data.testMode) {
        setShipError(null);
      }
    } catch {
      setShipError("Network error");
    } finally {
      setShippingOrder(null);
    }
  };

  const handleStatusUpdate = async (
    orderId: string,
    newStatus: string
  ) => {
    try {
      const res = await fetch(
        `/api/companies/${companyId}/orders/${orderId}/ship`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fulfilmentStatus: newStatus }),
        }
      );

      if (res.ok) {
        await fetchOrders();
      }
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("nb-NO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
    }).format(v);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push(`/nexus/company/${companyId}/warehouse/${warehouseId}`)}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-4 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          Tilbake til varehus
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Ordrekø</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Ordrer som venter på utsendelse fra dette varehuset
            </p>
          </div>

          {/* Bring test mode indicator */}
          {process.env.NEXT_PUBLIC_TEST_MODE === "true" && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5 text-sm text-yellow-400">
              <FiAlertTriangle className="w-4 h-4" />
              Testmodus — ingen ekte forsendelser
            </div>
          )}
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tabCounts[tab.key] ?? 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(1);
                  setExpandedOrder(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? tab.color : ""}`} />
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                      isActive
                        ? "bg-zinc-700 text-zinc-200"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <FiLoader className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <FiPackage className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Ingen ordrer med status &quot;{STATUS_TABS.find((t) => t.key === activeTab)?.label}&quot;</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isExpanded = expandedOrder === order.id;
              const isShipping = shippingOrder === order.id;
              const isDigitalOnly = order.items.every(
                (i) => i.product.productType === "DIGITAL"
              );

              return (
                <div
                  key={order.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
                >
                  {/* Order Header (always visible) */}
                  <button
                    onClick={() =>
                      setExpandedOrder(isExpanded ? null : order.id)
                    }
                    className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      {/* Product thumbnails */}
                      <div className="flex -space-x-2">
                        {order.items.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className="w-10 h-10 rounded-lg border-2 border-zinc-900 overflow-hidden bg-zinc-800"
                          >
                            {item.product.image?.[0] ? (
                              <Image
                                src={item.product.image[0]}
                                alt={item.title}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <FiPackage className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <div className="w-10 h-10 rounded-lg border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                            +{order.items.length - 3}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-medium">
                          #{order.id.slice(-8).toUpperCase()}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {formatDate(order.createdAt)} •{" "}
                          {order.customer.name || order.customer.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {isDigitalOnly && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                          Digital
                        </span>
                      )}

                      {order.trackingNumber && (
                        <span className="text-xs text-zinc-400 font-mono">
                          {order.trackingNumber}
                        </span>
                      )}

                      <span className="text-sm font-medium text-zinc-300">
                        {formatPrice(order.totalAmount)}
                      </span>

                      {isExpanded ? (
                        <FiChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <FiChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Items */}
                        <div>
                          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                            Produkter
                          </h3>
                          <div className="space-y-2">
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-3"
                              >
                                <div className="w-8 h-8 rounded bg-zinc-800 overflow-hidden flex-shrink-0">
                                  {item.product.image?.[0] ? (
                                    <Image
                                      src={item.product.image[0]}
                                      alt={item.title}
                                      width={32}
                                      height={32}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                      <FiPackage className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">
                                    {item.title}
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    {item.quantity}x{" "}
                                    {formatPrice(item.priceAtTime)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Shipping Address */}
                        <div>
                          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                            Leveringsadresse
                          </h3>
                          <div className="text-sm space-y-1">
                            <div className="font-medium">
                              {order.shipping.name}
                            </div>
                            <div className="text-zinc-400">
                              {order.shipping.address}
                            </div>
                            <div className="text-zinc-400">
                              {order.shipping.postalCode}{" "}
                              {order.shipping.city}
                            </div>
                            <div className="text-zinc-400">
                              {order.shipping.country}
                            </div>
                            {order.shipping.phone && (
                              <div className="text-zinc-500 text-xs mt-2">
                                📞 {order.shipping.phone}
                              </div>
                            )}
                            {order.shipping.email && (
                              <div className="text-zinc-500 text-xs">
                                ✉️ {order.shipping.email}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Panel */}
                        <div>
                          {order.fulfilmentStatus === "UNFULFILLED" && !isDigitalOnly && (
                            <div>
                              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                                Send ordre
                              </h3>

                              {/* Service selector */}
                              <div className="mb-3">
                                <label className="text-xs text-zinc-500 mb-1 block">
                                  Bring-tjeneste
                                </label>
                                <select
                                  value={serviceCode}
                                  onChange={(e) =>
                                    setServiceCode(e.target.value)
                                  }
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
                                >
                                  {Object.entries(BRING_SERVICES).map(
                                    ([code, name]) => (
                                      <option key={code} value={code}>
                                        {name} ({code})
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>

                              {/* Weight */}
                              <div className="mb-4">
                                <label className="text-xs text-zinc-500 mb-1 block">
                                  Vekt (gram)
                                </label>
                                <input
                                  type="number"
                                  value={packageWeight}
                                  onChange={(e) =>
                                    setPackageWeight(
                                      parseInt(e.target.value) || 1000
                                    )
                                  }
                                  min={1}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
                                />
                              </div>

                              {shipError && (
                                <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                                  {shipError}
                                </div>
                              )}

                              <button
                                onClick={() => handleShip(order.id)}
                                disabled={isShipping}
                                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                              >
                                {isShipping ? (
                                  <>
                                    <FiLoader className="w-4 h-4 animate-spin" />
                                    Bestiller frakt...
                                  </>
                                ) : (
                                  <>
                                    <FiTruck className="w-4 h-4" />
                                    Book Bring-forsendelse
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() =>
                                  handleStatusUpdate(order.id, "PROCESSING")
                                }
                                className="w-full mt-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg px-4 py-2 text-sm transition-colors"
                              >
                                Marker som under behandling
                              </button>
                            </div>
                          )}

                          {order.fulfilmentStatus === "PROCESSING" && (
                            <div>
                              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                                Under behandling
                              </h3>
                              <button
                                onClick={() => handleShip(order.id)}
                                disabled={isShipping}
                                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                              >
                                {isShipping ? (
                                  <FiLoader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <FiTruck className="w-4 h-4" />
                                )}
                                Book Bring-forsendelse
                              </button>
                            </div>
                          )}

                          {order.fulfilmentStatus === "SHIPPED" && (
                            <div>
                              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                                Sporingsinfo
                              </h3>
                              <div className="space-y-2 text-sm">
                                {order.trackingNumber && (
                                  <div className="text-zinc-300">
                                    <span className="text-zinc-500">
                                      Sporings-nr:{" "}
                                    </span>
                                    <span className="font-mono">
                                      {order.trackingNumber}
                                    </span>
                                  </div>
                                )}
                                {order.trackingUrl && (
                                  <a
                                    href={order.trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                                  >
                                    <FiExternalLink className="w-3 h-3" />
                                    Spor forsendelse
                                  </a>
                                )}
                                {order.labelUrl && (
                                  <a
                                    href={order.labelUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-zinc-400 hover:text-zinc-300 text-sm"
                                  >
                                    <FiDownload className="w-3 h-3" />
                                    Last ned etikett
                                  </a>
                                )}
                                {order.estimatedDelivery && (
                                  <div className="text-zinc-400 text-xs mt-2">
                                    Forventet levering:{" "}
                                    {formatDate(order.estimatedDelivery)}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() =>
                                  handleStatusUpdate(order.id, "DELIVERED")
                                }
                                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm transition-colors flex items-center justify-center gap-2"
                              >
                                <FiCheckCircle className="w-4 h-4" />
                                Marker som levert
                              </button>
                            </div>
                          )}

                          {order.fulfilmentStatus === "DELIVERED" && (
                            <div className="text-center py-4">
                              <FiCheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                              <div className="text-sm text-emerald-400 font-medium">
                                Levert
                              </div>
                              {order.deliveredAt && (
                                <div className="text-xs text-zinc-500 mt-1">
                                  {formatDate(order.deliveredAt)}
                                </div>
                              )}
                            </div>
                          )}

                          {isDigitalOnly &&
                            order.fulfilmentStatus === "UNFULFILLED" && (
                              <div className="text-center py-4">
                                <div className="text-sm text-purple-300 mb-2">
                                  Digitalt produkt — automatisk levert
                                </div>
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(order.id, "DELIVERED")
                                  }
                                  className="bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-4 py-2 text-sm transition-colors"
                                >
                                  Marker som levert
                                </button>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 disabled:text-zinc-600 text-sm"
                >
                  Forrige
                </button>
                <span className="text-sm text-zinc-500">
                  Side {page} av {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 disabled:text-zinc-600 text-sm"
                >
                  Neste
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
