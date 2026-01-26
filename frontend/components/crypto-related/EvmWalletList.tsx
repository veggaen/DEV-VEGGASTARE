"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WalletDto = {
	id: string;
	label: string;
	address: string;
	chainId: number | null;
	isDefault: boolean;
	verifiedAt: string | null;
	createdAt: string;
};

function trimAddress(addr: string) {
	if (!addr) return "";
	return `${addr.slice(0, 6)}…${addr.slice(addr.length - 4)}`;
}

type PendingAction =
	| { type: "setPrimary"; walletId: string }
	| { type: "unlink"; walletId: string };

export default function EvmWalletList({
	enabled,
	refreshToken,
}: {
	enabled: boolean;
	refreshToken?: number;
}) {
	const [wallets, setWallets] = useState<WalletDto[]>([]);
	const [loading, setLoading] = useState(false);
	const [pending, setPending] = useState<PendingAction | null>(null);
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);

	const defaultWallet = useMemo(() => wallets.find((w) => w.isDefault) ?? null, [wallets]);

	const load = async () => {
		if (!enabled) {
			setWallets([]);
			return;
		}

		setLoading(true);
		try {
			const res = await fetch("/api/wallets/evm", { method: "GET" });
			const json = await res.json();
			if (!res.ok) {
				setWallets([]);
				return;
			}
			setWallets(Array.isArray(json?.wallets) ? json.wallets : []);
		} catch {
			setWallets([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, refreshToken]);

	const runAction = async (
		action: PendingAction,
		codeOrNull: string | null
	) => {
		if (!enabled) {
			toast.error("Enable Web3 mode first.", { position: "top-center" });
			return;
		}

		setBusy(true);
		try {
			const url = `/api/wallets/evm/${action.walletId}`;
			const method = action.type === "setPrimary" ? "PATCH" : "DELETE";
			const res = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: codeOrNull }),
			});
			const json = await res.json();

			if (json?.twoFactor) {
				setPending(action);
				toast.success("2FA code sent to your email.", { position: "top-center" });
				return;
			}

			if (!res.ok) {
				toast.error(json?.error ?? "Action failed", { position: "top-center" });
				return;
			}

			toast.success(
				action.type === "setPrimary" ? "Primary wallet updated." : "Wallet unlinked.",
				{ position: "top-center" }
			);
			setPending(null);
			setCode("");
			await load();
		} catch {
			toast.error("Something went wrong.", { position: "top-center" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
						Linked wallets
					</div>
					<div className="mt-1 text-sm text-slate-900 dark:text-slate-100">
						{defaultWallet
							? `Primary: ${trimAddress(defaultWallet.address)}`
							: "No primary wallet"}
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					disabled={loading || busy || !enabled}
					onClick={() => void load()}
				>
					Refresh
				</Button>
			</div>

			{!enabled ? (
				<div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
					Enable Web3 mode to manage wallets.
				</div>
			) : null}

			{enabled && wallets.length === 0 && !loading ? (
				<div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
					No wallets linked yet.
				</div>
			) : null}

			{wallets.length > 0 ? (
				<div className="mt-3 space-y-2">
					{wallets.map((w) => {
						const isPending = pending?.walletId === w.id;
						return (
							<div
								key={w.id}
								className="rounded-lg border border-black/10 p-2 dark:border-white/10"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
												{w.label}
											</div>
											{w.isDefault ? (
												<span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">
													Primary
												</span>
											) : null}
											{w.verifiedAt ? (
												<span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-200">
													Verified
												</span>
											) : (
												<span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-200">
													Unverified
												</span>
											)}
										</div>
										<div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 break-all">
											{w.address}
										</div>
									</div>

									<div className="flex shrink-0 items-center gap-2">
										{!w.isDefault ? (
											<Button
												variant="outline"
												size="sm"
												disabled={busy}
												onClick={() => void runAction({ type: "setPrimary", walletId: w.id }, null)}
											>
												Make primary
											</Button>
										) : null}
										<Button
											variant="destructive"
											size="sm"
											disabled={busy}
											onClick={() => void runAction({ type: "unlink", walletId: w.id }, null)}
										>
											Unlink
										</Button>
									</div>
								</div>

								{isPending ? (
									<div className="mt-2 space-y-2">
										<div className="text-xs text-slate-500 dark:text-slate-400">
											Enter the 2FA code from email to continue.
										</div>
										<Input
											value={code}
											onChange={(e) => setCode(e.target.value)}
											disabled={busy}
											placeholder="123456"
											inputMode="numeric"
										/>
										<div className="flex gap-2">
											<Button
												variant="outline"
												disabled={busy}
												onClick={() => {
													setPending(null);
													setCode("");
												}}
											>
												Cancel
											</Button>
											<Button
												disabled={busy || !code.trim()}
												onClick={() => void runAction(pending!, code.trim())}
											>
												Continue
											</Button>
										</div>
									</div>
							) : null}
							</div>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
