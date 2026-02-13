"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { motion, useReducedMotion } from "framer-motion";
import WalletConnection from "../crypto-related/WalletAdapter"; // Your wallet UI (legacy)
import AppKitButton from "../crypto-related/AppKitButton"; // Polished AppKit wallet modal
import NetworkSyncBridge from "@/components/crypto-related/NetworkSyncBridge";
import { MyDialogbarNavigator } from "@/app/(protected)/_components/dialog-bar";
import { useTheme } from "next-themes";
import { signIn, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FaUser } from "react-icons/fa";
import useSWR from "swr";
import { toast } from "sonner";
import { TbHexagons } from "react-icons/tb";
import { FiShoppingCart, FiUser, FiMessageSquare, FiImage, FiSliders, FiShield, FiBell, FiLock, FiDollarSign, FiSun, FiMoon, FiMonitor, FiTrash2, FiEye, FiEyeOff, FiBellOff, FiVolume2, FiVolumeX, FiKey, FiCamera, FiEdit2, FiExternalLink, FiCopy, FiLink, FiRefreshCw, FiCheck, FiPackage, FiZap } from "react-icons/fi";
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
import { useUiPreferences } from "@/components/providers/ui-preferences";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import usePusher from "@/hooks/usePusher";
import { useCallback } from "react";
import { MiniCartDropdown } from "@/components/uicustom/mini-cart-dropdown";
import { ChatLiteDropdown } from "@/components/uicustom/chat-lite-dropdown";
import { useCleanLogout } from "@/hooks/use-clean-logout";
import { useAccount, useChainId, useChains, useSwitchChain } from "wagmi";

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
	} = useNotifications({ refreshInterval: 30000, enabled: !!clientUser });

	// Fetch cart count for logged-in users
	const { data: cartData, mutate: mutateCart } = useSWR(
		clientUser?.id ? `/api/cart/${clientUser.id}` : null,
		fetcher,
		{ refreshInterval: 10000, dedupingInterval: 3000 }
	);
	const cartCount = cartData?.items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0;

	// Real-time cart updates via Pusher
	usePusher<{ userId: string }>(
		clientUser?.id ? `UserChannel_${clientUser.id}` : '',
		'cart-update',
		useCallback(() => {
			mutateCart();
		}, [mutateCart])
	);

	// Real-time notification updates via Pusher
	usePusher<{ userId: string }>(
		clientUser?.id ? `UserChannel_${clientUser.id}` : '',
		'notification-update',
		useCallback(() => {
			// The notifications hook SWR will be revalidated via its own key
			window.dispatchEvent(new CustomEvent('notification-refresh'));
		}, [])
	);
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
	const cleanLogout = useCleanLogout();
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
	// Messages is now an icon in the topbar, not a text link
	const nav: Array<{ href: string; label: string }> = [
		{ href: "/", label: "Home" },
		{ href: "/products", label: "Products" },
		{ href: "/pulse", label: "Pulse" },
		...(clientUser
			? [
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
												if (notif.type === 'TRADE_REQUEST' && notif.metadata?.tradeId) {
													window.location.href = `/trade/${notif.metadata.tradeId}`;
												} else if (notif.conversationId) {
													window.location.href = `/conversations/${notif.conversationId}`;
												} else if (notif.pulseId) {
													window.location.href = `/pulse/${notif.pulseId}`;
												} else if (notif.actorId) {
													window.location.href = `/profile/${notif.actorId}`;
												}
											}}
											condensed
										/>
										
										{/* Mini Cart Dropdown */}
										<MiniCartDropdown
											userId={clientUser?.id}
											cartCount={cartCount}
											onCartUpdate={() => mutateCart()}
										/>

										{/* Chat lite dropdown — replaces plain Messages link */}
										<ChatLiteDropdown />
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

													{/* Web3 Wallet — always visible in nav pane for all users */}
													<div className={`${clientUser ? 'mt-2' : 'mt-4'} rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden`}>
														<div className="flex items-center gap-3 px-4 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
															<FiZap className="h-4 w-4 text-emerald-500" />
															<span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Web3 Wallet</span>
															{clientUser && effectiveWeb3ModeEnabled && (
																<Link
																	href="/settings?section=wallet"
																	onClick={() => setMenuOpen(false)}
																	className="ml-auto text-[10px] text-zinc-400 hover:text-emerald-500 transition-colors"
																>
																	Manage →
																</Link>
															)}
														</div>
														<div className="flex justify-center p-3">
															<AppKitButton size="md" />
														</div>
													</div>
												</div>
											)}

											{/* Settings Pane - Lite Mode with Hover Dropdowns */}
											{clientUser && menuPane === "settings" && (
												<SettingsPaneLite 
													setMenuOpen={setMenuOpen}
													effectiveWeb3ModeEnabled={effectiveWeb3ModeEnabled}
													walletRefreshToken={walletRefreshToken}
													setWalletRefreshToken={setWalletRefreshToken}
													openCookieSettings={openCookieSettings}
												/>
											)}

										</div>

										{/* Footer actions */}
										<div className="border-t border-zinc-100 dark:border-zinc-800 p-4 space-y-2">
											{clientUser ? (
												<button
													type="button"
													onClick={() => cleanLogout()}
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

// Compact wallet info shown inside the sidebar Sheet wallet section
function SidebarWalletInfo() {
	const { address, isConnected } = useAccount();
	const activeChainId = useChainId();
	const chains = useChains();
	const { switchChain, status: switchStatus } = useSwitchChain();
	const [copied, setCopied] = useState(false);

	if (!isConnected || !address) return null;

	const trimmed = `${address.slice(0, 6)}…${address.slice(-4)}`;
	const activeChain = chains.find((c) => c.id === activeChainId);

	const copyAddress = async () => {
		try {
			await navigator.clipboard.writeText(address);
			setCopied(true);
			toast.success("Address copied");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy");
		}
	};

	return (
		<div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5 space-y-2">
			{/* Address row */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-1.5 min-w-0">
					<span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
					<span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate" title={address}>
						{trimmed}
					</span>
				</div>
				<button
					type="button"
					onClick={copyAddress}
					className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors shrink-0"
					title="Copy full address"
				>
					{copied ? (
						<FiCheck className="h-3.5 w-3.5 text-emerald-500" />
					) : (
						<FiCopy className="h-3.5 w-3.5 text-zinc-400" />
					)}
				</button>
			</div>

			{/* Network row */}
			<div className="flex items-center justify-between gap-2">
				<span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
					Network
				</span>
				<select
					className="text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300 max-w-[140px]"
					value={activeChainId ?? ""}
					onChange={(e) => {
						const id = Number(e.target.value);
						if (id !== activeChainId) switchChain({ chainId: id });
					}}
					disabled={switchStatus === "pending"}
				>
					{chains.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}{switchStatus === "pending" && c.id !== activeChainId ? " …" : ""}
						</option>
					))}
				</select>
			</div>

			{/* Current chain indicator */}
			{activeChain && (
				<div className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right">
					Chain ID: {activeChain.id}
				</div>
			)}
		</div>
	);
}

