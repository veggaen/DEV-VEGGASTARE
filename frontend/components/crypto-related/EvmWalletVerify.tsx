"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CHAIN_LABELS: Record<number, string> = {
	1: "Ethereum",
	10: "Optimism",
	56: "BNB Chain",
	100: "Gnosis",
	137: "Polygon",
	369: "PulseChain",
	8453: "Base",
	42161: "Arbitrum",
	11155111: "Sepolia",
};

function trimAddress(addr: string) {
	if (!addr) return "";
	return `${addr.slice(0, 6)}…${addr.slice(addr.length - 4)}`;
}

export default function EvmWalletVerify({
	enabled,
	onVerified,
}: {
	enabled: boolean;
	onVerified?: () => void;
}) {
	const { address, isConnected } = useAccount();
	const chainId = useChainId();
	const { signMessageAsync } = useSignMessage();

	const [busy, setBusy] = useState(false);
	const [needTwoFactor, setNeedTwoFactor] = useState(false);
	const [code, setCode] = useState("");
	const [verifiedAddress, setVerifiedAddress] = useState<string | null>(null);

	const displayAddress = useMemo(() => (address ? trimAddress(address) : ""), [address]);
	const chainLabel = chainId ? (CHAIN_LABELS[chainId] ?? `Chain ${chainId}`) : "current EVM network";

	const verify = async () => {
		if (!enabled) {
			toast.error("Enable Web3 mode first.", { position: "top-center" });
			return;
		}
		if (!isConnected || !address) {
			toast.error("Connect an EVM wallet first.", { position: "top-center" });
			return;
		}

		setBusy(true);
		try {
			const challengeRes = await fetch("/api/wallets/evm/challenge", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ address, chainId, code: needTwoFactor ? code : null }),
			});
			const challengeJson = await challengeRes.json();

			if (challengeJson?.twoFactor) {
				setNeedTwoFactor(true);
				toast.success("2FA code sent to your email.", { position: "top-center" });
				return;
			}
			if (!challengeRes.ok) {
				toast.error(challengeJson?.error ?? "Failed to create challenge", { position: "top-center" });
				return;
			}

			const signature = await signMessageAsync({ message: challengeJson.message });

			const verifyRes = await fetch("/api/wallets/evm/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					challengeId: challengeJson.challengeId,
					signature,
					label: `EVM ${displayAddress}`,
				}),
			});
			const verifyJson = await verifyRes.json();
			if (!verifyRes.ok) {
				toast.error(verifyJson?.error ?? "Verification failed", { position: "top-center" });
				return;
			}

			const linkedAddress =
				typeof verifyJson?.wallet?.address === "string" ? verifyJson.wallet.address : address;
			setVerifiedAddress(linkedAddress);
			toast.success("Wallet verified and ready for seller payouts.", { position: "top-center" });
			setNeedTwoFactor(false);
			setCode("");
			onVerified?.();
		} catch {
			toast.error("Something went wrong.", { position: "top-center" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
						Connected EVM wallet
					</div>
					<div className="mt-1 text-sm text-zinc-900 dark:text-zinc-100 break-all">
						{isConnected && address ? address : "No wallet connected yet"}
					</div>
				</div>
				{isConnected && address ? (
					<span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
						{chainLabel}
					</span>
				) : null}
			</div>

			<p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
				Signing proves you control this address. The same EVM address can receive on Ethereum,
				PulseChain, Base, and other EVM networks; the checkout token decides the payment network.
			</p>

			{verifiedAddress ? (
				<div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
					<span className="font-semibold">Ready:</span> {trimAddress(verifiedAddress)} is linked and can be used as a receiving wallet.
				</div>
			) : null}

			{needTwoFactor ? (
				<div className="mt-3 space-y-2">
					<div className="text-xs text-zinc-500 dark:text-zinc-400">
						Enter the 2FA code from email to continue.
					</div>
					<Input
						value={code}
						onChange={(e) => setCode(e.target.value)}
						disabled={busy}
						placeholder="123456"
						inputMode="numeric"
					/>
				</div>
			) : null}

			<Button
				onClick={verify}
				disabled={busy || !enabled}
				className="mt-3 w-full"
				variant="outline"
				title={!enabled ? "Enable Web3 mode first" : "Verify wallet ownership"}
			>
				{busy ? "Waiting for signature..." : needTwoFactor ? "Verify with code" : "Verify and use this wallet"}
			</Button>
		</div>
	);
}
