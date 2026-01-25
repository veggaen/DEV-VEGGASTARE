

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RefCallback, RefObject } from "react";
import { MySidebarProductsMenu } from "../uicustom/product/sidebar";

export type SidebarDock = "edge-left" | "frame-left" | "frame-right" | "edge-right";

// Sidebar dimensions - must match sidebar.tsx
const SIDEBAR_WIDTH = 340;
const SIDEBAR_GAP = 16; // breathing room between sidebar and content

const SIDEBAR_DOCK_KEY = "veggastare.products.sidebarDock";
const LEGACY_PLACEMENT_KEY = "veggastare.products.sidebarPlacement";

// Define the context props interface
interface SidebarContextProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  scrollContainerRef: RefObject<HTMLDivElement>;
	/** True when the products scroll container is past the initial threshold. */
	isContentScrolled: boolean;
	sidebarDock: SidebarDock;
	setSidebarDock: (dock: SidebarDock) => void;
	/**
	 * A ref callback for the Products page's centered frame. Used to compute “snap to left/right of products”.
	 * (We only need its bounding box.)
	 */
	registerProductsFrame: RefCallback<HTMLElement>;
	productsFrameBounds: { left: number; right: number } | null;
	/** Scroll progress as a value from 0 to 1 */
	scrollProgress: number;
}

// Create the context
const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

// Create a hook to use the sidebar context
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a ProductProvider");
  }
  return context;
};