// Settings Pane Lite Component with Hover Dropdowns
function SettingsPaneLite({
	setMenuOpen,
	effectiveWeb3ModeEnabled,
	walletRefreshToken,
	setWalletRefreshToken,
	openCookieSettings,
}: {
	setMenuOpen: (open: boolean) => void;
	effectiveWeb3ModeEnabled: boolean;
	walletRefreshToken: number;
	setWalletRefreshToken: (fn: (t: number) => number) => void;
	openCookieSettings: () => void;
}) {
	const { resolvedTheme, setTheme } = useTheme();
	const [hoveredItem, setHoveredItem] = useState<string | null>(null);
	const clientUser = useCurrentUser();

	// Settings items with quick actions on hover
	const settingsItems = [
		{ 
			id: 'profile', 
			href: '/settings?section=profile', 
			icon: FiImage, 
			label: 'Profile', 
			desc: 'Avatar, banner & bio',
			quickActions: [
				{ id: 'view', icon: FiExternalLink, label: 'View', actionType: 'link', link: `/profile/${clientUser?.id}` },
				{ id: 'avatar', icon: FiCamera, label: 'Avatar', actionType: 'link', link: '/settings?section=profile' },
				{ id: 'edit', icon: FiEdit2, label: 'Edit Bio', actionType: 'link', link: '/settings?section=profile' },
			],
		},
		{ 
			id: 'account', 
			href: '/settings?section=account', 
			icon: FiUser, 
			label: 'Account', 
			desc: 'Name & email',
			quickActions: [
				{ id: 'edit', icon: FiEdit2, label: 'Edit Name', actionType: 'link', link: '/settings?section=account' },
				// Only show email edit for non-OAuth users (credential-based accounts)
				...(!clientUser?.isOAuth ? [
					{ id: 'editEmail', icon: FiEdit2, label: 'Change Email', actionType: 'link', link: '/settings?section=account' },
				] : []),
			],
		},
		{ 
			id: 'appearance', 
			href: '/settings?section=appearance', 
			icon: FiSliders, 
			label: 'Appearance', 
			desc: 'Theme & effects',
			quickActions: [
				{ id: 'light', icon: FiSun, label: 'Light', actionType: 'theme' },
				{ id: 'dark', icon: FiMoon, label: 'Dark', actionType: 'theme' },
				{ id: 'system', icon: FiMonitor, label: 'System', actionType: 'theme' },
			],
			currentValue: resolvedTheme,
		},
		{ 
			id: 'currency', 
			href: '/settings?section=currency', 
			icon: FiDollarSign, 
			label: 'Currency', 
			desc: 'Display currency',
			quickActions: [
				{ id: 'USD', icon: () => <span className="text-sm font-medium">$</span>, label: 'USD', actionType: 'currency' },
				{ id: 'EUR', icon: () => <span className="text-sm font-medium">€</span>, label: 'EUR', actionType: 'currency' },
				{ id: 'GBP', icon: () => <span className="text-sm font-medium">£</span>, label: 'GBP', actionType: 'currency' },
				{ id: 'NOK', icon: () => <span className="text-sm font-medium">kr</span>, label: 'NOK', actionType: 'currency' },
			],
		},
		{ 
			id: 'security', 
			href: '/settings?section=security', 
			icon: FiShield, 
			label: 'Security', 
			desc: 'Password & 2FA',
			quickActions: [
				{ id: 'password', icon: FiKey, label: 'Password', actionType: 'link', link: '/settings?section=security' },
				{ id: '2fa', icon: FiShield, label: '2FA', actionType: 'link', link: '/settings?section=security' },
			],
		},
		{ 
			id: 'notifications', 
			href: '/settings?section=notifications', 
			icon: FiBell, 
			label: 'Notifications', 
			desc: 'Alerts & sounds',
			quickActions: [
				{ id: 'mute', icon: FiBellOff, label: 'Mute All', actionType: 'notification', action: 'mute' },
				{ id: 'unmute', icon: FiVolume2, label: 'Unmute', actionType: 'notification', action: 'unmute' },
			],
		},
		{ 
			id: 'privacy', 
			href: '/settings?section=privacy', 
			icon: FiLock, 
			label: 'Privacy', 
			desc: 'Visibility & data',
			quickActions: [
				{ id: 'clearCookies', icon: FiTrash2, label: 'Clear Cookies', actionType: 'privacy', action: 'clearCookies' },
				{ id: 'clearCache', icon: FiTrash2, label: 'Clear Cache', actionType: 'privacy', action: 'clearCache' },
			],
		},
	];

	return (
		<div className="p-4 space-y-3">
			{/* Quick Settings Links with Hover Dropdowns */}
			<div className="space-y-1">
				<div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-2 mb-2">
					Quick Access
				</div>
				{settingsItems.map((item) => (
					<SettingsItemWithHover
						key={item.id}
						item={item}
						isHovered={hoveredItem === item.id}
						onHover={() => setHoveredItem(item.id)}
						onLeave={() => setHoveredItem(null)}
						setMenuOpen={setMenuOpen}
					/>
				))}
			</div>

			{/* Wallet Section */}
			{effectiveWeb3ModeEnabled && (
				<div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3">
					<div className="flex items-center justify-between mb-2">
						<div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
							Wallet
						</div>
						<Link
							href="/settings?section=wallet"
							onClick={() => setMenuOpen(false)}
							className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
						>
							Manage →
						</Link>
					</div>
					<div className="space-y-2">
						{/* AppKit button for polished wallet modal with QR codes & social logins */}
						<div className="flex justify-center py-1">
							<AppKitButton size="md" />
						</div>

						{/* Connected wallet info: address, copy, network */}
						<SidebarWalletInfo />

						{/* Inventory shortcut */}
						<Link
							href="/dashboard/inventory"
							onClick={() => setMenuOpen(false)}
							className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
						>
							<FiPackage className="h-3.5 w-3.5 text-emerald-500" />
							<span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Token Inventory</span>
							<span className="ml-auto text-[10px] text-zinc-400">→</span>
						</Link>

						<EvmWalletVerify
							enabled={effectiveWeb3ModeEnabled}
							onVerified={() => setWalletRefreshToken((t) => t + 1)}
						/>
						<EvmWalletList enabled={effectiveWeb3ModeEnabled} refreshToken={walletRefreshToken} />
					</div>
				</div>
			)}

			{/* All Settings & Cookie Preferences */}
			<div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
				<Link
					href="/settings"
					onClick={() => setMenuOpen(false)}
					className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
				>
					All Settings
				</Link>
				<button
					type="button"
					onClick={() => {
						setMenuOpen(false);
						setTimeout(() => openCookieSettings(), 0);
					}}
					className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
				>
					Cookie preferences
				</button>
			</div>
		</div>
	);
}

