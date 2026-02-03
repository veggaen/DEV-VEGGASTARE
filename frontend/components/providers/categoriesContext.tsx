'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

// Define the Seller interface (with count)
export interface Seller {
  id: string;
  name: string;
  type: 'user' | 'company';
  count: number;
}

// Define the CategoryWithCount interface
export interface CategoryWithCount {
  category: string;
  count: number;
}

// Define the context type
interface CategoriesContextType {
  // Categories with counts
  categoriesWithCounts: CategoryWithCount[];
  categoriesLoading: boolean;
  // Legacy categories array (for backwards compatibility)
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCategories: string[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
  // Price filters
  minPrice: number | null;
  setMinPrice: React.Dispatch<React.SetStateAction<number | null>>;
  maxPrice: number | null;
  setMaxPrice: React.Dispatch<React.SetStateAction<number | null>>;
  initialPriceRange: { min: number; max: number } | null;
  // Search
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  // Sellers
  sellers: Seller[];
  setSellers: React.Dispatch<React.SetStateAction<Seller[]>>;
  sellersLoading: boolean;
  selectedSellers: string[];
  setSelectedSellers: React.Dispatch<React.SetStateAction<string[]>>;
  // Reset functions
  resetAllFilters: () => void;
  resetPriceFilters: () => void;
  resetCategoryFilters: () => void;
  resetSellerFilters: () => void;
  // Active filter count
  activeFilterCount: number;
}

// Create the context
const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

// Provider component
export const CategoriesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Categories with counts (new)
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  // Legacy categories array
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Price
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [initialPriceRange, setInitialPriceRange] = useState<{ min: number; max: number } | null>(null);
  // Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  // Sellers
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setCategoriesLoading(true);
        setSellersLoading(true);

        const [fetchedCategoriesWithCounts, fetchedPriceRange, fetchedSellers] = await Promise.all([
          fetch('/api/categories-with-counts').then((res) => (res.ok ? res.json() : [])),
          fetch('/api/price-range').then((res) => (res.ok ? res.json() : null)),
          fetch('/api/products/sellers').then((res) => (res.ok ? res.json() : [])),
        ]);

        // Set categories with counts
        if (Array.isArray(fetchedCategoriesWithCounts)) {
          setCategoriesWithCounts(fetchedCategoriesWithCounts);
          // Also set legacy categories array for backwards compatibility
          setCategories(fetchedCategoriesWithCounts.map((c: CategoryWithCount) => c.category));
        }

        setSellers(fetchedSellers || []);

        // Store initial price range for reset functionality
        if (
          fetchedPriceRange &&
          typeof fetchedPriceRange.min === 'number' &&
          typeof fetchedPriceRange.max === 'number'
        ) {
          setInitialPriceRange({ min: fetchedPriceRange.min, max: fetchedPriceRange.max });
          if (minPrice === null) setMinPrice(fetchedPriceRange.min);
          if (maxPrice === null) setMaxPrice(fetchedPriceRange.max);
        }
      } catch (error) {
        console.error('Failed to fetch filter data:', error);
      } finally {
        setCategoriesLoading(false);
        setSellersLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch dynamic counts when filters change
  useEffect(() => {
    // Skip if we haven't loaded initial data yet
    if (categoriesLoading || sellersLoading) return;

    const fetchDynamicCounts = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedCategories.length > 0) {
          params.set('selectedCategories', selectedCategories.join(','));
        }
        if (selectedSellers.length > 0) {
          params.set('selectedSellers', selectedSellers.join(','));
        }
        if (typeof minPrice === 'number' && Number.isFinite(minPrice)) {
          params.set('minPrice', String(minPrice));
        }
        if (typeof maxPrice === 'number' && Number.isFinite(maxPrice) && maxPrice !== Infinity) {
          params.set('maxPrice', String(maxPrice));
        }
        if (searchTerm) {
          params.set('searchTerm', searchTerm);
        }

        const response = await fetch(`/api/filter-counts?${params}`);
        if (!response.ok) throw new Error('Failed to fetch counts');

        const data = await response.json();

        // Update counts while preserving category/seller order
        if (data.categories) {
          setCategoriesWithCounts((prev) =>
            prev.map((cat) => {
              const updated = data.categories.find((c: CategoryWithCount) => c.category === cat.category);
              return updated ? { ...cat, count: updated.count } : cat;
            })
          );
        }
        if (data.sellers) {
          setSellers((prev) =>
            prev.map((seller) => {
              const updated = data.sellers.find((s: Seller) => s.id === seller.id);
              return updated ? { ...seller, count: updated.count } : seller;
            })
          );
        }
      } catch (error) {
        console.error('Failed to fetch dynamic filter counts:', error);
      }
    };

    // Debounce to avoid too many requests
    const timeoutId = setTimeout(fetchDynamicCounts, 150);
    return () => clearTimeout(timeoutId);
  }, [selectedCategories, selectedSellers, minPrice, maxPrice, searchTerm, categoriesLoading, sellersLoading]);

  // Reset functions
  const resetPriceFilters = useCallback(() => {
    if (initialPriceRange) {
      setMinPrice(initialPriceRange.min);
      setMaxPrice(initialPriceRange.max);
    } else {
      setMinPrice(null);
      setMaxPrice(null);
    }
  }, [initialPriceRange]);

  const resetCategoryFilters = useCallback(() => {
    setSelectedCategories([]);
  }, []);

  const resetSellerFilters = useCallback(() => {
    setSelectedSellers([]);
  }, []);

  const resetAllFilters = useCallback(() => {
    resetPriceFilters();
    resetCategoryFilters();
    resetSellerFilters();
    setSearchTerm('');
  }, [resetPriceFilters, resetCategoryFilters, resetSellerFilters]);

  // Calculate active filter count
  const activeFilterCount =
    selectedCategories.length +
    selectedSellers.length +
    (searchTerm ? 1 : 0) +
    (initialPriceRange && (minPrice !== initialPriceRange.min || maxPrice !== initialPriceRange.max) ? 1 : 0);

  return (
    <CategoriesContext.Provider
      value={{
        categoriesWithCounts,
        categoriesLoading,
        categories,
        setCategories,
        selectedCategories,
        setSelectedCategories,
        minPrice,
        setMinPrice,
        maxPrice,
        setMaxPrice,
        initialPriceRange,
        searchTerm,
        setSearchTerm,
        sellers,
        setSellers,
        sellersLoading,
        selectedSellers,
        setSelectedSellers,
        resetAllFilters,
        resetPriceFilters,
        resetCategoryFilters,
        resetSellerFilters,
        activeFilterCount,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
};

// Custom hook to use the context
export const useCategories = () => {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error('useCategories must be used within a CategoriesProvider');
  }
  return context;
};
