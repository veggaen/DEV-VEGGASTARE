'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiChevronDown, 
  FiGrid, 
  FiTag, 
  FiTrendingUp, 
  FiPercent, 
  FiStar, 
  FiGift,
  FiSearch,
  FiSliders,
  FiX,
  FiMenu
} from 'react-icons/fi';
import { LuPanelLeftClose, LuPanelLeftOpen, LuLayoutGrid, LuSettings2 } from 'react-icons/lu';
import { useCategories, CategoryWithCount } from '@/components/providers/categoriesContext';
import { useSidebar, type SidebarDock } from '@/components/providers/product-layoutProvider';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

// Category groups with icons
const CATEGORY_GROUPS: {
  label: string;
  icon: React.ElementType;
  categories: string[];
  gradient: string;
}[] = [
  {
    label: 'Electronics',
    icon: FiGrid,
    categories: ['Electronics', 'Computers', 'Phones', 'Audio', 'Gaming', 'Cameras', 'Accessories'],
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    label: 'Fashion',
    icon: FiTag,
    categories: ['Clothing', 'Shoes', 'Bags', 'Jewelry', 'Watches', 'Accessories'],
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    label: 'Home & Living',
    icon: FiGift,
    categories: ['Furniture', 'Kitchen', 'Decor', 'Garden', 'Tools', 'Appliances'],
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    label: 'Sports',
    icon: FiTrendingUp,
    categories: ['Fitness', 'Outdoor', 'Sports Equipment', 'Cycling', 'Camping'],
    gradient: 'from-green-500 to-emerald-500',
  },
];

// Quick links
const QUICK_LINKS = [
  { label: 'Deals', icon: FiPercent, href: '/products/daily-deals' },
  { label: 'New', icon: FiStar, href: '/products?sort=newest' },
  { label: 'Member', icon: FiGift, href: '/products/member-discount' },
];

// Dock options
const DOCK_OPTIONS: { value: SidebarDock; label: string; icon: string }[] = [
  { value: 'edge-left', label: 'Left edge', icon: '◀' },
  { value: 'frame-left', label: 'Left inline', icon: '⬅' },
  { value: 'frame-right', label: 'Right inline', icon: '➡' },
  { value: 'edge-right', label: 'Right edge', icon: '▶' },
];

interface CategoryDropdownProps {
  group: typeof CATEGORY_GROUPS[number];
  availableCategories: CategoryWithCount[];
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
}