// Individual settings item with flip card animation
function SettingsItemWithHover({
	item,
	isHovered,
	onHover,
	onLeave,
	setMenuOpen,
}: {
	item: any;
	isHovered: boolean;
	onHover: () => void;
	onLeave: () => void;
	setMenuOpen: (open: boolean) => void;
}) {
	const { resolvedTheme, setTheme } = useTheme();
	const { prefs, setPrefs } = useUiPreferences();
	const [isClearing, setIsClearing] = useState(false);
	
	const hasQuickActions = item.quickActions && item.quickActions.length > 0;
	
	// Get current value for highlighting
	const getCurrentValue = () => {
		if (item.id === 'appearance') return resolvedTheme;
		if (item.id === 'currency') return prefs.preferredFiatCurrency;
		return null;
	};
	
	// Clear non-essential cookies while preserving auth
	const clearNonEssentialCookies = async () => {
		setIsClearing(true);
		try {
			const cookies = document.cookie.split(';');
			const essentialPrefixes = ['next-auth', 'authjs', '__Secure-', '__Host-', 'csrf'];
			let clearedCount = 0;
			
			cookies.forEach(cookie => {
				const [name] = cookie.split('=').map(c => c.trim());
				const isEssential = essentialPrefixes.some(prefix => 
					name.toLowerCase().startsWith(prefix.toLowerCase())
				);
				if (!isEssential && name) {
					document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
					clearedCount++;
				}
			});
			
			const essentialStorage = ['veggastare:', 'next-auth', 'ui-preferences'];
			const keysToRemove: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && !essentialStorage.some(prefix => key.startsWith(prefix))) {
					keysToRemove.push(key);
				}
			}
			keysToRemove.forEach(key => localStorage.removeItem(key));
			
			toast.success(`Cleared ${clearedCount} cookies and ${keysToRemove.length} cached items`, {
				description: 'Your session remains active',
			});
		} catch (err) {
			toast.error('Failed to clear cookies');
		} finally {
			setIsClearing(false);
		}
	};
	
	// Clear browser cache
	const clearBrowserCache = async () => {
		setIsClearing(true);
		try {
			if ('caches' in window) {
				const cacheNames = await caches.keys();
				await Promise.all(cacheNames.map(name => caches.delete(name)));
			}
			sessionStorage.clear();
			toast.success('Cache cleared successfully', {
				description: 'Page may reload to apply changes',
			});
			setTimeout(() => window.location.reload(), 1000);
		} catch (err) {
			toast.error('Failed to clear cache');
		} finally {
			setIsClearing(false);
		}
	};
	
	// Toggle notification mute
	const toggleNotificationMute = async (mute: boolean) => {
		try {
			const res = await fetch('/api/notifications/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ inAppEnabled: !mute, pushEnabled: !mute }),
			});
			if (res.ok) {
				toast.success(mute ? 'Notifications muted' : 'Notifications enabled');
			} else {
				toast.error('Failed to update notifications');
			}
		} catch (err) {
			toast.error('Failed to update notifications');
		}
	};
	
	const handleQuickAction = (action: any, e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		switch (action.actionType) {
			case 'theme':
				setTheme(action.id);
				break;
			case 'currency':
				setPrefs({ preferredFiatCurrency: action.id });
				break;
			case 'link':
				setMenuOpen(false);
				window.location.href = action.link;
				break;
			case 'notification':
				if (action.action === 'mute') toggleNotificationMute(true);
				if (action.action === 'unmute') toggleNotificationMute(false);
				break;
			case 'privacy':
				if (action.action === 'clearCookies') clearNonEssentialCookies();
				if (action.action === 'clearCache') clearBrowserCache();
				break;
		}
	};

	// Click on front card navigates to settings
	const handleFrontClick = () => {
		setMenuOpen(false);
		window.location.href = item.href;
	};

	return (
		<div
			className="relative h-[52px]"
			style={{ perspective: '1000px' }}
			onMouseEnter={onHover}
			onMouseLeave={onLeave}
		>
			{/* Card container with 3D flip */}
			<div
				className="relative w-full h-full transition-transform duration-300 ease-out"
				style={{ 
					transformStyle: 'preserve-3d',
					transform: hasQuickActions && isHovered ? 'rotateX(180deg)' : 'rotateX(0deg)',
				}}
			>
				{/* Front of card - Normal view */}
				<div
					className="absolute inset-0 w-full h-full rounded-lg px-3 py-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
					style={{ backfaceVisibility: 'hidden' }}
					onClick={handleFrontClick}
				>
					<div className="flex items-center gap-3 h-full">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
							<item.icon className="h-4 w-4" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="font-medium text-sm text-zinc-700 dark:text-zinc-200">{item.label}</div>
							<div className="text-[11px] text-zinc-500 dark:text-zinc-500 truncate">{item.desc}</div>
						</div>
						{item.currentValue && (
							<div className="text-[10px] text-zinc-400 dark:text-zinc-600">
								{item.currentValue}
							</div>
						)}
					</div>
				</div>

				{/* Back of card - Quick actions */}
				{hasQuickActions && (
					<div
						className="absolute inset-0 w-full h-full rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5"
						style={{ 
							backfaceVisibility: 'hidden',
							transform: 'rotateX(180deg)',
						}}
					>
						<div className="flex items-center justify-center gap-1 h-full">
							{item.quickActions.map((action: any) => {
								const isActive = getCurrentValue() === action.id;
								const IconComponent = action.icon;
								const isDanger = action.action === 'clearCookies' || action.action === 'clearCache';
								
								return (
									<button
										key={action.id}
										type="button"
										disabled={isClearing}
										onClick={(e) => handleQuickAction(action, e)}
										className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
											isActive
												? 'bg-emerald-500 text-white shadow-sm'
												: isDanger
													? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60'
													: 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-600 shadow-sm'
										} ${isClearing ? 'opacity-50 cursor-wait' : ''}`}
										title={action.label}
									>
										{typeof IconComponent === 'function' ? (
											<IconComponent className="h-3.5 w-3.5" />
										) : (
											<IconComponent className="h-3.5 w-3.5" />
										)}
										<span>{action.label}</span>
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default MyTopBar;