"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

	const displayAddress = useMemo(() => (address ? trimAddress(address) : ""), [address]);

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

			toast.success("Wallet verified and linked.", { position: "top-center" });
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
		<div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
			<div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
				EVM wallet
			</div>
			<div className="mt-1 text-sm text-zinc-900 dark:text-zinc-100 break-all">
				{isConnected && address ? address : "Not connected"}
			</div>

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
				{busy ? "Working..." : needTwoFactor ? "Verify with code" : "Verify wallet ownership"}
			</Button>
		</div>
	);
}
