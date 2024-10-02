'use client';

import React, { useState } from 'react';
import { useCategories } from "@/components/providers/categoriesContext";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useSidebar } from '@/components/providers/product-layoutProvider';

export const MySidebarProductsMenu = () => {
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const {
    categories,
    selectedCategories,
    setSelectedCategories,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    searchTerm,
    setSearchTerm,
  } = useCategories();

  const [isPriceOpen, setIsPriceOpen] = useState(true);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true);

  // Toggle functions
  const togglePriceSection = () => setIsPriceOpen((prev) => !prev);
  const toggleCategoriesSection = () => setIsCategoriesOpen((prev) => !prev);

  // Handle category selection
  const handleCategoryChange = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Reset price filters
  const handleResetPrice = () => {
    setMinPrice(null);
    setMaxPrice(null);
  };

  return (
    <>
      {/* Overlay for small screens */}
      {isSidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full max-w-[300px] w-full bg-white dark:bg-gray-800 shadow-md z-50 transform transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Search Input */}
          <div className="p-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Price Filter */}
          <div className="px-4">
            <button
              onClick={togglePriceSection}
              className="flex justify-between items-center w-full text-lg font-semibold text-gray-700 dark:text-gray-200 focus:outline-none"
            >
              <span>Price</span>
              {isPriceOpen ? (
                <ArrowUpIcon className="w-5 h-5" />
              ) : (
                <ArrowDownIcon className="w-5 h-5" />
              )}
            </button>
            {isPriceOpen && (
              <div className="mt-4 space-y-2">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice !== null ? minPrice : ''}
                    onChange={(e) =>
                      setMinPrice(e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="w-1/2 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice !== null ? maxPrice : ''}
                    onChange={(e) =>
                      setMaxPrice(e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="w-1/2 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleResetPrice}
                  className="w-full bg-blue-500 text-white rounded-md px-3 py-2 mt-2 hover:bg-blue-600 focus:outline-none"
                >
                  Reset Price
                </button>
              </div>
            )}
          </div>

          {/* Categories Filter */}
          <div className="flex-1 flex flex-col overflow-y-hidden px-4 mt-6">
            <button
              onClick={toggleCategoriesSection}
              className="flex justify-between items-center w-full text-lg font-semibold text-gray-700 dark:text-gray-200 focus:outline-none"
            >
              <span>Categories</span>
              {isCategoriesOpen ? (
                <ArrowUpIcon className="w-5 h-5" />
              ) : (
                <ArrowDownIcon className="w-5 h-5" />
              )}
            </button>
            {isCategoriesOpen && (
              <div className="mt-4 flex-1 overflow-y-auto space-y-2">
                {categories.map((category, index) => (
                  <label key={index} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => handleCategoryChange(category)}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-200 capitalize">
                      {category}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};