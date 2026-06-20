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
import WalletConnectChooser from "@/components/crypto-related/WalletConnectChooser";
/* Renders “X NATIVE (~$Y)” and stays in sync with PricingContext */

/* --- Wagmi (EVM) --- */
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits } from "viem";

/* --- Solana --- */
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";

/* --- Seller payment resolution --- */
import { resolveCheckoutPayment, type CheckoutSellerPayment } from "@/actions/seller-payment";

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

type CheckoutPaymentMethod = 'crypto' | 'paypal';

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

function platformReceiverFor(active: ReturnType<typeof useActiveNetwork>["active"]) {
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

function formatNativeAmount(amount: number | null | undefined, symbol: string) {
  if (amount == null || !Number.isFinite(amount)) return `0 ${symbol}`;
  const digits = amount >= 1 ? 4 : 8;
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: amount >= 1 ? 2 : 0,
  })} ${symbol}`;
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
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('crypto');
  const [availableFiatMethods, setAvailableFiatMethods] = useState<{ type: string; displayName: string; icon: string }[]>([]);

  /* Crypto payment verification states */
  const [verifyingTx, setVerifyingTx] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paymentTimerActive, setPaymentTimerActive] = useState(false);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(PAYMENT_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addressSectionRef = useRef<HTMLDivElement | null>(null);

  /* Seller payment info (resolved from products in cart) */
  const [sellerPayment, setSellerPayment] = useState<CheckoutSellerPayment | null>(null);

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
    const contactValid =
      shippingContact.name.trim().length >= 2 &&
      shippingContact.email.includes("@");
    // Digital-only orders only need contact details for receipt/download delivery.
    if (allDigital) return contactValid;
    // Physical orders need contact, address, and a selected shipping method.
    return contactValid && resolvedAddress !== null && selectedShipping !== null;
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

  // Shared input styling for the checkout — single hairline border, soft bg,
  // accent focus ring. Keeps every field visually consistent without nested boxes.
  const checkoutInputClass =
    "w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30";

  const focusDeliveryAddress = useCallback(() => {
    addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      const input = addressSectionRef.current?.querySelector<HTMLInputElement>("input");
      input?.focus();
    }, 250);
  }, []);

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
      const cartItems: CartItem[] = data.items ?? [];
      setItems(cartItems);
      setPageLoading(false);

      // Resolve seller payment info for products in cart
      if (cartItems.length > 0) {
        const productIds = cartItems.map((it) => it.product.id);
        resolveCheckoutPayment({ productIds })
          .then((spRes) => {
            if ('data' in spRes) {
              setSellerPayment(spRes.data);
            }
          })
          .catch((err) => {
            console.warn("[checkout] Seller payment resolution failed:", err);
          });
      } else {
        setSellerPayment(null);
      }
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
      .then((d) => {
        const methods = Array.isArray(d.methods) ? d.methods : [];
        setAvailableFiatMethods(methods.filter((method: { type?: string }) => method.type === 'paypal'));
      })
      .catch(() => setAvailableFiatMethods([]));
  }, []);

  useEffect(() => {
    if (paymentMethod === 'paypal' && availableFiatMethods.length === 0) {
      setPaymentMethod('crypto');
    }
  }, [availableFiatMethods.length, paymentMethod]);

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

  /**
   * Receiver address: prefer product token/family routing, then the legacy EVM
   * seller wallet, then the platform receiver.
   */
  const receiverAddress = useMemo(() => {
    const family = active.kind === "evm" ? "EVM" : "SOLANA";
    const tokenKey = `${family}:${nativeSymbol.toUpperCase()}`;
    const tokenReceiver = sellerPayment?.unifiedReceiverWalletByToken?.[tokenKey];
    if (tokenReceiver) return tokenReceiver;

    const familyReceiver = sellerPayment?.unifiedReceiverWalletByFamily?.[family];
    if (familyReceiver) return familyReceiver;

    if (family === "EVM" && sellerPayment?.unifiedReceiverWallet) {
      return sellerPayment.unifiedReceiverWallet;
    }
    return platformReceiverFor(active);
  }, [active, nativeSymbol, sellerPayment]);

  /* network label */
  const networkLabel = useMemo(() => {
    if (active.kind === "evm") {
      if (active.chainId === 1) return "Ethereum Mainnet";
      if (active.chainId === 369) return "PulseChain Mainnet";
      return `EVM chain ${active.chainId}`;
    }
    const m =
      active.cluster === WalletAdapterNetwork.Mainnet
        ? "Solana Mainnet"
        : active.cluster === WalletAdapterNetwork.Testnet
        ? "Solana Testnet"
        : "Solana Devnet";
    return m;
  }, [active]);

  const isMainnetPaymentNetwork = useMemo(() => {
    if (active.kind === "evm") return active.chainId === 1 || active.chainId === 369;
    return active.cluster === WalletAdapterNetwork.Mainnet;
  }, [active]);

  const networkGuardMessage = isMainnetPaymentNetwork
    ? null
    : active.kind === "evm"
      ? "Switch to Ethereum Mainnet or PulseChain Mainnet before paying. Testnets and unknown EVM chains are blocked for marketplace purchases."
      : "Switch to Solana Mainnet before paying. Testnet and devnet payments are blocked for marketplace purchases.";

  /* ready to pay? */
  const isWalletReady =
    (active.kind === "evm" && !!evm.address) || (active.kind === "solana" && !!sol.publicKey);

  const cryptoPayButtonTitle = !isMainnetPaymentNetwork
    ? networkGuardMessage ?? undefined
    : !isShippingValid
      ? (allDigital ? "Fill in contact details" : "Fill in shipping address")
      : undefined;

  const cryptoPayButtonLabel = paying
    ? "Processing..."
    : !isMainnetPaymentNetwork
      ? "Switch to mainnet"
      : !isShippingValid
        ? (allDigital ? "Fill in contact" : "Fill in address")
        : `Pay with ${nativeSymbol}`;

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
        return res.json();
      } catch (e) {
        console.error("Order recording failed:", e);
        throw e;
      }
    },
    [items, grandTotalUSD, networkLabel, shippingContact, resolvedAddress, active, nativeSymbol, usdPerNative, rates, totalInNative, senderAddress, receiverAddress, selectedShipping, shippingCostUSD]
  );

  /** Confirm order after on-chain verification */
  const confirmOrder = useCallback(async (orderId: string, txId: string, blockNum?: number) => {
    const res = await fetch("/api/orders/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, transactionId: txId, blockNumber: blockNum }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("Order confirmation failed:", text);
      throw new Error(text || "Order confirmation failed");
    }
    return res.json();
  }, []);

  const cancelPendingOrder = useCallback(async (orderId: string, txId?: string) => {
    try {
      await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          transactionId: txId ?? null,
          status: "FAILED",
        }),
      });
    } catch (e) {
      console.error("Order cancellation failed:", e);
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

  async function handlePayEvmNative(): Promise<string> {
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

    let orderData: { id?: string } | null = null;

    try {
      // Record order as CONFIRMING after the wallet has broadcast the transaction.
      orderData = await recordOrder(hash);

    // Wait for on-chain confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    setVerifyingTx(false);
    setPaymentTimerActive(false);

    // Confirm order after on-chain verification
    if (orderData?.id) {
      await confirmOrder(orderData.id, hash, Number(receipt.blockNumber));
      // Book shipment (non-blocking — fires after order confirmed)
      await fetch(`/api/cart/${user?.id}`, { method: "DELETE" });
      return orderData.id;
    }
    throw new Error("Order was paid but no order id was returned.");
    } catch (e) {
      setVerifyingTx(false);
      setPaymentTimerActive(false);
      if (orderData?.id) await cancelPendingOrder(orderData.id, hash);
      throw e;
    }
  }

  async function handlePaySolana(): Promise<string> {
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

    let orderData: { id?: string } | null = null;

    try {
      // Record order as CONFIRMING after the wallet has broadcast the transaction.
      orderData = await recordOrder(sig);

    // Wait for on-chain confirmation
    await connection.confirmTransaction(sig, "confirmed");
    setVerifyingTx(false);
    setPaymentTimerActive(false);

    // Confirm order
    if (orderData?.id) {
      await confirmOrder(orderData.id, sig);
      await fetch(`/api/cart/${user?.id}`, { method: "DELETE" });
      return orderData.id;
    }
    throw new Error("Order was paid but no order id was returned.");
    } catch (e) {
      setVerifyingTx(false);
      setPaymentTimerActive(false);
      if (orderData?.id) await cancelPendingOrder(orderData.id, sig);
      throw e;
    }
  }

  async function handleConfirmPay() {
    try {
      if (!isMainnetPaymentNetwork) {
        throw new Error(networkGuardMessage ?? "Switch to a supported mainnet before paying.");
      }
      setPaying(true);
      setTxHash(null);
      setVerifyingTx(false);
      const orderId = active.kind === "evm" ? await handlePayEvmNative() : await handlePaySolana();
      router.push(`/order-confirmation?orderId=${encodeURIComponent(orderId)}`);
    } catch (e) {
      console.error("Payment failed:", e);
      setPaymentTimerActive(false);
      setVerifyingTx(false);
      setError(
        !isMainnetPaymentNetwork && networkGuardMessage
          ? networkGuardMessage
          : active.kind === "evm"
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
    let pendingFiatOrderId: string | null = null;
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
          // For fiat, store seller's PayPal email as receiverAddress for traceability
          receiverAddress: sellerPayment?.unifiedPaypalEmail ?? null,
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
      const order = await orderRes.json();
      pendingFiatOrderId = order.id;


      // 2. Create payment session with provider
      const isPaypal = paymentMethod === 'paypal';
      // PayPal: route return through capture endpoint so we can call capturePayment()
      const returnUrl = isPaypal
        ? `${window.location.origin}/api/payments/paypal/capture?orderId=${order.id}`
        : `${window.location.origin}/order-confirmation?orderId=${order.id}`;

      const sessionRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          provider: paymentMethod,
          amount: Math.round(grandTotalUSD * 100), // cents/øre
          currency: "USD",
          returnUrl,
          // Pass seller PayPal email so provider can route payment to seller
          ...(isPaypal && sellerPayment?.unifiedPaypalEmail
            ? { sellerPaypalEmail: sellerPayment.unifiedPaypalEmail }
            : {}),
        }),
      });
      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to start payment");
      }
      const session = await sessionRes.json();

      // 3. Redirect to provider. PayPal capture clears the cart after confirmed payment.
      if (session.redirectUrl) {
        window.location.href = session.redirectUrl;
      } else {
        // Klarna returns clientToken for widget — for now redirect to confirmation
        router.push(`/order-confirmation?orderId=${order.id}`);
      }
    } catch (e) {
      console.error("Fiat payment failed:", e);
      if (pendingFiatOrderId) {
        await cancelPendingOrder(pendingFiatOrderId);
      }
      const message = e instanceof Error ? e.message : `Payment via ${paymentMethod} failed. Please try again.`;
      setError(paymentMethod === 'paypal' ? `PayPal checkout could not start: ${message}` : message);
      setShowError(true);
    } finally {
      setPaying(false);
    }
  }

  /* -------- Render -------- */
  if (pageLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 lg:px-8">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <div className="h-16 w-16 animate-pulse rounded-lg bg-muted/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted/60" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted/50" />
                </div>
              </div>
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
        </div>
      </div>
    );
  }

  if (error && showError) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <p className="text-base text-foreground">{error}</p>
        <button
          onClick={() => setShowError(false)}
          className="mt-4 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <p className="text-lg text-muted-foreground">Your cart is empty.</p>
        <button
          onClick={() => router.push("/products")}
          className="group mt-5 inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all duration-200 hover:gap-3"
        >
          Browse products
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8 lg:py-10">
      <motion.div
        className="mb-8 border-b border-border pb-5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Checkout
        </div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Review &amp; pay
        </h1>
      </motion.div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
        {/* Left: items + delivery */}
        <motion.div
          className="min-w-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-base font-semibold tracking-tight text-foreground">Your order</h2>

          <div className="mt-4 divide-y divide-border/70">
            {items.map((item) => {
              const imageSrc = item.product.image?.[0] || "/placeholder-image.jpg";
              return (
                <div
                  key={item.id}
                  className="group flex items-center justify-between gap-4 py-4 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted/40 transition-transform duration-200 group-hover:-translate-y-0.5 lg:h-[72px] lg:w-[72px]">
                      <AspectRatio ratio={1 / 1}>
                        <Image
                          src={imageSrc}
                          alt={item.product.title}
                          fill
                          sizes="(max-width: 1024px) 64px, 72px"
                          className="object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder-image.jpg";
                          }}
                        />
                      </AspectRatio>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium text-foreground">
                        {item.product.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        ${item.product.price.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Delivery/contact details */}
          <div ref={addressSectionRef} className="mt-8 border-t border-border pt-8">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {allDigital ? "Buyer contact" : "Delivery"}
            </h2>
            <div className="mt-4">
            {allDigital ? (
              <p className="text-sm text-muted-foreground">
                Digital products are delivered by email and shown in your downloads after payment.
              </p>
            ) : (
              <AddressSelector
                value={selectedAddress}
                onChange={setSelectedAddress}
                customAddress={customAddress}
                onCustomAddressChange={setCustomAddress}
                allowCustom
                allowSave
                expandCustomByDefault
                label="Delivery address"
                required
              />
            )}

            {/* Contact details */}
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${allDigital ? "" : "mt-6"}`}>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Full name <span className="text-muted-foreground">*</span>
                </label>
                <input
                  type="text"
                  value={shippingContact.name}
                  onChange={(e) => updateContact("name", e.target.value)}
                  placeholder="Ola Nordmann"
                  className={checkoutInputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Phone</label>
                <input
                  type="tel"
                  value={shippingContact.phone}
                  onChange={(e) => updateContact("phone", e.target.value)}
                  placeholder="+47 123 45 678"
                  className={checkoutInputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Email <span className="text-muted-foreground">*</span>
                </label>
                <input
                  type="email"
                  value={shippingContact.email}
                  onChange={(e) => updateContact("email", e.target.value)}
                  placeholder="ola@example.com"
                  className={checkoutInputClass}
                />
              </div>
            </div>

            {!isShippingValid && allDigital && (
              <p className="mt-4 border-l-2 border-amber-500/50 pl-3 text-sm text-muted-foreground">
                Add your name and email to continue.
              </p>
            )}
            {!isShippingValid && !allDigital && (
              <p className="mt-4 border-l-2 border-amber-500/50 pl-3 text-sm text-muted-foreground">
                Add a delivery address plus your name and email to continue.
              </p>
            )}

            {!allDigital && (
              <ShippingMethodSelector
                fromPostalCode={sellerPostalCode}
                toPostalCode={resolvedAddress?.postalCode ?? ""}
                totalWeightGrams={items.reduce((sum, it) => sum + it.quantity * 1000, 0)}
                nokPerUsd={nokPerUsd}
                onSelect={setSelectedShipping}
                selectedServiceCode={selectedShipping?.serviceCode}
                allDigital={allDigital}
                onAddressNeeded={focusDeliveryAddress}
              />
            )}
            </div>
          </div>
        </motion.div>

        {/* Right: sticky summary */}
        <motion.div
          className="lg:sticky lg:top-6 lg:self-start"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div className="rounded-xl border border-border bg-surface-1 p-5 lg:p-6">
            <h2 className="text-base font-semibold tracking-tight text-foreground">Summary</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums text-foreground">${subtotalUSD.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="tabular-nums text-foreground">
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
                <p className="-mt-1 text-xs text-muted-foreground">
                  {selectedShipping.serviceName}
                  {selectedShipping.estimatedDelivery
                    ? ` — est. ${new Date(selectedShipping.estimatedDelivery).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}`
                    : ""}
                </p>
              )}

              <div className="mt-1 flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-xl font-semibold tabular-nums text-foreground">${grandTotalUSD.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method — quiet text toggle (no emoji, no filled boxes) */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Payment</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {[{ type: 'crypto', label: 'Crypto' }, ...availableFiatMethods.map((m) => ({ type: m.type, label: m.displayName }))].map((m) => {
                  const selected = paymentMethod === m.type;
                  return (
                    <button
                      key={m.type}
                      onClick={() => setPaymentMethod(m.type as typeof paymentMethod)}
                      className={`relative pb-1 text-sm transition-colors ${
                        selected ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m.label}
                      <span
                        className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-all duration-200 ${
                          selected ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seller payment info / multi-seller warning — quiet left-border lines */}
            {sellerPayment && (
              <div className="mt-4 space-y-2 text-xs">
                {sellerPayment.multiSeller && (
                  <p className="border-l-2 border-amber-500/50 pl-3 text-muted-foreground">
                    Items from multiple sellers — payment goes to platform escrow.
                  </p>
                )}
                {!sellerPayment.multiSeller && paymentMethod === 'crypto' && receiverAddress && receiverAddress !== platformReceiverFor(active) && (
                  <p className="border-l-2 border-emerald-500/50 pl-3 text-muted-foreground">
                    Paying seller directly →{' '}
                    <span className="font-mono text-foreground">{formatAddr(receiverAddress)}</span>
                  </p>
                )}
                {!sellerPayment.multiSeller && paymentMethod === 'paypal' && sellerPayment.unifiedPaypalEmail && (
                  <p className="border-l-2 border-sky-500/50 pl-3 text-muted-foreground">
                    Seller PayPal on file: <span className="font-medium text-foreground">{sellerPayment.unifiedPaypalEmail}</span>
                  </p>
                )}
              </div>
            )}

            {/* Crypto payment details (only when crypto selected) */}
            {paymentMethod === 'crypto' && (
              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <span className="text-foreground">{networkLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="tabular-nums text-foreground">
                    {usdPerNative != null ? <>1 {nativeSymbol} = ${usdPerNative.toFixed(2)}</> : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total ({nativeSymbol})</span>
                  <span className="text-right font-medium tabular-nums text-foreground">
                    {formatNativeAmount(totalInNative, nativeSymbol)}
                    <span className="ml-1 text-xs text-muted-foreground">≈ ${grandTotalUSD.toFixed(2)}</span>
                  </span>
                </div>
                {networkGuardMessage && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-200">
                    {networkGuardMessage}
                  </p>
                )}
              </div>
            )}

            {/* Fiat info (only when fiat selected) */}
            {paymentMethod !== 'crypto' && (
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                You&apos;ll be redirected to{' '}
                <span className="font-medium capitalize text-foreground">{paymentMethod}</span>{' '}
                to complete payment.
              </p>
            )}

            {/* Pay buttons */}
            {paymentMethod === 'crypto' && !isWalletReady ? (
              <WalletConnectChooser authenticateDirect={false}>
                <Button
                  type="button"
                  className="w-full mt-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={paying}
                >
                  Connect wallet to pay
                </Button>
              </WalletConnectChooser>
            ) : paymentMethod === 'crypto' ? (
              <Dialog open={confirmOpen} onOpenChange={(open) => {
                if (!paying) setConfirmOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full mt-5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                    disabled={paying || !isShippingValid || !isMainnetPaymentNetwork}
                    title={cryptoPayButtonTitle}
                  >
                    {cryptoPayButtonLabel}
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface-1 p-6">
                  <DialogTitle className="sr-only">Confirm Payment</DialogTitle>
                  <AnimatePresence>
                    {confirmOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -14, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="mb-1 text-lg font-semibold tracking-tight text-foreground">Confirm payment</h3>
                        <p className="mb-5 text-sm text-muted-foreground">Scan the code or send from your connected wallet.</p>

                        {/* QR Code for receiver address */}
                        <div className="mb-5 flex flex-col items-center">
                          <div className="rounded-xl bg-white p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={qrCodeUrl(receiverAddress, 180)}
                              alt="Payment QR code"
                              width={180}
                              height={180}
                              className="rounded"
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Scan to copy receiver address
                          </p>
                        </div>

                        {/* Payment details */}
                        <div className="space-y-2.5 border-t border-border pt-4 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Network</span>
                            <span className="text-right text-foreground">{networkLabel}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">From</span>
                            <span className="break-all text-right font-mono text-xs text-foreground">{formatAddr(senderAddress)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">To</span>
                            <span className="break-all text-right font-mono text-xs text-foreground">{formatAddr(receiverAddress)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                              {formatNativeAmount(totalInNative, nativeSymbol)}
                              <span className="block text-xs text-muted-foreground">≈ ${grandTotalUSD.toFixed(2)}</span>
                            </span>
                          </div>
                          {networkGuardMessage && (
                            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-200">
                              {networkGuardMessage}
                            </p>
                          )}
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
                          <div className="mt-4 flex items-start gap-2 border-l-2 border-sky-500/50 pl-3">
                            <motion.div
                              className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-sky-500 border-t-transparent"
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-sm text-foreground">Verifying on-chain…</span>
                              <p className="max-w-full break-all font-mono text-xs leading-5 text-muted-foreground">TX: {txHash}</p>
                            </div>
                          </div>
                        )}

                        {/* Disclaimer */}
                        <p className="mt-4 border-l-2 border-amber-500/50 pl-3 text-[11px] leading-relaxed text-muted-foreground">
                          Crypto transactions are <strong className="text-foreground">irreversible</strong> — double-check the network, address, and amount.
                          This payment is recorded at the current NOK rate for Skatteetaten compliance.
                        </p>

                        <Button
                          onClick={handleConfirmPay}
                          className="mt-5 w-full bg-emerald-600 text-white transition-colors hover:bg-emerald-500"
                          disabled={paying || !isWalletReady || !totalInNative || !isMainnetPaymentNetwork}
                        >
                          {verifyingTx ? "Verifying…" : paying ? "Processing…" : `Confirm & pay`}
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
                title={!isShippingValid ? (allDigital ? "Fill in contact details" : "Fill in shipping address") : undefined}
              >
                {paying ? "Processing…" : !isShippingValid ? (allDigital ? "Fill in contact" : "Fill in address") : `Pay with ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}`}
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
