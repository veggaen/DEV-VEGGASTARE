"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
	connectorType?: string;
	authProvider?: string;
	socialEmail?: string;
	createdAt: string;
};

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

function chainLabel(chainId: number | null) {
	return chainId ? (CHAIN_LABELS[chainId] ?? `Chain ${chainId}`) : "EVM";
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
	const [confirmingUnlinkId, setConfirmingUnlinkId] = useState<string | null>(null);
	const [actionError, setActionError] = useState<{ walletId: string; message: string } | null>(null);
	const actionRequest = useRef<AbortController | null>(null);
	useEffect(() => () => actionRequest.current?.abort(), [enabled]);

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
		if (actionRequest.current) return;
		if (!enabled) {
			toast.error("Enable Web3 mode first.", { position: "top-center" });
			return;
		}

		const controller = new AbortController();
		actionRequest.current = controller;
		const timeout = setTimeout(() => controller.abort(), 20_000);
		setBusy(true);
		setActionError(null);
		try {
			const url = `/api/wallets/evm/${action.walletId}`;
			const method = action.type === "setPrimary" ? "PATCH" : "DELETE";
			const res = await fetch(url, {
				method,
				signal: controller.signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...(action.type === 'setPrimary' ? { action: 'setPrimary' } : {}), code: codeOrNull }),
			});
			const json = await res.json();

			if (res.ok && json?.twoFactor) {
				setPending(action);
				setCode('');
				setConfirmingUnlinkId(null);
				toast.success("2FA code sent to your email.", { position: "top-center" });
				return;
			}

			if (!res.ok) {
				setActionError({ walletId: action.walletId, message: json?.error ?? 'Unable to change this wallet. Refresh and try again.' });
				return;
			}

			toast.success(
				action.type === "setPrimary" ? "This wallet will receive new sales." : "Wallet link removed from your account.",
				{ position: "top-center" }
			);
			setPending(null);
			setConfirmingUnlinkId(null);
			setCode("");
			await load();
		} catch {
			setActionError({ walletId: action.walletId, message: 'We could not confirm the change. Refresh the list before trying again.' });
		} finally {
			clearTimeout(timeout);
			actionRequest.current = null;
			setBusy(false);
		}
	};

	return (
		<div role="region" aria-label="Saved receiving wallets" className="min-w-0 rounded-xl border border-border bg-surface-1/60 p-3 dark:bg-muted/40">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Verified receiving wallets
					</div>
					<div className="mt-1 text-sm text-foreground">
						{defaultWallet
							? `Active for new listings: ${trimAddress(defaultWallet.address)}`
							: "No active receiving wallet yet"}
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					disabled={loading || busy || !enabled}
					onClick={() => void load()}
				>
					{loading ? 'Refreshing…' : 'Refresh'}
				</Button>
			</div>

			{!enabled ? (
				<div className="mt-2 text-xs text-muted-foreground">
					Enable Web3 mode to manage wallets.
				</div>
			) : null}

			{enabled && wallets.length === 0 && !loading ? (
				<div className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground dark:text-foreground/80">
					No verified wallets yet. Connect a wallet above, then sign once to make it available for product payouts.
				</div>
			) : null}

			{wallets.length > 0 ? (
				<div className="mt-3 space-y-2">
					{wallets.map((w) => {
						const isPending = pending?.walletId === w.id;
						return (
							<div
								key={w.id}
								role="group"
								aria-label={`${w.label} receiving wallet`}
								className="rounded-lg border border-border p-2"
							>
								<div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<div className="min-w-0 break-words text-sm font-semibold text-foreground">
												{w.label}
											</div>
											{w.isDefault ? (
												<span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-[11px] font-semibold text-brand-accent-hover dark:text-brand-accent-light">
													Primary
												</span>
											) : null}
											{w.verifiedAt ? (
												<span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-[11px] font-semibold text-brand-accent-hover dark:text-brand-accent-light">
													Verified
												</span>
											) : (
												<span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-200">
													Unverified
												</span>
											)}
										</div>
										<div className="mt-0.5 text-xs text-muted-foreground break-all">
											{w.address}
										</div>
										<div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
											<span>Last signed on {chainLabel(w.chainId)}</span>
											{w.authProvider ? <span>via {w.authProvider}</span> : null}
											{w.socialEmail ? <span>{w.socialEmail}</span> : null}
										</div>
									</div>

									<div className="flex shrink-0 flex-wrap items-center gap-2">
										{!w.isDefault ? (
											<Button
												variant="outline"
												size="sm"
												className="min-h-11"
												disabled={busy || !!pending || !w.verifiedAt}
												onClick={() => void runAction({ type: "setPrimary", walletId: w.id }, null)}
											>
												Use for sales
											</Button>
										) : null}
										<Button
											variant="destructive"
											size="sm"
											className="min-h-11"
											disabled={busy || !!pending}
											onClick={() => setConfirmingUnlinkId(w.id)}
										>
											Remove link
										</Button>
									</div>
								</div>

								{confirmingUnlinkId === w.id ? (
									<div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
										<div className="text-sm font-semibold text-red-700 dark:text-red-200">
											Remove this verified wallet link?
										</div>
										<p className="mt-1 text-xs leading-relaxed text-red-700/80 dark:text-red-200/80">
											Remove this address from Veggat. No replacement receiving wallet is selected automatically. Your extension stays connected.
										</p>
										<div className="mt-3 flex flex-wrap gap-2">
											<Button
												variant="outline"
												size="sm"
												className="min-h-11"
												disabled={busy}
												onClick={() => setConfirmingUnlinkId(null)}
											>
												Keep linked
											</Button>
											<Button
												variant="destructive"
												size="sm"
												className="min-h-11"
												disabled={busy}
												onClick={() => void runAction({ type: "unlink", walletId: w.id }, null)}
											>
												Remove wallet link
											</Button>
										</div>
									</div>
								) : null}

								{isPending ? (
									<form className="mt-3 max-w-sm space-y-2" onSubmit={event => { event.preventDefault(); if (/^\d{6}$/.test(code)) void runAction(pending!, code); }}>
										<div className="text-xs text-muted-foreground">
											{pending.type === 'unlink' ? 'Confirm removal with the code sent to your email.' : 'Confirm the receiving wallet with the code sent to your email.'}
										</div>
										<label className="block text-sm" htmlFor={`wallet-action-code-${w.id}`}>Email verification code</label>
										<Input
											id={`wallet-action-code-${w.id}`}
											name="walletActionCode"
											className="min-h-11 text-base"
											autoComplete="one-time-code"
											maxLength={6}
											pattern="[0-9]{6}"
											required
											spellCheck={false}
											aria-invalid={actionError?.walletId === w.id || undefined}
											aria-describedby={actionError?.walletId === w.id ? `wallet-action-error-${w.id}` : undefined}
											value={code}
											onChange={(e) => setCode(e.target.value)}
											disabled={busy}
											inputMode="numeric"
										/>
										<div className="flex flex-wrap gap-2">
											<Button
												variant="outline"
												type="button"
												className="min-h-11"
												disabled={busy}
												onClick={() => {
													setPending(null);
													setCode("");
													setActionError(null);
												}}
											>
												Cancel
											</Button>
											<Button
												type="submit"
												className="min-h-11"
												disabled={busy}
											>
												{busy ? 'Confirming…' : pending.type === 'unlink' ? 'Confirm removal' : 'Confirm receiving wallet'}
											</Button>
										</div>
									</form>
								) : null}
								{actionError?.walletId === w.id ? <p id={`wallet-action-error-${w.id}`} role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{actionError.message}</p> : null}
							</div>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
