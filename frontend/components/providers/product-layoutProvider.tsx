

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
	openSidebar: () => void;
	closeSidebar: () => void;
  toggleSidebar: () => void;
	/** Mobile-only: current swipe-to-open progress in px (0..sidebarWidthPx). */
	sidebarSwipePx: number;
	/** Mobile-only: true while user is actively swiping the sidebar open. */
	isSidebarSwiping: boolean;
	/** Mobile-only: cancel any in-progress swipe (resets sidebarSwipePx). */
	cancelSidebarSwipe: () => void;
	/** Mobile-only: whether the /products controls/search bar should be visible. */
	productsControlsVisible: boolean;
	/** Mobile-only: whether the global TopBar should be visible. */
	topBarVisible: boolean;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
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
	/** Whether to show the site footer (false during infinite scroll loading) */
	showFooter: boolean;
	setShowFooter: (show: boolean) => void;
	/** Pagination size for /products */
	perPage: number;
	setPerPage: (n: number) => void;
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

// Optional hook that doesn't throw - returns null if outside ProductProvider
export const useSidebarOptional = () => {
  return useContext(SidebarContext) ?? null;
};

// Define the ProductProvider component
const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [sidebarSwipePx, setSidebarSwipePx] = useState(0);
	const [isSidebarSwiping, setIsSidebarSwiping] = useState(false);
	const [productsControlsVisible, setProductsControlsVisible] = useState(true);
	const [topBarVisible, setTopBarVisible] = useState(true);
	const productsControlsVisibleRef = useRef(true);
	const topBarVisibleRef = useRef(true);
	const sidebarOpenRef = useRef(false);
	const menuOpenRef = useRef(false);

	useEffect(() => {
		sidebarOpenRef.current = isSidebarOpen;
	}, [isSidebarOpen]);
	useEffect(() => {
		productsControlsVisibleRef.current = productsControlsVisible;
	}, [productsControlsVisible]);
	useEffect(() => {
		topBarVisibleRef.current = topBarVisible;
	}, [topBarVisible]);
	useEffect(() => {
		const onMenuState = (e: Event) => {
			const ce = e as CustomEvent<{ open?: boolean }>;
			const open = Boolean(ce?.detail?.open);
			menuOpenRef.current = open;
			if (open) {
				// Enforce mutual exclusivity: if menu opens, close filters sidebar.
				setIsSidebarOpen(false);
				setIsSidebarSwiping(false);
				setSidebarSwipePx(0);
			}
		};
		window.addEventListener("veggat:menu-open-state", onMenuState as any);
		return () => window.removeEventListener("veggat:menu-open-state", onMenuState as any);
	}, []);
  const cancelSidebarSwipe = useCallback(() => {
		setIsSidebarSwiping(false);
		setSidebarSwipePx(0);
	}, []);
	const openSidebar = useCallback(() => {
		setIsSidebarOpen(true);
		try {
			window.dispatchEvent(new Event("veggat:close-menu"));
		} catch {
			// ignore
		}
	}, []);
	const closeSidebar = useCallback(() => {
		setIsSidebarOpen(false);
		setIsSidebarSwiping(false);
		setSidebarSwipePx(0);
	}, []);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
	// Swipe-to-open on mobile: kept lightweight (passive touch listeners), and only
	// triggers when the gesture starts near the screen edges.
	useEffect(() => {
		const el = scrollContainerRef.current;
		if (!el) return;
		if (typeof window === "undefined") return;
		// NOTE: removed static media query check - let isMobile() handle it dynamically
		// so touch events work when switching to mobile emulation in devtools

		let startX = 0;
		let startY = 0;
		let startT = 0;
		let startOnLeftEdge = false;
		let startOnRightEdge = false;
		let startInCarousel = false;
		let startCarouselCanScrollPrev = false;
		let startCarouselCanScrollNext = false;
		let isSwipingSidebar = false;
		let lastScrollTop = el.scrollTop || 0;
		let upAccum = 0;
		const isMobile = () => (window.matchMedia ? !window.matchMedia("(min-width: 768px)").matches : true);
		const setChrome = (nextControls: boolean, nextTopbar: boolean) => {
			if (productsControlsVisibleRef.current !== nextControls) setProductsControlsVisible(nextControls);
			if (topBarVisibleRef.current !== nextTopbar) setTopBarVisible(nextTopbar);
			try {
				el.setAttribute("data-products-controls-visible", String(nextControls));
				el.setAttribute("data-products-topbar-visible", String(nextTopbar));
				window.dispatchEvent(
					new CustomEvent("veggat:products-chrome", {
						detail: { controlsVisible: nextControls, topbarVisible: nextTopbar },
					})
				);
			} catch {
				// ignore
			}
		};
		// Ensure correct initial state
		if (!isMobile()) setChrome(true, true);

		// If the user switches between mobile emulation and desktop, force chrome visible on desktop.
		// Otherwise the topbar can remain hidden until the next scroll event.
		const mq = window.matchMedia?.("(min-width: 768px)");
		const onMq = () => {
			if (mq?.matches) setChrome(true, true);
		};
		onMq();
		mq?.addEventListener?.("change", onMq);

		// Bigger edge area + optional full-screen "pane" swipes (Android/iOS home-screen feel)
		// NOTE: Carousel requires MORE deliberate horizontal swipes to avoid accidental sidebar/menu triggers
		const EDGE_PX = 64;
		const MIN_DX = 60; // Easier to trigger on non-carousel areas
		const MIN_DX_CAROUSEL = 140; // Much harder on carousel (especially at edges)
		const PANE_MIN_DX = 120; // Pane swipe on non-carousel content
		const PANE_RATIO = 1.4; // Less strict horizontal requirement on text areas
		const MAX_DY = 80; // More lenient vertical tolerance on text/description areas
		const MAX_DY_CAROUSEL = 32; // Very strict on carousel - must be nearly horizontal
		const MAX_DT = 600;
		const MIN_PROGRESS_PX = 10;
		const sidebarWidthPx = () => Math.min(Math.round(window.innerWidth * 0.92), 420);

		const isInteractiveTarget = (target: EventTarget | null) => {
			const node = target as HTMLElement | null;
			if (!node) return false;
			return Boolean(
				node.closest(
					"button,a,input,textarea,select,[role='button'],[role='link'],[data-sidebar-filters='true'],[data-slider-thumb],[data-price-slider]"
				)
			);
		};

		const toBool = (raw: string | null) => raw === "true" || raw === "1";

		const onTouchStart = (e: TouchEvent) => {
			// Only process on mobile
			if (!isMobile()) return;
			if (e.touches.length !== 1) return;
			if (isInteractiveTarget(e.target)) return;
			// If sidebar is already open, we don't do progressive swipe-open.
			if (sidebarOpenRef.current) return;
			// If menu is open, don't open sidebar.
			if (menuOpenRef.current) return;
			const t = e.touches[0];
			startX = t.clientX;
			startY = t.clientY;
			startT = Date.now();
			startOnLeftEdge = startX <= EDGE_PX;
			startOnRightEdge = startX >= (window.innerWidth - EDGE_PX);

			const target = e.target as HTMLElement | null;
			const carouselRoot = target?.closest?.("[data-embla-carousel='true']") as HTMLElement | null;
			startInCarousel = Boolean(carouselRoot);
			startCarouselCanScrollPrev = carouselRoot ? toBool(carouselRoot.getAttribute("data-can-scroll-prev")) : false;
			startCarouselCanScrollNext = carouselRoot ? toBool(carouselRoot.getAttribute("data-can-scroll-next")) : false;
			isSwipingSidebar = false;
			setIsSidebarSwiping(false);
			setSidebarSwipePx(0);
		};

		const onTouchMove = (e: TouchEvent) => {
			if (!startT) return;
			if (e.touches.length !== 1) return;
			if (isInteractiveTarget(e.target)) return;
			if (sidebarOpenRef.current) return;
			if (menuOpenRef.current) return;

			const t = e.touches[0];
			const dx = t.clientX - startX;
			const dy = t.clientY - startY;

			// Only handle mostly-horizontal gestures.
			if (Math.abs(dx) <= Math.abs(dy)) return;

			// Determine whether this gesture is allowed to drive the sidebar.
			// Progressive open when:
			// - Starting on left edge (classic edge swipe) OR
			// - Starting on a carousel AND the carousel can't scroll further in that direction OR
			// - A strong whole-screen right-swipe ("pane" swipe)
			const canDriveFromCarousel =
				(startInCarousel && dx > 0 && !startCarouselCanScrollPrev) ||
				(startInCarousel && dx < 0 && !startCarouselCanScrollNext);

			// More lenient on non-carousel content (title/description/price areas)
			const isPaneSwipeRight =
				!startInCarousel &&
				dx > 0 &&
				Math.abs(dx) > 24 &&
				Math.abs(dx) > Math.abs(dy) * PANE_RATIO;

			const wantsOpenSidebarFromLeft = (startOnLeftEdge || canDriveFromCarousel || isPaneSwipeRight) && dx > 0;

			// For now, we only support progressive reveal for opening the filters sidebar
			// (left->right). Menu opening remains on-touchend.
			if (!wantsOpenSidebarFromLeft) return;

			const maxDy = startInCarousel ? MAX_DY_CAROUSEL : MAX_DY;
			if (Math.abs(dy) > maxDy) return;

			const progress = Math.max(0, Math.min(sidebarWidthPx(), dx));
			if (!isSwipingSidebar && progress < MIN_PROGRESS_PX) return;

			isSwipingSidebar = true;
			setIsSidebarSwiping(true);
			setSidebarSwipePx(progress);
			e.preventDefault();
			e.stopPropagation();
		};

		const onTouchEnd = (e: TouchEvent) => {
			if (!startT) return;
			const dt = Date.now() - startT;
			startT = 0;
			if (dt > MAX_DT) {
				setIsSidebarSwiping(false);
				setSidebarSwipePx(0);
				return;
			}
			const t = e.changedTouches[0];
			if (!t) return;
			const dx = t.clientX - startX;
			const dy = t.clientY - startY;
			const maxDy = startInCarousel ? MAX_DY_CAROUSEL : MAX_DY;
			const minDx = startInCarousel ? MIN_DX_CAROUSEL : MIN_DX;
			// Edge swipes have a lower threshold for minDx since they're intentional
			const edgeMinDx = 50; // Much easier threshold for edge swipes
			
			if (Math.abs(dy) > maxDy) {
				setIsSidebarSwiping(false);
				setSidebarSwipePx(0);
				return;
			}

			// If we were actively swiping the sidebar, decide open/close based on progress.
			if (isSwipingSidebar) {
				const width = sidebarWidthPx();
				const progress = Math.max(0, Math.min(width, dx));
				const velocity = width > 0 && dt > 0 ? progress / dt : 0; // px/ms
				const shouldOpen = progress > width * 0.33 || velocity > 0.9;
				setIsSidebarSwiping(false);
				setSidebarSwipePx(0);
				if (shouldOpen) openSidebar();
				return;
			}

			// Edge swipes: prioritize these before pane/carousel checks
			// Edge swipes only need to pass edgeMinDx threshold (intentional gestures)
			if (startOnLeftEdge && dx > edgeMinDx && Math.abs(dx) > Math.abs(dy)) {
				if (menuOpenRef.current) return;
				openSidebar();
				return;
			}
			if (startOnRightEdge && dx < -edgeMinDx && Math.abs(dx) > Math.abs(dy)) {
				if (sidebarOpenRef.current) return;
				window.dispatchEvent(new Event("veggat:open-menu"));
				return;
			}

			// Whole-screen "pane" swipes: very horizontal + large dx.
			// (Avoids accidental triggers while vertically scrolling.)
			const isPaneSwipe =
				Math.abs(dx) >= PANE_MIN_DX &&
				Math.abs(dx) > Math.abs(dy) * PANE_RATIO &&
				Math.abs(dy) <= MAX_DY;

			if (!isPaneSwipe && Math.abs(dx) < minDx) return;

			// Whole-screen pane navigation (not on carousels unless edge-gated)
			if (isPaneSwipe && !startInCarousel) {
				if (dx > 0) {
					if (menuOpenRef.current) return;
					openSidebar();
					return;
				}
				if (dx < 0) {
					if (sidebarOpenRef.current) return;
					window.dispatchEvent(new Event("veggat:open-menu"));
					return;
				}
			}

			// Carousel-aware swipe: only trigger if the carousel cannot scroll further
			// in that swipe direction. This lets horizontal swipes normally paginate the carousel.
			if (startInCarousel && dx > 0 && !startCarouselCanScrollPrev) {
				if (menuOpenRef.current) return;
				openSidebar();
				return;
			}
			if (startInCarousel && dx < 0 && !startCarouselCanScrollNext) {
				if (sidebarOpenRef.current) return;
				window.dispatchEvent(new Event("veggat:open-menu"));
			}
		};

		const onChromeScroll = () => {
			if (!isMobile()) {
				setChrome(true, true);
				lastScrollTop = el.scrollTop || 0;
				upAccum = 0;
				return;
			}
			// Don't auto-hide UI while a sheet is open.
			if (menuOpenRef.current || sidebarOpenRef.current || isSidebarSwiping) return;

			const top = el.scrollTop || 0;
			const delta = top - lastScrollTop;
			lastScrollTop = top;

			// At the very top, show everything.
			if (top <= 2) {
				upAccum = 0;
				setChrome(true, true);
				return;
			}

			const DOWN_EPS = 2;
			const UP_EPS = 2;
			const HIDE_AFTER_PX = 10;
			const REVEAL_CONTROLS_UP_PX = 10;
			const REVEAL_TOPBAR_UP_PX = 44;

			if (delta > DOWN_EPS) {
				upAccum = 0;
				if (top >= HIDE_AFTER_PX) setChrome(false, false);
				return;
			}

			if (delta < -UP_EPS) {
				upAccum += -delta;
				if (!productsControlsVisibleRef.current && upAccum >= REVEAL_CONTROLS_UP_PX) {
					setChrome(true, false);
				}
				if (!topBarVisibleRef.current && upAccum >= REVEAL_TOPBAR_UP_PX) {
					setChrome(true, true);
				}
			}
		};

		el.addEventListener("touchstart", onTouchStart, { passive: true });
		el.addEventListener("touchmove", onTouchMove, { passive: false });
		el.addEventListener("touchend", onTouchEnd, { passive: true });
		el.addEventListener("touchcancel", onTouchEnd, { passive: true });
		el.addEventListener("scroll", onChromeScroll, { passive: true });
		return () => {
			mq?.removeEventListener?.("change", onMq);
			el.removeEventListener("touchstart", onTouchStart as any);
			el.removeEventListener("touchmove", onTouchMove as any);
			el.removeEventListener("touchend", onTouchEnd as any);
			el.removeEventListener("touchcancel", onTouchEnd as any);
			el.removeEventListener("scroll", onChromeScroll as any);
		};
	}, [openSidebar]);
	// Footer visibility - hidden during infinite scroll loading on /products
	const [showFooter, setShowFooter] = useState(false);
	// Pagination size - used by products page + sidebar
	const [perPage, setPerPage] = useState(30);
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
				openSidebar,
				closeSidebar,
				toggleSidebar,
				sidebarSwipePx,
				isSidebarSwiping,
				cancelSidebarSwipe,
				productsControlsVisible,
				topBarVisible,
				scrollContainerRef,
				isContentScrolled,
					sidebarDock,
					setSidebarDock,
					registerProductsFrame,
					productsFrameBounds,
					scrollProgress,
					showFooter,
					setShowFooter,
					perPage,
					setPerPage,
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