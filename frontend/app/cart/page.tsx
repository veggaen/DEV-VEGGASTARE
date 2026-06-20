"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
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
  const { data: session } = useSession();
  const router = useRouter();
  const { convertToUSD } = useCurrencyRates();

  useEffect(() => {
    if (session) {
      fetchCartItems();
    } else {
      router.push("/auth/login");
    }
  }, [session]);

  const fetchCartItems = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cart/${session?.user?.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch cart items");
      }
      const data = await response.json();
      setCartItems(data.items);
      const totalQuantity = data.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
      // Sum in USD so mixed-currency carts total correctly; UI converts to the
      // user's selected currency for display.
      const totalPrice = data.items.reduce(
        (sum: number, item: any) =>
          sum + item.quantity * convertToUSD(item.product.price, item.product.priceCurrency ?? "USD"),
        0
      );
      setTotalQuantity(totalQuantity);
      setTotalPrice(totalPrice);
    } catch (error) {
      console.error("Error fetching cart items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = async (itemId: string, changeType: "increment" | "decrement") => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cart/${session?.user?.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeType }),
      });
      if (!response.ok) {
        throw new Error("Failed to update item quantity");
      }
      console.log(`Item quantity ${changeType} successfully!`);
      fetchCartItems();
    } catch (error) {
      console.error("Error updating item quantity:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      setLoading(true);
      console.log(`Removing item ${itemId} from cart`);
      const response = await fetch(`/api/cart/${session?.user?.id}/items/${itemId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Failed to remove item from cart");
      }
      console.log("Item removed from cart successfully");
      fetchCartItems();
    } catch (error) {
      console.error("Error removing item from cart:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    router.push("/checkout");
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 lg:px-8">
        <div className="h-8 w-32 animate-pulse rounded bg-muted/60" />
        <div className="mt-8 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4 py-4">
              <div className="h-16 w-16 animate-pulse rounded-lg bg-muted/60" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted/60" />
                <div className="h-3 w-1/4 animate-pulse rounded bg-muted/50" />
              </div>
            </div>
          ))}
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
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg text-muted-foreground">Your cart is empty.</p>
          <button
            onClick={() => router.push("/products")}
            className="group mt-5 inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all duration-200 hover:gap-3"
          >
            Browse products
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
          {/* Items */}
          <div className="min-w-0 divide-y divide-border/70">
            {cartItems.map((item) => (
              <motion.div
                key={item.id}
                className="group flex items-center gap-4 py-5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
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
                    className="mt-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>

                {/* Quantity stepper — clean inline controls, no pill */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleQuantityChange(item.id, "decrement")}
                    disabled={item.quantity <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="min-w-[28px] text-center text-sm font-medium tabular-nums text-foreground">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(item.id, "increment")}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </motion.div>
            ))}
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
                className="mt-5 w-full rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white shadow-sm shadow-emerald-600/20 transition-all duration-200 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-500/30"
              >
                Proceed to checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;