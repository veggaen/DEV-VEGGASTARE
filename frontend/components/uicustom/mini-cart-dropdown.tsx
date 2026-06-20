"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FiShoppingCart, FiTrash2, FiPlus, FiMinus, FiArrowRight, FiPackage, FiShoppingBag } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import PriceAmount from "@/components/crypto-related/PriceAmount";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  product: {
    id: string;
    title: string;
    price: number;
    priceCurrency?: string;
    image: string[];
  };
  quantity: number;
}

interface MiniCartDropdownProps {
  userId: string | undefined;
  cartCount: number;
  onCartUpdate?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MiniCartDropdown({ userId, cartCount, onCartUpdate }: MiniCartDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { convertToUSD } = useCurrencyRates();
  // Subtotal in USD (items may be priced in different currencies). PriceAmount
  // then renders it in the user's selected currency.
  const totalPriceUsd = items.reduce(
    (sum, item) =>
      sum + item.quantity * convertToUSD(item.product.price, item.product.priceCurrency ?? "USD"),
    0
  );
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Handle client-side mounting for portal
  useEffect(() => { setMounted(true); }, []);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open]);

  // Fetch cart items when dropdown opens
  useEffect(() => {
    if (open && userId) {
      setLoading(true);
      fetch(`/api/cart/${userId}`)
        .then(res => res.ok ? res.json() : { items: [] })
        .then(data => setItems(data.items ?? []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
  }, [open, userId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape  
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // ─── Cart actions ────────────────────────────────────────────────────────

  const updateQuantity = useCallback(async (itemId: string, nextQuantity: number) => {
    if (!userId) return;
    const normalized = Math.max(1, Math.min(1000, Math.floor(Number(nextQuantity) || 1)));
    const previousItems = items;
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity: normalized } : item))
    );
    setActionLoading(itemId);
    try {
      const res = await fetch(`/api/cart/${userId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: normalized }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems((prev) => prev.map((item) => (item.id === itemId ? data : item)));
      onCartUpdate?.();
    } catch {
      setItems(previousItems);
      toast.error("Failed to update quantity");
    } finally {
      setActionLoading(null);
    }
  }, [items, onCartUpdate, userId]);

  const handleQuantityChange = async (itemId: string, changeType: "increment" | "decrement") => {
    const current = items.find((item) => item.id === itemId)?.quantity ?? 1;
    await updateQuantity(itemId, changeType === "increment" ? current + 1 : current - 1);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!userId) return;
    setActionLoading(itemId);
    try {
      const res = await fetch(`/api/cart/${userId}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems(prev => prev.filter(i => i.id !== itemId));
      onCartUpdate?.();
      toast.success("Item removed");
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const dropdownContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            zIndex: 9999,
          }}
          className="w-[360px] max-w-[calc(100vw-32px)] rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700/60 dark:bg-zinc-900"
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <FiShoppingBag className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Your Basket
                </span>
                {totalItems > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    {totalItems} item{totalItems !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                ESC
              </button>
            </div>

            {/* Content */}
            {!userId ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <FiShoppingCart className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Log in to see your basket</p>
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Sign in →
                </Link>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <FiPackage className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Your basket is empty</p>
                <Link
                  href="/products"
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Browse products →
                </Link>
              </div>
            ) : (
              <>
                {/* Items list */}
                <ScrollArea className="max-h-[280px]">
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <AnimatePresence mode="popLayout">
                      {items.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex gap-3 px-4 py-3"
                        >
                          {/* Product image */}
                          <Link
                            href={`/products/${item.product.id}`}
                            onClick={() => setOpen(false)}
                            className="relative shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 hover:ring-2 hover:ring-emerald-500/40 transition-all"
                          >
                            {item.product.image?.[0] ? (
                              <Image
                                src={item.product.image[0]}
                                alt={item.product.title}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <FiPackage className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
                              </div>
                            )}
                          </Link>

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/products/${item.product.id}`}
                              onClick={() => setOpen(false)}
                              className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 line-clamp-1 transition-colors"
                            >
                              {item.product.title}
                            </Link>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                <PriceAmount
                                  amount={item.product.price * item.quantity}
                                  currency={item.product.priceCurrency ?? "USD"}
                                />
                              </span>
                              {item.quantity > 1 && (
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                  <PriceAmount
                                    amount={item.product.price}
                                    currency={item.product.priceCurrency ?? "USD"}
                                  />{" "}
                                  each
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantity controls */}
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                              <button
                                onClick={() => handleQuantityChange(item.id, "decrement")}
                                disabled={actionLoading === item.id || item.quantity <= 1}
                                className="flex h-6 w-6 items-center justify-center rounded-l-md text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                              >
                                <FiMinus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={1000}
                                inputMode="numeric"
                                value={item.quantity}
                                aria-label={`Quantity for ${item.product.title}`}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  const next = Math.max(1, Math.min(1000, Number(event.target.value) || 1));
                                  setItems((prev) =>
                                    prev.map((cartItem) => cartItem.id === item.id ? { ...cartItem, quantity: next } : cartItem)
                                  );
                                }}
                                onBlur={(event) => updateQuantity(item.id, Number(event.target.value) || 1)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.currentTarget.blur();
                                  }
                                }}
                                className="h-6 w-8 border-x border-zinc-200 bg-transparent text-center text-xs font-medium tabular-nums text-zinc-700 outline-none focus:bg-emerald-500/10 dark:border-zinc-700 dark:text-zinc-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <button
                                onClick={() => handleQuantityChange(item.id, "increment")}
                                disabled={actionLoading === item.id}
                                className="flex h-6 w-6 items-center justify-center rounded-r-md text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                              >
                                <FiPlus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={actionLoading === item.id}
                              className="text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
                            >
                              <FiTrash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>

                {/* Footer with totals & actions */}
                <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800 space-y-3">
                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Subtotal</span>
                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      <PriceAmount usd={totalPriceUsd} />
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => { setOpen(false); router.push("/cart"); }}
                    >
                      <FiShoppingBag className="mr-1.5 h-3 w-3" />
                      View Full Cart
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                      onClick={() => { setOpen(false); router.push("/checkout"); }}
                    >
                      Checkout
                      <FiArrowRight className="ml-1.5 h-3 w-3" />
                    </Button>
                  </div>

                  {/* Subtle info */}
                  <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">
                    Shipping & taxes calculated at checkout
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
  );

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(prev => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        aria-label={cartCount > 0 ? `${cartCount} item${cartCount !== 1 ? "s" : ""} in basket` : "Basket"}
      >
        <FiShoppingCart className="h-[18px] w-[18px]" />
        {cartCount > 0 && (
          <motion.span
            key={cartCount}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white"
          >
            {cartCount > 99 ? "99+" : cartCount}
          </motion.span>
        )}
      </button>

      {/* Render dropdown in portal to escape overflow:hidden containers */}
      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
