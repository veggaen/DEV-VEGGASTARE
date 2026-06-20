"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";

interface CartItem {
  id: string;
  product: {
    id: string;
    title: string;
    price: number;
    priceCurrency?: string;
    image: string[];
    productType?: string;
    shipFromPostalId?: string;
    freeShippingEnabled?: boolean;
    freeShippingThreshold?: number | null;
  };
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  totalPrice: number;
  isLoading: boolean;
  error: string | null;
  addItem: (productId: string, quantity?: number) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  updateQuantity: (itemId: string, changeType: "increment" | "decrement") => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const itemCount = useMemo(() => 
    items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalPrice = useMemo(() =>
    items.reduce((sum, item) => sum + item.quantity * item.product.price, 0),
    [items]
  );

  const refreshCart = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cart/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch cart");
      const data = await response.json();
      setItems(data.items ?? []);
    } catch (err) {
      console.error("Error fetching cart:", err);
      setError("Failed to load cart");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load cart on mount and when user changes
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addItem = useCallback(async (productId: string, quantity = 1): Promise<boolean> => {
    if (!userId) return false;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cart/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });
      if (!response.ok) throw new Error("Failed to add item");
      await refreshCart();
      return true;
    } catch (err) {
      console.error("Error adding to cart:", err);
      setError("Failed to add item to cart");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId, refreshCart]);

  const removeItem = useCallback(async (itemId: string): Promise<boolean> => {
    if (!userId) return false;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cart/${userId}/items/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove item");
      await refreshCart();
      return true;
    } catch (err) {
      console.error("Error removing from cart:", err);
      setError("Failed to remove item");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId, refreshCart]);

  const updateQuantity = useCallback(async (
    itemId: string, 
    changeType: "increment" | "decrement"
  ): Promise<boolean> => {
    if (!userId) return false;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cart/${userId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeType }),
      });
      if (!response.ok) throw new Error("Failed to update quantity");
      await refreshCart();
      return true;
    } catch (err) {
      console.error("Error updating quantity:", err);
      setError("Failed to update quantity");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId, refreshCart]);

  const clearCart = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cart/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to clear cart");
      setItems([]);
      return true;
    } catch (err) {
      console.error("Error clearing cart:", err);
      setError("Failed to clear cart");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        totalPrice,
        isLoading,
        error,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

