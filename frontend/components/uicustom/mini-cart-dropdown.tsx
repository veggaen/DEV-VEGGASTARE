"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FiShoppingCart, FiTrash2, FiPlus, FiMinus, FiArrowRight, FiPackage, FiShoppingBag } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import PriceAmount, { PriceTotal } from "@/components/crypto-related/PriceAmount";
import { useCartPage } from '@/hooks/use-cart-page';
import { useCart } from '@/contexts/cart-context';
import { isShowcaseProduct } from '@/lib/showcase-catalog';
import { useClientReady } from '@/hooks/use-client-ready';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MiniCartDropdownProps {
  userId: string | undefined;
  cartCount: number;
}

function BasketQuantity({ quantity, draft, setDraft, title, disabled, save }: { quantity: number; draft: string; setDraft: (value: string) => void; title: string; disabled: boolean; save: (value: number) => void }) {
  const value = Number(draft);
  const valid = Number.isInteger(value) && value >= 1 && value <= 1000;
  const changed = draft !== String(quantity);
  return <form className="flex items-center gap-1" onSubmit={event => { event.preventDefault(); if (valid && !disabled) save(value); }}>
    <input type="number" min={1} max={1000} inputMode="numeric" autoComplete="off" name="quantity" value={draft} disabled={disabled} aria-label={`Quantity for ${title}`} aria-invalid={changed && !valid} onChange={event => setDraft(event.target.value)} className="h-11 w-14 bg-transparent text-center text-base font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
    {changed && <button type="submit" disabled={!valid || disabled} className="min-h-11 rounded-md px-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" aria-label={`Save quantity for ${title}`}>Save</button>}
  </form>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MiniCartDropdown({ userId, cartCount }: MiniCartDropdownProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const hasDrafts = Object.keys(drafts).length > 0;
  const { syncCart } = useCart();
  const { items, loading, refreshing, pending, error, needsRefresh, reload, mutate } = useCartPage(activated ? userId : undefined, syncCart);
  const busy = refreshing || pending.size > 0;
  const canCheckout = !busy && !needsRefresh && !hasDrafts && items.every(item => isShowcaseProduct(item.product.id) && item.quantity === 1);
  const mounted = useClientReady();
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const clearDraft = (id: string) => setDrafts(previous => {
    const next = { ...previous }; delete next[id]; return next;
  });
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const leave = (event: FocusEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('focusin', leave);
    return () => document.removeEventListener('focusin', leave);
  }, [open]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (!open) return;
    const position = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: Math.max(16, Math.min(window.innerWidth - rect.right, Math.max(16, window.innerWidth - 376))),
      });
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [open]);

  // Fetch cart items when dropdown opens
  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

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
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const dropdownContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dropdownRef}
          role="dialog"
          aria-label="Shopping basket"
          initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            zIndex: 9999,
          }}
          className="w-[360px] max-w-[calc(100%-32px)] max-h-[calc(100dvh-88px)] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700/60 dark:bg-zinc-900"
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
                ref={closeRef}
                aria-label="Close basket"
                onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
                className="min-h-11 min-w-11 rounded-md text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-ring"
              >
                ESC
              </button>
            </div>

            {error && <div role="alert" className="border-b border-border p-4 text-sm text-foreground">
              <p>{error}</p>
              {needsRefresh && <Button variant="outline" disabled={busy} className="mt-2 min-h-11" onClick={() => void reload()}>{refreshing ? 'Refreshing basket…' : 'Retry saved basket'}</Button>}
            </div>}
            {refreshing && !loading && <p role="status" className="px-4 py-2 text-xs text-muted-foreground">Refreshing saved basket…</p>}
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
              <div role="status" aria-label="Loading basket" className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : items.length === 0 && needsRefresh ? null : items.length === 0 ? (
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
                <div className="max-h-[min(420px,50dvh)] overflow-y-auto overscroll-contain">
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <AnimatePresence mode="popLayout">
                      {items.map((item) => (
                        <motion.div
                          key={item.id}
                          layout={!reducedMotion}
                          initial={reducedMotion ? false : { opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: reducedMotion ? 0 : 20 }}
                          transition={{ duration: reducedMotion ? 0 : 0.2 }}
                          className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 px-4 py-3"
                        >
                          {/* Product image */}
                          <Link
                            href={`/products/${item.product.id}`}
                            onClick={() => setOpen(false)}
                            className="relative shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 hover:ring-2 hover:ring-emerald-500/40 focus-visible:ring-2 focus-visible:ring-ring"
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
                            <div className="mt-1 flex flex-wrap items-center gap-2">
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
                          <div className="col-span-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                              <button
                                aria-label={`Decrease quantity for ${item.product.title}`}
                                onClick={() => { clearDraft(item.id); void mutate(item.id, 'decrement'); }}
                                disabled={pending.has(item.id) || refreshing || needsRefresh || item.quantity <= 1}
                                className="flex size-11 items-center justify-center rounded-l-md text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <FiMinus className="h-3 w-3" />
                              </button>
                              <BasketQuantity quantity={item.quantity} draft={drafts[item.id] ?? String(item.quantity)} setDraft={value => setDrafts(previous => { const next = { ...previous }; if (value === String(item.quantity)) delete next[item.id]; else next[item.id] = value; return next; })} title={item.product.title} disabled={pending.has(item.id) || refreshing || needsRefresh} save={value => { clearDraft(item.id); void mutate(item.id, value); }} />
                              <button
                                aria-label={`Increase quantity for ${item.product.title}`}
                                onClick={() => { clearDraft(item.id); void mutate(item.id, 'increment'); }}
                                disabled={pending.has(item.id) || refreshing || needsRefresh || item.quantity >= 1000}
                                className="flex size-11 items-center justify-center rounded-r-md text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <FiPlus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              aria-label={`Remove ${item.product.title} from basket`}
                              onClick={() => { clearDraft(item.id); void mutate(item.id, 'remove'); }}
                              disabled={pending.has(item.id) || refreshing || needsRefresh}
                              className="flex size-11 items-center justify-center rounded-md text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <FiTrash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Footer with totals & actions */}
                <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800 space-y-3">
                  {/* Total */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Subtotal</span>
                    <span className="min-w-0 text-right text-base font-bold text-zinc-900 dark:text-zinc-100">
                      <PriceTotal entries={items.map(item => ({ amount: item.product.price * item.quantity, currency: item.product.priceCurrency ?? 'USD' }))} />
                    </span>
                  </div>

                  {/* Action buttons */}
                  {hasDrafts && <div className="text-sm text-muted-foreground"><p>Save your quantity edits to update the total.</p><button type="button" className="min-h-11 underline focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setDrafts({})}>Discard quantity edits</button></div>}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 flex-1 text-xs"
                      onClick={() => { setOpen(false); router.push("/cart"); }}
                    >
                      <FiShoppingBag className="mr-1.5 h-3 w-3" />
                      View Full Cart
                    </Button>
                    <Button
                      size="sm"
                      className="min-h-11 flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                      disabled={!canCheckout}
                      onClick={() => { setOpen(false); router.push("/checkout"); }}
                    >
                      Checkout
                      <FiArrowRight className="ml-1.5 h-3 w-3" />
                    </Button>
                  </div>

                  {/* Subtle info */}
                  <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">
                    {!canCheckout && !busy && !needsRefresh ? 'Review item quantities in the full cart before checkout.' : 'Final price and payment method confirmed at checkout.'}
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
        disabled={!mounted}
        onClick={() => { setActivated(true); setOpen(prev => !prev); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        aria-label={cartCount > 0 ? `${cartCount} item${cartCount !== 1 ? "s" : ""} in basket` : "Basket"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FiShoppingCart className="h-[18px] w-[18px]" />
        {cartCount > 0 && (
          <motion.span
            key={cartCount}
            initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
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
