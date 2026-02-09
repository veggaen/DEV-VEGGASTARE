'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FiX, FiSearch, FiRotateCcw, FiChevronDown, FiChevronUp, FiDollarSign, FiGrid, FiUsers, FiShield, FiSliders } from 'react-icons/fi';
import { MdAdd } from 'react-icons/md';
import { useSidebar, type SidebarDock } from '@/components/providers/product-layoutProvider';
import { useCategories, type CategoryWithCount } from '@/components/providers/categoriesContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriceSlider } from '@/components/ui/price-slider';
import { cn } from '@/lib/utils';
import { UseCurrentRole } from '@/hooks/use-current-role';
import { useCurrentUser } from '@/hooks/use-current-user';
import { UserRole } from '@/generated/prisma/browser';

// ─── Loading Skeleton ────────────────────────────────────────────────────────
const FilterSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 flex-1 rounded bg-zinc-200 dark:bg-zinc-700" style={{ width: `${60 + Math.random() * 30}%` }} />
      </div>
    ))}
  </div>
);

// ─── Collapsible Section Component ───────────────────────────────────────────
interface FilterSectionProps {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  selectedCount?: number;
  isOpen: boolean;
  onToggle: () => void;
  onReset?: () => void;
  showReset?: boolean;
  /** If true, section grows to fill available space when open (for scrollable lists) */
  canGrow?: boolean;
  children: React.ReactNode;
}

