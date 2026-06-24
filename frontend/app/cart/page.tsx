"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { motion } from "framer-motion";
import { FiShoppingBag, FiMinus, FiPlus, FiTrash2, FiLoader } from "react-icons/fi";
import PriceAmount from "@/components/crypto-related/PriceAmount";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";

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

const CartPage = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [totalQuantity, setTotalQuantity] = useState<number>(0);
  const [totalPrice, setTotalPrice] = useState<number>(0); // USD
  const [loading, setLoading] = useState(true);
  // Per-item pending set: mutating one row disables just that row's controls
  // instead of flashing the whole page back to the skeleton (perceived perf).
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  const [checkingOut, setCheckingOut] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const { convertToUSD } = useCurrencyRates();

  const recompute = useCallback(
    (items: CartItem[]) => {
      const qty = items.reduce((sum, item) => sum + item.quantity, 0);
      // Sum in USD so mixed-currency carts total correctly; UI converts to the
      // user's selected currency for display.
      const usd = items.reduce(
        (sum, item) =>
          sum + item.quantity * convertToUSD(item.product.price, item.product.priceCurrency ?? "USD"),
        0
      );
      setTotalQuantity(qty);
      setTotalPrice(usd);
    },
    [convertToUSD]
  );

  const fetchCartItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/cart/${session?.user?.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch cart items");
      }
      const data = await response.json();
      const items: CartItem[] = data.items;
      setCartItems(items);
      recompute(items);
    } catch (error) {
      console.error("Error fetching cart items:", error);
    }
  }, [session?.user?.id, recompute]);

  useEffect(() => {
    if (session) {
      setLoading(true);
      fetchCartItems().finally(() => setLoading(false));
    } else {
      router.push("/auth/login");
    }
  }, [session, fetchCartItems, router]);

  const setPending = (itemId: string, on: boolean) => {
    setPendingItems((prev) => {
      const next = new Set(prev);
      if (on) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  const handleQuantityChange = async (itemId: string, changeType: "increment" | "decrement") => {
    // Optimistic update — reflect the change instantly, reconcile from the server
    // after. No full-page skeleton flash for a single tap.
    const prevItems = cartItems;
    const optimistic = cartItems.map((item) =>
      item.id === itemId
        ? { ...item, quantity: Math.max(1, item.quantity + (changeType === "increment" ? 1 : -1)) }
        : item
    );
    setCartItems(optimistic);
    recompute(optimistic);
    setPending(itemId, true);
    try {
      const response = await fetch(`/api/cart/${session?.user?.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeType }),
      });
      if (!response.ok) {
        throw new Error("Failed to update item quantity");
      }
      await fetchCartItems();
    } catch (error) {
      console.error("Error updating item quantity:", error);
      // Roll back the optimistic change on failure.
      setCartItems(prevItems);
      recompute(prevItems);
    } finally {
      setPending(itemId, false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const prevItems = cartItems;
    // Optimistically drop the row so removal feels instant.
    const optimistic = cartItems.filter((item) => item.id !== itemId);
    setCartItems(optimistic);
    recompute(optimistic);
    setPending(itemId, true);
    try {
      const response = await fetch(`/api/cart/${session?.user?.id}/items/${itemId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Failed to remove item from cart");
      }
      await fetchCartItems();
    } catch (error) {
      console.error("Error removing item from cart:", error);
      setCartItems(prevItems);
      recompute(prevItems);
    } finally {
      setPending(itemId, false);
    }
  };

  const handleCheckout = () => {
    setCheckingOut(true);
    router.push("/checkout");
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8 lg:py-10">
        <div className="mb-8 border-b border-border pb-5">
          <div className="h-3 w-16 animate-pulse rounded bg-muted/60" />
          <div className="mt-3 h-8 w-40 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
          <div className="min-w-0 divide-y divide-border/70">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 py-5" style={{ opacity: Math.max(0.4, 1 - i * 0.2) }}>
                <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-muted/60 sm:h-20 sm:w-20" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted/60" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-muted/50" />
                </div>
                <div className="h-11 w-28 animate-pulse rounded-md bg-muted/50" />
              </div>
            ))}
          </div>
          <div className="hidden lg:block">
            <div className="h-44 w-full animate-pulse rounded-xl bg-muted/50" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-8 border-b border-border pb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Cart</div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Your cart
        </h1>
      </div>

      {cartItems.length === 0 ? (
        <motion.div
          className="flex flex-col items-center justify-center px-6 py-24 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Icon in a soft ring — gives the empty state a focal point instead of
              a lone line of text floating in a void. Subtle, no decorative glow. */}
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-muted/60 ring-1 ring-border/60">
            <FiShoppingBag className="h-7 w-7 text-muted-foreground/70" />
          </div>
          <h2 className="mt-6 text-lg font-semibold tracking-tight text-foreground">
            Your cart is empty
          </h2>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            Nothing here yet — explore the marketplace and add something you like.
          </p>
          <button
            onClick={() => router.push("/products")}
            className="group mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-[gap] duration-200 hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Browse products
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
          {/* Items */}
          <div className="min-w-0 divide-y divide-border/70">
            {cartItems.map((item) => {
              const isPending = pendingItems.has(item.id);
              return (
                <motion.div
                  key={item.id}
                  layout
                  className="group flex flex-wrap items-center gap-x-4 gap-y-3 py-5 sm:flex-nowrap"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: isPending ? 0.6 : 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted/40 transition-transform duration-200 group-hover:-translate-y-0.5 sm:h-20 sm:w-20">
                    <AspectRatio ratio={1 / 1}>
                      <Image src={item.product.image[0]} alt={item.product.title} fill className="object-cover" />
                    </AspectRatio>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-medium text-foreground">{item.product.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <PriceAmount amount={item.product.price} currency={item.product.priceCurrency ?? "USD"} />
                    </p>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={isPending}
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 -ml-1 rounded-md px-1 text-xs text-muted-foreground/80 transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 sm:py-1"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>

                  {/* Quantity stepper — 44–48px touch targets per control. */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleQuantityChange(item.id, "decrement")}
                      disabled={item.quantity <= 1 || isPending}
                      className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Decrease quantity"
                    >
                      <FiMinus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums text-foreground">
                      {isPending ? (
                        <FiLoader className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        item.quantity
                      )}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item.id, "increment")}
                      disabled={isPending}
                      className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Increase quantity"
                    >
                      <FiPlus className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border border-border bg-surface-1 p-5 lg:p-6">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items</span>
                  <span className="tabular-nums text-foreground">{totalQuantity}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="text-xl font-semibold tabular-nums text-foreground">
                    <PriceAmount usd={totalPrice} />
                  </span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-brand-accent py-2.5 text-sm font-semibold text-brand-accent-foreground shadow-sm transition-colors duration-200 hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {checkingOut ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Loading checkout…
                  </>
                ) : (
                  "Proceed to checkout"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
