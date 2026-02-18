"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";

import { useCurrentUser } from "@/hooks/use-current-user";
import { AddressSelector } from "@/components/uicustom/address-selector";
import { ShippingMethodSelector } from "@/components/uicustom/shipping-method-selector";
import type { SelectedShipping } from "@/components/uicustom/shipping-method-selector";
import type { Address } from "@/hooks/use-addresses";
import type { AddressData } from "@/components/uicustom/address-input";

/* --- App contexts (already mounted in layout) --- */
import { useActiveNetwork } from "@/components/crypto-related/ActiveNetworkContext";
import { usePricing } from "@/components/crypto-related/PricingContext";
/* Renders “X NATIVE (~$Y)” and stays in sync with PricingContext */
import PriceAmount from "@/components/crypto-related/PriceAmount";

/* --- Wagmi (EVM) --- */
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits } from "viem";

/* --- Solana --- */
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";

/* ============ Types ============ */
interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    price: number;
    image: string[];
    productType?: string;
    shipFromPostalId?: string;
    freeShippingEnabled?: boolean;
    freeShippingThreshold?: number | null;
  };
}

interface ShippingContact {
  name: string;
  phone: string;
  email: string;
}

/* ============ Helpers ============ */
function formatAddr(addr?: string | null) {
  if (!addr) return "";
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function solanaRpcFor(cluster: WalletAdapterNetwork) {
  // You can override these via env if you have a custom RPC
  const env =
    cluster === WalletAdapterNetwork.Mainnet
      ? process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET
      : cluster === WalletAdapterNetwork.Testnet
      ? process.env.NEXT_PUBLIC_SOLANA_RPC_TESTNET
      : process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET;

  if (env) return env;

  if (cluster === WalletAdapterNetwork.Mainnet) return "https://solana-rpc.publicnode.com";
  if (cluster === WalletAdapterNetwork.Testnet) return "https://api.testnet.solana.com";
  return "https://api.devnet.solana.com";
}

function receiverAddressFor(active: ReturnType<typeof useActiveNetwork>["active"]) {
  if (active.kind === "evm") {
    if (active.chainId === 369) return process.env.NEXT_PUBLIC_RECEIVER_PLS ?? "0x45Ce973C2363785a1FB3ca7a2714575432DD8C99";
    return process.env.NEXT_PUBLIC_RECEIVER_ETH ?? "0x45Ce973C2363785a1FB3ca7a2714575432DD8C99";
  }
  return process.env.NEXT_PUBLIC_RECEIVER_SOL ?? "Bmm2RU2g6LGd4UFmYDp8YvUwonhkvz44D3EMkccq3FZs";
}

/** QR code URL via public API */
function qrCodeUrl(data: string, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

/** Format seconds into MM:SS */
function fmtTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Payment expiry timer (15 minutes) */
const PAYMENT_TIMER_SECONDS = 15 * 60;

/* ============ Page ============ */
export default function CheckoutPage() {
  const router = useRouter();
  const user = useCurrentUser();

  /* network + pricing */
  const { active } = useActiveNetwork();
  const { rates, nativeSymbol, convertFromUSD } = usePricing();

  /* wallets */
  const evm = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const sol = useWallet();

  /* ui & data */
  const [items, setItems] = useState<CartItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'crypto' | 'vipps' | 'klarna' | 'paypal'>('crypto');
  const [availableFiatMethods, setAvailableFiatMethods] = useState<{ type: string; displayName: string; icon: string }[]>([]);

  /* Crypto payment verification states */
  const [verifyingTx, setVerifyingTx] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paymentTimerActive, setPaymentTimerActive] = useState(false);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(PAYMENT_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* shipping — address book + contact */
  const [selectedShipping, setSelectedShipping] = useState<SelectedShipping | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [customAddress, setCustomAddress] = useState<Partial<AddressData>>({});
  const [shippingContact, setShippingContact] = useState<ShippingContact>({
    name: "",
    phone: "",
    email: user?.email ?? "",
  });

  // Derived shipping fields from selected address OR custom address
  const resolvedAddress = useMemo(() => {
    if (selectedAddress) {
      return {
        addressLine1: selectedAddress.addressLine1,
        postalCode: selectedAddress.postalCode,
        city: selectedAddress.city,
        country: selectedAddress.country,
      };
    }
    if (customAddress?.addressLine1 && customAddress?.postalCode && customAddress?.city) {
      return {
        addressLine1: customAddress.addressLine1 + (customAddress.addressLine2 ? `, ${customAddress.addressLine2}` : ""),
        postalCode: customAddress.postalCode,
        city: customAddress.city,
        country: customAddress.country || "NO",
      };
    }
    return null;
  }, [selectedAddress, customAddress]);

  // Determine if all items are digital-only (no shipping needed)
  const allDigital = useMemo(
    () => items.length > 0 && items.every((it) => it.product.productType === "DIGITAL"),
    [items]
  );

  // Get the first seller postal code from cart items (for shipping rate lookup)
  const sellerPostalCode = useMemo(() => {
    for (const it of items) {
      if (it.product.shipFromPostalId) return it.product.shipFromPostalId;
    }
    return "4310"; // Fallback: Hommersåk (Veggat HQ)
  }, [items]);

  // NOK per USD for shipping cost conversion
  const nokPerUsd = useMemo(() => {
    if (rates.NOK?.usd) return 1 / rates.NOK.usd;
    return 11.0;
  }, [rates]);

  const isShippingValid = useMemo(() => {
    const baseValid =
      resolvedAddress !== null &&
      shippingContact.name.trim().length >= 2 &&
      shippingContact.email.includes("@");
    // Digital-only orders don't need a shipping method
    if (allDigital) return baseValid;
    // Physical orders need a selected shipping method
    return baseValid && selectedShipping !== null;
  }, [resolvedAddress, shippingContact, allDigital, selectedShipping]);

  // Check if all items qualify for free shipping
  const freeShipping = useMemo(() => {
    if (allDigital) return true;
    return items.every((it) => {
      if (it.product.productType === "DIGITAL") return true;
      if (it.product.freeShippingEnabled) {
        if (!it.product.freeShippingThreshold) return true;
        return it.product.price * it.quantity >= it.product.freeShippingThreshold;
      }
      return false;
    });
  }, [items, allDigital]);

  const updateContact = (field: keyof ShippingContact, value: string) => {
    setShippingContact((prev) => ({ ...prev, [field]: value }));
  };

  /* Payment countdown timer */
  useEffect(() => {
    if (paymentTimerActive && paymentTimeLeft > 0) {
      timerRef.current = setInterval(() => {
        setPaymentTimeLeft((t) => {
          if (t <= 1) {
            setPaymentTimerActive(false);
            setError("Payment window expired. Prices may have changed. Please try again.");
            setShowError(true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paymentTimerActive, paymentTimeLeft]);

  /* load cart (server has USD prices) */
  const loadCart = useCallback(async () => {
    if (!user?.id) return;
    setPageLoading(true);
    try {
      const res = await fetch(`/api/cart/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch cart");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (e) {
      console.error(e);
      setError("Unable to load cart. Please try again.");
      setShowError(true);
    } finally {
      setPageLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    loadCart();
  }, [user, loadCart, router]);

  /* fetch available fiat payment methods */
  useEffect(() => {
    fetch("/api/payments")
      .then((r) => (r.ok ? r.json() : { methods: [] }))
      .then((d) => setAvailableFiatMethods(d.methods ?? []))
      .catch(() => setAvailableFiatMethods([]));
  }, []);

  /* totals */
  const subtotalUSD = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity * it.product.price, 0),
    [items]
  );

  // Shipping cost in USD (0 if free shipping or digital)
  const shippingCostUSD = useMemo(() => {
    if (allDigital || freeShipping) return 0;
    return selectedShipping?.priceUSD ?? 0;
  }, [allDigital, freeShipping, selectedShipping]);

  // Grand total = subtotal + shipping
  const grandTotalUSD = useMemo(
    () => subtotalUSD + shippingCostUSD,
    [subtotalUSD, shippingCostUSD]
  );

  // price per native (USD per 1 native)
  const usdPerNative = useMemo(() => {
    if (nativeSymbol === "ETH") return rates.ETH?.usd ?? null;
    if (nativeSymbol === "PLS") return rates.PLS?.usd ?? null;
    if (nativeSymbol === "SOL") return rates.SOL?.usd ?? null;
    return null;
  }, [nativeSymbol, rates]);

  // total to pay in native token, following the active network
  const totalInNative = useMemo(
    () => convertFromUSD(grandTotalUSD, "NATIVE"),
    [grandTotalUSD, convertFromUSD]
  );

  /* sender/receiver addresses */
  const senderAddress = useMemo(() => {
    if (active.kind === "evm") return evm.address ?? "";
    if (active.kind === "solana") return sol.publicKey ? sol.publicKey.toBase58() : "";
    return "";
  }, [active, evm.address, sol.publicKey]);

  const receiverAddress = useMemo(() => receiverAddressFor(active), [active]);

  /* network label */
  const networkLabel = useMemo(() => {
    if (active.kind === "evm") {
      return active.chainId === 369 ? "PulseChain (EVM)" : "Ethereum (EVM)";
    }
    const m =
      active.cluster === WalletAdapterNetwork.Mainnet
        ? "Solana (Mainnet)"
        : active.cluster === WalletAdapterNetwork.Testnet
        ? "Solana (Testnet)"
        : "Solana (Devnet)";
    return m;
  }, [active]);

  /* ready to pay? */
  const isWalletReady =
    (active.kind === "evm" && !!evm.address) || (active.kind === "solana" && !!sol.publicKey);

  /* -------- Payment actions -------- */
  const recordOrder = useCallback(
    async (txHashValue: string, blockNum?: number) => {
      try {
        const chainFamily = active.kind === "evm" ? "EVM" : "SOLANA";
        const chainId = active.kind === "evm" ? active.chainId : undefined;
        const tokenSym = nativeSymbol;
        const usdRate = usdPerNative ?? undefined;
        // Compute NOK rate: tokenPriceUSD / (NOK_per_USD)
        // rates.NOK.usd = how many USD 1 NOK is worth, so 1 USD = 1/rates.NOK.usd NOK
        const nokPerUsd = rates.NOK?.usd ? (1 / rates.NOK.usd) : undefined;
        const nokRate = usdRate && nokPerUsd ? usdRate * nokPerUsd : undefined;

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalAmount: grandTotalUSD,
            transactionId: txHashValue,
            method: "CRYPTO_NATIVE",
            commentOrder: `${items.length} items`,
            commentPay: `Paid ${totalInNative} ${nativeSymbol} on ${networkLabel}`,
            // On-chain crypto data
            chainFamily,
            chainId,
            tokenSymbol: tokenSym,
            nativeAmount: totalInNative?.toString() ?? "0",
            senderAddress,
            receiverAddress,
            blockNumber: blockNum ?? null,
            nokRateAtTime: nokRate ?? null,
            usdRateAtTime: usdRate ?? null,
            // Shipping info
            shippingName: shippingContact.name,
            shippingAddress: resolvedAddress?.addressLine1 ?? "",
            shippingCity: resolvedAddress?.city ?? "",
            shippingPostalCode: resolvedAddress?.postalCode ?? "",
            shippingCountry: resolvedAddress?.country ?? "NO",
            shippingPhone: shippingContact.phone,
            shippingEmail: shippingContact.email,
            shippingMethod: selectedShipping?.serviceCode ?? null,
            shippingCost: shippingCostUSD > 0 ? shippingCostUSD : null,
            // Cart items for OrderItem records
            items: items.map((it) => ({
              productId: it.product.id,
              quantity: it.quantity,
              priceAtTime: it.product.price,
              title: it.product.title,
            })),
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to record order");
        }
        const orderData = await res.json();
        // clear cart
        await fetch(`/api/cart/${user?.id}`, { method: "DELETE" });
        return orderData;
      } catch (e) {
        console.error("Order recording failed:", e);
        throw e;
      }
    },
    [user?.id, items, grandTotalUSD, networkLabel, shippingContact, resolvedAddress, active, nativeSymbol, usdPerNative, rates, totalInNative, senderAddress, receiverAddress, selectedShipping, shippingCostUSD]
  );

  /** Confirm order after on-chain verification */
  const confirmOrder = useCallback(async (orderId: string, txId: string, blockNum?: number) => {
    try {
      const res = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, transactionId: txId, blockNumber: blockNum }),
      });
      if (!res.ok) {
        console.warn("Order confirmation failed:", await res.text());
      }
    } catch (e) {
      console.error("Order confirm error:", e);
    }
  }, []);

  /**
   * Book Bring shipment after payment succeeds.
   * Non-blocking: failures are logged but don't break the order flow.
   */
  const bookShipment = useCallback(
    async (orderId: string) => {
      if (allDigital || !selectedShipping || !resolvedAddress) return;
      try {
        // 1. Create Bring booking
        const bookRes = await fetch("/api/bring-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: {
              name: "Veggat",
              address: "Blåskjellveien 5B",
              postalCode: sellerPostalCode,
              city: "Hommersåk",
              countryCode: "NO",
              email: "orders@veggat.com",
            },
            recipient: {
              name: shippingContact.name,
              address: resolvedAddress.addressLine1,
              postalCode: resolvedAddress.postalCode,
              city: resolvedAddress.city,
              countryCode: resolvedAddress.country || "NO",
              email: shippingContact.email || undefined,
              phone: shippingContact.phone || undefined,
            },
            packages: [
              {
                weight: items.reduce((sum, it) => sum + it.quantity * 1000, 0), // grams
                description: `Veggat order ${orderId}`,
              },
            ],
            serviceCode: selectedShipping.serviceCode,
            orderId,
          }),
        });

        if (!bookRes.ok) {
          console.warn("[checkout] Bring booking failed:", await bookRes.text());
          return;
        }

        const booking = await bookRes.json();

        // 2. Persist tracking info on order
        if (booking.success && booking.booking) {
          await fetch(`/api/orders/${orderId}/shipping`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trackingNumber: booking.booking.consignmentNumber ?? null,
              trackingUrl: booking.booking.trackingUrl ?? null,
              bringConsignmentId: booking.booking.consignmentNumber ?? null,
              shippingServiceName: selectedShipping.serviceName,
              estimatedDelivery: selectedShipping.estimatedDelivery ?? null,
            }),
          });
        }
      } catch (e) {
        // Non-blocking — order is already placed
        console.error("[checkout] Bring booking error:", e);
      }
    },
    [allDigital, selectedShipping, resolvedAddress, sellerPostalCode, shippingContact, items]
  );

  async function handlePayEvmNative() {
    if (!walletClient || !publicClient) throw new Error("Wallet not connected");

    if (!totalInNative || totalInNative <= 0) throw new Error("Invalid amount");
    if (!receiverAddress || !receiverAddress.startsWith("0x")) throw new Error("Receiver address (EVM) missing");

    // ETH & PLS both use 18 decimals
    const value = parseUnits(totalInNative.toString(), 18);

    // Start payment timer
    setPaymentTimerActive(true);
    setPaymentTimeLeft(PAYMENT_TIMER_SECONDS);

    const hash = await walletClient.sendTransaction({
      to: receiverAddress as `0x${string}`,
      value,
    });

    setTxHash(hash);
    setVerifyingTx(true);

    // Record order as CONFIRMING
    const orderData = await recordOrder(hash);

    // Wait for on-chain confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    setVerifyingTx(false);
    setPaymentTimerActive(false);

    // Confirm order after on-chain verification
    if (orderData?.id) {
      await confirmOrder(orderData.id, hash, Number(receipt.blockNumber));
      // Book shipment (non-blocking — fires after order confirmed)
      bookShipment(orderData.id);
    }
  }

  async function handlePaySolana() {
    const from = sol.publicKey;
    if (!from || !sol.signTransaction) throw new Error("Solana wallet not connected");
    if (!totalInNative || totalInNative <= 0) throw new Error("Invalid amount");

    const endpoint = solanaRpcFor(active.kind === "solana" ? active.cluster : WalletAdapterNetwork.Devnet);
    const connection = new Connection(endpoint);
    const to = new PublicKey(receiverAddress);

    const lamports = Math.floor(totalInNative * LAMPORTS_PER_SOL);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports,
      })
    );
    tx.feePayer = from;
    const { blockhash } = await connection.getRecentBlockhash();
    tx.recentBlockhash = blockhash;

    // Start payment timer
    setPaymentTimerActive(true);
    setPaymentTimeLeft(PAYMENT_TIMER_SECONDS);

    const signed = await sol.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());

    setTxHash(sig);
    setVerifyingTx(true);

    // Record order as CONFIRMING
    const orderData = await recordOrder(sig);

    // Wait for on-chain confirmation
    await connection.confirmTransaction(sig, "confirmed");
    setVerifyingTx(false);
    setPaymentTimerActive(false);

    // Confirm order
    if (orderData?.id) {
      await confirmOrder(orderData.id, sig);
      bookShipment(orderData.id);
    }
  }

  async function handleConfirmPay() {
    try {
      setPaying(true);
      setTxHash(null);
      setVerifyingTx(false);
      if (active.kind === "evm") await handlePayEvmNative();
      else await handlePaySolana();
      router.push("/order-confirmation");
    } catch (e) {
      console.error("Payment failed:", e);
      setPaymentTimerActive(false);
      setVerifyingTx(false);
      setError(
        active.kind === "evm"
          ? "EVM payment failed. Check your wallet and try again."
          : "Solana payment failed. Check your wallet and try again."
      );
      setShowError(true);
    } finally {
      setPaying(false);
      setConfirmOpen(false);
    }
  }

  /* ---- Fiat payment flow ---- */
  async function handlePayFiat() {
    if (!isShippingValid) return;
    try {
      setPaying(true);

      // 1. Create a PENDING order first
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: grandTotalUSD,
          transactionId: `fiat_${Date.now()}`,
          method: paymentMethod.toUpperCase(),
          commentOrder: `${items.length} items`,
          commentPay: `Fiat payment via ${paymentMethod}`,
          shippingName: shippingContact.name,
          shippingAddress: resolvedAddress?.addressLine1 ?? "",
          shippingCity: resolvedAddress?.city ?? "",
          shippingPostalCode: resolvedAddress?.postalCode ?? "",
          shippingCountry: resolvedAddress?.country ?? "NO",
          shippingPhone: shippingContact.phone,
          shippingEmail: shippingContact.email,
          shippingMethod: selectedShipping?.serviceCode ?? null,
          shippingCost: shippingCostUSD > 0 ? shippingCostUSD : null,
          items: items.map((it) => ({
            productId: it.product.id,
            quantity: it.quantity,
            priceAtTime: it.product.price,
            title: it.product.title,
          })),
        }),
      });
      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create order");
      }
      const { order } = await orderRes.json();

      // 1b. Book Bring shipment (non-blocking, fires in parallel with payment session)
      if (order?.id) bookShipment(order.id);

      // 2. Create payment session with provider
      const sessionRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          provider: paymentMethod,
          amount: Math.round(grandTotalUSD * 100), // cents/øre
          currency: paymentMethod === "vipps" ? "NOK" : "USD",
          returnUrl: `${window.location.origin}/order-confirmation?orderId=${order.id}`,
        }),
      });
      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to start payment");
      }
      const session = await sessionRes.json();

      // 3. Clear cart
      await fetch(`/api/cart/${user?.id}`, { method: "DELETE" });

      // 4. Redirect to provider
      if (session.redirectUrl) {
        window.location.href = session.redirectUrl;
      } else {
        // Klarna returns clientToken for widget — for now redirect to confirmation
        router.push(`/order-confirmation?orderId=${order.id}`);
      }
    } catch (e) {
      console.error("Fiat payment failed:", e);
      setError(`Payment via ${paymentMethod} failed. Please try again.`);
      setShowError(true);
    } finally {
      setPaying(false);
    }
  }

  /* -------- Render -------- */
  if (pageLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <motion.div
          className="w-full max-w-md p-6 bg-surface-1 dark:bg-white/[0.02] border border-border dark:border-white/10 rounded-xl"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-4 text-center">
            Loading Checkout…
          </h1>
          <div className="w-full bg-muted dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="bg-emerald-500 h-2.5 rounded-full"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              style={{ width: "50%" }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (error && showError) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <motion.div
          className="w-full max-w-md p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-500/30"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col gap-3">
            <p className="text-red-700 dark:text-red-300 text-center">{error}</p>
            <Button variant="outline" className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30" onClick={() => setShowError(false)}>
              Dismiss
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <motion.div
          className="w-full max-w-md p-6 bg-surface-1 dark:bg-white/[0.02] border border-border dark:border-white/10 rounded-xl text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-muted-foreground text-lg mb-4">Your cart is empty.</p>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => router.push("/products")}>
            Shop Now
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-8">
      <motion.h1
        className="text-4xl font-extrabold mb-8 text-foreground"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Checkout
      </motion.h1>

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
        {/* Left: items */}
        <motion.div
          className="col-span-1 lg:col-span-2 bg-surface-1 dark:bg-white/[0.02] p-4 lg:p-6 rounded-xl border border-border dark:border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Your Order</h2>
          {items.map((item) => {
            const imageSrc = item.product.image?.[0] || "/placeholder-image.jpg";
            return (
              <motion.div
                key={item.id}
                className="flex items-center justify-between mb-4 p-3 lg:p-4 bg-muted/30 dark:bg-white/[0.02] rounded-lg border border-border/50 dark:border-white/5"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 bg-muted dark:bg-white/5 rounded-lg overflow-hidden">
                    <AspectRatio ratio={1 / 1}>
                      <Image
                        src={imageSrc}
                        alt={item.product.title}
                        fill
                        className="object-cover"
                        onError={(e) => {
                          console.error("Image load error:", e);
                          (e.target as HTMLImageElement).src = "/placeholder-image.jpg";
                        }}
                      />
                    </AspectRatio>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-foreground truncate">
                      {item.product.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      ${item.product.price.toFixed(2)} × {item.quantity}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  ${(item.product.price * item.quantity).toFixed(2)}
                </p>
              </motion.div>
            );
          })}

          {/* Shipping Address Form */}
          <div className="mt-6 pt-6 border-t border-border dark:border-white/10">
            <h3 className="text-xl font-semibold mb-4 text-foreground">Shipping Address</h3>

            {/* Address Selector — saved addresses + Bring autocomplete */}
            <AddressSelector
              value={selectedAddress}
              onChange={setSelectedAddress}
              customAddress={customAddress}
              onCustomAddressChange={setCustomAddress}
              allowCustom
              allowSave
              label="Delivery address"
              required
            />

            {/* Contact details — always shown alongside address picker */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Full name *
                </label>
                <input
                  type="text"
                  value={shippingContact.name}
                  onChange={(e) => updateContact("name", e.target.value)}
                  placeholder="Ola Nordmann"
                  className="w-full px-3 py-2.5 border border-border dark:border-white/10 rounded-lg bg-input dark:bg-white/5 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={shippingContact.phone}
                  onChange={(e) => updateContact("phone", e.target.value)}
                  placeholder="+47 123 45 678"
                  className="w-full px-3 py-2.5 border border-border dark:border-white/10 rounded-lg bg-input dark:bg-white/5 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={shippingContact.email}
                  onChange={(e) => updateContact("email", e.target.value)}
                  placeholder="ola@example.com"
                  className="w-full px-3 py-2.5 border border-border dark:border-white/10 rounded-lg bg-input dark:bg-white/5 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
            </div>

            {!isShippingValid && !selectedShipping && resolvedAddress && (
              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                Please select or enter an address and fill in your name and email to continue
              </p>
            )}
            {!isShippingValid && !resolvedAddress && (
              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                Please select or enter an address and fill in your name and email to continue
              </p>
            )}

            {/* Shipping Method Selector — Bring live rates */}
            <ShippingMethodSelector
              fromPostalCode={sellerPostalCode}
              toPostalCode={resolvedAddress?.postalCode ?? ""}
              totalWeightGrams={items.reduce((sum, it) => sum + it.quantity * 1000, 0)}
              nokPerUsd={nokPerUsd}
              onSelect={setSelectedShipping}
              selectedServiceCode={selectedShipping?.serviceCode}
              allDigital={allDigital}
            />
          </div>
        </motion.div>

        {/* Right: summary */}
        <motion.div
          className="col-span-1 bg-surface-1 dark:bg-white/[0.02] p-4 lg:p-6 rounded-xl border border-border dark:border-white/10 sticky top-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Order Summary</h2>

          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Subtotal (USD):</span>
              <span className="text-foreground font-medium">${subtotalUSD.toFixed(2)}</span>
            </div>

            {/* Shipping cost line */}
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Shipping:</span>
              <span className="text-foreground font-medium">
                {allDigital
                  ? "Digital"
                  : freeShipping
                  ? "Free"
                  : shippingCostUSD > 0
                  ? `$${shippingCostUSD.toFixed(2)}`
                  : "—"}
              </span>
            </div>
            {selectedShipping && !allDigital && !freeShipping && (
              <p className="text-xs text-muted-foreground -mt-2">
                {selectedShipping.serviceName}
                {selectedShipping.estimatedDelivery
                  ? ` — est. ${new Date(selectedShipping.estimatedDelivery).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}`
                  : ""}
              </p>
            )}

            <hr className="border-border dark:border-white/10 my-2" />
            <div className="flex justify-between font-bold text-xl">
              <span className="text-foreground">Total (USD)</span>
              <span className="text-emerald-600 dark:text-emerald-400">${grandTotalUSD.toFixed(2)}</span>
            </div>

            {/* Payment Method Selector */}
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Payment method</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('crypto')}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                    paymentMethod === 'crypto'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-muted/30 dark:bg-white/5 text-foreground border-border dark:border-white/10 hover:border-emerald-500/50'
                  }`}
                >
                  🔗 Crypto
                </button>
                {availableFiatMethods.map((m) => (
                  <button
                    key={m.type}
                    onClick={() => setPaymentMethod(m.type as typeof paymentMethod)}
                    className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                      paymentMethod === m.type
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-muted/30 dark:bg-white/5 text-foreground border-border dark:border-white/10 hover:border-emerald-500/50'
                    }`}
                  >
                    {m.icon} {m.displayName}
                  </button>
                ))}
              </div>
            </div>

            {/* Crypto payment details (only when crypto selected) */}
            {paymentMethod === 'crypto' && (
              <div className="mt-4 space-y-3 p-3 rounded-lg bg-muted/20 dark:bg-white/[0.02] border border-border/50 dark:border-white/5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span className="text-foreground">{networkLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="text-foreground">
                    {usdPerNative != null ? <>1 {nativeSymbol} = ${usdPerNative.toFixed(2)}</> : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total ({nativeSymbol})</span>
                  <span className="text-foreground font-medium">
                    <PriceAmount usd={grandTotalUSD} />
                  </span>
                </div>
              </div>
            )}

            {/* Fiat info (only when fiat selected) */}
            {paymentMethod !== 'crypto' && (
              <div className="mt-4 p-3 rounded-lg bg-muted/20 dark:bg-white/[0.02] border border-border/50 dark:border-white/5">
                <p className="text-sm text-muted-foreground">
                  You will be redirected to{' '}
                  <span className="text-foreground font-medium capitalize">{paymentMethod}</span>
                  {' '}to complete payment.
                </p>
              </div>
            )}

            {/* Pay buttons */}
            {paymentMethod === 'crypto' ? (
              <Dialog open={confirmOpen} onOpenChange={(open) => {
                if (!paying) setConfirmOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full mt-5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                    disabled={!isWalletReady || paying || !isShippingValid}
                    title={!isShippingValid ? "Fill in shipping address" : !isWalletReady ? "Connect wallet first" : undefined}
                  >
                    {paying ? "Processing…" : !isShippingValid ? "Fill in address" : `Pay with ${nativeSymbol}`}
                  </Button>
                </DialogTrigger>

                <DialogContent className="bg-surface-1 dark:bg-zinc-900 p-6 rounded-2xl max-w-lg border border-border dark:border-white/10">
                  <DialogTitle className="sr-only">Confirm Payment</DialogTitle>
                  <AnimatePresence>
                    {confirmOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -14, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="text-xl font-bold text-foreground mb-4">Confirm Payment</h3>

                        {/* QR Code for receiver address */}
                        <div className="flex flex-col items-center mb-4">
                          <div className="bg-white p-2 rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={qrCodeUrl(receiverAddress, 180)}
                              alt="Payment QR code"
                              width={180}
                              height={180}
                              className="rounded"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Scan to copy receiver address
                          </p>
                        </div>

                        {/* Payment details */}
                        <div className="space-y-2.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Network</span>
                            <span className="text-foreground">{networkLabel}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">From</span>
                            <span className="text-foreground font-mono text-xs">{formatAddr(senderAddress)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">To</span>
                            <span className="text-foreground font-mono text-xs">{formatAddr(receiverAddress)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              <PriceAmount usd={grandTotalUSD} />
                            </span>
                          </div>
                        </div>

                        {/* Timer */}
                        {paymentTimerActive && (
                          <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                            <span className="text-muted-foreground">Rate locked for:</span>
                            <span className={`font-mono font-bold ${paymentTimeLeft < 120 ? 'text-red-500' : 'text-emerald-500'}`}>
                              {fmtTimer(paymentTimeLeft)}
                            </span>
                          </div>
                        )}

                        {/* Verification status */}
                        {verifyingTx && txHash && (
                          <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/20">
                            <div className="flex items-center gap-2">
                              <motion.div
                                className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                              />
                              <span className="text-sm text-blue-700 dark:text-blue-300">
                                Verifying on-chain…
                              </span>
                            </div>
                            <p className="text-xs text-blue-500 font-mono mt-1 truncate">
                              TX: {txHash}
                            </p>
                          </div>
                        )}

                        {/* Disclaimer */}
                        <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
                          ⚠️ Crypto transactions are <strong>irreversible</strong>. Double-check the network, address, and amount.
                          For Norwegian tax: this payment will be recorded at current NOK rate for Skatteetaten compliance.
                        </div>

                        <Button
                          onClick={handleConfirmPay}
                          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={paying || !isWalletReady || !totalInNative}
                        >
                          {verifyingTx ? "Verifying…" : paying ? "Processing…" : `Confirm & Pay`}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </DialogContent>
              </Dialog>
            ) : (
              <Button
                onClick={handlePayFiat}
                className="w-full mt-5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                disabled={paying || !isShippingValid}
                title={!isShippingValid ? "Fill in shipping address" : undefined}
              >
                {paying ? "Processing…" : !isShippingValid ? "Fill in address" : `Pay with ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}`}
              </Button>
            )}

            <footer className="mt-8 text-center text-muted-foreground text-xs">
              <p>
                By proceeding, you agree to our{" "}
                <Link href="/terms" className="underline hover:text-foreground transition-colors">
                  Terms & Conditions
                </Link>
                .
              </p>
            </footer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
