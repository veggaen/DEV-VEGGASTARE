/** @fileOverview Original-currency cart estimates; checkout remains server-authoritative. @stability stable */
import type { CartItemDto } from "@/lib/types/carts";

export function formatCartMoney(amount: number, currency = "USD"): string | null {
  if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) return null;
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "code" }).format(amount);
  } catch { return null; }
}

export function cartCurrencyTotals(items: CartItemDto[]) {
  const totals = new Map<string, number>();
  for (const { product, quantity } of items) {
    const currency = product.priceCurrency ?? "USD";
    const amount = product.price * quantity;
    if (!formatCartMoney(amount, currency)) return null;
    const total = (totals.get(currency) ?? 0) + amount;
    if (!Number.isFinite(total)) return null;
    totals.set(currency, total);
  }
  return [...totals].map(([currency, amount]) => ({ currency, formatted: formatCartMoney(amount, currency) }));
}
