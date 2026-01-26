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
			"relative px-2 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400/70 " +
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
	const [nexusOpen, setNexusOpen] = useState(false);
	const [web3ModeEnabled, setWeb3ModeEnabled] = useState(false);
	const [isRequestingWeb3Mode, setIsRequestingWeb3Mode] = useState(false);
	const [walletRefreshToken, setWalletRefreshToken] = useState(0);

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


			// Add a bit of hysteresis to avoid flicker/jitter around the threshold.
			// On /products we want the header to dock almost immediately so the products
			// sticky controls bar visually “glues” to it on the first scroll notch.
			const isProducts = pathname.startsWith("/products");
			// Mouse wheels can produce a first scrollTop of exactly 1px (or even fractional),
			// so treat any non-zero scroll as "scrolled" on /products.
			const enter = isProducts ? 0 : 12;
			const exit = isProducts ? 0 : 4;
				const onScroll = () => {
					const top = getScrollTop();
					const compact =
						isProducts &&
						!!scrollEl &&
						scrollEl.getAttribute("data-products-compact") === "true";
					setIsScrolled((prev) => (compact ? true : prev ? top > exit : top > enter));
				};

    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    scrollEl?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
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

		const update = () => {
			const h = headerEl.getBoundingClientRect().height;
			if (Number.isFinite(h) && h > 0) {
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
	}, [pathname, isScrolled]);

  const morphTransition = prefersReducedMotion
    ? { duration: 0 }
		: { type: "tween", duration: 0.18, ease: "easeOut" };

  // Avoid rendering the full navigation on auth screens.
  const hideOnAuthPages = pathname.startsWith("/auth/");
  if (hideOnAuthPages) return <NetworkSyncBridge />;

	const nav = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Products" },
    { href: "/feed", label: "Feed" },
    ...(clientUser
      ? [
          { href: "/conversations", label: "Conversations" },
          { href: "/dashboard", label: "Dashboard" },
          { href: "/nexus", label: "Settings" },
        ]
      : []),
    { href: "/analytics", label: "Analytics" },
  ] as const;

	const menuLinks = useMemo(() => {
		// Keep the sheet clean for logged-out users: primary discovery paths first.
		if (!clientUser) return nav;
		return nav;
	}, [clientUser, nav]);

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
				className="sticky top-0 z-[60] w-full"
				initial={false}
				animate={{
					paddingTop: isScrolled ? 0 : 12,
					paddingBottom: isScrolled ? 0 : 12,
					paddingLeft: isScrolled ? 0 : 24,
					paddingRight: isScrolled ? 0 : 24
				}}
				transition={morphTransition}
			>
<motion.div
  transition={morphTransition}
  className={
    "w-full border-b transition-colors duration-300 " + 
    (isScrolled
      ? "border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl"
      : "border-transparent bg-white/0 dark:bg-slate-950/0")
  }
>
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
										{item.label}
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
										className="h-[52px] w-[52px] rounded-full bg-black/5 p-0 hover:bg-black/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.10]"
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
											<TbHexagons className="h-6 w-6 text-slate-700 dark:text-slate-200" />
										)}
									</Button>
								</SheetTrigger>

								<SheetContent
									side="right"
									className="w-[92vw] max-w-[420px] bg-white/95 dark:bg-zinc-900/80 backdrop-blur-xl border border-black/10 dark:border-white/10"
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