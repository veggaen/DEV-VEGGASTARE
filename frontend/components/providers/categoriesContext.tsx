'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { fetchAllCategories, fetchPriceRange, fetchAllTitles } from '@/actions/fetch-categories';

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
  titles: string[];
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

export const CategoriesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [titles, setTitles] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedCategories, { min, max }, fetchedTitles] = await Promise.all([
          fetchAllCategories(),
          fetchPriceRange(),
          fetchAllTitles(),
        ]);
        setCategories(fetchedCategories);
        setTitles(fetchedTitles);

        if (minPrice === null) {
          setMinPrice(min);
        }

        if (maxPrice === null) {
          setMaxPrice(max);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, []);

  return (
    <CategoriesContext.Provider value={{
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
      titles
    }}>
      {children}
    </CategoriesContext.Provider>
  );
};

export const useCategories = () => {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error('useCategories must be used within a CategoriesProvider');
  }
  return context;
};