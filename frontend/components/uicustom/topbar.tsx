"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode } from "react";
import dynamic from 'next/dynamic';
import Link from "@/components/ui/navigation-link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useClientReady } from "@/hooks/use-client-ready";
import AppKitButton from "../crypto-related/AppKitButton";
import NetworkSyncBridge from "@/components/crypto-related/NetworkSyncBridge";
import { MyDialogbarNavigator } from "@/app/(protected)/_components/dialog-bar";
import { useTheme } from "next-themes";
import { signIn, useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FaUser, FaDiscord, FaGithub } from "react-icons/fa";
import { MySocialAuth } from '@/components/uicustom/auth/buttons/social';
import { FcGoogle } from "react-icons/fc";
import { useCart } from "@/contexts/cart-context";
import { toast } from "sonner";
import { TbHexagons } from "react-icons/tb";
import { FiUser, FiImage, FiShield, FiBell, FiLock, FiSun, FiMoon, FiMonitor, FiCopy, FiLink, FiCheck, FiPackage } from "react-icons/fi";
import { IS_WEB3_CONFIGURED } from "@/lib/web3-config";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { CurrencySelector } from "@/components/uicustom/currency-selector";
import { AppHeader } from "@/components/uicustom/chrome/app-header";
import { AppRail } from "@/components/uicustom/chrome/app-rail";
import { ThemeToggle, swapThemeWithReveal } from "@/components/uicustom/chrome/theme-toggle";
import { HeaderTip } from "@/components/uicustom/chrome/header-tip";
import { NotificationDropdown } from "@/components/uicustom/notifications/notification-dropdown";
import { useNotifications } from "@/hooks/use-notifications";
import { isDemoUserId } from '@/lib/demo-policy';
import { useUiPreferences } from "@/components/providers/ui-preferences";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import usePusher from "@/hooks/usePusher";
import { MiniCartDropdown } from "@/components/uicustom/mini-cart-dropdown";
import { ChatLiteDropdown } from "@/components/uicustom/chat-lite-dropdown";
import { useCleanLogout } from "@/hooks/use-clean-logout";
import { useAccount, useChainId, useChains, useSwitchChain, useConnections } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { CopyChip } from "@/components/uicustom/CopyChip";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
import { isLocalChain } from "@/lib/is-local-chain";
import { FiMenu } from 'react-icons/fi';
import { getNavigationGroups, getPrimaryNavigation, isActiveNavigationPath as isActivePath } from './site-navigation';

// These panels are only mounted inside the open navigation/settings sheet.
// Keep connection providers stable; defer optional UI, not the entire app tree.
function WalletPanelLoading() {
	return <div role="status" className="min-h-24 rounded-xl border border-border bg-foreground/[0.04] p-4 text-sm text-muted-foreground">Loading wallet controls…</div>;
}
const SidebarWalletPanel = dynamic(() => import('../crypto-related/SidebarWalletPanel'), { ssr: false, loading: WalletPanelLoading });
const EvmWalletVerify = dynamic(() => import('@/components/crypto-related/EvmWalletVerify'), { ssr: false, loading: WalletPanelLoading });
const EvmWalletList = dynamic(() => import('@/components/crypto-related/EvmWalletList'), { ssr: false, loading: WalletPanelLoading });

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
			sessionStorage.setItem(bridgeKey, String(Date.now()));
			signIn(bridgeProvider, { callbackUrl: window.location.pathname || '/products' });
		}, 1200);
		return () => clearTimeout(timer);
	}, [appKitEmail, nextAuthEmail, sessionStatus, appKitAuthProvider]);

	// Zero-UI: this component only fires the side-effect
	return null;
}

