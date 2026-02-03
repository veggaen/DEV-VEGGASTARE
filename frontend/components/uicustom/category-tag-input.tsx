'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Check, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CategorySuggestion } from '@/lib/types/categories';

export interface CategoryTag {
  id?: string; // For existing categories
  name: string;
  slug?: string;
  isNew?: boolean; // True if user is creating a new category
  parentId?: string | null;
  parentName?: string | null;
}

interface CategoryTagInputProps {
  value: CategoryTag[];
  onChange: (tags: CategoryTag[]) => void;
  disabled?: boolean;
  placeholder?: string;
  maxTags?: number;
  className?: string;
  error?: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function CategoryTagInput({
  value = [],
  onChange,
  disabled = false,
  placeholder = 'Add category...',
  maxTags = 10,
  className,
  error,
}: CategoryTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSimilarWarning, setShowSimilarWarning] = useState<CategorySuggestion | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedInput = useDebounce(inputValue, 200);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSimilarWarning(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/categories/suggest?q=${encodeURIComponent(query)}&limit=8`);
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data: CategorySuggestion[] = await res.json();
      
      // Filter out already selected categories
      const filtered = data.filter(
        (s) => !value.some((v) => v.id === s.id || v.name.toLowerCase() === s.name.toLowerCase())
      );
      
      setSuggestions(filtered);

      // Check for similar existing category (fuzzy match warning)
      const almostMatch = filtered.find(
        (s) => s.similarity >= 0.7 && !s.isExactMatch
      );
      setShowSimilarWarning(almostMatch || null);
      
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [value]);

  useEffect(() => {
    fetchSuggestions(debouncedInput);
  }, [debouncedInput, fetchSuggestions]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add a tag
  const addTag = (tag: CategoryTag) => {
    if (value.length >= maxTags) return;
    
    // Check if already exists
    if (value.some((v) => v.name.toLowerCase() === tag.name.toLowerCase())) {
      return;
    }

    onChange([...value, tag]);
    setInputValue('');
    setSuggestions([]);
    setSelectedIndex(-1);
    setShowSimilarWarning(null);
  };

  // Remove a tag
  const removeTag = (index: number) => {
    const newTags = [...value];
    newTags.splice(index, 1);
    onChange(newTags);
  };

  // Handle selecting a suggestion
  const selectSuggestion = (suggestion: CategorySuggestion) => {
    addTag({
      id: suggestion.id,
      name: suggestion.name,
      slug: suggestion.slug,
      isNew: false,
      parentName: suggestion.parentName,
    });
  };

  // Create new category from input
  const createNewTag = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // If there's a very similar match, use that instead
    if (showSimilarWarning && showSimilarWarning.similarity >= 0.9) {
      selectSuggestion(showSimilarWarning);
      return;
    }

    addTag({
      name: trimmed,
      isNew: true,
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          selectSuggestion(suggestions[selectedIndex]);
        } else if (inputValue.trim()) {
          createNewTag();
        }
        break;
      case 'Escape':
        setIsFocused(false);
        setSuggestions([]);
        break;
      case 'Backspace':
        if (!inputValue && value.length > 0) {
          removeTag(value.length - 1);
        }
        break;
      case ',':
      case 'Tab':
        if (inputValue.trim()) {
          e.preventDefault();
          createNewTag();
        }
        break;
    }
  };

  const showDropdown = isFocused && (suggestions.length > 0 || inputValue.trim());

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Tags container */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex flex-wrap items-center gap-1.5 min-h-10 px-3 py-2 rounded-md border',
          'bg-background cursor-text transition-colors',
          isFocused ? 'border-primary ring-1 ring-primary' : 'border-input',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-destructive'
        )}
      >
        {/* Existing tags */}
        {value.map((tag, idx) => (
          <Badge
            key={`${tag.name}-${idx}`}
            variant={tag.isNew ? 'secondary' : 'default'}
            className={cn(
              'flex items-center gap-1 pr-1 text-xs font-medium',
              tag.isNew && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
            )}
          >
            {tag.parentName && (
              <span className="text-muted-foreground flex items-center">
                {tag.parentName}
                <ChevronRight className="h-3 w-3 mx-0.5" />
              </span>
            )}
            {tag.name}
            {tag.isNew && <span className="text-[10px] opacity-70 ml-1">(ny)</span>}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(idx);
                }}
                className="ml-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        {/* Input */}
        {value.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={value.length === 0 ? placeholder : ''}
            className={cn(
              'flex-1 min-w-[120px] bg-transparent outline-none text-sm',
              'placeholder:text-muted-foreground'
            )}
          />
        )}

        {/* Loading indicator */}
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Suggestions dropdown */}
      {showDropdown && (
        <div
          ref={suggestionsRef}
          className={cn(
            'absolute z-50 w-full mt-1 py-1 rounded-md border shadow-lg',
            'bg-popover border-border max-h-[240px] overflow-y-auto'
          )}
        >
          {/* Similar match warning */}
          {showSimilarWarning && !suggestions.find((s) => s.isExactMatch) && (
            <div className="px-3 py-2 border-b border-border bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Lignende kategori finnes</p>
                  <p className="opacity-80">
                    Mente du &quot;{showSimilarWarning.name}&quot;?
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions list */}
          {suggestions.map((suggestion, idx) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => selectSuggestion(suggestion)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2',
                'hover:bg-accent transition-colors',
                selectedIndex === idx && 'bg-accent'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {suggestion.isExactMatch && (
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                )}
                <span className="truncate">
                  {suggestion.parentName && (
                    <span className="text-muted-foreground">
                      {suggestion.parentName}
                      <ChevronRight className="inline h-3 w-3 mx-0.5" />
                    </span>
                  )}
                  {suggestion.name}
                </span>
              </div>
              {suggestion.productCount !== undefined && suggestion.productCount > 0 && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {suggestion.productCount} produkt{suggestion.productCount !== 1 ? 'er' : ''}
                </span>
              )}
            </button>
          ))}

          {/* Create new option */}
          {inputValue.trim() && !suggestions.find((s) => s.isExactMatch) && (
            <button
              type="button"
              onClick={createNewTag}
              className={cn(
                'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                'hover:bg-accent transition-colors border-t border-border',
                selectedIndex === suggestions.length && 'bg-accent'
              )}
            >
              <Plus className="h-4 w-4 text-primary" />
              <span>
                Opprett &quot;<span className="font-medium">{inputValue.trim()}</span>&quot;
              </span>
              <span className="text-xs text-muted-foreground ml-auto">(ny kategori)</span>
            </button>
          )}

          {/* Empty state */}
          {!isLoading && suggestions.length === 0 && !inputValue.trim() && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Begynn å skrive for å søke eller opprette kategorier
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}

      {/* Helper text */}
      <p className="mt-1 text-xs text-muted-foreground">
        Trykk Enter eller , for å legge til. Maks {maxTags} kategorier.
      </p>
    </div>
  );
}
