'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define the Seller interface
interface Seller {
  id: string;
  name: string;
  type: 'user' | 'company';
}

// Define the context type
interface CategoriesContextType {
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCategories: string[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
  minPrice: number | null;
  setMinPrice: React.Dispatch<React.SetStateAction<number | null>>;
  maxPrice: number | null;
  setMaxPrice: React.Dispatch<React.SetStateAction<number | null>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  sellers: Seller[];
  setSellers: React.Dispatch<React.SetStateAction<Seller[]>>;
  selectedSellers: string[];
  setSelectedSellers: React.Dispatch<React.SetStateAction<string[]>>;
}

// Create the context
const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

// Provider component
export const CategoriesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories, sellers, and price range from your API
        const [fetchedCategories, fetchedPriceRange, fetchedSellers] = await Promise.all([
          fetch('/api/categories').then((res) => res.json()),
          fetch('/api/price-range').then((res) => res.json()),
          fetch('/api/products/sellers').then((res) => res.json()),
        ]);

        setCategories(fetchedCategories);
        setSellers(fetchedSellers);

        if (minPrice === null) {
          setMinPrice(fetchedPriceRange.min);
        }

        if (maxPrice === null) {
          setMaxPrice(fetchedPriceRange.max);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
  }, [minPrice, maxPrice]);

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        setCategories,
        selectedCategories,
        setSelectedCategories,
        minPrice,
        setMinPrice,
        maxPrice,
        setMaxPrice,
        searchTerm,
        setSearchTerm,
        sellers,
        setSellers,
        selectedSellers,
        setSelectedSellers,
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
