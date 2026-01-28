"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { motion, useReducedMotion } from "framer-motion";
import WalletConnection from "../crypto-related/WalletAdapter"; // Your wallet UI
import NetworkSyncBridge from "@/components/crypto-related/NetworkSyncBridge";
import { MyDialogbarNavigator } from "@/app/(protected)/_components/dialog-bar";
import { useTheme } from "next-themes";
import { signIn, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FaUser } from "react-icons/fa";
import { toast } from "sonner";
import { TbHexagons } from "react-icons/tb";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { MyRequestWeb3ModeSecurityAction } from "@/actions/security-action";
import EvmWalletVerify from "@/components/crypto-related/EvmWalletVerify";
import EvmWalletList from "@/components/crypto-related/EvmWalletList";

type NavLinkProps = {
  href: string;
  children: ReactNode;
  isActive: boolean;
};

const NavLink = ({ href, children, isActive }: NavLinkProps) => (
	<Link
		href={href}
		aria-current={isActive ? "page" : undefined}
		className={
			"group relative px-2 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/70 " +
			(isActive
				? "text-slate-950 dark:text-slate-50"
				: "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-50") +
			" after:absolute after:left-2 after:right-2 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-emerald-500/70 after:transition-opacity after:duration-200 " +
			(isActive ? "after:opacity-100" : "after:opacity-0 hover:after:opacity-40")
		}
	>
		{children}
	</Link>
);

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const MyTopBar = () => {
  const pathname = usePathname();
  const clientUser = useCurrentUser();
  const prefersReducedMotion = useReducedMotion();
	const headerRef = useRef<HTMLElement | null>(null);
	const { resolvedTheme, setTheme } = useTheme();
	const [menuOpen, setMenuOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [productsTopbarVisible, setProductsTopbarVisible] = useState(true);
	const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState<number>(72);
	const [nexusOpen, setNexusOpen] = useState(false);
	const [web3ModeEnabled, setWeb3ModeEnabled] = useState(false);
	const [isRequestingWeb3Mode, setIsRequestingWeb3Mode] = useState(false);
	const [walletRefreshToken, setWalletRefreshToken] = useState(0);
	const collapseForProducts = pathname.startsWith("/products") && isMobile && !productsTopbarVisible;
	const menuSwipeRef = useRef<{ x: number; y: number; t: number } | null>(null);
	const onMenuTouchStart = (e: React.TouchEvent) => {
		if (!isMobile) return;
		if (!menuOpen) return;
		if (e.touches.length !== 1) return;
		const t = e.touches[0];
		menuSwipeRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
	};
	const onMenuTouchEnd = (e: React.TouchEvent) => {
		if (!isMobile) return;
		if (!menuOpen) return;
		const s = menuSwipeRef.current;
		menuSwipeRef.current = null;
		if (!s) return;
		const t = e.changedTouches?.[0];
		if (!t) return;
		const dx = t.clientX - s.x;
		const dy = t.clientY - s.y;
		const dt = Date.now() - s.t;
		if (dt <= 650 && dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.2) {
			setMenuOpen(false);
		}
	};

	useEffect(() => {
		try {
			const raw = window.localStorage.getItem("veggastare:web3ModeEnabled");
			if (raw === "true") setWeb3ModeEnabled(true);
		} catch {
			// ignore
		}
	}, []);

	const setWeb3Mode = (next: boolean) => {
		setWeb3ModeEnabled(next);
		try {
			window.localStorage.setItem("veggastare:web3ModeEnabled", String(next));
		} catch {
			// ignore
		}
	};

	const effectiveWeb3ModeEnabled = clientUser
		? !!(clientUser as any).web3ModeEnabled
		: web3ModeEnabled;

	const toggleTheme = () => {
		const next = resolvedTheme === "dark" ? "light" : "dark";
		setTheme(next);
	};

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>(
      '[data-app-scroll-container="true"]'
    );

    const getScrollTop = () => (scrollEl ? scrollEl.scrollTop : window.scrollY);


		// Hysteresis + rAF throttling to prevent near-top "bounce".
		// (Some devices/wheels can oscillate between 0px and 1px scrollTop.)
		const isProducts = pathname.startsWith("/products");
		const enter = isProducts ? 6 : 12;
		const exit = isProducts ? 2 : 4;
		let raf = 0;
		const update = () => {
			raf = 0;
			const top = getScrollTop();
			const compact =
				isProducts &&
				!!scrollEl &&
				scrollEl.getAttribute("data-products-compact") === "true";
			setIsScrolled((prev) => (compact ? true : prev ? top > exit : top > enter));
		};
		const onScroll = () => {
			if (raf) return;
			raf = window.requestAnimationFrame(update);
		};

		update();

		window.addEventListener("scroll", onScroll, { passive: true });
		scrollEl?.addEventListener("scroll", onScroll, { passive: true });

		return () => {
			if (raf) window.cancelAnimationFrame(raf);
			window.removeEventListener("scroll", onScroll);
			scrollEl?.removeEventListener("scroll", onScroll);
		};
  }, [pathname]);

	// Keep a CSS variable in sync with the actual rendered header height.
	// This avoids overlap/gaps for components that need to sit *below* the sticky
	// header (e.g. /products sidebar overlay).
	useLayoutEffect(() => {
		const headerEl = headerRef.current;
		if (!headerEl) return;
		// Desktop should NEVER collapse the topbar; only mobile on /products can collapse
		const collapseForProducts = pathname.startsWith("/products") && isMobile && !productsTopbarVisible;

		const update = () => {
			// Desktop always shows header offset
			if (collapseForProducts && isMobile) {
				document.documentElement.style.setProperty("--app-header-offset", "0px");
				return;
			}
			const h = headerEl.getBoundingClientRect().height;
			if (Number.isFinite(h) && h > 0) {
				setMeasuredHeaderHeight(Math.round(h));
				document.documentElement.style.setProperty(
					"--app-header-offset",
					`${h}px`
				);
			}
		};

		update();
		const ro = new ResizeObserver(() => update());
		ro.observe(headerEl);
		return () => ro.disconnect();
	}, [pathname, isScrolled, isMobile, productsTopbarVisible]);

  const morphTransition = prefersReducedMotion
    ? { duration: 0 }
		: { type: "tween", duration: 0.18, ease: "easeOut" };

  // Avoid rendering the full navigation on auth screens.
  const hideOnAuthPages = pathname.startsWith("/auth/");
  if (hideOnAuthPages) return <NetworkSyncBridge />;

	const nav: Array<{ href: string; label: string }> = [
		{ href: "/", label: "Home" },
		{ href: "/products", label: "Products" },
		{ href: "/pulse", label: "Pulse" },
		...(clientUser
			? [
					{ href: "/conversations", label: "Conversations" },
					{ href: "/dashboard", label: "Dashboard" },
					{ href: "/nexus", label: "Settings" },
				]
			: []),
		{ href: "/analytics", label: "Analytics" },
	];

	const menuLinks = useMemo(() => {
		// Keep the sheet clean for logged-out users: primary discovery paths first.
		const base = nav;
		return [
			...base,
			{ href: "/info", label: "Info / Contact" },
			{ href: "/privacy", label: "Privacy & cookies" },
		];
	}, [nav]);

	const openCookieSettings = () => {
		try {
			window.dispatchEvent(new Event("veggat:cookie-consent-open"));
		} catch {
			// ignore
		}
	};

	useEffect(() => {
		const onOpenMenu = () => setMenuOpen(true);
		window.addEventListener("veggat:open-menu", onOpenMenu as any);
		return () => window.removeEventListener("veggat:open-menu", onOpenMenu as any);
	}, []);

	useEffect(() => {
		try {
			window.dispatchEvent(
				new CustomEvent("veggat:menu-open-state", {
					detail: { open: menuOpen },
				})
			);
		} catch {
			// ignore
		}
	}, [menuOpen]);

	useEffect(() => {
		const onCloseMenu = () => setMenuOpen(false);
		window.addEventListener("veggat:close-menu", onCloseMenu as any);
		return () => window.removeEventListener("veggat:close-menu", onCloseMenu as any);
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const mq = window.matchMedia?.("(min-width: 768px)");
		const update = () => setIsMobile(!(mq?.matches ?? false));
		update();
		mq?.addEventListener?.("change", update);
		return () => mq?.removeEventListener?.("change", update);
	}, []);

	useEffect(() => {
		const onChrome = (e: Event) => {
			if (!pathname.startsWith("/products")) return;
			const ce = e as CustomEvent<{ topbarVisible?: boolean }>;
			setProductsTopbarVisible(Boolean(ce?.detail?.topbarVisible ?? true));
		};
		window.addEventListener("veggat:products-chrome", onChrome as any);
		return () => window.removeEventListener("veggat:products-chrome", onChrome as any);
	}, [pathname]);

  return (
    <>
      <NetworkSyncBridge />
			<MyDialogbarNavigator
				open={nexusOpen}
				onOpenChange={setNexusOpen}
				hideTrigger
				onOpen={() => setMenuOpen(false)}
			/>
			<motion.header
				ref={headerRef}
				className="sticky top-0 z-[60] w-full overflow-hidden transition-[max-height] duration-200 ease-out"
				style={{
					maxHeight: collapseForProducts ? 0 : measuredHeaderHeight,
					pointerEvents: collapseForProducts ? "none" : "auto",
				}}
				initial={false}
				animate={
					prefersReducedMotion
						? {}
						: collapseForProducts
							? { opacity: 0, y: -10 }
							: { opacity: 1, y: 0 }
				}
				transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
			>
				<motion.div
					initial={false}
					animate={
						prefersReducedMotion
							? {}
							: {
								paddingLeft: isScrolled ? 0 : 12,
								paddingRight: isScrolled ? 0 : 12,
								borderRadius: isScrolled ? 0 : 24,
							}
					}
					transition={morphTransition}
					style={{ transformOrigin: "50% 0%", willChange: "padding, border-radius" }}
					className="relative w-full overflow-hidden"
				>
					{/* Center-out background reveal (prevents the sudden square flash) */}
					<motion.div
						aria-hidden
						className="pointer-events-none absolute inset-0"
						initial={false}
						animate={
							prefersReducedMotion
								? { opacity: isScrolled ? 1 : 0 }
								: isScrolled
									? { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }
									: { opacity: 0, clipPath: "inset(50% 50% 50% 50%)" }
						}
						transition={{ duration: 0.22, ease: "easeOut" }}
						style={{ willChange: "clip-path, opacity" }}
					>
						<div className="absolute inset-0 bg-white/75 dark:bg-slate-950/65 backdrop-blur-xl" />
					</motion.div>

					{/* Bottom line reveals after the fill finishes */}
					<motion.div
						aria-hidden
						className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-black/10 dark:bg-white/10"
						initial={false}
						animate={
							prefersReducedMotion
								? { opacity: isScrolled ? 1 : 0 }
								: isScrolled
									? { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }
									: { opacity: 0, clipPath: "inset(0% 50% 0% 50%)" }
						}
						transition={
							prefersReducedMotion
								? { duration: 0 }
								: isScrolled
									? { duration: 0.18, ease: "easeOut", delay: 0.18 }
									: { duration: 0.12, ease: "easeOut", delay: 0 }
						}
					/>
					<div className="mx-auto flex h-[var(--app-header)] max-w-screen-2xl items-center justify-between px-3 sm:px-4 md:px-6">
						<div className="flex min-w-0 items-center gap-4">
							<Link
								href="/"
								className="shrink-0 font-semibold tracking-tight text-slate-900 dark:text-slate-100"
							>
								VeggaStare
							</Link>

							<nav className="hidden md:flex items-center gap-3">
								{nav.map((item) => (
									<NavLink
										key={item.href}
										href={item.href}
										isActive={isActivePath(pathname, item.href)}
									>
										{item.href === "/pulse" ? (
											<span className="inline-flex items-center gap-2">
												<span className="relative h-3 w-3">
													<motion.span
														className="absolute inset-0 rounded-full bg-emerald-400/80"
														animate={{ scale: [1, 1.35, 1], opacity: [0.65, 1, 0.65] }}
														transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
													/>
													<motion.span
														className="absolute -inset-2 rounded-full border border-emerald-400/35 opacity-0 group-hover:opacity-100"
														animate={{ scale: [0.9, 1.1, 0.9], opacity: [0, 0.55, 0] }}
														transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
													/>
												</span>
												<span>{item.label}</span>
											</span>
										) : (
											item.label
										)}
									</NavLink>
								))}
							</nav>
						</div>

						<div className="flex shrink-0 items-center">
							<Sheet open={menuOpen} onOpenChange={setMenuOpen}>
								<SheetTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="group h-[52px] w-[52px] rounded-full bg-black/5 p-0 hover:bg-black/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.10]"
										aria-label="Open menu"
										title="Menu"
									>
										{clientUser ? (
											<Avatar className="h-[52px] w-[52px]">
												<AvatarImage
													src={clientUser.image || "/users/avatar.webp"}
													alt="User"
												/>
												<AvatarFallback className="bg-emerald-500 text-white">
													<FaUser className="h-5 w-5" />
												</AvatarFallback>
											</Avatar>
										) : (
											<motion.span
												className="inline-flex"
												whileHover={prefersReducedMotion ? undefined : { rotate: 10, scale: 1.08 }}
												whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
												transition={{ type: "spring", stiffness: 520, damping: 26, mass: 0.6 }}
											>
												<TbHexagons className="h-6 w-6 text-slate-700 transition-colors group-hover:text-emerald-400 dark:text-slate-200 dark:group-hover:text-emerald-300" />
											</motion.span>
										)}
									</Button>
								</SheetTrigger>

								<SheetContent
									side="right"
									className="w-[92vw] max-w-[420px] bg-white/95 dark:bg-zinc-900/80 backdrop-blur-xl border border-black/10 dark:border-white/10"
										onTouchStart={onMenuTouchStart}
										onTouchEnd={onMenuTouchEnd}
								>
									<div className="flex h-full flex-col gap-4 p-4">
										<SheetHeader className="space-y-1">
											<SheetTitle className="text-lg font-semibold">
												{clientUser ? (clientUser.name ?? "Account") : "Welcome"}
											</SheetTitle>
											<SheetDescription className="text-sm text-slate-600 dark:text-slate-300">
												{clientUser?.email ?? "Sign in to sync your account and wallets."}
											</SheetDescription>
										</SheetHeader>

										<div className="flex items-center justify-between rounded-xl border border-black/10 p-3 dark:border-white/10 bg-black/5 dark:bg-white/[0.06]">
											<div className="min-w-0">
												<div className="text-sm font-semibold">Mode</div>
												<div className="text-xs text-slate-500 dark:text-slate-400 truncate">
													{effectiveWeb3ModeEnabled
														? "Web3 enabled: advanced wallet controls"
														: "Web2: simple account experience"}
												</div>
											</div>
											<Switch
												checked={effectiveWeb3ModeEnabled}
												disabled={isRequestingWeb3Mode}
												onCheckedChange={(checked) => {
													if (clientUser) {
														setIsRequestingWeb3Mode(true);
														MyRequestWeb3ModeSecurityAction(checked)
															.then((data) => {
																if (data?.error) {
																	toast.error(data.error, { position: "top-center" });
																	return;
																}
																if (data?.success) {
																	toast.success(data.success, { position: "top-center" });
																}
															})
															.catch(() => {
																toast.error("Something went wrong!", { position: "top-center" });
															})
															.finally(() => setIsRequestingWeb3Mode(false));
														return;
													}

													// Logged out: keep this as a local UX preference.
													setWeb3Mode(checked);
												}}
												aria-label="Toggle Web3 advanced mode"
											/>
										</div>

										<WalletConnection mode="dialog" />
										{clientUser && effectiveWeb3ModeEnabled ? (
											<>
												<EvmWalletVerify
													enabled={effectiveWeb3ModeEnabled}
													onVerified={() => setWalletRefreshToken((t) => t + 1)}
												/>
												<div className="-mt-1">
													<EvmWalletList enabled={effectiveWeb3ModeEnabled} refreshToken={walletRefreshToken} />
												</div>
											</>
										) : null}

										<div className="flex flex-col gap-2">
											{menuLinks.map((item) => (
												<Link
													key={item.href}
													href={item.href}
													onClick={() => setMenuOpen(false)}
													className="rounded-xl border border-black/10 px-3 py-2.5 text-sm dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors"
												>
													{item.label}
												</Link>
											))}
										</div>

										<div className="mt-auto flex flex-col gap-2">
											<Button
												variant="outline"
												onClick={() => {
													setMenuOpen(false);
													// Ensure banner animates after the sheet closes.
													setTimeout(() => openCookieSettings(), 0);
												}}
											>
												Cookie settings
											</Button>
											{clientUser ? (
												<>
													<div className="rounded-xl border border-black/10 p-2 dark:border-white/10">
														<button
															type="button"
															onClick={() => {
																setMenuOpen(false);
																// Defer opening so the Sheet can close first without
																// the dialog interpreting the click as an outside interaction.
																setTimeout(() => setNexusOpen(true), 0);
															}}
															className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-slate-700 hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/[0.06]"
															aria-label="Open Nexus command palette"
															title="Open Nexus (Ctrl/Cmd + K)"
														>
															<TbHexagons className="h-5 w-5" />
															<span className="font-medium">Nexus</span>
															<span className="ml-auto hidden text-xs opacity-60 md:inline">Ctrl K</span>
														</button>
													</div>
													<Button variant="outline" onClick={() => toggleTheme()}>
														{resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
													</Button>
													<Button variant="destructive" onClick={() => signOut()}>
														Logout
													</Button>
												</>
											) : (
												<>
													<Button onClick={() => signIn("google", { callbackUrl: "/products" })}>
														Continue with Google
													</Button>
													<Button onClick={() => signIn("github", { callbackUrl: "/products" })}>
														Continue with GitHub
													</Button>
													<Link
														href="/auth/login"
														onClick={() => setMenuOpen(false)}
														className="rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/10"
													>
														Login
													</Link>
													<Link
														href="/auth/register"
														onClick={() => setMenuOpen(false)}
														className="rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/10"
													>
														Sign up
													</Link>
													<Button variant="outline" onClick={() => toggleTheme()}>
														{resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
													</Button>
												</>
											)}
										</div>
									</div>
								</SheetContent>
							</Sheet>
						</div>
					</div>
					</motion.div>
			</motion.header>
    </>
  );
};

export default MyTopBar;