'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown, FiGrid, FiTag, FiTrendingUp, FiPercent, FiStar, FiGift } from 'react-icons/fi';
import { useCategories, CategoryWithCount } from '@/components/providers/categoriesContext';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Define category groups with icons for better organization
const CATEGORY_GROUPS: {
  label: string;
  icon: React.ElementType;
  categories: string[];
  color: string;
}[] = [
  {
    label: 'Electronics',
    icon: FiGrid,
    categories: ['Electronics', 'Computers', 'Phones', 'Audio', 'Gaming', 'Cameras', 'Accessories'],
    color: 'from-blue-500 to-cyan-500',
  },
  {
    label: 'Fashion',
    icon: FiTag,
    categories: ['Clothing', 'Shoes', 'Bags', 'Jewelry', 'Watches', 'Accessories'],
    color: 'from-pink-500 to-rose-500',
  },
  {
    label: 'Home & Living',
    icon: FiGift,
    categories: ['Furniture', 'Kitchen', 'Decor', 'Garden', 'Tools', 'Appliances'],
    color: 'from-amber-500 to-orange-500',
  },
  {
    label: 'Sports',
    icon: FiTrendingUp,
    categories: ['Fitness', 'Outdoor', 'Sports Equipment', 'Cycling', 'Camping'],
    color: 'from-green-500 to-emerald-500',
  },
];

// Quick filter buttons
const QUICK_FILTERS = [
  { label: 'Deals', icon: FiPercent, href: '/products/daily-deals' },
  { label: 'New', icon: FiStar, href: '/products?sort=newest' },
  { label: 'Member Discount', icon: FiGift, href: '/products/member-discount' },
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

  // Filter to only show categories that exist in available categories
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
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  // Close on click outside
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

  // Don't render if no matching categories
  if (matchingCategories.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          "hover:bg-white/60 dark:hover:bg-white/[0.08]",
          isOpen && "bg-white/60 dark:bg-white/[0.08]",
          hasActiveSelection && "text-indigo-600 dark:text-indigo-400"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{group.label}</span>
        <FiChevronDown 
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full left-0 mt-1 z-50 min-w-[200px] max-w-[280px]"
          >
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
              {/* Header with gradient */}
              <div className={cn("px-3 py-2 bg-gradient-to-r text-white text-xs font-medium", group.color)}>
                {group.label} Categories
              </div>
              
              <div className="p-2 max-h-[300px] overflow-y-auto">
                {matchingCategories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.category);
                  return (
                    <button
                      key={cat.category}
                      onClick={() => onCategoryToggle(cat.category)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                        "hover:bg-zinc-100 dark:hover:bg-white/[0.06]",
                        isSelected && "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      )}
                    >
                      <span className="truncate">{cat.category}</span>
                      <span className={cn(
                        "text-xs tabular-nums px-1.5 py-0.5 rounded-full",
                        isSelected 
                          ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                          : "bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400"
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

// All categories dropdown for uncategorized items
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
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
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
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          "hover:bg-white/60 dark:hover:bg-white/[0.08]",
          isOpen && "bg-white/60 dark:bg-white/[0.08]",
          selectedCategories.length > 0 && "text-indigo-600 dark:text-indigo-400"
        )}
      >
        <FiGrid className="h-4 w-4" />
        <span>All Categories</span>
        <FiChevronDown 
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full left-0 mt-1 z-50 min-w-[220px] max-w-[300px]"
          >
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
              <div className="px-3 py-2 bg-gradient-to-r from-zinc-600 to-zinc-700 text-white text-xs font-medium">
                Browse All Categories
              </div>
              
              <div className="p-2 max-h-[350px] overflow-y-auto">
                {categories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.category);
                  return (
                    <button
                      key={cat.category}
                      onClick={() => onCategoryToggle(cat.category)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                        "hover:bg-zinc-100 dark:hover:bg-white/[0.06]",
                        isSelected && "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      )}
                    >
                      <span className="truncate">{cat.category}</span>
                      <span className={cn(
                        "text-xs tabular-nums px-1.5 py-0.5 rounded-full",
                        isSelected 
                          ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                          : "bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400"
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

export function CategorySubBar() {
  const { 
    categoriesWithCounts, 
    categoriesLoading, 
    selectedCategories, 
    setSelectedCategories,
    activeFilterCount,
    resetAllFilters
  } = useCategories();

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  if (categoriesLoading) {
    return (
      <div className="border-b border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-screen-2xl px-3 sm:px-4 md:px-6">
          <div className="flex items-center gap-2 py-2 overflow-x-auto">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 w-24 rounded-lg bg-zinc-200/50 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-black/5 dark:border-white/5 bg-gradient-to-r from-zinc-50/80 via-white/60 to-zinc-50/80 dark:from-zinc-900/40 dark:via-zinc-800/30 dark:to-zinc-900/40">
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
          {/* All Categories dropdown */}
          <AllCategoriesDropdown
            categories={categoriesWithCounts}
            selectedCategories={selectedCategories}
            onCategoryToggle={handleCategoryToggle}
          />

          {/* Divider */}
          <div className="h-5 w-px bg-black/10 dark:bg-white/10 mx-1 hidden sm:block" />

          {/* Category group dropdowns */}
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
          <div className="flex-1" />

          {/* Quick filter links */}
          <div className="hidden lg:flex items-center gap-1">
            {QUICK_FILTERS.map(filter => {
              const Icon = filter.icon;
              return (
                <Link
                  key={filter.label}
                  href={filter.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    "text-zinc-600 dark:text-zinc-400",
                    "hover:bg-white/60 dark:hover:bg-white/[0.08] hover:text-zinc-900 dark:hover:text-zinc-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{filter.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Active filters badge & clear */}
          <AnimatePresence>
            {activeFilterCount > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={resetAllFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-colors"
              >
                <span>{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}</span>
                <span className="text-indigo-500">×</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
