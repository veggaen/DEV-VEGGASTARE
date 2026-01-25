"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaRegCopy } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { useCurrentUser } from "@/hooks/use-current-user";

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
  product: { id: string; title: string; price: number; image: string[] };
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

  /* totals */
  const subtotalUSD = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity * it.product.price, 0),
    [items]
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
    () => convertFromUSD(subtotalUSD, "NATIVE"),
    [subtotalUSD, convertFromUSD]
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
    async (txHash: string) => {
      try {
        await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.id,
            totalAmount: subtotalUSD,
            transactionId: txHash,
            method: "NATIVE", // or "ERC20/SPL" when you add token payments
            commentOrder: items.map((it) => it.product.title).join(", "),
            commentPay: `Paid on ${networkLabel}`,
          }),
        });
        // clear cart
        await fetch(`/api/cart/${user?.id}`, { method: "DELETE" });
      } catch (e) {
        console.error("Order recording failed:", e);
      }
    },
    [user?.id, items, subtotalUSD, networkLabel]
  );

  async function handlePayEvmNative() {
    if (!walletClient || !publicClient) throw new Error("Wallet not connected");

    if (!totalInNative || totalInNative <= 0) throw new Error("Invalid amount");
    if (!receiverAddress || !receiverAddress.startsWith("0x")) throw new Error("Receiver address (EVM) missing");

    // ETH & PLS both use 18 decimals
    const value = parseUnits(totalInNative.toString(), 18);

    const hash = await walletClient.sendTransaction({
      to: receiverAddress as `0x${string}`,
      value,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    await recordOrder(hash);
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

    const signed = await sol.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    await recordOrder(sig);
  }

  async function handleConfirmPay() {
    try {
      setPaying(true);
      if (active.kind === "evm") await handlePayEvmNative();
      else await handlePaySolana();
      router.push("/order-confirmation");
    } catch (e) {
      console.error("Payment failed:", e);
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

  /* -------- Render -------- */
  if (pageLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <motion.div
          className="w-full max-w-md p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
            Loading Checkout…
          </h1>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="bg-blue-600 h-2.5 rounded-full"
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
          className="w-full max-w-md p-6 bg-red-100 dark:bg-red-900/50 rounded-xl shadow-lg border border-red-400"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex justify-between items-center">
            <p className="text-red-700 dark:text-red-200 text-center">{error}</p>
            <Button variant="ghost" className="text-red-700 dark:text-red-200" onClick={() => setShowError(false)}>
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
          className="w-full max-w-md p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-gray-600 dark:text-gray-400 text-lg">Your cart is empty.</p>
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push("/products")}>
            Shop Now
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-8">
      <motion.h1
        className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Checkout
      </motion.h1>

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
        {/* Left: items */}
        <motion.div
          className="col-span-1 lg:col-span-2 bg-white dark:bg-gray-900 p-4 lg:p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-100">Your Order</h2>
          {items.map((item) => {
            const imageSrc = item.product.image?.[0] || "/placeholder-image.jpg";
            return (
              <motion.div
                key={item.id}
                className="flex items-center justify-between mb-4 p-3 lg:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
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
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.product.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      ${item.product.price.toFixed(2)} × {item.quantity}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  ${(item.product.price * item.quantity).toFixed(2)}
                </p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Right: summary */}
        <motion.div
          className="col-span-1 bg-white dark:bg-gray-900 p-4 lg:p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 sticky top-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-100">Order Summary</h2>

          <div className="space-y-4">
            <div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Network:</p>
              <p className="text-gray-900 dark:text-gray-100">{networkLabel}</p>
            </div>

            <div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Sender Address:</p>
              <div className="flex items-center gap-2">
                <span className="text-gray-900 dark:text-gray-100 break-all md:max-w-none max-w-[260px] truncate">
                  {senderAddress || "Not connected"}
                </span>
                {senderAddress && (
                  <button
                    onClick={() => navigator.clipboard.writeText(senderAddress)}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    <FaRegCopy  className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Receiver Address:</p>
              <div className="flex items-center gap-2">
                <span className="text-gray-900 dark:text-gray-100 break-all md:max-w-none max-w-[260px] truncate">
                  {receiverAddress}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(receiverAddress)}
                  className="text-blue-500 hover:text-blue-600"
                >
                  <FaRegCopy  className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Subtotal (USD):</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">${subtotalUSD.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400 font-medium">
                Conversion Rate ({nativeSymbol}/USD):
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {usdPerNative != null ? <>1 {nativeSymbol} = ${usdPerNative.toFixed(2)}</> : "—"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Total ({nativeSymbol}):</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {/* Same renderer you used on product cards; follows user preset & active network */}
                <PriceAmount usd={subtotalUSD} />
              </span>
            </div>

            <hr className="border-gray-200 dark:border-gray-700 my-2" />
            <div className="flex justify-between font-bold text-xl">
              <span className="text-gray-800 dark:text-gray-200">Total (USD)</span>
              <span className="text-gray-900 dark:text-gray-100">${subtotalUSD.toFixed(2)}</span>
            </div>

            {/* Confirm & Pay */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <Button
                  className="w-full mt-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  disabled={!isWalletReady || paying}
                >
                  {paying ? "Processing…" : `Pay with ${nativeSymbol}`}
                </Button>
              </DialogTrigger>

              <DialogContent className="bg-gray-900 dark:bg-gray-800 p-6 rounded-2xl max-w-md border border-gray-700">
                <AnimatePresence>
                  {confirmOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -14, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h3 className="text-xl font-bold text-white mb-4">Confirm Payment</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Network</span>
                          <span className="text-gray-100">{networkLabel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">From</span>
                          <span className="text-gray-100">{formatAddr(senderAddress)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">To</span>
                          <span className="text-gray-100">{formatAddr(receiverAddress)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Amount</span>
                          <span className="text-gray-100">
                            <PriceAmount usd={subtotalUSD} />
                          </span>
                        </div>
                      </div>

                      <Button
                        onClick={handleConfirmPay}
                        className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white"
                        disabled={paying || !isWalletReady || !totalInNative}
                      >
                        {paying ? "Processing…" : `Confirm & Pay`}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </DialogContent>
            </Dialog>

            <footer className="mt-8 text-center text-gray-500 dark:text-gray-400 text-xs">
              <p>
                By proceeding, you agree to our{" "}
                <Link href="/terms" className="underline hover:text-gray-700 dark:hover:text-gray-300">
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
