"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAccount } from "wagmi";
import { FiLoader } from "react-icons/fi";
import { IoChevronDownCircleOutline } from "react-icons/io5";
import { useWalletsRuntime } from "./WalletRuntimeContext";
import { getConnectorBrand } from "./walletIcons";

type WalletConnectionProps = {
  variant?: "default" | "topbar";
  mode?: "auto" | "dialog";
};

function trim(text: string, full = false) {
  if (full || !text) return text;
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

export default function WalletConnection({ variant = "default", mode = "auto" }: WalletConnectionProps) {
  // Runtime state
  const { evm, solana, evmConnectors, connectEvm, disconnectEvm, connectSolana, disconnectSolana, busy } =
    useWalletsRuntime();

  const { publicKey, wallets: solWallets } = useWallet();
  const { isConnected: evmConnected } = useAccount();

  const [open, setOpen] = useState(false);

  const address = useMemo(() => {
    return evmConnected ? evm.address : publicKey?.toBase58() ?? "";
  }, [evmConnected, evm.address, publicKey]);

  const anyConnected = evmConnected || !!publicKey;
  const useConnectedDropdown = mode === "auto" && anyConnected;

  const evmConnectorGroups = useMemo(() => {
    const normalized = evmConnectors.map((connector) => {
      const { label, icon } = getConnectorBrand(connector);
      const id = connector.id?.toLowerCase?.() ?? "";
      const name = connector.name?.toLowerCase?.() ?? "";
      const isWalletConnect = id.includes("walletconnect") || name.includes("walletconnect");
      const isMetaMask = id.includes("metamask") || name.includes("metamask");
      const isCoinbase = id.includes("coinbase") || name.includes("coinbase");

      return { connector, label, icon, isWalletConnect, isMetaMask, isCoinbase };
    });

    // Recommended:
    // - MetaMask first (best UX on desktop when extension is present)
    // - WalletConnect for mobile / non-extension wallets
    // - Coinbase next
    const recommended = normalized
      .filter((c) => c.isMetaMask || c.isWalletConnect || c.isCoinbase)
      .sort((a, b) => {
        const rank = (x: typeof a) =>
          x.isMetaMask ? 0 : x.isWalletConnect ? 1 : x.isCoinbase ? 2 : 10;
        return rank(a) - rank(b);
      });

    const recommendedUids = new Set(recommended.map((x) => x.connector.uid ?? x.connector.id));
    const more = normalized.filter((x) => !recommendedUids.has(x.connector.uid ?? x.connector.id));
    return { recommended, more };
  }, [evmConnectors]);

  const walletConnectEnabled = Boolean(
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? process.env.NEXT_PUBLIC_PROJECT_ID
  );

  return (
		<div>
      <Dialog open={open} onOpenChange={setOpen}>
        {!anyConnected ? (
          <DialogTrigger asChild>
						<Button
							variant="outline"
							className="h-10 rounded-xl border border-black/10 bg-white/60 px-3 text-sm font-medium text-slate-900 hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.10]"
						>
							{busy.evm || busy.sol ? (
								"Connecting..."
							) : (
								<>
                  <span className="sm:hidden">Connect</span>
                  <span className="hidden sm:inline">{variant === "topbar" ? "Wallet" : "Connect wallet"}</span>
								</>
							)}
						</Button>
          </DialogTrigger>
        ) : useConnectedDropdown ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
								variant="outline"
								className="h-10 rounded-xl border border-black/10 bg-white/60 px-3 text-sm font-medium text-slate-900 hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.10] flex items-center gap-2"
                title={address || "Not connected"}
              >
								<span className="truncate max-w-[140px] sm:max-w-[180px]">{address ? trim(address) : "Not connected"}</span>
                <IoChevronDownCircleOutline className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
						<DropdownMenuContent className="w-[360px] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl p-3">
              {/* EVM row */}
							<div className="mb-3 p-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
								<div className="text-xs text-slate-500 dark:text-slate-400 mb-1">EVM</div>
								<div className="text-sm text-slate-900 dark:text-slate-100">
                  {evmConnected ? evm.address : "Not connected"}
                </div>
                <div className="mt-2 flex gap-2">
                  {evmConnected ? (
                    <Button
                      size="sm"
                      variant="outline"
											className="text-red-600 hover:text-red-700"
                      onClick={disconnectEvm}
                      disabled={busy.evm}
                      title="Disconnect EVM"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <DialogTrigger asChild>
											<Button size="sm" variant="secondary">
												Connect EVM
											</Button>
                    </DialogTrigger>
                  )}
                </div>
              </div>

              {/* Solana row */}
							<div className="p-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
								<div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Solana</div>
								<div className="text-sm text-slate-900 dark:text-slate-100">
                  {publicKey ? publicKey.toBase58() : "Not connected"}
                </div>
                <div className="mt-2 flex gap-2">
                  {publicKey ? (
                    <Button
                      size="sm"
                      variant="outline"
											className="text-red-600 hover:text-red-700"
                      onClick={disconnectSolana}
                      disabled={busy.sol}
                      title="Disconnect Solana"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <DialogTrigger asChild>
											<Button size="sm" variant="secondary">
												Connect Solana
											</Button>
                    </DialogTrigger>
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="h-10 rounded-xl border border-black/10 bg-white/60 px-3 text-sm font-medium text-slate-900 hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.10] flex items-center gap-2"
            title={address || "Not connected"}
          >
            <span className="truncate max-w-[180px]">{address ? trim(address) : "Not connected"}</span>
            <IoChevronDownCircleOutline className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        )}

        {/* Modal */}
				<DialogContent className="max-w-[520px] bg-white/95 dark:bg-slate-950/95 rounded-2xl border border-black/10 dark:border-white/10 backdrop-blur-lg">
          <DialogTitle className="sr-only">Select a Wallet &amp; Connect</DialogTitle>
          <div className="flex w-full justify-center items-center">
            <div className="flex flex-col justify-start items-stretch space-y-4 w-[320px] md:w-[480px] overflow-y-auto">
							<div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Select a Wallet &amp; Connect</div>

            <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              On desktop: choose <span className="font-medium text-slate-700 dark:text-slate-200">MetaMask</span> (browser extension).
               On mobile: choose <span className="font-medium text-slate-700 dark:text-slate-200">WalletConnect</span> and scan the QR.
            </div>

            {!walletConnectEnabled ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                WalletConnect is disabled for this environment. If this is unexpected (e.g. Production), set
                 <span className="font-semibold">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</span> in your deployment env vars.
              </div>
            ) : null}

            {anyConnected ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">EVM</div>
                  <div className="text-sm text-slate-900 dark:text-slate-100 break-all">
                    {evmConnected ? evm.address : "Not connected"}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {evmConnected ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={disconnectEvm}
                        disabled={busy.evm}
                        title="Disconnect EVM"
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Solana</div>
                  <div className="text-sm text-slate-900 dark:text-slate-100 break-all">
                    {publicKey ? publicKey.toBase58() : "Not connected"}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {publicKey ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={disconnectSolana}
                        disabled={busy.sol}
                        title="Disconnect Solana"
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

              {/* Solana wallets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {solWallets.map((w, i) => {
                  const key = `${w.adapter.name}-${i}`;
                  return (
                    <Button
                      key={key}
                      type="button"
                      onClick={async () => {
                        await connectSolana(w.adapter.name as any);
                        setOpen(false);
                      }}
                      variant="ghost"
									className="h-[50px] border border-black/10 bg-black/5 hover:bg-black/10 text-slate-900 font-semibold rounded-xl transition-colors gap-3 justify-start dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:text-slate-100"
                      title={`Connect with ${w.adapter.name}`}
                      disabled={busy.sol}
                    >
                      <Image src={w.adapter.icon} alt={w.adapter.name} height={22} width={22} className="rounded" />
                      {w.adapter.name}
                      {busy.sol && <FiLoader className="ml-2 h-4 w-4 animate-spin" />}
                    </Button>
                  );
                })}
              </div>

              {/* EVM connectors with proper logos */}
              {evmConnectorGroups.recommended.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Recommended
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {evmConnectorGroups.recommended.map(({ connector, label, icon, isWalletConnect, isMetaMask }) => (
                      <Button
                        key={connector.uid ?? connector.id}
                        type="button"
                        onClick={async () => {
                          await connectEvm(connector);
                          setOpen(false);
                        }}
                        variant="ghost"
									className="h-[50px] border border-black/10 bg-black/5 hover:bg-black/10 text-slate-900 font-semibold rounded-xl transition-colors justify-start dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:text-slate-100"
                        title={`Connect with ${label}`}
                        disabled={busy.evm}
                      >
                        <span className="flex w-full items-center gap-3 min-w-0">
                          <Image src={icon} alt={label} height={22} width={22} className="rounded shrink-0" />
                          <span className="flex-1 min-w-0 truncate">{label}</span>
                          {isMetaMask ? (
                            <span className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                              Desktop
                            </span>
                          ) : null}
                          {isWalletConnect ? (
                            <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                              Mobile
                            </span>
                          ) : null}
                          {busy.evm ? <FiLoader className="shrink-0 h-4 w-4 animate-spin" /> : null}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {evmConnectorGroups.more.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    More wallets
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {evmConnectorGroups.more.map(({ connector, label, icon }) => (
                      <Button
                        key={connector.uid ?? connector.id}
                        type="button"
                        onClick={async () => {
                          await connectEvm(connector);
                          setOpen(false);
                        }}
                        variant="ghost"
									className="h-[50px] border border-black/10 bg-black/5 hover:bg-black/10 text-slate-900 font-semibold rounded-xl transition-colors justify-start dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.10] dark:text-slate-100"
                        title={`Connect with ${label}`}
                        disabled={busy.evm}
                      >
                        <span className="flex w-full items-center gap-3 min-w-0">
                          <Image src={icon} alt={label} height={22} width={22} className="rounded shrink-0" />
                          <span className="flex-1 min-w-0 truncate">{label}</span>
                          {busy.evm ? <FiLoader className="shrink-0 h-4 w-4 animate-spin" /> : null}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
