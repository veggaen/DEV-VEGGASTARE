"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MyThemeBtn } from "./themebtn";
import { MyUserButton } from "./auth/buttons/user-button";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { motion, useReducedMotion } from "framer-motion";
import WalletConnection from "../crypto-related/WalletAdapter"; // Your wallet UI
import NetworkSyncBridge from "@/components/crypto-related/NetworkSyncBridge";
import { FiMenu } from "react-icons/fi";
import { MyDialogbarNavigator } from "@/app/(protected)/_components/dialog-bar";

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

  return (
    <>
      <NetworkSyncBridge />
			<motion.header
				ref={headerRef}
				className="sticky top-0 z-[60] w-full"
				initial={false}
				animate={{
					paddingTop: isScrolled ? 0 : 12,
					paddingBottom: isScrolled ? 0 : 8,
				}}
				transition={morphTransition}
			>
				<motion.div
					transition={morphTransition}
					className={
						"w-full border-b transition-[background-color,border-color,box-shadow] duration-200 will-change-transform " +
						(isScrolled
							? "border-black/10 bg-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60"
							: "border-black/10 bg-white/25 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/25")
					}
				>
					<div
						className={
							"mx-auto flex h-[var(--app-header)] max-w-screen-2xl items-center justify-between px-3 sm:px-4 md:px-6"
						}
					>
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
								<div className="flex items-center gap-1">
									<WalletConnection />
									{clientUser ? <MyDialogbarNavigator variant="topbar" /> : null}
									<MyThemeBtn />
									{clientUser ? (
										<MyUserButton />
									) : (
										<div className="hidden md:flex items-center gap-1 pr-1">
											<Link
												href="/auth/login"
												className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-black/5 dark:text-slate-200 dark:hover:text-slate-50 dark:hover:bg-white/10"
											>
												Login
											</Link>
											<Link
												href="/auth/register"
												className="rounded-xl px-3 py-2 text-sm font-medium border border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
											>
												Sign up
											</Link>
										</div>
									)}

								<div className="md:hidden">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													aria-label="Open navigation menu"
												className="h-10 w-10 rounded-xl bg-transparent text-slate-700 hover:bg-black/5 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-slate-50"
												>
													<FiMenu className="h-5 w-5" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-56">
												{nav.map((item) => (
													<DropdownMenuItem key={item.href} asChild>
														<Link href={item.href}>{item.label}</Link>
													</DropdownMenuItem>
												))}
												<DropdownMenuSeparator />
												{!clientUser ? (
													<>
														<DropdownMenuItem asChild>
															<Link href="/auth/login">Login</Link>
														</DropdownMenuItem>
														<DropdownMenuItem asChild>
															<Link href="/auth/register">Sign up</Link>
														</DropdownMenuItem>
													</>
												) : null}
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							</div>
						</div>
					</motion.div>
			</motion.header>
    </>
  );
};

export default MyTopBar;