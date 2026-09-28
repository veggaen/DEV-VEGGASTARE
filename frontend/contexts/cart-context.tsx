"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";
import type { CreditIntent } from '@/lib/payments/settlement-input';
import { settlementRequest } from '@/lib/payments/settlement-client';
import { CartItemResponseSchema } from '@/lib/types/carts';

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
  creditAmount?: number;
  creditDiscountOre?: number;
  creditSpendMinor?: number | null;
  creditSpendCurrency?: string | null;
  updatedAt?: string;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  totalPrice: number;
  isLoading: boolean;
  error: string | null;
  addItem: (productId: string, quantity?: number, creditAmount?: number) => Promise<boolean>;
  updateCredits: (itemId: string, creditAmount: number) => Promise<boolean>;
  addCreditIntent: (intent: CreditIntent) => Promise<boolean>;
  updateCreditIntent: (itemId: string, revision: string, intent: CreditIntent) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  updateQuantity: (itemId: string, changeType: "increment" | "decrement") => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  refreshCart: () => Promise<void>;
  syncCart: (items: CartItem[]) => void;
  checkoutBlocked: boolean;
  setCartEditing: (editorId: string, busy: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { convertToUSD } = useCurrencyRates();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeEditors, setActiveEditors] = useState<Set<string>>(new Set());
  const setCartEditing = useCallback((editorId: string, busy: boolean) => {
    setActiveEditors(previous => {
      if (previous.has(editorId) === busy) return previous;
      const next = new Set(previous);
      if (busy) next.add(editorId); else next.delete(editorId);
      return next;
    });
  }, []);

  const userId = session?.user?.id;
  const currentUser = useRef(userId); currentUser.current = userId;

  const itemCount = useMemo(() =>
    items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  // BUG FIX: previously summed item.product.price RAW, ignoring per-item
  // currency — so a mixed-currency cart (e.g. 100 NOK + 50 USD) totalled as if
  // every price were the same currency. Sum in USD via convertToUSD so the
  // context's totalPrice is correct for any consumer (matches the cart page).
  const totalPrice = useMemo(() =>
    items.reduce(
      (sum, item) =>
        sum + item.quantity * convertToUSD(item.product.price, item.product.priceCurrency ?? "USD"),
      0
    ),
    [items, convertToUSD]
  );

  const refreshCart = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cart/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch cart");
      const data = await response.json();
      if (currentUser.current !== userId) return;
      setItems(data.items ?? []);
    } catch (err) {
      console.error("Error fetching cart:", err);
      if (currentUser.current === userId) setError("Failed to load cart");
    } finally {
      if (currentUser.current === userId) setIsLoading(false);
    }
  }, [userId]);

  // Load cart on mount and when user changes
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addItem = useCallback(async (productId: string, quantity = 1, creditAmount?: number): Promise<boolean> => {
    if (!userId) return false;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cart/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity, creditAmount }),
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

  const updateCredits = useCallback(async (itemId: string, creditAmount: number) => {
    if (!userId) return false;
    try {
      const response = await fetch(`/api/cart/${userId}/items/${itemId}`, { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creditAmount }), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return false;
      const item = await response.json();
      setItems(previous => previous.map(row => row.id === itemId ? item : row));
      return true;
    } catch { return false; }
  }, [userId]);

  const saveCreditIntent = useCallback(async (intent: CreditIntent, itemId?: string, revision?: string) => {
    if (!userId) return false;
    setIsLoading(true);
    try {
      const result = await settlementRequest('/api/checkout/credit-intent', itemId
        ? { itemId, expectedUpdatedAt: revision, intent } : intent, undefined, itemId ? 'PATCH' : 'POST');
      const item = CartItemResponseSchema.parse(result);
      if (currentUser.current !== userId) return false;
      if (itemId && item.id !== itemId) throw new Error('Unexpected cart item');
      setItems(previous => [...previous.filter(row => row.product.id !== item.product.id), item]);
      setError(null);
      return true;
    } catch { if (currentUser.current === userId) setError('Your basket change could not be confirmed. Refresh your basket before trying again.'); return false; }
    finally { if (currentUser.current === userId) setIsLoading(false); }
  }, [userId]);
  const addCreditIntent = useCallback((intent: CreditIntent) => saveCreditIntent(intent), [saveCreditIntent]);
  const updateCreditIntent = useCallback((itemId: string, revision: string, intent: CreditIntent) => saveCreditIntent(intent, itemId, revision), [saveCreditIntent]);

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
        updateCredits,
        addCreditIntent,
        updateCreditIntent,
        clearCart,
        refreshCart,
        syncCart: setItems,
        checkoutBlocked: activeEditors.size > 0,
        setCartEditing,
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

