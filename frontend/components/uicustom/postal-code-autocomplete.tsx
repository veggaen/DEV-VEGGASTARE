'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapPin, Loader2, Navigation, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// TYPES
// =============================================================================

export interface PostalCodeSuggestion {
  postal_code: string;
  city: string;
  municipality?: string;
  county?: string;
  latitude?: string;
  longitude?: string;
}

interface PostalCodeAutocompleteProps {
  value: string;
  onChange: (postalCode: string, city?: string) => void;
  onSelect?: (suggestion: PostalCodeSuggestion) => void;
  onLocate?: () => Promise<boolean>;
  isLocating?: boolean;
  placeholder?: string;
  countryCode?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  /** If true, auto-detect location on mount with cooldown logic */
  autoDetectOnMount?: boolean;
  /** Show the prominent locate button */
  showLocateButton?: boolean;
}

// =============================================================================
// CACHE & CONSTANTS
// =============================================================================

const CACHE_KEY = 'veggat-location-cache';
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const COOLDOWN_KEY = 'veggat-location-cooldown';
const COOLDOWN_MS = 60 * 1000; // 1 minute between auto-detects

interface LocationCache {
  postalCode: string;
  city?: string;
  timestamp: number;
}

function getLocationCache(): LocationCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LocationCache;
    if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setLocationCache(postalCode: string, city?: string) {
  if (typeof window === 'undefined') return;
  try {
    const data: LocationCache = { postalCode, city, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function canAutoDetect(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const lastAttempt = localStorage.getItem(COOLDOWN_KEY);
    if (!lastAttempt) return true;
    return Date.now() - parseInt(lastAttempt, 10) > COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markAutoDetectAttempt() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
  } catch {
    // ignore
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PostalCodeAutocomplete({
  value,
  onChange,
  onSelect,
  onLocate,
  isLocating = false,
  placeholder = 'Postal code (e.g. 4310)',
  countryCode = 'no',
  disabled = false,
  className,
  error,
  autoDetectOnMount = false,
  showLocateButton = true,
}: PostalCodeAutocompleteProps) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<PostalCodeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasAutoDetected, setHasAutoDetected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync external value
  useEffect(() => {
    if (value !== query) {
      setQuery(value || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Auto-detect on mount with cache/cooldown
  useEffect(() => {
    if (!autoDetectOnMount || hasAutoDetected || !onLocate) return;
    
    setHasAutoDetected(true);

    // Check cache first
    const cached = getLocationCache();
    if (cached) {
      onChange(cached.postalCode, cached.city);
      setQuery(cached.postalCode);
      return;
    }

    // Check cooldown
    if (!canAutoDetect()) return;

    // Trigger auto-detect
    markAutoDetectAttempt();
    onLocate().then((success) => {
      // Cache will be set by the parent component via onChange
    });
  }, [autoDetectOnMount, hasAutoDetected, onLocate, onChange]);

  // Fetch suggestions as user types
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (searchQuery.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch(
        `/api/bring-shipping-suggest-postcode?postalCode=${encodeURIComponent(searchQuery)}&countryCode=${countryCode}`,
        { signal: abortRef.current.signal }
      );

      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      const results: PostalCodeSuggestion[] = data.postal_codes || [];
      
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[PostalCodeAutocomplete] Fetch error:', err);
      }
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [countryCode]);

  // Handle input change with debounce
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleInputChange = useCallback((newValue: string) => {
    // Only allow numeric input for postal codes
    const cleaned = newValue.replace(/\D/g, '').slice(0, 4);
    setQuery(cleaned);
    setSelectedIndex(-1);
    onChange(cleaned);

    // Debounce API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(cleaned);
    }, 150); // Fast response for good UX
  }, [onChange, fetchSuggestions]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: PostalCodeSuggestion) => {
    const postal = suggestion.postal_code;
    setQuery(postal);
    onChange(postal, suggestion.city);
    setShowSuggestions(false);
    setSuggestions([]);
    setLocationCache(postal, suggestion.city);
    onSelect?.(suggestion);
  }, [onChange, onSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && query.length >= 4) {
        // Just submit current value
        e.preventDefault();
        setShowSuggestions(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (suggestions.length === 1) {
          handleSelectSuggestion(suggestions[0]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, handleSelectSuggestion, query.length]);

  // Handle locate button
  const handleLocateClick = useCallback(async () => {
    if (!onLocate || isLocating || disabled) return;
    
    markAutoDetectAttempt();
    const success = await onLocate();
    
    if (success) {
      setShowSuggestions(false);
    }
  }, [onLocate, isLocating, disabled]);

  // Clear input
  const handleClear = useCallback(() => {
    setQuery('');
    onChange('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChange]);

  // Highlight matching portion
  const highlightMatch = useCallback((text: string, search: string) => {
    if (!search) return text;
    const idx = text.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {text.slice(idx, idx + search.length)}
        </span>
        {text.slice(idx + search.length)}
      </>
    );
  }, []);

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={placeholder}
            disabled={disabled || isLocating}
            className={cn(
              'pr-8 bg-white dark:bg-black/30',
              'border-gray-200 dark:border-white/10',
              'focus:ring-emerald-500/20 focus:border-emerald-500',
              error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
            )}
          />
          
          {/* Loading / Clear indicator */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : query.length > 0 ? (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Prominent Locate Button */}
        {showLocateButton && onLocate && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleLocateClick}
            disabled={disabled || isLocating}
            className={cn(
              'relative shrink-0 overflow-hidden',
              'bg-linear-to-br from-emerald-500/10 to-teal-500/10',
              'dark:from-emerald-500/20 dark:to-teal-500/20',
              'border-emerald-500/30 hover:border-emerald-500/50',
              'hover:from-emerald-500/20 hover:to-teal-500/20',
              'dark:hover:from-emerald-500/30 dark:hover:to-teal-500/30',
              'transition-all duration-200',
              isLocating && 'animate-pulse'
            )}
            title="Auto-detect my location"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Navigation className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            )}
            
            {/* Subtle pulse animation when idle */}
            {!isLocating && (
              <motion.div
                className="absolute inset-0 bg-emerald-500/10 rounded-md"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: [0.8, 1.2, 0.8], 
                  opacity: [0, 0.3, 0] 
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              />
            )}
          </Button>
        )}
      </div>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 w-full mt-1',
              'bg-white dark:bg-gray-900',
              'border border-gray-200 dark:border-white/10',
              'rounded-lg shadow-lg',
              'max-h-60 overflow-auto'
            )}
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.postal_code}-${index}`}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className={cn(
                  'w-full px-3 py-2.5 text-left transition-colors',
                  'flex items-center gap-3',
                  'hover:bg-gray-50 dark:hover:bg-white/5',
                  selectedIndex === index && 'bg-emerald-50 dark:bg-emerald-500/10'
                )}
              >
                <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono font-semibold text-gray-900 dark:text-white">
                      {highlightMatch(suggestion.postal_code, query)}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {suggestion.city}
                    </span>
                  </div>
                  {suggestion.municipality && suggestion.municipality !== suggestion.city && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {suggestion.municipality}
                      {suggestion.county && `, ${suggestion.county}`}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}

export default PostalCodeAutocomplete;
