'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  searchAddresses,
  lookupPostalCode,
  type BringAddressSuggestion,
} from '@/lib/bring-address';
import {
  MapPin,
  Loader2,
  Search,
  Building2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// =============================================================================
// TYPES
// =============================================================================

export interface AddressData {
  addressLine1: string; // Street address + number
  addressLine2?: string; // Apartment, suite, unit, floor
  postalCode: string;
  city: string;
  municipality?: string;
  county?: string;
  country: string;
  latitude?: string;
  longitude?: string;
}

interface AddressInputProps {
  value?: Partial<AddressData>;
  onChange: (address: Partial<AddressData>) => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  label?: string;
  placeholder?: string;
  error?: string;
  /** Show apartment/suite field (addressLine2) */
  showAddressLine2?: boolean;
  /** Hint text below the input */
  hint?: string;
}

// =============================================================================
// SIMPLE UNIFIED ADDRESS INPUT
// =============================================================================

/**
 * Create unique key for address to detect duplicates
 */
function getAddressKey(s: BringAddressSuggestion): string {
  return `${s.street}-${s.street_number || ''}-${s.letter || ''}-${s.postal_code}`.toLowerCase();
}

/**
 * Deduplicate suggestions based on full address
 */
function deduplicateSuggestions(suggestions: BringAddressSuggestion[]): BringAddressSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter(s => {
    const key = getAddressKey(s);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function AddressInput({
  value = {},
  onChange,
  onValidationChange,
  disabled = false,
  required = false,
  className,
  label = 'Ship from location',
  placeholder = 'Start typing address...',
  error,
  showAddressLine2 = true,
  hint = 'Search via Bring API or enter manually. Supports street + number + letter (e.g., 5B).',
}: AddressInputProps) {
  // State
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<BringAddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isExpanded, setIsExpanded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine if we have a complete address
  const hasCompleteAddress = !!(value.addressLine1 && value.postalCode && value.city);

  // Format display string
  const displayAddress = hasCompleteAddress
    ? [value.addressLine1, value.addressLine2, `${value.postalCode} ${value.city}`]
        .filter(Boolean)
        .join(', ')
    : '';

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

  // Search addresses as user types
  const handleSearchChange = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);
    setSelectedIndex(-1);

    if (searchQuery.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchAddresses(searchQuery);
      // Deduplicate results
      const unique = deduplicateSuggestions(results);
      setSuggestions(unique);
      setShowSuggestions(unique.length > 0);
    } catch (err) {
      console.error('[AddressInput] Search error:', err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(
    (suggestion: BringAddressSuggestion) => {
      const streetWithNumber = [
        suggestion.street,
        suggestion.street_number,
        suggestion.letter,
      ].filter(Boolean).join(' ').trim();

      const newAddress: Partial<AddressData> = {
        addressLine1: streetWithNumber || suggestion.street,
        addressLine2: value.addressLine2, // Preserve existing
        postalCode: suggestion.postal_code,
        city: suggestion.city,
        municipality: suggestion.municipality,
        county: suggestion.county,
        country: suggestion.country || 'NO',
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      };

      onChange(newAddress);
      setQuery(''); // Clear search
      setShowSuggestions(false);
      setSuggestions([]);
      setIsExpanded(true); // Show the details after selection
      onValidationChange?.(true);
    },
    [onChange, onValidationChange, value.addressLine2]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSelectSuggestion(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    },
    [showSuggestions, suggestions, selectedIndex, handleSelectSuggestion]
  );

  // Handle postal code blur - auto-fill city
  const handlePostalCodeBlur = useCallback(async () => {
    if (!value.postalCode || value.postalCode.length < 4) return;
    if (value.city) return; // Already has city

    try {
      const postalData = await lookupPostalCode(value.postalCode);
      if (postalData) {
        onChange({
          ...value,
          city: postalData.city,
          municipality: postalData.municipality,
          county: postalData.county,
        });
      }
    } catch (err) {
      console.error('[AddressInput] Postal lookup error:', err);
    }
  }, [value, onChange]);

  // Manual field updates
  const updateField = useCallback(
    (field: keyof AddressData, fieldValue: string) => {
      onChange({ ...value, [field]: fieldValue });
    },
    [value, onChange]
  );

  return (
    <div ref={wrapperRef} className={cn('space-y-3', className)}>
      {/* Label with info tooltip */}
      {label && (
        <div className="flex items-center gap-1.5">
          <Label className="text-sm text-muted-foreground">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {hint && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  {hint}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Search input with autocomplete */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pl-10 pr-10',
            error && 'border-red-500 focus-visible:ring-red-500'
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.postal_code}-${suggestion.street}-${suggestion.street_number || ''}-${suggestion.letter || ''}-${index}`}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors',
                  'flex flex-col gap-0.5',
                  selectedIndex === index && 'bg-muted'
                )}
              >
                <span className="font-medium">
                  {suggestion.street} {suggestion.street_number}{suggestion.letter && <span className="text-amber-500 font-semibold">{suggestion.letter}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {suggestion.postal_code} {suggestion.city}
                  {suggestion.municipality && `, ${suggestion.municipality}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Address summary with expand button */}
      {hasCompleteAddress && (
        <div className="border border-border rounded-md overflow-hidden">
          {/* Summary header - always visible */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{value.addressLine1}</p>
                {value.addressLine2 && (
                  <p className="text-muted-foreground text-xs">{value.addressLine2}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  {value.postalCode} {value.city}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{isExpanded ? 'Hide' : 'Edit'}</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </button>

          {/* Expanded edit fields */}
          {isExpanded && (
            <div className="p-3 border-t border-border space-y-3 bg-muted/10">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Street Address
                </Label>
                <Input
                  type="text"
                  value={value.addressLine1 || ''}
                  onChange={(e) => updateField('addressLine1', e.target.value)}
                  placeholder="Street name and number"
                  disabled={disabled}
                  className="text-sm"
                />
              </div>

              {showAddressLine2 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Delivery note{' '}
                    <span className="text-muted-foreground/60">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={value.addressLine2 || ''}
                      onChange={(e) => updateField('addressLine2', e.target.value)}
                      placeholder="Apt 4B, green mailbox, ring doorbell..."
                      disabled={disabled}
                      className="pl-10 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Postal Code
                  </Label>
                  <Input
                    type="text"
                    value={value.postalCode || ''}
                    onChange={(e) => updateField('postalCode', e.target.value)}
                    onBlur={handlePostalCodeBlur}
                    placeholder="0000"
                    disabled={disabled}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">City</Label>
                  <Input
                    type="text"
                    value={value.city || ''}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="City"
                    disabled={disabled}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual entry when no address selected yet */}
      {!hasCompleteAddress && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {isExpanded ? 'Hide manual entry' : 'Or enter address manually'}
          </button>

          {isExpanded && (
            <div className="space-y-3 p-3 border border-border rounded-md bg-muted/10">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Street Address
                </Label>
                <Input
                  type="text"
                  value={value.addressLine1 || ''}
                  onChange={(e) => updateField('addressLine1', e.target.value)}
                  placeholder="Street name and number"
                  disabled={disabled}
                  className="text-sm"
                />
              </div>

              {showAddressLine2 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Delivery note{' '}
                    <span className="text-muted-foreground/60">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={value.addressLine2 || ''}
                      onChange={(e) => updateField('addressLine2', e.target.value)}
                      placeholder="Apt 4B, green mailbox, ring doorbell..."
                      disabled={disabled}
                      className="pl-10 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Postal Code
                  </Label>
                  <Input
                    type="text"
                    value={value.postalCode || ''}
                    onChange={(e) => updateField('postalCode', e.target.value)}
                    onBlur={handlePostalCodeBlur}
                    placeholder="0000"
                    disabled={disabled}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">City</Label>
                  <Input
                    type="text"
                    value={value.city || ''}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="City"
                    disabled={disabled}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default AddressInput;