const MyTopBar = () => {
	const clientReady = useClientReady();
	const pathname = usePathname();
	const clientUser = useCurrentUser();

	// Fetch notifications for logged-in users
	const { 
		notifications, 
		unreadCount, 
		isLoading: notificationsLoading,
		isError: notificationsError,
		pending: notificationsPending,
		refresh: refreshNotifications,
		markAsRead,
		markAllAsRead 
	} = useNotifications({ refreshInterval: 60000, enabled: !!clientUser, userId: clientUser?.id, readOnly: isDemoUserId(clientUser?.id) });

	// One shared cart cache: mutations update the badge without a poll or reload.
	const { itemCount: cartCount, refreshCart: mutateCart } = useCart();

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
	const [menuOpen, updateMenuOpen] = useState(false);
	const [walletOpening, setWalletOpening] = useState(false);
	const walletOpeningRequest = useRef(0);
	const setMenuOpen = useCallback((open: boolean) => {
		walletOpeningRequest.current++;
		updateMenuOpen(open);
		if (!open) setWalletOpening(false);
	}, []);
	useEffect(() => () => { walletOpeningRequest.current++; }, []);
	const openGuestWallet = async () => {
		if (walletOpening || !IS_WEB3_CONFIGURED) return;
		const request = ++walletOpeningRequest.current;
		setWalletOpening(true);
		try {
			const { ensureAppKit } = await import('../crypto-related/AppKitInit');
			const appKit = await ensureAppKit();
			if (request !== walletOpeningRequest.current) return;
			await appKit.open({ view: 'Connect' });
			if (request !== walletOpeningRequest.current) { await appKit.close(); return; }
			setMenuOpen(false);
		} catch {
			if (request === walletOpeningRequest.current) toast.error('Wallet connect is unavailable. Try again or use email, Google, GitHub or Discord.');
		} finally {
			if (request === walletOpeningRequest.current) setWalletOpening(false);
		}
	};
	const [isMobile, setIsMobile] = useState(false);
	const [nexusOpen, setNexusOpen] = useState(false);
	const [web3ModeEnabled, setWeb3ModeEnabled] = useState(false);
	const [walletRefreshToken, setWalletRefreshToken] = useState(0);
	const [menuPane, setMenuPane] = useState<"nav" | "settings">("nav");
	const cleanLogout = useCleanLogout();
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

	// A signed-in account's disabled setting must override an old browser opt-in.
	const effectiveWeb3ModeEnabled = clientUser
		? clientUser.web3ModeEnabled === true
		: web3ModeEnabled;

	const [isScrolled, setIsScrolled] = useState(false);
	const showTopbarChrome = isScrolled;

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

	// Measure the mounted header only on actual resize, never animate its geometry.
	useLayoutEffect(() => {
		const header = headerRef.current;
		if (!header) return;
		const update = () => {
			const height = header.getBoundingClientRect().height;
			if (height > 0) document.documentElement.style.setProperty("--app-header-offset", `${height}px`);
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(header);
		return () => observer.disconnect();
	}, [pathname]);

	// Chips in the floating rail; everything else lives in the grouped menu.
	const railItems = getPrimaryNavigation(clientUser, "header");
	const menuGroups = getNavigationGroups(clientUser);

	const cookieAfterClose = useRef(false);
	const openCookieSettings = () => {
		cookieAfterClose.current = true;
		setMenuOpen(false);
	};

	useEffect(() => {
		const onOpenMenu = () => setMenuOpen(true);
		window.addEventListener("veggat:open-menu", onOpenMenu as any);
		return () => window.removeEventListener("veggat:open-menu", onOpenMenu as any);
	}, [setMenuOpen]);

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
	}, [setMenuOpen]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const mq = window.matchMedia?.("(min-width: 768px)");
		const update = () => setIsMobile(!(mq?.matches ?? false));
		update();
		mq?.addEventListener?.("change", update);
		return () => mq?.removeEventListener?.("change", update);
	}, []);

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
			<Sheet open={menuOpen} onOpenChange={setMenuOpen}>
				<AppHeader
					ref={headerRef}
					scrolled={showTopbarChrome}
					rail={<AppRail id="header-rail" items={railItems} />}
					utilities={
						<>
						{/* Desktop quick actions */}
						<TooltipProvider delayDuration={200}>
						<div className="hidden md:flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<div data-nav-key="currency" className="relative">
										<CurrencySelector variant="ghost" size="sm" />
									</div>
								</TooltipTrigger>
								<TooltipContent side="bottom" sideOffset={6} className="rounded-full border-border/60 px-3 py-1.5 text-[11px] font-medium">Currency</TooltipContent>
							</Tooltip>

							{clientUser && (
								<>
									{/* Notification Bell */}
											<HeaderTip label="Alerts">
											<div data-nav-key="notifications" className="relative">
												<NotificationDropdown
													notifications={notifications}
													unreadCount={unreadCount}
													isLoading={notificationsLoading}
													isError={notificationsError}
													pending={notificationsPending}
													readOnly={isDemoUserId(clientUser?.id)}
													onRefresh={refreshNotifications}
													onMarkRead={markAsRead}
													onMarkAllRead={markAllAsRead}
												/>
											</div>
											</HeaderTip>
									
									{/* Mini Cart Dropdown */}
									<Tooltip>
										<TooltipTrigger asChild>
											<div data-nav-key="cart" className="relative">
												<MiniCartDropdown
													key={clientUser?.id ?? 'guest'}
													userId={clientUser?.id}
													cartCount={cartCount}
												/>
											</div>
										</TooltipTrigger>
										<TooltipContent side="bottom" sideOffset={6} className="rounded-full border-border/60 px-3 py-1.5 text-[11px] font-medium">Cart</TooltipContent>
									</Tooltip>


								</>
							)}
						</div>
						{clientUser && (
							<HeaderTip label="Messages">
							<div data-nav-key="conversations" className="relative">
								<ChatLiteDropdown />
							</div>
							</HeaderTip>
						)}
						<ThemeToggle />
						</TooltipProvider>
						</>
					}
					account={
					<HeaderTip label={clientUser ? "Account" : "Menu"}>
					<SheetTrigger asChild>
						<button
							type="button"
							data-nav-key="avatar"
							data-nav-round="true"
							aria-label="Open menu"
							disabled={!clientReady}
							className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border/60 bg-surface-1/75 px-3.5 text-sm font-medium text-foreground backdrop-blur-xl transition-[color,background-color,border-color,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none hover:border-border hover:bg-surface-3 hover:shadow-e1 motion-safe:hover:-translate-y-px motion-safe:active:scale-95 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:size-10 md:px-0"
						>
							<span className="inline-flex items-center gap-2 md:hidden"><FiMenu aria-hidden="true" className="size-5" /><span>Menu</span></span>
							<span className="hidden md:inline-flex">{clientUser ? (
								<Avatar className="size-8 ring-2 ring-background transition-[box-shadow] duration-200 group-hover:ring-brand-accent/40">
									<AvatarImage
										src={clientUser.image || "/users/avatar.webp"}
										alt="User"
									/>
									<AvatarFallback className="bg-muted text-sm text-muted-foreground">
										<FaUser className="size-4" />
									</AvatarFallback>
								</Avatar>
							) : (
								<TbHexagons aria-hidden="true" className="size-5 text-muted-foreground transition-[color,transform] duration-300 group-hover:rotate-12 group-hover:text-brand-accent" />
							)}</span>
						</button>
					</SheetTrigger>
					</HeaderTip>
					}
				/>
					<SheetContent
						side="right"
						className="w-[calc(100%-2rem)] max-w-[380px] h-dvh overflow-hidden overscroll-contain border-l border-border bg-popover pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
						onTouchStart={onMenuTouchStart}
						onTouchEnd={onMenuTouchEnd}
						accessibleTitle="Navigation Menu"
						onCloseAutoFocus={event => {
							if (!cookieAfterClose.current) return;
							cookieAfterClose.current = false;
							event.preventDefault();
							requestAnimationFrame(() => window.dispatchEvent(new Event("veggat:cookie-consent-open")));
						}}
					>
						<div className="flex h-full min-h-0 flex-col">
							{/* User Profile Header */}
							{clientUser ? (
								<>
									<Link
										href="/profile"
										onClick={() => setMenuOpen(false)}
										className="flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.07] transition-colors group"
										title="View Profile"
									>
										<Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm group-hover:ring-brand-accent/50 transition-[box-shadow] duration-200">
											<AvatarImage
												src={clientUser.image || "/users/avatar.webp"}
												alt="User"
											/>
											<AvatarFallback className="bg-muted text-muted-foreground text-sm">
												<FaUser className="h-4 w-4" />
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0 flex-1">
											<div className="text-sm font-semibold text-foreground truncate">
												{clientUser.name ?? "Account"}
											</div>
											<div className="text-[11px] text-muted-foreground/80 group-hover:text-brand-accent-hover dark:group-hover:text-brand-accent-light transition-colors">
												View profile →
											</div>
										</div>
									</Link>
									{/* Quick-copy strips: email + active wallet */}
									<SidebarQuickCopyStrips email={clientUser.email ?? undefined} />
									<div className="border-b border-border" />
								</>
							) : (
							<>
							<SheetHeader className="border-b border-border p-6">
								<SheetTitle className="text-base font-semibold text-foreground">
									Welcome
								</SheetTitle>
								<SheetDescription className="text-xs text-muted-foreground">
									Sign in to unlock all features
								</SheetDescription>
							</SheetHeader>
							</>
							)}

							{/* Two-Pane Tab Navigation */}
							{clientUser && (
								<div className="flex border-b border-border">
									<button
										type="button"
										onClick={() => setMenuPane("nav")}
										aria-pressed={menuPane === "nav"}
										className={`flex-1 py-3 text-sm font-medium transition-colors ${menuPane === "nav"
											? "text-foreground border-b-2 border-foreground"
											: "text-muted-foreground hover:text-foreground"
											}`}
									>
										Navigate
									</button>
									<button
										type="button"
										onClick={() => setMenuPane("settings")}
										aria-pressed={menuPane === "settings"}
										className={`flex-1 py-3 text-sm font-medium transition-colors ${menuPane === "settings"
											? "text-foreground border-b-2 border-foreground"
											: "text-muted-foreground hover:text-foreground"
											}`}
									>
										Settings
									</button>
								</div>
							)}

							{/* Main scrollable content */}
							<div data-navigation-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
								{/* Navigation Pane */}
								{(!clientUser || menuPane === "nav") && (
									<div className="p-3">
										{/* Grouped navigation — compact tiles, two per row, icon in a soft well */}
										<nav className="space-y-5" aria-label="Menu">
											{menuGroups.map((group) => (
												<div key={group.label}>
													<div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
														{group.label}
													</div>
													<div className="grid grid-cols-2 gap-1.5">
														{group.items.map((item) => {
															const active = isActivePath(pathname, item.href);
															const Icon = item.icon;
															return (
																<Link
																	key={item.href}
																	href={item.href}
																	onClick={() => setMenuOpen(false)}
																	aria-current={active ? 'page' : undefined}
																	className={`group/navitem flex min-h-12 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-200 motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-brand-accent/40 bg-brand-accent/10 text-foreground" : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-foreground/[0.06] hover:text-foreground"}`}
																>
																	<span className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-brand-accent/15 text-brand-accent" : "bg-foreground/[0.05] text-muted-foreground group-hover/navitem:text-foreground"}`}>
																		<Icon className="h-4 w-4" />
																	</span>
																	<span className="min-w-0 truncate">{item.label}</span>
																	{item.href === "/pulse" && (
																		<span className="ml-auto flex h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" aria-hidden="true" />
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
											<div className="mt-3 border-t border-border pt-3">
												<button
													type="button"
													onClick={() => {
														setMenuOpen(false);
														setTimeout(() => setNexusOpen(true), 0);
													}}
													className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground transition-colors"
												>
													<TbHexagons className="h-4 w-4 text-muted-foreground/80 shrink-0" />
													<span>Nexus</span>
													<kbd className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
												</button>
											</div>
										)}

										{/* Web3 Wallets — only for logged-in users */}
										{clientUser && (
											<div className="mt-3 border-t border-border pt-3">
												{/* Reserve the disconnected panel's geometry while its
												    optional bundle/data loads; do not move a scrolled drawer. */}
												<div data-navigation-wallet-slot className="min-h-66">
												<SidebarWalletPanel
													isLoggedIn={!!clientUser}
													web3Enabled={effectiveWeb3ModeEnabled}
													onClose={() => setMenuOpen(false)}
													userName={clientUser?.name}
												/>
												</div>
											</div>
										)}
									</div>
								)}
								{/* Settings pane with visible touch/keyboard controls */}
								{clientUser && menuPane === "settings" && (
									<SettingsPaneLite 
										setMenuOpen={setMenuOpen}
										effectiveWeb3ModeEnabled={effectiveWeb3ModeEnabled}
										walletRefreshToken={walletRefreshToken}
										setWalletRefreshToken={setWalletRefreshToken}
									/>
								)}
								{/* Privacy choices must remain reachable without an account. */}
								<div className="border-t border-border p-4">
									<button type="button" onClick={openCookieSettings} className="flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cookie preferences</button>
								</div>

							</div>

							{/* Footer actions */}
							<div className="shrink-0 border-t border-border p-4 space-y-2">
								{clientUser ? (
									<button
										type="button"
										onClick={() => cleanLogout()}
										className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-3 transition-colors"
									>
										Sign out
									</button>
								) : (
									<>
										{/* Web3 connect — top option */}
										<button
											type="button"
											onClick={openGuestWallet}
											disabled={!IS_WEB3_CONFIGURED || walletOpening} aria-busy={walletOpening} title={IS_WEB3_CONFIGURED ? "Connect a crypto wallet" : "Wallet connect coming soon"} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground enabled:hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<FiLink className="w-4 h-4" />
											{walletOpening ? 'Opening wallet…' : IS_WEB3_CONFIGURED ? 'Connect with Web3' : 'Web3 wallet — coming soon'}
										</button>

										{/* OAuth providers row */}
										<MySocialAuth redirectTo="/products" />

										{/* Sign in / Sign up links */}
										<div className="flex gap-2 pt-1">
											<Link
												href="/auth/login"
												onClick={() => setMenuOpen(false)}
												className="flex-1 rounded-xl px-4 py-2.5 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
											>
												Sign in
											</Link>
											<Link
												href="/auth/register"
												onClick={() => setMenuOpen(false)}
												className="flex-1 rounded-xl px-4 py-2.5 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
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
				<div className="flex items-center gap-2 rounded-lg px-3 py-1.5 border border-border bg-foreground/[0.05]">
					<span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80 shrink-0 w-10">
						Email
					</span>
					<span className="text-xs text-foreground/85 truncate font-mono min-w-0 flex-1">
						{displayEmail}
					</span>
					<CopyChip text={displayEmail!} label="Copy email" size="xs" />
				</div>
			)}
			{/* Active wallet row */}
			{hasWallet && trimmed ? (
				<div className="flex items-center gap-2 rounded-lg px-3 py-1.5 border border-brand-accent/30 bg-foreground/[0.05]">
					<span className="h-1.5 w-1.5 rounded-full bg-brand-accent-light shrink-0" />
					{walletName && (
						<span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-accent-hover dark:text-brand-accent-light shrink-0">
							{isAuthConnector && normalizedAuthProvider === "google" ? <FcGoogle className="h-3 w-3" /> : null}
							{isAuthConnector && normalizedAuthProvider === "discord" ? <FaDiscord className="h-3 w-3 text-[#5865F2]" /> : null}
							{isAuthConnector && normalizedAuthProvider === "github" ? <FaGithub className="h-3 w-3" /> : null}
							{walletName}
						</span>
					)}
					<span className="text-xs text-foreground/85 truncate font-mono min-w-0 flex-1" title={effectiveAddress}>
						{trimmed}
					</span>
					{chain && (
						<span className={`text-[9px] rounded px-1.5 py-0.5 shrink-0 inline-flex items-center gap-1 ${
							isLocalChain(chain.id)
								? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700"
								: "bg-muted text-muted-foreground"
						}`}>
							{isLocalChain(chain.id) && <span className="font-mono font-bold">&gt;_RPC</span>}
							{chain.name}
						</span>
					)}
					<CopyChip text={effectiveAddress!} label="Copy wallet address" size="xs" />
				</div>
			) : nextAuthEmail ? (
				<div className="flex items-center gap-2 rounded-lg px-3 py-1.5 border border-dashed border-border bg-foreground/[0.05]">
					<span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80 shrink-0 w-10">
						Wallet
					</span>
					<span className="text-[11px] text-muted-foreground/80 italic">
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
						className="w-full flex items-center gap-2 rounded-lg px-3 py-1.5 border border-brand-accent/30 bg-brand-accent/10 text-[11px] font-medium text-brand-accent-hover hover:bg-brand-accent/15 dark:text-brand-accent-light transition-colors"
					>
						<span className="h-1.5 w-1.5 rounded-full bg-brand-accent shrink-0 animate-pulse" />
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
		<div className="rounded-lg border border-border p-2.5 space-y-2">
			{/* Address row */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-1.5 min-w-0">
					<span className="h-2 w-2 rounded-full bg-brand-accent-light shrink-0" />
					<span className="text-xs font-mono text-foreground/85 truncate" title={effectiveAddress}>
						{trimmed}
					</span>
				</div>
				<button
					type="button"
					onClick={copyAddress}
						className="flex size-11 shrink-0 items-center justify-center rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					title="Copy full address"
				>
					{copied ? (
						<FiCheck className="h-3.5 w-3.5 text-brand-accent" />
					) : (
						<FiCopy className="h-3.5 w-3.5 text-muted-foreground/80" />
					)}
				</button>
			</div>

			{/* Network row */}
			<div className="flex items-center justify-between gap-2">
				<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
					Network
				</span>
				<select
					aria-label="Wallet network"
					className="min-h-11 min-w-0 max-w-[180px] rounded border border-border bg-background px-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
				<div className="text-[10px] text-muted-foreground/80 text-right">
					Chain ID: {activeChain.id}
				</div>
			)}
		</div>
	);
}

// Explicit controls work equally with touch, mouse and keyboard.
function SettingsPaneLite({
  setMenuOpen, effectiveWeb3ModeEnabled, walletRefreshToken, setWalletRefreshToken,
}: {
  setMenuOpen: (open: boolean) => void;
  effectiveWeb3ModeEnabled: boolean;
  walletRefreshToken: number;
  setWalletRefreshToken: (fn: (t: number) => number) => void;
}) {
  const { theme, setTheme } = useTheme();
  const { prefs, setPrefs } = useUiPreferences();
  const settingsItems = [
    { id: 'profile', icon: FiImage, label: 'Profile', desc: 'Avatar, banner & bio' },
    { id: 'account', icon: FiUser, label: 'Account', desc: 'Name & email' },
    { id: 'security', icon: FiShield, label: 'Security', desc: 'Password & two-factor authentication' },
    { id: 'notifications', icon: FiBell, label: 'Notifications', desc: 'Alerts & sounds' },
    { id: 'privacy', icon: FiLock, label: 'Privacy', desc: 'Visibility & data' },
  ];
  const choiceClass = "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 text-xs font-medium transition-colors duration-200 motion-reduce:transition-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-brand-accent aria-pressed:bg-brand-accent/10 aria-pressed:text-foreground";

  return (
    <div className="space-y-4 p-4">
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-sm font-medium">Appearance</legend>
        <div className="flex gap-1.5">
          {([{ id: 'light', label: 'Light', icon: FiSun }, { id: 'dark', label: 'Dark', icon: FiMoon }, { id: 'system', label: 'System', icon: FiMonitor }] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={theme === id} className={choiceClass} onClick={(event) => swapThemeWithReveal(() => setTheme(id), { x: event.clientX, y: event.clientY })}>
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />{label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-sm font-medium">Display currency</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {(['USD', 'EUR', 'GBP', 'NOK'] as const).map(currency => (
            <button key={currency} type="button" aria-pressed={prefs.preferredFiatCurrency === currency} className={choiceClass} onClick={() => setPrefs({ preferredFiatCurrency: currency })}>{currency}</button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">Display preference only. Checkout shows the charged currency.</p>
      </fieldset>
      <nav aria-label="Quick settings" className="space-y-1">
        {settingsItems.map(({ id, icon: Icon, label, desc }) => (
          <Link key={id} href={`/settings?section=${id}`} onClick={() => setMenuOpen(false)} className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-200 motion-reduce:transition-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0"><span className="block text-sm font-medium">{label}</span><span className="block text-xs leading-relaxed text-muted-foreground">{desc}</span></span>
          </Link>
        ))}
      </nav>
			{/* Wallet Section */}
			{effectiveWeb3ModeEnabled && (
				<div className="rounded-xl bg-foreground/[0.05] p-3">
					<div className="flex items-center justify-between mb-2">
						<div className="text-xs font-medium text-muted-foreground">
							Wallet
						</div>
						<Link
							href="/settings?section=wallet"
							onClick={() => setMenuOpen(false)}
							className="inline-flex min-h-11 items-center rounded-md px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
							className="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
						>
							<FiPackage className="h-3.5 w-3.5 text-brand-accent" />
							<span className="text-xs font-medium text-foreground/85">Trading · experimental</span>
							<span className="ml-auto text-[10px] text-muted-foreground/80">→</span>
						</Link>

						<EvmWalletVerify
							enabled={effectiveWeb3ModeEnabled}
							onVerified={() => setWalletRefreshToken((t) => t + 1)}
						/>
						<EvmWalletList enabled={effectiveWeb3ModeEnabled} refreshToken={walletRefreshToken} />
					</div>
				</div>
			)}

      <div className="space-y-1 border-t border-border pt-3">
        <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center justify-center rounded-xl bg-muted px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">All settings</Link>
      </div>
    </div>
  );
}

export default MyTopBar;