const FilterSection = ({
  title,
  icon,
  count,
  selectedCount,
  isOpen,
  onToggle,
  onReset,
  showReset,
  canGrow = false,
  children,
}: FilterSectionProps) => (
  <div className={cn(
    "border-b border-black/5 dark:border-white/10 last:border-b-0 flex flex-col min-h-0",
    isOpen && canGrow && "flex-1"
  )}>
    {/* Header row - uses div + onClick to avoid nesting buttons */}
    <div className="flex w-full items-center justify-between gap-2 py-3 -mx-1 px-1 rounded-md flex-shrink-0">
      {/* Clickable toggle area */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 flex-1 min-w-0 text-left transition-colors hover:opacity-80"
        aria-expanded={isOpen}
      >
        {icon && <span className="text-zinc-500 dark:text-zinc-400 flex-shrink-0">{icon}</span>}
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{title}</span>
        {typeof count === 'number' && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">({count})</span>
        )}
        {typeof selectedCount === 'number' && selectedCount > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500/15 px-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 flex-shrink-0">
            {selectedCount}
          </span>
        )}
      </button>
      {/* Action buttons - siblings, not nested */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {showReset && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded transition-colors"
            aria-label={`Reset ${title.toLowerCase()}`}
          >
            <FiRotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded transition-colors"
          aria-label={isOpen ? `Collapse ${title.toLowerCase()}` : `Expand ${title.toLowerCase()}`}
        >
          {isOpen ? (
            <FiChevronUp className="h-4 w-4" />
          ) : (
            <FiChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
    <div
      className={cn(
        "transition-[flex] duration-200 ease-out overflow-hidden min-h-0",
        isOpen ? (canGrow ? "flex-1 flex flex-col" : "") : "flex-[0_0_0px]"
      )}
    >
      <div className={cn(
        "pb-4 pt-1",
        canGrow && "flex flex-col min-h-0 flex-1"
      )}>{children}</div>
    </div>
  </div>
);

// ─── Category Item with Count ────────────────────────────────────────────────
interface CategoryItemProps {
  category: CategoryWithCount;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const CategoryItem = ({ category, isSelected, onToggle, disabled }: CategoryItemProps) => (
  <label
    className={cn(
      "flex items-center gap-2.5 py-1.5 px-4 -mx-1 rounded-md cursor-pointer transition-colors",
      disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
      isSelected && "bg-sky-500/5 dark:bg-sky-500/10"
    )}
  >
    <Checkbox
      checked={isSelected}
      onCheckedChange={onToggle}
      disabled={disabled}
      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
    />
    <span className={cn(
      "flex-1 text-sm capitalize",
      isSelected ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-700 dark:text-zinc-300"
    )}>
      {category.category}
    </span>
    <span className={cn(
      "text-xs tabular-nums",
      category.count === 0 ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"
    )}>
      {category.count}
    </span>
  </label>
);

export const MySidebarProductsMenu = () => {
  const { isSidebarOpen, toggleSidebar, closeSidebar, sidebarSwipePx, isSidebarSwiping, cancelSidebarSwipe, isContentScrolled, sidebarDock, setSidebarDock, productsFrameBounds, perPage, setPerPage } = useSidebar();
  const isDocked = isContentScrolled;
	const isRightDock = sidebarDock === 'edge-right' || sidebarDock === 'frame-right';
  const isEdgeDock = sidebarDock === 'edge-left' || sidebarDock === 'edge-right';
  const isFrameDock = sidebarDock === 'frame-left' || sidebarDock === 'frame-right';
  const userRole = UseCurrentRole();
  const user = useCurrentUser(); // For showing/hiding create button
  const isLoggedIn = !!user;

  const SIDEBAR_WIDTH = 340;
  const FRAME_GAP = 16;

  const [viewportW, setViewportW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 0));
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

	const isMobile = viewportW > 0 && viewportW < 768;
	// Force left-side slide-over on mobile to match gesture expectations (left->right opens filters).
	const isRight = !isMobile && isRightDock;

  const closeSwipeRef = useRef<{ x: number; y: number; t: number; onSlider: boolean } | null>(null);
  const onMobileSidebarTouchStart: React.TouchEventHandler<HTMLElement> = (e) => {
    if (!isMobile) return;
    if (!isSidebarOpen) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    // Check if touch started on a slider component
    const target = e.target as HTMLElement;
    const onSlider = Boolean(target.closest('[data-price-slider], [data-slider-thumb]'));
    closeSwipeRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), onSlider };
  };
  const onMobileSidebarTouchEnd: React.TouchEventHandler<HTMLElement> = (e) => {
    if (!isMobile) return;
    if (!isSidebarOpen) return;
    const s = closeSwipeRef.current;
    closeSwipeRef.current = null;
    if (!s) return;
    // Don't close if touch started on a slider - user is adjusting price filter
    if (s.onSlider) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const dt = Date.now() - s.t;
    // Swipe left to close (fast + mostly horizontal)
    if (dt <= 650 && dx < -70 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      cancelSidebarSwipe();
      closeSidebar();
    }
  };

  const [footerLiftPx, setFooterLiftPx] = useState(0);
  const [cookieLiftPx, setCookieLiftPx] = useState(0);

  // When the page footer/cookie banner enters the viewport, shrink the fixed sidebar so
  // bottom actions (e.g. Reset all filters) stay reachable.
  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;

      try {
        const raw = getComputedStyle(document.documentElement)
          .getPropertyValue('--cookie-banner-offset')
          .trim();
        const n = raw ? Number(raw.replace('px', '')) : 0;
        setCookieLiftPx(Number.isFinite(n) ? Math.max(0, n) : 0);
      } catch {
        setCookieLiftPx(0);
      }

      const footer = document.querySelector('footer');
      if (!footer) {
        setFooterLiftPx(0);
        return;
      }

      // If the footer is hidden (e.g. on mobile via `display:none`), it should not
      // affect sidebar height. `getBoundingClientRect()` returns zeros in that case
      // which previously looked like a full overlap.
      const footerStyle = getComputedStyle(footer);
      if (footerStyle.display === 'none' || footerStyle.visibility === 'hidden') {
        setFooterLiftPx(0);
        return;
      }

      const rect = footer.getBoundingClientRect();
      if (rect.height <= 1) {
        setFooterLiftPx(0);
        return;
      }
      const vh = window.innerHeight || 0;
      const overlap = Math.max(0, vh - rect.top);
      const bounded = Math.min(overlap, 320);
      setFooterLiftPx((prev) => (Math.abs(prev - bounded) < 1 ? prev : bounded));
    };

    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('veggat:cookie-banner-offset', onScrollOrResize as any);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('veggat:cookie-banner-offset', onScrollOrResize as any);
    };
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const snapPoints = useMemo(() => {
    const maxLeft = Math.max(0, viewportW - SIDEBAR_WIDTH);
    const frameLeft = productsFrameBounds?.left ?? 0;
    const frameRight = productsFrameBounds?.right ?? viewportW;

    const edgeLeftX = 0;
    const edgeRightX = maxLeft;
    const frameLeftX = clamp(frameLeft - SIDEBAR_WIDTH - FRAME_GAP, 0, maxLeft);
    const frameRightX = clamp(frameRight + FRAME_GAP, 0, maxLeft);

    return [
      { dock: 'edge-left' as const, x: edgeLeftX },
      { dock: 'frame-left' as const, x: frameLeftX },
      { dock: 'frame-right' as const, x: frameRightX },
      { dock: 'edge-right' as const, x: edgeRightX },
    ];
  }, [productsFrameBounds?.left, productsFrameBounds?.right, viewportW]);

  // Find the closest snap point to a given x position
  const findClosestSnapPoint = useCallback((x: number) => {
    let closest = snapPoints[0];
    let minDist = Math.abs(x - closest.x);
    
    for (const sp of snapPoints) {
      const dist = Math.abs(x - sp.x);
      if (dist < minDist) {
        minDist = dist;
        closest = sp;
      }
    }
    return closest;
  }, [snapPoints]);

  const leftForDock = useMemo(() => {
    const hit = snapPoints.find((p) => p.dock === sidebarDock);
    if (hit) return hit.x;
    return snapPoints[0]?.x ?? 0;
  }, [sidebarDock, snapPoints]);

  // Enhanced drag ref that tracks start position for gesture detection
  const dragRef = useRef<{ 
    pointerId: number; 
    grabOffsetX: number;
    startX: number;
    startY: number;
    startDock: SidebarDock;
  } | null>(null);
  const [dragLeft, setDragLeft] = useState<number | null>(null);
  const [previewDock, setPreviewDock] = useState<SidebarDock | null>(null);
  const effectiveLeft = dragLeft ?? leftForDock;

  useEffect(() => {
    if (dragRef.current === null && dragLeft !== null) setDragLeft(null);
    if (dragRef.current === null && previewDock !== null) setPreviewDock(null);
  }, [sidebarDock, dragLeft, previewDock]);
  
  // Gesture-based dock calculation
  const calculateDockFromGesture = useCallback((
    deltaX: number, 
    deltaY: number, 
    startDock: SidebarDock
  ): SidebarDock => {
    const isOnLeft = startDock === 'edge-left' || startDock === 'frame-left';
    const isEdge = startDock === 'edge-left' || startDock === 'edge-right';
    
    // Thresholds for gesture detection
    const horizontalThreshold = 100; // px to switch sides
    const verticalThreshold = 40;    // px to switch edge/inline
    
    // Check if this is primarily a vertical or horizontal gesture
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Vertical gesture: switch between edge and inline on same side
    if (absY > verticalThreshold && absY > absX * 0.7) {
      if (deltaY > 0) {
        // Dragging DOWN → move to inline (frame)
        return isOnLeft ? 'frame-left' : 'frame-right';
      } else {
        // Dragging UP → move to edge
        return isOnLeft ? 'edge-left' : 'edge-right';
      }
    }
    
    // Horizontal gesture: switch sides
    if (absX > horizontalThreshold) {
      if (deltaX > 0) {
        // Dragging RIGHT
        if (absX > horizontalThreshold * 2) {
          // Far right → edge-right
          return 'edge-right';
        }
        // Medium right → frame-right (or stay if already on right)
        return isOnLeft ? 'frame-right' : (isEdge ? 'frame-right' : 'edge-right');
      } else {
        // Dragging LEFT
        if (absX > horizontalThreshold * 2) {
          // Far left → edge-left
          return 'edge-left';
        }
        // Medium left → frame-left (or stay if already on left)
        return isOnLeft ? (isEdge ? 'frame-left' : 'edge-left') : 'frame-left';
      }
    }
    
    // Small movement - stay at current position
    return startDock;
  }, []);

  // ─── Filter State from Context ─────────────────────────────────────────────
  const {
    categoriesWithCounts,
    categoriesLoading,
    selectedCategories,
    setSelectedCategories,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    initialPriceRange,
    sellers,
    sellersLoading,
    selectedSellers,
    setSelectedSellers,
    resetAllFilters,
    resetPriceFilters,
    resetCategoryFilters,
    resetSellerFilters,
    activeFilterCount,
  } = useCategories();

  // ─── Section Open State ────────────────────────────────────────────────────
  const [isPriceOpen, setIsPriceOpen] = useState(true);
  const [isViewOptionsOpen, setIsViewOptionsOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true);
  const [isSellersOpen, setIsSellersOpen] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // ─── Category Search (mobile-friendly) ─────────────────────────────────────
  const [categorySearch, setCategorySearch] = useState('');
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categoriesWithCounts;
    const search = categorySearch.toLowerCase();
    return categoriesWithCounts.filter((c) => c.category.toLowerCase().includes(search));
  }, [categoriesWithCounts, categorySearch]);

  // ─── Seller Search ─────────────────────────────────────────────────────────
  const [sellerSearch, setSellerSearch] = useState('');
  const filteredSellers = useMemo(() => {
    if (!sellerSearch.trim()) return sellers;
    const search = sellerSearch.toLowerCase();
    return sellers.filter((s) => s.name.toLowerCase().includes(search));
  }, [sellers, sellerSearch]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleCategoryChange = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleSellerChange = (sellerId: string) => {
    setSelectedSellers((prev) =>
      prev.includes(sellerId) ? prev.filter((id) => id !== sellerId) : [...prev, sellerId]
    );
  };

  // ─── SidebarPanel (shared by desktop & mobile) ────────────────────────────
  // NOTE: This is a render function, NOT a component. Using it as a component
  // (e.g. <SidebarPanel />) would cause re-mount on every parent render, losing
  // input focus. Instead, call it as {renderSidebarPanel('desktop')}.
  const renderSidebarPanel = (variant: 'mobile' | 'desktop') => {
    const showClose = variant === 'mobile' || isSidebarOpen;
    const enableDrag = variant === 'desktop';

    const onHeaderPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
      if (!enableDrag) return;
      if (!isSidebarOpen) return;
      if (e.button !== 0) return;
      e.preventDefault();
      const currentLeft = effectiveLeft;
      dragRef.current = { 
        pointerId: e.pointerId, 
        grabOffsetX: e.clientX - currentLeft,
        startX: e.clientX,
        startY: e.clientY,
        startDock: sidebarDock,
      };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      setDragLeft(currentLeft);
      setPreviewDock(sidebarDock);
    };

    const onHeaderPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
      const s = dragRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      
      // Calculate gesture delta from start position
      const deltaX = e.clientX - s.startX;
      const deltaY = e.clientY - s.startY;
      
      // Use gesture to determine target dock
      const targetDock = calculateDockFromGesture(deltaX, deltaY, s.startDock);
      
      // Show the actual drag position for smooth 1:1 tracking during drag
      const maxLeft = Math.max(0, viewportW - SIDEBAR_WIDTH);
      const rawLeft = clamp(e.clientX - s.grabOffsetX, 0, maxLeft);
      
      // Always show raw position during drag for smooth tracking
      setDragLeft(rawLeft);
      
      // Update preview dock for visual feedback (this determines where it will snap on release)
      if (targetDock !== previewDock) setPreviewDock(targetDock);
    };

    const finishDrag: React.PointerEventHandler<HTMLDivElement> = (e) => {
      const s = dragRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      
      // Use the preview dock (calculated from gesture) as final position
      const finalDock = previewDock ?? s.startDock;
      setSidebarDock(finalDock);
      setDragLeft(null);
      setPreviewDock(null);
      dragRef.current = null;
    };

    const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.OWNER;
    const hasPriceChanges = initialPriceRange && (minPrice !== initialPriceRange.min || maxPrice !== initialPriceRange.max);

    return (
      <div className="flex h-full flex-col">
        {/* ─── Sticky Header ─── */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-4 border-b border-black/5 dark:border-white/10",
            enableDrag && "cursor-grab active:cursor-grabbing select-none touch-none"
          )}
          style={{
            // Use CSS variable for alignment with topbar, fallback to 68px
            height: variant === 'desktop' && isDocked && isEdgeDock
              ? 'calc(var(--products-controls-height, 68px))'
              : '68px',
            maxHeight: '68px',
            paddingTop: variant === 'desktop' && isDocked && isEdgeDock ? 0 : undefined,
            paddingBottom: variant === 'desktop' && isDocked && isEdgeDock ? 0 : undefined,
          }}
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          aria-label={enableDrag ? "Filters (drag to reposition)" : "Filters"}
        >
        {variant === 'mobile' ? (
          <div className="grid w-full grid-cols-[1fr,auto,1fr] items-center">
            <div />
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Filters</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-xs font-medium text-white">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <div className="flex items-center justify-end">
              {showClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  aria-label="Close filters"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <FiX className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Filters</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-xs font-medium text-white">
                  {activeFilterCount}
                </span>
              )}
            </div>
            {showClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                aria-label="Close filters"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <FiX className="h-5 w-5" />
              </Button>
            )}
          </>
        )}
      </div>

        {/* ─── Scrollable Body ─── */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-1">

          {/* Price Filter */}
          <FilterSection
            title="Price"
            icon={<FiSliders className="h-4 w-4" />}
            isOpen={isPriceOpen}
            onToggle={() => setIsPriceOpen((p) => !p)}
            showReset={!!hasPriceChanges}
            onReset={resetPriceFilters}
          >
            {/* Fancy animated price slider */}
            <PriceSlider
              minValue={minPrice}
              maxValue={maxPrice}
              rangeMin={0}
              rangeMax={initialPriceRange?.max ?? 10000}
              step={10}
              onMinChange={setMinPrice}
              onMaxChange={setMaxPrice}
              formatValue={(v) => v.toLocaleString()}
            />
            
            {/* Fallback manual inputs for precise entry */}
            <details className="mt-3 group">
              <summary className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors select-none">
                Enter exact values
              </summary>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 relative">
                  <label className="sr-only">Minimum price</label>
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice ?? ''}
                    onChange={(e) => setMinPrice(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full h-9 bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <span className="text-zinc-400 text-sm font-medium select-none">–</span>
                <div className="flex-1 relative">
                  <label className="sr-only">Maximum price</label>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice ?? ''}
                    onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full h-9 bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </details>
          </FilterSection>

          {/* Categories Filter */}
          <FilterSection
            title="Categories"
            icon={<FiGrid className="h-4 w-4" />}
            count={categoriesWithCounts.length}
            selectedCount={selectedCategories.length}
            isOpen={isCategoriesOpen}
            onToggle={() => setIsCategoriesOpen((p) => !p)}
            showReset={selectedCategories.length > 0}
            onReset={resetCategoryFilters}
            canGrow
          >
            {categoriesLoading ? (
              <FilterSkeleton count={6} />
            ) : (
              <div className="flex flex-col flex-1 min-h-0 gap-2">
                {/* Category search - always render to maintain focus */}
                {categoriesWithCounts.length > 6 && (
                  <div className="relative flex-shrink-0 mx-0.5">
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search categories..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:border-sky-500"
                    />
                  </div>
                )}
                {/* Category list */}
                <div className="flex-1 min-h-16 overflow-x-hidden overflow-y-auto space-y-0.5">
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((cat) => (
                      <CategoryItem
                        key={cat.category}
                        category={cat}
                        isSelected={selectedCategories.includes(cat.category)}
                        onToggle={() => handleCategoryChange(cat.category)}
                        disabled={cat.count === 0}
                      />
                    ))
                  ) : (
                    <div className="text-sm text-zinc-400 py-2 px-1">No categories found</div>
                  )}
                </div>
              </div>
            )}
          </FilterSection>

          {/* Sellers Filter */}
          <FilterSection
            title="Sellers"
            icon={<FiUsers className="h-4 w-4" />}
            count={sellers.length}
            selectedCount={selectedSellers.length}
            isOpen={isSellersOpen}
            onToggle={() => setIsSellersOpen((p) => !p)}
            showReset={selectedSellers.length > 0}
            onReset={resetSellerFilters}
            canGrow
          >
            {sellersLoading ? (
              <FilterSkeleton count={4} />
            ) : sellers.length > 0 ? (
              <div className="flex flex-col flex-1 min-h-0 gap-2">
                {/* Seller search */}
                {sellers.length > 6 && (
                  <div className="relative flex-shrink-0 mx-0.5">
                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search sellers..."
                      value={sellerSearch}
                      onChange={(e) => setSellerSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:border-sky-500"
                    />
                  </div>
                )}
                {/* Seller list */}
                <div className="flex-1 min-h-16 overflow-x-hidden overflow-y-auto space-y-0.5">
                  {filteredSellers.length > 0 ? (
                    filteredSellers.map((seller) => (
                      <label
                        key={seller.id}
                        className={cn(
                          "flex items-center gap-2.5 py-1.5 px-4 -mx-1 rounded-md cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
                          selectedSellers.includes(seller.id) && "bg-sky-500/5 dark:bg-sky-500/10"
                        )}
                      >
                        <Checkbox
                          checked={selectedSellers.includes(seller.id)}
                          onCheckedChange={() => handleSellerChange(seller.id)}
                          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                        />
                        <span className={cn(
                          "flex-1 text-sm capitalize truncate",
                          selectedSellers.includes(seller.id)
                            ? "text-zinc-900 dark:text-zinc-100 font-medium"
                            : "text-zinc-700 dark:text-zinc-300"
                        )}>
                          {seller.name}
                        </span>
                        <span className={cn(
                          "text-xs tabular-nums flex-shrink-0",
                          seller.count === 0 ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"
                        )}>
                          {seller.count}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-400 py-2 px-1">No sellers found</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-400 py-2">No sellers available</div>
            )}
          </FilterSection>

          {/* Admin Section (RBAC-gated) */}
          {isAdmin && (
            <FilterSection
              title="Admin Tools"
              icon={<FiShield className="h-4 w-4" />}
              isOpen={isAdminOpen}
              onToggle={() => setIsAdminOpen((p) => !p)}
            >
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <p className="text-xs text-zinc-500">Mod/Admin only features</p>
                {/* Future: add moderation toggles here */}
                <div className="text-xs opacity-60">No admin filters yet</div>
              </div>
            </FilterSection>
          )}

          {/* View options (kept at the bottom; collapsed by default) */}
          <FilterSection
            title="View Options"
            icon={<FiGrid className="h-4 w-4" />}
            isOpen={isViewOptionsOpen}
            onToggle={() => setIsViewOptionsOpen((p) => !p)}
          >
            <div className="grid gap-2">
              <div className="grid gap-1.5 sm:grid-cols-[auto,1fr] sm:items-center sm:gap-2">
                <div className="text-xs text-zinc-600 dark:text-zinc-300">Items / page</div>
                <Select value={perPage.toString()} onValueChange={(v) => setPerPage(Number(v))}>
                  <SelectTrigger className="h-10 w-full sm:w-[170px] rounded-lg border-black/10 bg-white/60 text-zinc-800 shadow-sm shadow-black/[0.03] hover:bg-white/75 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.10]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-black/10 bg-white/95 text-zinc-950 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-surface-1/80 dark:text-zinc-50">
                    <SelectItem value="10" className="whitespace-nowrap">10 per page</SelectItem>
                    <SelectItem value="20" className="whitespace-nowrap">20 per page</SelectItem>
                    <SelectItem value="30" className="whitespace-nowrap">30 per page</SelectItem>
                    <SelectItem value="50" className="whitespace-nowrap">50 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FilterSection>
        </div>

        {/* ─── Footer with Reset All ─── */}
        <div className="p-4 border-t border-black/5 dark:border-white/10">
          <Button
            variant="outline"
            onClick={resetAllFilters}
            className="w-full gap-2"
            disabled={activeFilterCount === 0}
          >
            <FiRotateCcw className="h-4 w-4" />
            Reset all filters
            {activeFilterCount > 0 && (
              <span className="ml-1 text-xs opacity-70">({activeFilterCount})</span>
            )}
          </Button>
        </div>
      </div>
    );
  };

				// Align flush under the TopBar when scrolled. On /products the TopBar morphs between
				// a floating (taller) state and a docked state (exactly --app-header). If we always
				// use --app-header-offset we can get a small lingering gap during/after the morph.
				const headerTopVar = isDocked ? 'var(--app-header)' : 'var(--app-header-offset)';
				// When the products controls bar becomes sticky, it occupies the very top of the
				// /products scroll container. For frame-left/frame-right we want the sidebar below it.
				const desktopTop = isDocked && isFrameDock
					? `calc(${headerTopVar} + var(--products-controls-offset))`
					: headerTopVar;
				// When NOT scrolled (floating), push sidebar DOWN to create visual separation from navbar.
				// This makes the sidebar feel "disconnected" / floating when at the top of the page.
				// Once scrolled, this becomes 0 and the sidebar "connects" with the topbar.
				const floatingTopOffset = !isDocked ? 24 : 0;
				const desktopHeight = isDocked && isFrameDock
					? `calc(100dvh - ${headerTopVar} - var(--products-controls-offset))`
					: `calc(100dvh - ${headerTopVar} - ${floatingTopOffset}px)`;
        const bottomInsetPx = footerLiftPx + cookieLiftPx;
        const desktopHeightWithInset =
          bottomInsetPx > 0 ? `calc(${desktopHeight} - ${bottomInsetPx}px)` : desktopHeight;

				const isDragging = dragRef.current !== null;

  return (
    <>
      {/* Desktop sidebar (fixed overlay; does NOT push layout) */}
      <aside
        data-sidebar-filters="true"
        className={cn(
          "hidden md:block fixed z-[60]",
          "will-change-transform",
          // Smooth transitions when not dragging, instant when dragging for 1:1 tracking
          isDragging 
            ? "transition-[opacity,transform,top] duration-0" 
            : "transition-[opacity,transform,top,left] duration-300 ease-out",
          isSidebarOpen ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"
        )}
        style={{
          // When edge-right and docked, overlap 1px to eliminate any subpixel gap
          left: isDocked && isEdgeDock && sidebarDock === 'edge-right' && !isDragging
            ? effectiveLeft - 1 
            : effectiveLeft,
          width: SIDEBAR_WIDTH,
          top: `calc(${desktopTop} + ${floatingTopOffset}px)`,
			height: desktopHeightWithInset
        }}
      >
					<div
						className={cn(
							"h-full transition-[padding] duration-500 ease-out",
							// When floating (not scrolled), inset the panel with padding all around
							// so it visually feels disconnected from the navbar.
							isDocked ? "p-0" : "p-3"
						)}
					>
						<div
							className={cn(
								"w-full h-full bg-white/55 dark:bg-surface-1/40 backdrop-blur-xl transition-[border-radius,box-shadow] duration-500 ease-out",
								isDocked
									? cn(
										"shadow-none rounded-none",
										// When edge-docked, only show border on the inner side (toward content)
										// to avoid a visual gap between sidebar and controls bar
										isEdgeDock && sidebarDock === 'edge-right'
											? "border-y border-l border-black/10 dark:border-white/10"
											: isEdgeDock && sidebarDock === 'edge-left'
												? "border-y border-r border-black/10 dark:border-white/10"
												: "border border-black/10 dark:border-white/10"
									)
									: "border border-black/10 dark:border-white/10 shadow-xl rounded-2xl"
							)}
						>
							{renderSidebarPanel('desktop')}
						</div>
					</div>
				</aside>

      {/* Overlay for small screens - z-[95] below sidebar (z-[100]) but above everything else */}
      {(isSidebarOpen || (isSidebarSwiping && sidebarSwipePx > 0)) && (
        <div
          onClick={() => {
            cancelSidebarSwipe();
            closeSidebar();
          }}
          className="fixed inset-0 bg-black/50 z-[95] md:hidden"
          style={{
            opacity: isSidebarOpen ? 1 : Math.min(1, Math.max(0.08, sidebarSwipePx / 280)) * 0.9,
            transition: isSidebarSwiping ? "none" : "opacity 200ms ease-out",
          }}
        />
      )}

      {/* Mobile sidebar (slide-over) - solid bg, highest z-layer */}
      <aside
        data-sidebar-filters="true"
        className={cn(
        "fixed w-[92vw] max-w-[420px] bg-white dark:bg-surface-1 shadow-2xl z-[100] transform will-change-transform md:hidden",
        		isSidebarSwiping ? "transition-none" : "transition-transform duration-300 ease-out",
          isRight ? "right-0 border-l border-zinc-200 dark:border-zinc-800" : "left-0 border-r border-zinc-200 dark:border-zinc-800",
        // During active swipe, we drive transform inline for smooth follow.
        !(isSidebarSwiping && sidebarSwipePx > 0 && !isSidebarOpen)
          ? (isSidebarOpen ? "translate-x-0" : isRight ? "translate-x-full" : "-translate-x-full")
          : ""
        )}
    onTouchStart={onMobileSidebarTouchStart}
    onTouchEnd={onMobileSidebarTouchEnd}
    style={{
			top: 0,
			height: '100dvh',
      transform:
        isSidebarSwiping && sidebarSwipePx > 0 && !isSidebarOpen
          ? (isRight
            ? `translateX(calc(100% - ${sidebarSwipePx}px))`
            : `translateX(calc(-100% + ${sidebarSwipePx}px))`)
          : undefined,
    }}
      >
        {renderSidebarPanel('mobile')}
      </aside>
    </>
  );
};