function CategoryDropdown({ group, availableCategories, selectedCategories, onCategoryToggle }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const matchingCategories = availableCategories.filter(cat => 
    group.categories.some(gc => 
      cat.category.toLowerCase().includes(gc.toLowerCase()) ||
      gc.toLowerCase().includes(cat.category.toLowerCase())
    )
  );

  const hasActiveSelection = matchingCategories.some(cat => 
    selectedCategories.includes(cat.category)
  );

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const Icon = group.icon;

  if (matchingCategories.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="relative z-[100]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150",
          "text-slate-600 dark:text-slate-400",
          "hover:text-slate-900 dark:hover:text-slate-100",
          "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
          isOpen && "bg-black/[0.04] dark:bg-white/[0.06] text-slate-900 dark:text-slate-100",
          hasActiveSelection && "text-indigo-600 dark:text-indigo-400"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{group.label}</span>
        <FiChevronDown className={cn("h-3 w-3 transition-transform duration-150", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full left-0 mt-1.5 z-[100] min-w-[180px]"
          >
            <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden">
              <div className={cn("px-3 py-1.5 bg-gradient-to-r text-white text-[11px] font-medium tracking-wide uppercase", group.gradient)}>
                {group.label}
              </div>
              <div className="p-1.5 max-h-[260px] overflow-y-auto">
                {matchingCategories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.category);
                  return (
                    <button
                      key={cat.category}
                      onClick={() => onCategoryToggle(cat.category)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
                        "hover:bg-slate-100 dark:hover:bg-white/[0.06]",
                        isSelected && "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      )}
                    >
                      <span className="truncate">{cat.category}</span>
                      <span className={cn(
                        "text-[11px] tabular-nums px-1.5 py-0.5 rounded",
                        isSelected 
                          ? "bg-indigo-100 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300"
                          : "text-slate-400 dark:text-slate-500"
                      )}>
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AllCategoriesDropdown({ 
  categories, 
  selectedCategories, 
  onCategoryToggle 
}: { 
  categories: CategoryWithCount[];
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={dropdownRef}
      className="relative z-[100]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150",
          "text-slate-600 dark:text-slate-400",
          "hover:text-slate-900 dark:hover:text-slate-100",
          "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
          isOpen && "bg-black/[0.04] dark:bg-white/[0.06] text-slate-900 dark:text-slate-100",
          selectedCategories.length > 0 && "text-indigo-600 dark:text-indigo-400"
        )}
      >
        <LuLayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">All</span>
        <FiChevronDown className={cn("h-3 w-3 transition-transform duration-150", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full left-0 mt-1.5 z-[100] min-w-[200px]"
          >
            <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden">
              <div className="px-3 py-1.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white text-[11px] font-medium tracking-wide uppercase">
                All Categories
              </div>
              <div className="p-1.5 max-h-[300px] overflow-y-auto">
                {categories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.category);
                  return (
                    <button
                      key={cat.category}
                      onClick={() => onCategoryToggle(cat.category)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
                        "hover:bg-slate-100 dark:hover:bg-white/[0.06]",
                        isSelected && "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      )}
                    >
                      <span className="truncate">{cat.category}</span>
                      <span className={cn(
                        "text-[11px] tabular-nums px-1.5 py-0.5 rounded",
                        isSelected 
                          ? "bg-indigo-100 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300"
                          : "text-slate-400 dark:text-slate-500"
                      )}>
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ProductsToolbarProps {
  isScrolled?: boolean;
}

export function ProductsToolbar({ isScrolled = false }: ProductsToolbarProps) {
  const { 
    categoriesWithCounts, 
    categoriesLoading, 
    selectedCategories, 
    setSelectedCategories,
    activeFilterCount,
    resetAllFilters,
    searchTerm,
    setSearchTerm,
  } = useCategories();

  const {
    isSidebarOpen,
    toggleSidebar,
    sidebarDock,
    setSidebarDock,
  } = useSidebar();

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const isRight = sidebarDock === 'edge-right' || sidebarDock === 'frame-right';

  // Loading state
  if (categoriesLoading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-2 py-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-7 w-16 rounded-md bg-slate-200/50 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Determine if we should extend background to connect with edge sidebar
  const isEdgeDock = sidebarDock === 'edge-left' || sidebarDock === 'edge-right';

  return (
    <div className={cn(
      "relative z-50 transition-all duration-200 w-full",
      isScrolled && "bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-black/5 dark:border-white/5"
    )}>
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-4 md:px-6">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center gap-1 py-2">
          {/* Divider - shows on LEFT of Filters when sidebar is on right */}
          {isRight && <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1 order-[99]" />}
          
          {/* Filters toggle + Dock selector */}
          <div className={cn("flex items-center gap-1", isRight && "order-last")}>
            <button
              onClick={toggleSidebar}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150",
                "text-slate-600 dark:text-slate-400",
                "hover:text-slate-900 dark:hover:text-slate-100",
                "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
                isSidebarOpen && "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
              )}
            >
              {isSidebarOpen ? <LuPanelLeftClose className="h-4 w-4" /> : <LuPanelLeftOpen className="h-4 w-4" />}
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-500 text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-md text-[13px] transition-all duration-150",
                  "text-slate-500 dark:text-slate-500",
                  "hover:text-slate-700 dark:hover:text-slate-300",
                  "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                )}>
                  <LuSettings2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuLabel className="text-[11px] text-slate-500 uppercase tracking-wide">Panel Position</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {DOCK_OPTIONS.map(opt => (
                  <DropdownMenuItem 
                    key={opt.value}
                    onClick={() => setSidebarDock(opt.value)}
                    className={cn(
                      "text-[13px] cursor-pointer",
                      sidebarDock === opt.value && "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                    )}
                  >
                    <span className="mr-2 opacity-50">{opt.icon}</span>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Divider - shows on RIGHT of Filters when sidebar is on left */}
          {!isRight && <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1" />}

          {/* Categories */}
          <AllCategoriesDropdown
            categories={categoriesWithCounts}
            selectedCategories={selectedCategories}
            onCategoryToggle={handleCategoryToggle}
          />
          
          {CATEGORY_GROUPS.map(group => (
            <CategoryDropdown
              key={group.label}
              group={group}
              availableCategories={categoriesWithCounts}
              selectedCategories={selectedCategories}
              onCategoryToggle={handleCategoryToggle}
            />
          ))}

          {/* Spacer */}
          <div className="flex-1 min-w-4" />

          {/* Search */}
          <div className={cn(
            "relative flex items-center transition-all duration-200",
            isSearchFocused ? "w-[280px]" : "w-[200px]"
          )}>
            <FiSearch className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className={cn(
                "w-full h-8 pl-8 pr-3 rounded-md text-[13px] outline-none transition-all duration-150",
                "bg-black/[0.03] dark:bg-white/[0.04]",
                "text-slate-800 dark:text-slate-200",
                "placeholder:text-slate-400 dark:placeholder:text-slate-500",
                "border border-transparent",
                "hover:bg-black/[0.05] dark:hover:bg-white/[0.06]",
                "focus:bg-white dark:focus:bg-slate-900",
                "focus:border-indigo-500/50 dark:focus:border-indigo-400/50",
                "focus:ring-2 focus:ring-indigo-500/20"
              )}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
              >
                <FiX className="h-3 w-3 text-slate-400" />
              </button>
            )}
          </div>

          {/* Quick Links */}
          <div className="hidden xl:flex items-center gap-0.5 ml-2">
            {QUICK_LINKS.map(link => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150",
                    "text-slate-500 dark:text-slate-500",
                    "hover:text-slate-700 dark:hover:text-slate-300",
                    "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Active filters clear */}
          <AnimatePresence>
            {activeFilterCount > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={resetAllFilters}
                className="ml-2 flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                <FiX className="h-3 w-3" />
                <span>Clear</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden py-2.5 space-y-2">
          {/* Top row: Menu + Search */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={cn(
                "flex items-center justify-center h-9 w-9 rounded-lg transition-colors",
                "bg-black/[0.04] dark:bg-white/[0.06]",
                "text-slate-600 dark:text-slate-400",
                mobileMenuOpen && "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
              )}
            >
              <FiMenu className="h-4 w-4" />
            </button>

            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full h-9 pl-9 pr-3 rounded-lg text-[14px] outline-none transition-all duration-150",
                  "bg-black/[0.04] dark:bg-white/[0.06]",
                  "text-slate-800 dark:text-slate-200",
                  "placeholder:text-slate-400 dark:placeholder:text-slate-500",
                  "focus:bg-white dark:focus:bg-slate-900",
                  "focus:ring-2 focus:ring-indigo-500/30"
                )}
              />
            </div>

            <button
              onClick={toggleSidebar}
              className={cn(
                "flex items-center justify-center h-9 px-3 rounded-lg transition-colors gap-1.5",
                "bg-black/[0.04] dark:bg-white/[0.06]",
                "text-slate-600 dark:text-slate-400",
                isSidebarOpen && "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
              )}
            >
              <FiSliders className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-500 text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile category chips (expandable) */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
                  {categoriesWithCounts.slice(0, 12).map((cat) => {
                    const isSelected = selectedCategories.includes(cat.category);
                    return (
                      <button
                        key={cat.category}
                        onClick={() => handleCategoryToggle(cat.category)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors",
                          isSelected 
                            ? "bg-indigo-500 text-white" 
                            : "bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {cat.category}
                      </button>
                    );
                  })}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetAllFilters}
                      className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
