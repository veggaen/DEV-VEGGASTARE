"use client";

/** @fileOverview Row-isolated cart edits with bounded requests and explicit uncertain-outcome recovery. @stability stable */
import { useCallback, useEffect, useRef, useState } from "react";
import { CartItemResponseSchema, CartResponseSchema, type CartItemDto } from "@/lib/types/carts";

export function useCartPage(userId: string | undefined, syncCart: (items: CartItemDto[]) => void) {
  const [items, setItems] = useState<CartItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const current = useRef<CartItemDto[]>([]);
  const locks = useRef(new Set<string>());
  const requests = useRef(new Set<AbortController>());
  const epoch = useRef(0);
  const uncertain = useRef(false);
  const reading = useRef(false);

  const commit = useCallback((next: CartItemDto[]) => {
    current.current = next;
    setItems(next);
    syncCart(next);
  }, [syncCart]);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const controller = new AbortController();
    requests.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Cart request failed");
      return await response.json();
    } finally {
      clearTimeout(timer);
      requests.current.delete(controller);
    }
  }, []);

  const reload = useCallback(async () => {
    if (!userId || reading.current || locks.current.size) return;
    const version = epoch.current;
    reading.current = true;
    setRefreshing(true);
    try {
      const data = CartResponseSchema.parse(await request(`/api/cart/${userId}`));
      if (epoch.current !== version) return;
      commit(data.items);
      uncertain.current = false;
      setNeedsRefresh(false);
      setError("");
    } catch {
      if (epoch.current !== version) return;
      uncertain.current = true;
      setNeedsRefresh(true);
      setError("We couldn’t confirm your saved cart. Check your connection and refresh before making another change.");
    } finally {
      if (epoch.current === version) {
        reading.current = false;
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [userId, request, commit]);

  useEffect(() => {
    const activeEpoch = ++epoch.current;
    locks.current.clear();
    uncertain.current = false;
    reading.current = false;
    current.current = [];
    setItems([]);
    setPending(new Set());
    setError("");
    setNeedsRefresh(false);
    setLoading(true);
    void reload();
    const activeRequests = requests.current;
    return () => {
      epoch.current = activeEpoch + 1;
      activeRequests.forEach(controller => controller.abort());
      activeRequests.clear();
    };
  }, [reload]);

  const mutate = async (itemId: string, action: "increment" | "decrement" | "remove") => {
    if (!userId || locks.current.has(itemId) || reading.current || uncertain.current) return;
    const previous = current.current.find(item => item.id === itemId);
    if (!previous || (action === "decrement" && previous.quantity <= 1)) return;
    const version = epoch.current;
    locks.current.add(itemId);
    setPending(new Set(locks.current));
    setError("");
    // Keep a removal row mounted until confirmed: focus, errors and retry remain discoverable.
    if (action !== "remove") commit(current.current.map(item => item.id === itemId
      ? { ...item, quantity: item.quantity + (action === "increment" ? 1 : -1) } : item));
    try {
      const result = await request(`/api/cart/${userId}/items/${itemId}`, action === "remove"
        ? { method: "DELETE" }
        : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changeType: action }) });
      if (epoch.current !== version) return;
      if (action === "remove") commit(current.current.filter(item => item.id !== itemId));
      else {
        const updated = CartItemResponseSchema.parse(result);
        if (updated.id !== itemId) throw new Error("Unexpected cart item");
        commit(current.current.map(item => item.id === itemId ? updated : item));
      }
    } catch {
      if (epoch.current !== version) return;
      // Roll back only this row, never another row's in-flight/confirmed change.
      commit(current.current.map(item => item.id === itemId ? previous : item));
      uncertain.current = true;
      setNeedsRefresh(true);
      setError("That change could not be confirmed. We’re checking your saved cart before you continue.");
    } finally {
      if (epoch.current === version) {
        locks.current.delete(itemId);
        setPending(new Set(locks.current));
        // A lost response might still have committed. Re-read, never retry an increment automatically.
        if (uncertain.current && locks.current.size === 0) {
          await reload();
          if (epoch.current === version && !uncertain.current) {
            setError("That change could not be confirmed. Your saved cart is now shown below. Check it before trying again.");
          }
        }
      }
    }
  };

  return { items, loading, error, needsRefresh, refreshing, pending, reload, mutate };
}
