"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { motion, useReducedMotion } from "framer-motion";
import WalletConnection from "../crypto-related/WalletAdapter"; // Your wallet UI (legacy)
import SidebarWalletPanel from "../crypto-related/SidebarWalletPanel";
import AppKitButton from "../crypto-related/AppKitButton";
import NetworkSyncBridge from "@/components/crypto-related/NetworkSyncBridge";
import { MyDialogbarNavigator } from "@/app/(protected)/_components/dialog-bar";
import { useTheme } from "next-themes";
import { signIn, signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FaUser, FaDiscord, FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import useSWR from "swr";
import { toast } from "sonner";
import { TbHexagons } from "react-icons/tb";
import { FiShoppingCart, FiUser, FiMessageSquare, FiImage, FiSliders, FiShield, FiBell, FiLock, FiDollarSign, FiSun, FiMoon, FiMonitor, FiTrash2, FiEye, FiEyeOff, FiBellOff, FiVolume2, FiVolumeX, FiKey, FiCamera, FiEdit2, FiExternalLink, FiCopy, FiLink, FiRefreshCw, FiCheck, FiPackage, FiZap, FiHome, FiGrid, FiCreditCard, FiSettings, FiHelpCircle } from "react-icons/fi";
import { PulseHeart } from "@/components/uicustom/icons/PulseIcons";
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
import { MiniCartDropdown } from "@/components/uicustom/mini-cart-dropdown";
import { ChatLiteDropdown } from "@/components/uicustom/chat-lite-dropdown";
import { useCleanLogout } from "@/hooks/use-clean-logout";
import { useAccount, useChainId, useChains, useSwitchChain, useConnections, useDisconnect } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { CopyChip } from "@/components/uicustom/CopyChip";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
import { isLocalChain } from "@/lib/is-local-chain";

type NavLinkProps = {
	href: string;
	children: ReactNode;
	isActive: boolean;
};

const NavLink = ({ href, children, isActive, ...rest }: NavLinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
	<Link
		href={href}
		aria-current={isActive ? "page" : undefined}
		{...rest}
		className={`relative px-2.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
			isActive
				? "text-zinc-900 dark:text-zinc-100"
				: "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
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

/** Key for sessionStorage flag that prevents OAuth redirect loops */
const OAUTH_BRIDGE_KEY_PREFIX = 'veggat_oauth_bridge_';

/** Map AppKit authProvider → NextAuth provider id (only ones we have configured) */
const APPKIT_TO_NEXTAUTH: Record<string, string> = {
	google: 'google',
	discord: 'discord',
	github: 'github',
};

/**
 * Always-rendered zero-UI component that auto-bridges AppKit social login → NextAuth OAuth.
 * When a user signs in via AppKit's social login (Google, Discord, GitHub), this detects
 * "AppKit has an email but NextAuth doesn't" and triggers the corresponding NextAuth
 * OAuth sign-in. Because the user just authenticated with the provider, it auto-approves.
 *
 * @stability stable — extracted so it runs regardless of auth state or sidebar visibility.
 */
function AppKitOAuthBridge() {
	const { embeddedWalletInfo } = useAppKitAccount();
	const { status: sessionStatus, data: session } = useSession();

	const appKitEmail = embeddedWalletInfo?.user?.email as string | undefined;
	const appKitAuthProvider = embeddedWalletInfo?.authProvider as string | undefined;
	const nextAuthEmail = session?.user?.email;

	const bridgeTriggeredRef = useRef(false);

	useEffect(() => {
		// Wait for session to finish loading — avoid false positives
		if (sessionStatus === 'loading') return;
		// Only bridge if AppKit has an email but NextAuth doesn't
		if (!appKitEmail || nextAuthEmail) return;
		// One-shot per component mount
		if (bridgeTriggeredRef.current) return;

		// Determine which NextAuth provider to bridge to
		const nextAuthProvider = appKitAuthProvider ? APPKIT_TO_NEXTAUTH[appKitAuthProvider] : undefined;
		// Fall back to 'google' if we can't detect the provider (legacy behaviour)
		const bridgeProvider = nextAuthProvider || 'google';

		// Check per-email flag in sessionStorage to prevent redirect loops
		const bridgeKey = `${OAUTH_BRIDGE_KEY_PREFIX}${appKitEmail}`;
		if (sessionStorage.getItem(bridgeKey)) return;

		bridgeTriggeredRef.current = true;

		// Small delay to let wallet registry finish saving to sessionStorage
		const timer = setTimeout(() => {
			console.log(`[AppKitOAuthBridge] Auto-bridging AppKit ${appKitAuthProvider ?? 'unknown'} → NextAuth ${bridgeProvider}:`, appKitEmail);
			sessionStorage.setItem(bridgeKey, String(Date.now()));
			signIn(bridgeProvider, { callbackUrl: window.location.pathname || '/products' });
		}, 1200);
		return () => clearTimeout(timer);
	}, [appKitEmail, nextAuthEmail, sessionStatus, appKitAuthProvider]);

	// Zero-UI: this component only fires the side-effect
	return null;
}

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
	} = useNotifications({ refreshInterval: 60000, enabled: !!clientUser });

	// Fetch cart count for logged-in users
	const { data: cartData, mutate: mutateCart } = useSWR(
		clientUser?.id ? `/api/cart/${clientUser.id}` : null,
		fetcher,
		{ refreshInterval: 60000, dedupingInterval: 5000, revalidateOnFocus: true }
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

	// NOTE: notification-update Pusher event removed — it was subscribed but
	// never triggered from any server-side code, causing phantom refreshes.
	// Re-add when server-side notification triggers are implemented.

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
			if (raw === "true") {
				const timeoutId = window.setTimeout(() => setWeb3ModeEnabled(true), 0);
				return () => window.clearTimeout(timeoutId);
			}
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
		{ href: "/pulse", label: "Polls" },
		...(clientUser
			? [
				{ href: "/ai", label: "AI" },
			]
			: []),
	];

	const menuGroups = useMemo(() => {
		if (clientUser) {
			return [
				{
					label: "Explore",
					items: [
						{ href: "/", label: "Home", icon: FiHome },
						{ href: "/products", label: "Products", icon: FiPackage },
						{ href: "/pulse", label: "Polls", icon: PulseHeart },
						{ href: "/ai", label: "AI Chat", icon: FiZap },
					],
				},
				{
					label: "Account",
					items: [
						{ href: "/dashboard", label: "Dashboard", icon: FiGrid },
						{ href: "/conversations", label: "Messages", icon: FiMessageSquare },
						{ href: "/cart", label: "Cart", icon: FiShoppingCart },
						{ href: "/checkout", label: "Checkout", icon: FiCreditCard },
						{ href: "/settings", label: "Settings", icon: FiSettings },
					],
				},
				{
					label: "Info",
					items: [
						{ href: "/info", label: "Contact", icon: FiHelpCircle },
						{ href: "/privacy", label: "Privacy", icon: FiLock },
					],
				},
			];
		}
		return [
			{
				label: "Explore",
				items: [
					{ href: "/", label: "Home", icon: FiHome },
					{ href: "/products", label: "Products", icon: FiPackage },
					{ href: "/pulse", label: "Polls", icon: PulseHeart },
				],
			},
			{
				label: "Info",
				items: [
					{ href: "/info", label: "Contact", icon: FiHelpCircle },
					{ href: "/privacy", label: "Privacy", icon: FiLock },
				],
			},
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
		const timeoutId = window.setTimeout(() => setProductsTopbarVisible(true), 0);
		return () => window.clearTimeout(timeoutId);
	}, [pathname]);

	// Also reset when switching to desktop
	useEffect(() => {
		if (!isMobile) {
			const timeoutId = window.setTimeout(() => setProductsTopbarVisible(true), 0);
			return () => window.clearTimeout(timeoutId);
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

	// ── Nav sliding indicator ─────────────────────────────────────────────
	const navBarRef = useRef<HTMLDivElement>(null);
	const [navIndicator, setNavIndicator] = useState<{
		left: number; top: number; width: number; height: number; radius: number;
	} | null>(null);
	const navHoverRef = useRef(false);

	const computeNavPos = useCallback((el: HTMLElement | null) => {
		const container = navBarRef.current;
		if (!container || !el) return null;
		const cr = container.getBoundingClientRect();
		const er = el.getBoundingClientRect();
		return {
			left: er.left - cr.left,
			top: er.top - cr.top,
			width: er.width,
			height: er.height,
			radius: el.dataset.navRound === "true" ? Math.min(er.width, er.height) / 2 : 0,
		};
	}, []);

	const snapNavToActive = useCallback(() => {
		const container = navBarRef.current;
		if (!container) return;
		const activeEl = container.querySelector('[data-nav-active="true"]') as HTMLElement | null;
		if (activeEl) {
			const pos = computeNavPos(activeEl);
			if (pos) setNavIndicator(pos);
		}
	}, [computeNavPos]);

	const handleNavHover = useCallback((e: React.MouseEvent<HTMLElement>) => {
		navHoverRef.current = true;
		const pos = computeNavPos(e.currentTarget);
		if (pos) setNavIndicator(pos);
	}, [computeNavPos]);

	const handleNavBarLeave = useCallback(() => {
		navHoverRef.current = false;
		snapNavToActive();
	}, [snapNavToActive]);

	// Snap to active route on mount, route change, scroll state change
	useEffect(() => {
		const raf = requestAnimationFrame(() => {
			if (!navHoverRef.current) snapNavToActive();
		});
		return () => cancelAnimationFrame(raf);
	}, [pathname, isScrolled, snapNavToActive]);

	// Recompute on container resize
	useEffect(() => {
		const container = navBarRef.current;
		if (!container) return;
		const ro = new ResizeObserver(() => {
			if (!navHoverRef.current) snapNavToActive();
		});
		ro.observe(container);
		return () => ro.disconnect();
	}, [snapNavToActive]);

	// Avoid rendering the full navigation on auth screens.
	const hideOnAuthPages = pathname.startsWith("/auth/");
	if (hideOnAuthPages) return <><NetworkSyncBridge /><AppKitOAuthBridge /></>;

	return (
		<>
			<NetworkSyncBridge />
			<AppKitOAuthBridge />

			<MyDialogbarNavigator
				open={nexusOpen}
				onOpenChange={setNexusOpen}
				hideTrigger
				onOpen={() => setMenuOpen(false)}
			/>
			<motion.header
				ref={headerRef}
				className="sticky top-0 z-60 w-full"
				style={{
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
					style={{ transformOrigin: "50% 0%", willChange: "padding, border-radius", maxHeight: collapseForProducts ? 0 : measuredHeaderHeight }}
					className="relative w-full overflow-hidden transition-[max-height] duration-200 ease-out"
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
					<div
						ref={navBarRef}
						className="relative mx-auto flex h-[var(--app-header)] max-w-screen-2xl items-center justify-between px-3 sm:px-4 md:px-6"
						onMouseLeave={handleNavBarLeave}
					>
						{/* ── Sliding accent indicator ── */}
						{navIndicator && (
							<div
								aria-hidden
								className="absolute pointer-events-none z-50 border border-sky-500/50 dark:border-emerald-400/40 hidden md:block"
								style={{
									left: navIndicator.left,
									top: navIndicator.top,
									width: navIndicator.width,
									height: navIndicator.height,
									borderRadius: navIndicator.radius,
									transition: "left 0.35s cubic-bezier(0.22,1,0.36,1), top 0.35s cubic-bezier(0.22,1,0.36,1), width 0.35s cubic-bezier(0.22,1,0.36,1), height 0.35s cubic-bezier(0.22,1,0.36,1), border-radius 0.35s cubic-bezier(0.22,1,0.36,1)",
								}}
							/>
						)}

						<div className="flex min-w-0 items-center gap-6">
							<Link
								href="/"
								data-nav-key="logo"
								onMouseEnter={handleNavHover}
								className="shrink-0 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 px-1.5 py-1"
							>
								VeggaStare
							</Link>

							<nav className="hidden md:flex items-center gap-1">
								{nav.map((item) => (
									<NavLink
										key={item.href}
										href={item.href}
										isActive={isActivePath(pathname, item.href)}
										data-nav-key={item.href}
										data-nav-active={isActivePath(pathname, item.href) ? "true" : undefined}
										onMouseEnter={handleNavHover}
									>
										{item.href === "/pulse" ? (
											<span className="inline-flex items-center gap-1.5">
												<span className="relative flex h-2 w-2">
													<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 dark:bg-emerald-400 opacity-75" />
													<span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500 dark:bg-emerald-500" />
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
							<TooltipProvider delayDuration={200}>
							<div className="hidden md:flex items-center gap-1">
								<Tooltip>
									<TooltipTrigger asChild>
										<div data-nav-key="currency" onMouseEnter={handleNavHover} className="relative [&_button:hover]:!bg-transparent">
											<CurrencySelector variant="ghost" size="sm" />
										</div>
									</TooltipTrigger>
									<TooltipContent side="bottom" sideOffset={6} className="text-[11px] font-medium">Currency</TooltipContent>
								</Tooltip>

								{clientUser && (
									<>
										{/* Notification Bell */}
										<Tooltip>
											<TooltipTrigger asChild>
												<div data-nav-key="notifications" onMouseEnter={handleNavHover} className="relative [&_button:hover]:!bg-transparent">
													<NotificationDropdown
														notifications={notifications}
														unreadCount={unreadCount}
														isLoading={notificationsLoading}
														onMarkRead={markAsRead}
														onMarkAllRead={markAllAsRead}
														onNotificationClick={(notif) => {
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
												</div>
											</TooltipTrigger>
											<TooltipContent side="bottom" sideOffset={6} className="text-[11px] font-medium">Notifications</TooltipContent>
										</Tooltip>
										
										{/* Mini Cart Dropdown */}
										<Tooltip>
											<TooltipTrigger asChild>
												<div data-nav-key="cart" onMouseEnter={handleNavHover} className="relative [&_button:hover]:!bg-transparent">
													<MiniCartDropdown
														userId={clientUser?.id}
														cartCount={cartCount}
														onCartUpdate={() => mutateCart()}
													/>
												</div>
											</TooltipTrigger>
											<TooltipContent side="bottom" sideOffset={6} className="text-[11px] font-medium">Cart</TooltipContent>
										</Tooltip>

										{/* Chat lite dropdown */}
										<Tooltip>
											<TooltipTrigger asChild>
												<div data-nav-key="conversations" onMouseEnter={handleNavHover} className="relative [&_button:hover]:!bg-transparent">
													<ChatLiteDropdown />
												</div>
											</TooltipTrigger>
											<TooltipContent side="bottom" sideOffset={6} className="text-[11px] font-medium">Messages</TooltipContent>
										</Tooltip>
									</>
								)}
							</div>
							</TooltipProvider>
							<Sheet open={menuOpen} onOpenChange={setMenuOpen}>
								<SheetTrigger asChild>
									<button
										type="button"
										data-nav-key="avatar"
										data-nav-round="true"
										onMouseEnter={handleNavHover}
										className={`flex items-center justify-center rounded-full transition-all duration-200 hover:scale-105 ${clientUser
											? "h-14 w-14"
											: "h-14 w-14 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
											}`}
										aria-label="Open menu"
									>
										{clientUser ? (
											<Avatar className="h-14 w-14">
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
											<>
												<Link
													href="/profile"
													onClick={() => setMenuOpen(false)}
													className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group"
													title="View Profile"
												>
													<Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm group-hover:ring-sky-400/50 transition-all">
														<AvatarImage
															src={clientUser.image || "/users/avatar.webp"}
															alt="User"
														/>
														<AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm">
															<FaUser className="h-4 w-4" />
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0 flex-1">
														<div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
															{clientUser.name ?? "Account"}
														</div>
														<div className="text-[11px] text-zinc-400 dark:text-zinc-500 group-hover:text-sky-500 transition-colors">
															View profile →
														</div>
													</div>
												</Link>
												{/* Quick-copy strips: email + active wallet */}
												<SidebarQuickCopyStrips email={clientUser.email ?? undefined} />
												{/* Theme quick-toggle */}
												<div className="mx-3 mb-2 flex items-center gap-2">
													<button
														type="button"
														onClick={() => setTheme("light")}
														className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
															resolvedTheme === "light"
																? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30"
																: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent"
														}`}
													>
														<FiSun className="h-3 w-3" /> Light
													</button>
													<button
														type="button"
														onClick={() => setTheme("dark")}
														className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
															resolvedTheme === "dark"
																? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
																: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent"
														}`}
													>
														<FiMoon className="h-3 w-3" /> Dark
													</button>
													<button
														type="button"
														onClick={() => setTheme("system")}
														className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
															resolvedTheme !== "light" && resolvedTheme !== "dark"
																? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30"
																: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent"
														}`}
													>
														<FiMonitor className="h-3 w-3" /> System
													</button>
												</div>
												<div className="border-b border-zinc-100 dark:border-zinc-800" />
											</>
										) : (
										<>
										<SheetHeader className="border-b border-zinc-100 dark:border-zinc-800 p-6">
											<SheetTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
												Welcome
											</SheetTitle>
											<SheetDescription className="text-xs text-zinc-500 dark:text-zinc-400">
												Sign in to unlock all features
											</SheetDescription>
										</SheetHeader>
										</>
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
												<div className="p-3">
													{/* Grouped navigation */}
													<nav className="space-y-4">
														{menuGroups.map((group) => (
															<div key={group.label}>
																<div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
																	{group.label}
																</div>
																<div className="space-y-0.5">
																	{group.items.map((item) => {
																		const active = isActivePath(pathname, item.href);
																		const Icon = item.icon;
																		return (
																			<Link
																				key={item.href}
																				href={item.href}
																				onClick={() => setMenuOpen(false)}
																				className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${active ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
																			>
																				<Icon className={`h-4 w-4 shrink-0 ${active ? "text-sky-500" : "text-zinc-400 dark:text-zinc-500"}`} />
																				<span>{item.label}</span>
																				{item.href === "/pulse" && (
																					<span className="relative flex h-1.5 w-1.5 ml-0.5 shrink-0">
																						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 dark:bg-emerald-400 opacity-75" />
																						<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-emerald-500" />
																					</span>
																				)}
																			</Link>
																		);
																	})}
																</div>
															</div>
														))}
													</nav>

													{/* Nexus — flat command palette shortcut */}
													{clientUser && (
														<div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
															<button
																type="button"
																onClick={() => {
																	setMenuOpen(false);
																	setTimeout(() => setNexusOpen(true), 0);
																}}
																className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
															>
																<TbHexagons className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
																<span>Nexus</span>
																<kbd className="ml-auto text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
															</button>
														</div>
													)}

													{/* Web3 Wallets — only for logged-in users */}
													{clientUser && (
														<div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
															<SidebarWalletPanel
																isLoggedIn={!!clientUser}
																web3Enabled={effectiveWeb3ModeEnabled}
																onClose={() => setMenuOpen(false)}
																userName={clientUser?.name}
															/>
														</div>
													)}
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
													{/* Web3 connect — top option */}
													<button
														type="button"
														onClick={async () => {
															try {
																const { ModalController } = await import('@reown/appkit-controllers');
																ModalController.open({ view: 'Connect' });
																setMenuOpen(false);
															} catch { /* AppKit not ready */ }
														}}
														className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-white px-4 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
													>
														<FiLink className="w-4 h-4" />
														Connect with Web3
													</button>

													{/* OAuth providers row */}
													<div className="flex gap-2">
														<button
															type="button"
															onClick={() => signIn("google", { callbackUrl: "/products" })}
															className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
															title="Continue with Google"
														>
															<FcGoogle className="h-4 w-4" />
															Google
														</button>
														<button
															type="button"
															onClick={() => signIn("discord", { callbackUrl: "/products" })}
															className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
															title="Continue with Discord"
														>
															<FaDiscord className="h-4 w-4 text-[#5865F2]" />
															Discord
														</button>
														<button
															type="button"
															onClick={() => signIn("github", { callbackUrl: "/products" })}
															className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
															title="Continue with GitHub"
														>
															<FaGithub className="h-4 w-4" />
															GitHub
														</button>
													</div>

													{/* Sign in / Sign up links */}
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

/**
 * Quick-copy strips for sidebar header: email + active wallet address.
 * Shows NextAuth email, or falls back to AppKit social login email.
 * Active wallet row shows connector name (MetaMask, Coinbase, etc.) + address + chain.
 *
 * NOTE: The auto-bridge useEffect was extracted to AppKitOAuthBridge (rendered unconditionally
 * in MyTopBar) so it fires even when the user has no NextAuth session.
 * The manual fallback button still lives here for auth'd users who got stuck.
 */
function SidebarQuickCopyStrips({ email: nextAuthEmail }: { email?: string }) {
	const { address, isConnected, connector } = useAccount();
	const connections = useConnections();
	const activeChainId = useChainId();
	const chains = useChains();
	const { override } = useActiveWalletOverride();
	const { embeddedWalletInfo } = useAppKitAccount();
	const { status: sessionStatus } = useSession();

	// Email: prefer NextAuth session email, fall back to AppKit social login email
	const appKitEmail = embeddedWalletInfo?.user?.email as string | undefined;
	// BUG WORKAROUND (AppKit 1.8.x): embeddedWalletInfo.authProvider returns "email" even
	// for Google/Discord social logins. Read the real provider from localStorage.
	let appKitAuthProvider = embeddedWalletInfo?.authProvider as string | undefined;
	if (!appKitAuthProvider || appKitAuthProvider === 'email') {
		try {
			const storedSocial = typeof window !== 'undefined'
				? localStorage.getItem('@appkit/connected_social')
				: null;
			if (storedSocial && storedSocial !== 'email') {
				appKitAuthProvider = storedSocial;
			}
		} catch { /* SSR or storage blocked */ }
	}
	const displayEmail = nextAuthEmail || appKitEmail;

	const effectiveAddress = override?.address ?? address;
	const effectiveChainId = override?.chainId ?? activeChainId;
	const effectiveConnected = Boolean(effectiveAddress) && (Boolean(override?.address) || isConnected);
	const activeConn = effectiveAddress
		? connections.find((c) => c.accounts.some((a) => a.toLowerCase() === effectiveAddress.toLowerCase()))
		: undefined;
	const effectiveConnector = activeConn?.connector ?? connector;
	const chain = chains.find((c) => c.id === effectiveChainId);
	const trimmed = effectiveAddress ? `${effectiveAddress.slice(0, 6)}…${effectiveAddress.slice(-4)}` : null;
	const normalizedAuthProvider = appKitAuthProvider?.trim().toLowerCase();
	const authProviderLabel = normalizedAuthProvider
		? ({ google: "Google", discord: "Discord", github: "GitHub", apple: "Apple", x: "X (Twitter)", farcaster: "Farcaster" }[normalizedAuthProvider] ?? normalizedAuthProvider)
		: undefined;
	const isAuthConnector = effectiveConnector?.type === "AUTH" || effectiveConnector?.id === "auth" || effectiveConnector?.name === "Auth";

	// Friendly name for the active connector
	const connectorNameMap: Record<string, string> = {
		metaMask: "MetaMask", MetaMask: "MetaMask",
		"io.metamask": "MetaMask", "io.metamask.flask": "MetaMask Flask",
		coinbaseWalletSDK: "Coinbase", "Coinbase Wallet": "Coinbase",
		"com.coinbase.wallet": "Coinbase",
		walletConnect: "WalletConnect", WalletConnect: "WalletConnect",
		Auth: "Reown", injected: "Browser Wallet", Injected: "Browser Wallet",
	};
	const walletName = override?.address
		? "Local RPC"
		: isAuthConnector
		? authProviderLabel
			? `Reown via ${authProviderLabel}`
			: "Reown"
		: effectiveConnector
			? (connectorNameMap[effectiveConnector.name] ?? connectorNameMap[effectiveConnector.id] ?? effectiveConnector.name)
			: null;

	// Always render for logged-in users — show email + wallet or placeholder
	const hasEmail = !!displayEmail;
	const hasWallet = effectiveConnected;

	// If nothing to show at all, still show a connect-wallet hint
	return (
		<div className="mx-3 mb-2 space-y-1">
			{/* Email row */}
			{hasEmail && (
				<div className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
					<span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0 w-10">
						Email
					</span>
					<span className="text-xs text-zinc-600 dark:text-zinc-300 truncate font-mono min-w-0 flex-1">
						{displayEmail}
					</span>
					<CopyChip text={displayEmail!} label="Copy email" size="xs" />
				</div>
			)}
			{/* Active wallet row */}
			{hasWallet && trimmed ? (
				<div className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/50 border border-sky-500/30 dark:border-emerald-500/30">
					<span className="h-1.5 w-1.5 rounded-full bg-sky-400 dark:bg-emerald-400 shrink-0" />
					{walletName && (
						<span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-emerald-400 shrink-0">
							{isAuthConnector && normalizedAuthProvider === "google" ? <FcGoogle className="h-3 w-3" /> : null}
							{isAuthConnector && normalizedAuthProvider === "discord" ? <FaDiscord className="h-3 w-3 text-[#5865F2]" /> : null}
							{isAuthConnector && normalizedAuthProvider === "github" ? <FaGithub className="h-3 w-3" /> : null}
							{walletName}
						</span>
					)}
					<span className="text-xs text-zinc-600 dark:text-zinc-300 truncate font-mono min-w-0 flex-1" title={effectiveAddress}>
						{trimmed}
					</span>
					{chain && (
						<span className={`text-[9px] rounded px-1.5 py-0.5 shrink-0 inline-flex items-center gap-1 ${
							isLocalChain(chain.id)
								? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700"
								: "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
						}`}>
							{isLocalChain(chain.id) && <span className="font-mono font-bold">&gt;_RPC</span>}
							{chain.name}
						</span>
					)}
					<CopyChip text={effectiveAddress!} label="Copy wallet address" size="xs" />
				</div>
			) : nextAuthEmail ? (
				<div className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-700">
					<span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0 w-10">
						Wallet
					</span>
					<span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
						No active wallet — connect below ↓
					</span>
				</div>
			) : null}
			{/* AppKit Social → OAuth bridge fallback button.
			   The auto-bridge above fires once. If it failed or auto-bridge
			   was blocked, the user can click this manually. */}
			{appKitEmail && !nextAuthEmail && sessionStatus !== 'loading' && (() => {
				const fallbackProvider = appKitAuthProvider ? (APPKIT_TO_NEXTAUTH[appKitAuthProvider] ?? 'google') : 'google';
				const providerLabel = { google: 'Google', discord: 'Discord', github: 'GitHub' }[fallbackProvider] ?? 'Google';
				return (
					<button
						type="button"
						onClick={() => {
							sessionStorage.removeItem(`${OAUTH_BRIDGE_KEY_PREFIX}${appKitEmail}`);
							signIn(fallbackProvider, { callbackUrl: window.location.pathname || '/products' });
						}}
						className="w-full flex items-center gap-2 rounded-lg px-3 py-1.5 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
					>
						<span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0 animate-pulse" />
						Sign in with {providerLabel} to unlock all features →
					</button>
				);
			})()}
		</div>
	);
}

// Compact wallet info shown inside the sidebar Sheet wallet section
function SidebarWalletInfo() {
	const { address, isConnected } = useAccount();
	const activeChainId = useChainId();
	const chains = useChains();
	const { switchChain, status: switchStatus } = useSwitchChain();
	const { override } = useActiveWalletOverride();
	const [copied, setCopied] = useState(false);

	const effectiveAddress = override?.address ?? address;
	const effectiveChainId = override?.chainId ?? activeChainId;
	const effectiveConnected = Boolean(effectiveAddress) && (Boolean(override?.address) || isConnected);

	if (!effectiveConnected || !effectiveAddress) return null;

	const trimmed = `${effectiveAddress.slice(0, 6)}…${effectiveAddress.slice(-4)}`;
	const activeChain = chains.find((c) => c.id === effectiveChainId);

	const copyAddress = async () => {
		try {
			await navigator.clipboard.writeText(effectiveAddress);
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
					<span className="h-2 w-2 rounded-full bg-sky-400 dark:bg-emerald-400 shrink-0" />
					<span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate" title={effectiveAddress}>
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
						<FiCheck className="h-3.5 w-3.5 text-sky-500 dark:text-emerald-500" />
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
					value={effectiveChainId ?? ""}
					onChange={(e) => {
						const id = Number(e.target.value);
						if (id !== effectiveChainId) switchChain({ chainId: id });
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
							className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-sky-500 dark:hover:text-emerald-400 transition-colors"
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

						{/* Trading shortcut */}
						<Link
							href="/dashboard/trading"
							onClick={() => setMenuOpen(false)}
							className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
						>
							<FiPackage className="h-3.5 w-3.5 text-sky-500 dark:text-emerald-500" />
							<span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Trading</span>
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
												? 'bg-sky-500 dark:bg-emerald-500 text-white shadow-sm'
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