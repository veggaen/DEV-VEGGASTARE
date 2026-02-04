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
import useSWR from "swr";
import { toast } from "sonner";
import { TbHexagons } from "react-icons/tb";
import { FiShoppingCart, FiUser } from "react-icons/fi";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import EvmWalletVerify from "@/components/crypto-related/EvmWalletVerify";
import EvmWalletList from "@/components/crypto-related/EvmWalletList";
import ThemeToggleMenu from "@/components/uicustom/ThemeToggleMenu";
import { CurrencySelector } from "@/components/uicustom/currency-selector";
import { NotificationDropdown } from "@/components/uicustom/notifications/notification-dropdown";
import { useNotifications } from "@/hooks/use-notifications";

type NavLinkProps = {
	href: string;
	children: ReactNode;
	isActive: boolean;
};

const NavLink = ({ href, children, isActive }: NavLinkProps) => (
	<Link
		href={href}
		aria-current={isActive ? "page" : undefined}
		className={`relative px-2.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${isActive
			? "text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800"
			: "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
			}`}
	>
		{children}
	</Link>
);

function isActivePath(pathname: string, href: string) {
	if (href === "/") return pathname === "/";
	return pathname === href || pathname.startsWith(`${href}/`);
}

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : { items: [] });

const MyTopBar = () => {
	const pathname = usePathname();
	const clientUser = useCurrentUser();
	const prefersReducedMotion = useReducedMotion();

	// Fetch notifications for logged-in users
	const { 
		notifications, 
		unreadCount, 
		isLoading: notificationsLoading,
		markAsRead,
		markAllAsRead 
	} = useNotifications({ refreshInterval: 30000 });

	// Fetch cart count for logged-in users
	const { data: cartData } = useSWR(
		clientUser?.id ? `/api/cart/${clientUser.id}` : null,
		fetcher,
		{ refreshInterval: 30000, dedupingInterval: 5000 }
	);
	const cartCount = cartData?.items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0;
	const headerRef = useRef<HTMLElement | null>(null);
	const { resolvedTheme, setTheme } = useTheme();
	const [menuOpen, setMenuOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [productsTopbarVisible, setProductsTopbarVisible] = useState(true);
	const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState<number>(72);
	const [nexusOpen, setNexusOpen] = useState(false);
	const [web3ModeEnabled, setWeb3ModeEnabled] = useState(false);
	const [walletRefreshToken, setWalletRefreshToken] = useState(0);
	const [menuPane, setMenuPane] = useState<"nav" | "settings">("nav");
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
		// /products/create is non-scrollable on desktop; never show "scrolled" state
		const isCreatePage = pathname === "/products/create";
		const enter = isProducts ? 6 : 12;
		const exit = isProducts ? 2 : 4;
		let raf = 0;
		const update = () => {
			raf = 0;
			// Always keep topbar "unscrolled" on create page
			if (isCreatePage) {
				setIsScrolled(false);
				return;
			}
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

	// Simplified desktop nav - main discovery paths only
	const nav: Array<{ href: string; label: string }> = [
		{ href: "/", label: "Home" },
		{ href: "/products", label: "Products" },
		{ href: "/pulse", label: "Pulse" },
		...(clientUser
			? [
				{ href: "/conversations", label: "Messages" },
				{ href: "/dashboard", label: "Dashboard" },
			]
			: []),
	];

	const menuLinks = useMemo(() => {
		// Mobile/sheet menu has full navigation
		if (clientUser) {
			return [
				{ href: "/", label: "Home" },
				{ href: "/products", label: "Products" },
				{ href: "/pulse", label: "Pulse" },
				{ href: "/conversations", label: "Messages" },
				{ href: "/dashboard", label: "Dashboard" },
				{ href: "/cart", label: "Shopping Cart" },
				{ href: "/checkout", label: "Checkout" },
				{ href: "/settings", label: "Settings" },
				{ href: "/info", label: "Info / Contact" },
				{ href: "/privacy", label: "Privacy & cookies" },
			];
		}
		return [
			{ href: "/", label: "Home" },
			{ href: "/products", label: "Products" },
			{ href: "/pulse", label: "Pulse" },
			{ href: "/info", label: "Info / Contact" },
			{ href: "/privacy", label: "Privacy & cookies" },
		];
	}, [clientUser]);

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

	// Reset topbar visibility when navigating away from /products, switching to desktop,
	// or navigating to a different page within /products/* (like /products/create)
	useEffect(() => {
		// Always reset topbar visibility on pathname change - the ProductProvider will
		// re-hide it if needed based on scroll position
		setProductsTopbarVisible(true);
	}, [pathname]);

	// Also reset when switching to desktop
	useEffect(() => {
		if (!isMobile) {
			setProductsTopbarVisible(true);
		}
	}, [isMobile]);

	useEffect(() => {
		const onChrome = (e: Event) => {
			if (!pathname.startsWith("/products")) return;
			const ce = e as CustomEvent<{ topbarVisible?: boolean }>;
			setProductsTopbarVisible(Boolean(ce?.detail?.topbarVisible ?? true));
		};
		window.addEventListener("veggat:products-chrome", onChrome as any);
		return () => window.removeEventListener("veggat:products-chrome", onChrome as any);
	}, [pathname]);

	// Avoid rendering the full navigation on auth screens.
	const hideOnAuthPages = pathname.startsWith("/auth/");
	if (hideOnAuthPages) return <NetworkSyncBridge />;

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
						<div className="absolute inset-0 bg-white/75 dark:bg-black/70 backdrop-blur-xl" />
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
						<div className="flex min-w-0 items-center gap-6">
							<Link
								href="/"
								className="shrink-0 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
							>
								VeggaStare
							</Link>

							<nav className="hidden md:flex items-center gap-1">
								{nav.map((item) => (
									<NavLink
										key={item.href}
										href={item.href}
										isActive={isActivePath(pathname, item.href)}
									>
										{item.href === "/pulse" ? (
											<span className="inline-flex items-center gap-1.5">
												<span className="relative flex h-2 w-2">
													<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
													<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
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

						<div className="flex shrink-0 items-center gap-2">
							{/* Desktop quick actions */}
							<div className="hidden md:flex items-center gap-1">
								<CurrencySelector variant="ghost" size="sm" />

								{clientUser && (
									<>
										{/* Notification Bell */}
										<NotificationDropdown
											notifications={notifications}
											unreadCount={unreadCount}
											isLoading={notificationsLoading}
											onMarkRead={markAsRead}
											onMarkAllRead={markAllAsRead}
											onNotificationClick={(notif) => {
												// Navigate based on notification type
												if (notif.conversationId) {
													window.location.href = `/conversations/${notif.conversationId}`;
												} else if (notif.pulseId) {
													window.location.href = `/pulse/${notif.pulseId}`;
												} else if (notif.actorId) {
													window.location.href = `/profile/${notif.actorId}`;
												}
											}}
											condensed
										/>
										
										<Link
											href="/cart"
											className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
											title="Cart"
										>
											<FiShoppingCart className="h-[18px] w-[18px]" />
											{cartCount > 0 && (
												<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
													{cartCount > 99 ? "99+" : cartCount}
												</span>
											)}
										</Link>
									</>
								)}
							</div>
							<Sheet open={menuOpen} onOpenChange={setMenuOpen}>
								<SheetTrigger asChild>
									<button
										type="button"
										className={`flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${clientUser
											? "h-14 w-14"
											: "h-14 w-14 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
											}`}
										aria-label="Open menu"
									>
										{clientUser ? (
											<Avatar className="h-14 w-14 border-2 border-zinc-200 dark:border-zinc-700">
												<AvatarImage
													src={clientUser.image || "/users/avatar.webp"}
													alt="User"
												/>
												<AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-base">
													<FaUser className="h-6 w-6" />
												</AvatarFallback>
											</Avatar>
										) : (
											<TbHexagons className="h-6 w-6" />
										)}
									</button>
								</SheetTrigger>

								<SheetContent
									side="right"
									className="w-[92vw] max-w-[380px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800"
									onTouchStart={onMenuTouchStart}
									onTouchEnd={onMenuTouchEnd}
									accessibleTitle="Navigation Menu"
								>
									<div className="flex h-full flex-col">
										{/* User Profile Header */}
										{clientUser ? (
											<Link
												href="/profile"
												onClick={() => setMenuOpen(false)}
												className="flex flex-col items-center gap-3 p-6 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group"
												title="View Profile"
											>
												<Avatar className="h-20 w-20 border-2 border-zinc-200 dark:border-zinc-700 group-hover:border-emerald-400 transition-colors">
													<AvatarImage
														src={clientUser.image || "/users/avatar.webp"}
														alt="User"
													/>
													<AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xl">
														<FaUser className="h-8 w-8" />
													</AvatarFallback>
												</Avatar>
												<div className="text-center">
													<div className="text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
														{clientUser.name ?? "Account"}
													</div>
													<div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
														{clientUser.email}
													</div>
													<div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
														Click to view profile
													</div>
												</div>
											</Link>
										) : (
											<SheetHeader className="border-b border-zinc-100 dark:border-zinc-800 p-6">
												<SheetTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
													Welcome
												</SheetTitle>
												<SheetDescription className="text-xs text-zinc-500 dark:text-zinc-400">
													Sign in to access all features
												</SheetDescription>
											</SheetHeader>
										)}

										{/* Two-Pane Tab Navigation */}
										{clientUser && (
											<div className="flex border-b border-zinc-100 dark:border-zinc-800">
												<button
													type="button"
													onClick={() => setMenuPane("nav")}
													className={`flex-1 py-3 text-sm font-medium transition-colors ${menuPane === "nav"
														? "text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-900 dark:border-zinc-100"
														: "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
														}`}
												>
													Navigate
												</button>
												<button
													type="button"
													onClick={() => setMenuPane("settings")}
													className={`flex-1 py-3 text-sm font-medium transition-colors ${menuPane === "settings"
														? "text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-900 dark:border-zinc-100"
														: "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
														}`}
												>
													Settings
												</button>
											</div>
										)}

										{/* Main scrollable content */}
										<div className="flex-1 overflow-y-auto">
											{/* Navigation Pane */}
											{(!clientUser || menuPane === "nav") && (
												<div className="p-4">
													{/* Navigation links */}
													<nav className="space-y-1">
														{menuLinks.map((item) => (
															<Link
																key={item.href}
																href={item.href}
																onClick={() => setMenuOpen(false)}
																className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors ${isActivePath(pathname, item.href)
																	? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
																	: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
																	}`}
															>
																{item.label}
															</Link>
														))}
													</nav>

													{/* Nexus button in nav pane */}
													{clientUser && (
														<button
															type="button"
															onClick={() => {
																setMenuOpen(false);
																setTimeout(() => setNexusOpen(true), 0);
															}}
															className="mt-4 flex w-full items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
														>
															<TbHexagons className="h-5 w-5" />
															<span className="font-medium">Nexus</span>
															<span className="ml-auto text-[10px] text-zinc-400">⌘K</span>
														</button>
													)}
												</div>
											)}

											{/* Settings Pane */}
											{clientUser && menuPane === "settings" && (
												<div className="p-4 space-y-4">
													{/* Theme Section */}
													<div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-4">
														<div className="flex items-center justify-between mb-3">
															<div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
																Theme
															</div>
															<Link
																href="/settings?tab=appearance"
																onClick={() => setMenuOpen(false)}
																className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
															>
																More options →
															</Link>
														</div>
														<ThemeToggleMenu showLabel={true} />
													</div>

													{/* Currency Section */}
													<div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-4">
														<div className="flex items-center justify-between mb-3">
															<div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
																Currency
															</div>
															<Link
																href="/settings?tab=currency"
																onClick={() => setMenuOpen(false)}
																className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
															>
																More options →
															</Link>
														</div>
														<CurrencySelector showCrypto={true} variant="outline" />
													</div>

													{/* Wallet Section */}
													{effectiveWeb3ModeEnabled && (
														<div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-4">
															<div className="flex items-center justify-between mb-3">
																<div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
																	Wallet
																</div>
																<Link
																	href="/settings?tab=wallet"
																	onClick={() => setMenuOpen(false)}
																	className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
																>
																	Manage wallets →
																</Link>
															</div>
															<div className="space-y-2">
																<EvmWalletVerify
																	enabled={effectiveWeb3ModeEnabled}
																	onVerified={() => setWalletRefreshToken((t) => t + 1)}
																/>
																<EvmWalletList enabled={effectiveWeb3ModeEnabled} refreshToken={walletRefreshToken} />
															</div>
														</div>
													)}

													{/* All Settings Link */}
													<Link
														href="/settings"
														onClick={() => setMenuOpen(false)}
														className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
													>
														<span>All Settings</span>
													</Link>

													{/* Cookie Preferences */}
													<button
														type="button"
														onClick={() => {
															setMenuOpen(false);
															setTimeout(() => openCookieSettings(), 0);
														}}
														className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
													>
														Cookie preferences
													</button>
												</div>
											)}

											{/* Guest wallet connection */}
											{!clientUser && (
												<div className="p-4">
													<WalletConnection mode="dialog" />
												</div>
											)}
										</div>

										{/* Footer actions */}
										<div className="border-t border-zinc-100 dark:border-zinc-800 p-4 space-y-2">
											{clientUser ? (
												<button
													type="button"
													onClick={() => signOut()}
													className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
												>
													Sign out
												</button>
											) : (
												<>
													<button
														type="button"
														onClick={() => signIn("google", { callbackUrl: "/products" })}
														className="w-full rounded-xl bg-zinc-900 dark:bg-white px-4 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
													>
														Continue with Google
													</button>
													<button
														type="button"
														onClick={() => signIn("github", { callbackUrl: "/products" })}
														className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
													>
														Continue with GitHub
													</button>
													<div className="flex gap-2 pt-1">
														<Link
															href="/auth/login"
															onClick={() => setMenuOpen(false)}
															className="flex-1 rounded-xl px-4 py-2.5 text-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
														>
															Sign in
														</Link>
														<Link
															href="/auth/register"
															onClick={() => setMenuOpen(false)}
															className="flex-1 rounded-xl px-4 py-2.5 text-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
														>
															Sign up
														</Link>
													</div>
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