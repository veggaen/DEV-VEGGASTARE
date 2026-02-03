"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface CartItem {
  id: string;
  product: {
    id: string;
    title: string;
    price: number;
    image: string[];
  };
  quantity: number;
}

const CartPage = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [totalQuantity, setTotalQuantity] = useState<number>(0);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const router = useRouter();

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
      const totalPrice = data.items.reduce((sum: number, item: any) => sum + item.quantity * item.product.price, 0);
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
      <div className="w-full min-h-screen flex items-center justify-center">
        <motion.div
          className="w-full max-w-md p-6 bg-surface-1 dark:bg-white/[0.02] border border-border dark:border-white/10 rounded-xl"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-4 text-center">Loading Cart...</h1>
          <div className="w-full bg-muted dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="bg-emerald-500 h-2.5 rounded-full"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              style={{ width: "50%" }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return <p>Loading...</p>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-8">
      <h1 className="text-4xl font-extrabold mb-6 text-foreground">Shopping Cart</h1>
      {cartItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg mb-4">Your cart is empty.</p>
          <Button onClick={() => router.push("/products")} variant="outline">
            Continue Shopping
          </Button>
        </div>
      ) : (
        <div>
          {cartItems.map((item) => (
            <motion.div
              key={item.id}
              className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-[1440px] w-full bg-surface-1 dark:bg-white/[0.02] border border-border dark:border-white/10 p-4 lg:p-5 rounded-xl mb-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted dark:bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                  <AspectRatio ratio={1 / 1}>
                    <Image src={item.product.image[0]} alt={item.product.title} fill className="object-cover" />
                  </AspectRatio>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-foreground truncate">{item.product.title}</h2>
                  <p className="text-sm text-muted-foreground">${item.product.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-muted/50 dark:bg-white/5 rounded-lg px-2 py-1">
                  <Button
                    onClick={() => handleQuantityChange(item.id, "decrement")}
                    disabled={item.quantity <= 1}
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full hover:bg-zinc-200 dark:hover:bg-white/10"
                  >
                    -
                  </Button>
                  <span className="text-lg font-medium text-foreground min-w-[32px] text-center">
                    {item.quantity}
                  </span>
                  <Button
                    onClick={() => handleQuantityChange(item.id, "increment")}
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full hover:bg-zinc-200 dark:hover:bg-white/10"
                  >
                    +
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  Remove
                </Button>
              </div>
            </motion.div>
          ))}
          <motion.div
            className="mt-6 p-5 lg:p-6 bg-surface-1 dark:bg-white/[0.02] border border-border dark:border-white/10 rounded-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-semibold text-foreground mb-4">Order Summary</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Items:</span>
                <span className="font-medium text-foreground">{totalQuantity}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span className="text-foreground">Total Price:</span>
                <span className="text-emerald-600 dark:text-emerald-400">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <Button
              onClick={handleCheckout}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white transition-all duration-300 text-lg py-3 rounded-xl"
            >
              Proceed to Checkout
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CartPage;