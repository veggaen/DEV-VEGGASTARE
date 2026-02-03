'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FiMapPin, FiSearch, FiX, FiLoader, FiNavigation } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AddressSuggestion {
  id: string;
  street?: string;
  houseNumber?: string;
  letter?: string;
  postalCode: string;
  city: string;
  county?: string;
  municipality?: string;
  type: 'STREET' | 'PLACE' | 'PO_BOX' | 'POSTAL_PLACE';
  coords?: { latitude: number; longitude: number };
  display: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  onLocate?: () => void;
  isLocating?: boolean;
  placeholder?: string;
  countryCode?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onLocate,
  isLocating,
  placeholder = 'Enter address or postal code...',
  countryCode = 'no',
  className,
  disabled,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced fetch
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Determine if it's a postal code or address search
      const isPostalCode = /^\d{4}$/.test(query.trim());
      const type = isPostalCode ? 'streets' : 'suggestions';

      const response = await fetch(
        `/api/bring-address?q=${encodeURIComponent(query)}&country=${countryCode}&type=${type}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setSuggestions([]);
      } else {
        setSuggestions(data.suggestions || []);
        setIsOpen(data.suggestions?.length > 0);
      }
    } catch (err) {
      console.error('[AddressAutocomplete] Error:', err);
      setError('Could not load suggestions');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [countryCode]);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setHighlightedIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter' && value.trim()) {
        // Allow manual entry with Enter
        onSelect({
          id: 'manual',
          postalCode: value.trim(),
          city: '',
          type: 'POSTAL_PLACE',
          display: value.trim(),
        });
        setIsOpen(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          handleSelect(suggestions[highlightedIndex]);
        } else if (suggestions.length > 0) {
          handleSelect(suggestions[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Handle selection
  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.display);
    onSelect(suggestion);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        listRef.current && 
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  return (
    <div className={cn('relative', className)}>
      {/* Input group */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-muted-foreground">
          {isLoading ? (
            <FiLoader className="h-4 w-4 animate-spin" />
          ) : (
            <FiSearch className="h-4 w-4" />
          )}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full pl-10 pr-20 py-2.5 rounded-lg text-sm',
            'bg-surface-2 dark:bg-white/5',
            'border border-border dark:border-white/10',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500',
            'transition-all duration-200',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />

        {/* Action buttons */}
        <div className="absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setSuggestions([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Clear"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          )}
          
          {onLocate && (
            <button
              type="button"
              onClick={onLocate}
              disabled={isLocating || disabled}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                isLocating 
                  ? 'text-emerald-500 animate-pulse' 
                  : 'text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10'
              )}
              aria-label="Use my location"
              title="Use my location"
            >
              {isLocating ? (
                <FiLoader className="h-4 w-4 animate-spin" />
              ) : (
                <FiNavigation className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          {error}
        </p>
      )}

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 w-full mt-1 py-1',
              'bg-background dark:bg-zinc-900',
              'border border-border dark:border-white/10',
              'rounded-lg shadow-lg',
              'max-h-64 overflow-y-auto'
            )}
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSelect(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  'w-full px-3 py-2.5 text-left flex items-start gap-3',
                  'transition-colors duration-100',
                  highlightedIndex === index
                    ? 'bg-emerald-500/10 text-foreground'
                    : 'hover:bg-muted/50 text-foreground'
                )}
                role="option"
                aria-selected={highlightedIndex === index}
              >
                <FiMapPin className={cn(
                  'h-4 w-4 mt-0.5 shrink-0',
                  highlightedIndex === index 
                    ? 'text-emerald-500' 
                    : 'text-muted-foreground'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {suggestion.street 
                      ? `${suggestion.street}${suggestion.houseNumber ? ` ${suggestion.houseNumber}${suggestion.letter || ''}` : ''}`
                      : suggestion.city || suggestion.postalCode
                    }
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {suggestion.postalCode} {suggestion.city}
                    {suggestion.municipality && suggestion.municipality !== suggestion.city && 
                      `, ${suggestion.municipality}`
                    }
                  </div>
                </div>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded uppercase font-medium shrink-0',
                  suggestion.type === 'STREET' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                  suggestion.type === 'PLACE' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  suggestion.type === 'POSTAL_PLACE' && 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                  suggestion.type === 'PO_BOX' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                )}>
                  {suggestion.type.replace('_', ' ')}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No results */}
      {isOpen && !isLoading && value.length >= 2 && suggestions.length === 0 && !error && (
        <div className="absolute z-50 w-full mt-1 py-3 px-4 bg-background dark:bg-zinc-900 border border-border dark:border-white/10 rounded-lg shadow-lg">
          <p className="text-sm text-muted-foreground text-center">
            No addresses found. Try entering a postal code.
          </p>
        </div>
      )}
    </div>
  );
}

export default AddressAutocomplete;