// Define the ProductProvider component
const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
		const [isContentScrolled, setIsContentScrolled] = useState(false);
		// "Compact / full" mode for /products. Entered on first scroll gesture even if we prevent
		// the actual scroll movement, to avoid the initial scroll feeling "boosted".
		const [isCompactMode, setIsCompactMode] = useState(false);
		const compactRef = useRef(false);
		const hasLeftTopRef = useRef(false);
		// Scroll progress (0-1) for progress indicator
		const [scrollProgress, setScrollProgress] = useState(0);
	const [sidebarDock, setSidebarDockState] = useState<SidebarDock>(() => {
		// Prefer the new key; fall back to legacy placement key.
		try {
			const raw = localStorage.getItem(SIDEBAR_DOCK_KEY);
			if (raw === "edge-left" || raw === "frame-left" || raw === "frame-right" || raw === "edge-right") return raw;
		} catch {}
		try {
			const legacy = localStorage.getItem(LEGACY_PLACEMENT_KEY);
			if (legacy === "right") return "edge-right";
			if (legacy === "left") return "edge-left";
		} catch {}
		return "edge-left";
	});

	const [productsFrameBounds, setProductsFrameBounds] = useState<{ left: number; right: number } | null>(null);
	const [productsFrameNode, setProductsFrameNode] = useState<HTMLElement | null>(null);

	// ─── Viewport width tracking for responsive sidebar padding ───────────────
	const [viewportWidth, setViewportWidth] = useState(() =>
		typeof window !== 'undefined' ? window.innerWidth : 0
	);
	useEffect(() => {
		const onResize = () => setViewportWidth(window.innerWidth);
		window.addEventListener('resize', onResize, { passive: true });
		return () => window.removeEventListener('resize', onResize);
	}, []);

  const toggleSidebar = () => setIsSidebarOpen((v) => !v);
	const setSidebarDock = (dock: SidebarDock) => {
		setSidebarDockState(dock);
		try {
			localStorage.setItem(SIDEBAR_DOCK_KEY, dock);
		} catch {}
	};

	const registerProductsFrame: RefCallback<HTMLElement> = useCallback((node) => {
		setProductsFrameNode(node);
		if (!node) {
			setProductsFrameBounds(null);
			return;
		}
		const rect = node.getBoundingClientRect();
		setProductsFrameBounds({ left: rect.left, right: rect.right });
	}, []);

	// Keep products frame bounds fresh on resize (and any responsive layout changes).
	useEffect(() => {
		if (!productsFrameNode) return;

		let raf = 0;
		const update = () => {
			cancelAnimationFrame(raf);
				raf = requestAnimationFrame(() => {
				const r = productsFrameNode.getBoundingClientRect();
				setProductsFrameBounds({ left: r.left, right: r.right });
			});
		};

		update();
		window.addEventListener("resize", update, { passive: true });
		const ro = new ResizeObserver(update);
		ro.observe(productsFrameNode);
		return () => {
			window.removeEventListener("resize", update);
			ro.disconnect();
			cancelAnimationFrame(raf);
		};
	}, [productsFrameNode]);

	// Track scroll state (docked vs floating) based on the owned scroll container.
	useEffect(() => {
		const el = scrollContainerRef.current;
		if (!el) return;

			// Mobile: first upward swipe (which would normally scroll content down) at the very top
			// should only enter compact mode, without moving the grid.
			let touchStartX: number | null = null;
			let touchStartY: number | null = null;
			let blockTouchScrollForGesture = false;
			const TOUCH_THRESHOLD_PX = 6;
			const onTouchStart = (e: TouchEvent) => {
				blockTouchScrollForGesture = false;
				if (e.touches.length !== 1) {
					touchStartX = null;
					touchStartY = null;
					return;
				}
				touchStartX = e.touches[0].clientX;
				touchStartY = e.touches[0].clientY;
			};
			const onTouchMove = (e: TouchEvent) => {
				// Allow pinch-zoom / multi-touch gestures.
				if (e.touches.length !== 1) return;

				// Ignore touch events from inside the filters sidebar - let sidebar scroll independently
				const target = e.target as HTMLElement | null;
				if (target?.closest('[data-sidebar-filters="true"]')) return;

				if (blockTouchScrollForGesture) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}

				if (touchStartX == null || touchStartY == null) return;
				const dx = e.touches[0].clientX - touchStartX;
				const dy = e.touches[0].clientY - touchStartY;

				// Ignore mostly-horizontal gestures.
				if (Math.abs(dx) > Math.abs(dy)) return;

				// dy < 0 means finger moved up -> would scroll content down (enter compact).
				if (el.scrollTop === 0 && !compactRef.current && dy < -TOUCH_THRESHOLD_PX) {
					e.preventDefault();
					e.stopPropagation();
					blockTouchScrollForGesture = true;
					compactRef.current = true;
					setIsCompactMode(true);
					setIsContentScrolled(true);
					return;
				}

				// dy > 0 means finger moved down -> would scroll content up (exit compact).
				// Allow exiting compact mode with swipe down when at top.
				if (el.scrollTop === 0 && compactRef.current && dy > TOUCH_THRESHOLD_PX) {
					e.preventDefault();
					e.stopPropagation();
					blockTouchScrollForGesture = true;
					compactRef.current = false;
					setIsCompactMode(false);
					setIsContentScrolled(false);
				}
			};
			const onTouchEnd = () => {
				blockTouchScrollForGesture = false;
				touchStartX = null;
				touchStartY = null;
			};

			const onWheel = (e: WheelEvent) => {
				// allow ctrl/cmd + wheel zoom gestures
				if (e.ctrlKey || e.metaKey) return;

				// Ignore wheel events from inside the filters sidebar - let sidebar scroll independently
				const target = e.target as HTMLElement | null;
				if (target?.closest('[data-sidebar-filters="true"]')) return;

				// First downward wheel notch at the very top should *only* enter compact mode,
				// not actually scroll the products grid.
				if (el.scrollTop === 0 && !compactRef.current && e.deltaY > 0) {
					e.preventDefault();
					e.stopPropagation();
					compactRef.current = true;
					setIsCompactMode(true);
					setIsContentScrolled(true);
					return;
				}

				// Wheel up while at top AND in compact mode should exit compact mode.
				// This allows "scroll down once to enter, scroll up once to exit".
				if (el.scrollTop === 0 && compactRef.current && e.deltaY < 0) {
					e.preventDefault();
					e.stopPropagation();
					compactRef.current = false;
					setIsCompactMode(false);
					setIsContentScrolled(false);
				}
			};

		const onScroll = () => {
			const top = el.scrollTop;
				// Calculate scroll progress (0-1)
				const scrollHeight = el.scrollHeight - el.clientHeight;
				const progress = scrollHeight > 0 ? Math.min(1, top / scrollHeight) : 0;
				setScrollProgress(progress);

				if (top > 0) {
					hasLeftTopRef.current = true;
					// Once the user has actually scrolled, we stay in compact mode.
					if (!compactRef.current) {
						compactRef.current = true;
						setIsCompactMode(true);
					}
					setIsContentScrolled(true);
					return;
				}

				// top === 0
				if (hasLeftTopRef.current) {
					// User returned to the very top after scrolling; restore the hero state.
					hasLeftTopRef.current = false;
					if (compactRef.current) setIsCompactMode(false);
					setIsContentScrolled(false);
					return;
				}

				// Still at the very top (we may be in compact mode via the first wheel gesture).
				setIsContentScrolled(compactRef.current);
		};

		onScroll();
			el.addEventListener("touchstart", onTouchStart, { passive: true });
			el.addEventListener("touchmove", onTouchMove, { passive: false });
			el.addEventListener("touchend", onTouchEnd, { passive: true });
			el.addEventListener("touchcancel", onTouchEnd, { passive: true });
			el.addEventListener("wheel", onWheel, { passive: false });
			el.addEventListener("scroll", onScroll, { passive: true });
			return () => {
				el.removeEventListener("touchstart", onTouchStart);
				el.removeEventListener("touchmove", onTouchMove);
				el.removeEventListener("touchend", onTouchEnd);
				el.removeEventListener("touchcancel", onTouchEnd);
				el.removeEventListener("wheel", onWheel);
				el.removeEventListener("scroll", onScroll);
			};
	}, []);

		// Keep refs + a DOM hint in sync for components outside this provider (TopBar).
		useEffect(() => {
			compactRef.current = isCompactMode;
			const el = scrollContainerRef.current;
			if (!el) return;
			if (isCompactMode) {
				el.setAttribute("data-products-compact", "true");
			} else {
				el.removeAttribute("data-products-compact");
			}
			// Trigger listeners that only react to scroll events (e.g. TopBar) even when
			// the first wheel gesture was prevented.
			el.dispatchEvent(new Event("scroll"));
		}, [isCompactMode]);

  // Prevent “double scrollbars” (window + inner container) on /products.
  // The ProductProvider owns the main scroll area via `scrollContainerRef`.
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

	// ─── Sidebar content adjustment ──────────────────────────────────────────
	// When the sidebar is open on edge-left or edge-right, we use a flex layout
	// with a spacer that takes up the sidebar width. This forces the content to
	// shrink (grid reflows to fewer columns, inputs shrink) instead of just shifting.
	const isDesktop = viewportWidth >= 768; // md breakpoint
	const isEdgeDock = sidebarDock === 'edge-left' || sidebarDock === 'edge-right';
	const showLeftSpacer = isSidebarOpen && isDesktop && sidebarDock === 'edge-left';
	const showRightSpacer = isSidebarOpen && isDesktop && sidebarDock === 'edge-right';
	const spacerWidth = SIDEBAR_WIDTH; // No extra gap needed - sidebar already has some padding

	// Spacer style with smooth transition
	const spacerStyle: React.CSSProperties = {
		width: spacerWidth,
		minWidth: spacerWidth,
		transition: 'width 300ms ease-out, min-width 300ms ease-out, opacity 300ms ease-out',
	};
	const collapsedSpacerStyle: React.CSSProperties = {
		width: 0,
		minWidth: 0,
		transition: 'width 300ms ease-out, min-width 300ms ease-out, opacity 300ms ease-out',
	};

  return (
	  <SidebarContext.Provider
			value={{
				isSidebarOpen,
				toggleSidebar,
				scrollContainerRef,
				isContentScrolled,
					sidebarDock,
					setSidebarDock,
					registerProductsFrame,
					productsFrameBounds,
					scrollProgress,
			}}
		>
		    <div className="productProvider relative flex w-full h-full min-h-0">
					{/*
						Own the scroll area for /products so the scrollbar is always on the
						outer edge (even when the filters sidebar is on the right).
						Scrollbar styling is in globals.css - uses overlay mode so it doesn't take space.
					*/}
					<div
						ref={scrollContainerRef}
						data-app-scroll-container="true"
						className="flex-1 min-w-0 h-full min-h-0 overscroll-contain"
					>
							<MySidebarProductsMenu />
							{/* Flex container for spacer + content */}
							<div className="flex w-full min-h-full">
								{/* Left spacer when sidebar is edge-left */}
								<div
									aria-hidden="true"
									className="hidden md:block flex-shrink-0"
									style={showLeftSpacer ? spacerStyle : collapsedSpacerStyle}
								/>
								{/* Main content area - takes remaining width */}
								<div className="relative flex-1 min-w-0">
									{children}
								</div>
								{/* Right spacer when sidebar is edge-right */}
								<div
									aria-hidden="true"
									className="hidden md:block flex-shrink-0"
									style={showRightSpacer ? spacerStyle : collapsedSpacerStyle}
								/>
							</div>
					</div>
		    </div>
	  </SidebarContext.Provider>
  );
};

export default ProductProvider;