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
          className="w-full max-w-md p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">Loading Cart...</h1>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <motion.div
              className="bg-blue-600 h-2.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
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
      <h1 className="text-4xl font-extrabold mb-6 text-gray-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Shopping Cart</h1>
      {cartItems.length === 0 ? (
        <p className="text-center text-gray-600 dark:text-gray-400 text-lg">Your cart is empty.</p>
      ) : (
        <div>
          {cartItems.map((item) => (
            <motion.div
              key={item.id}
              className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1440px] w-full bg-white dark:bg-gray-900 p-3 lg:p-4 rounded-xl shadow-lg mb-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 flex-1">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                  <AspectRatio ratio={1 / 1}>
                    <Image src={item.product.image[0]} alt={item.product.title} fill className="object-cover" />
                  </AspectRatio>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{item.product.title}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">${item.product.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => handleQuantityChange(item.id, "decrement")}
                    disabled={item.quantity <= 1}
                    className="w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm"
                  >
                    -
                  </Button>
                  <span className="text-lg text-gray-800 dark:text-gray-200 min-w-[30px] text-center">
                    {item.quantity}
                  </span>
                  <Button
                    onClick={() => handleQuantityChange(item.id, "increment")}
                    className="w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm"
                  >
                    +
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => handleRemoveItem(item.id)}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm"
                >
                  Remove
                </Button>
              </div>
            </motion.div>
          ))}
          <motion.div
            className="mt-6 p-4 lg:p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Order Summary</h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg">Total Items: {totalQuantity}</p>
            <p className="text-gray-600 dark:text-gray-400 text-lg">Total Price: ${totalPrice.toFixed(2)}</p>
            <Button
              onClick={handleCheckout}
              className="mt-4 w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-lg py-2 rounded-lg shadow-lg"
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