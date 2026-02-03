'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  searchAddresses, 
  lookupPostalCode, 
  formatAddress,
  type BringAddressSuggestion,
  type ShippingAddress 
} from '@/lib/bring-address';
import { MapPin, Loader2, Check } from 'lucide-react';

interface AddressAutocompleteProps {
  value?: Partial<ShippingAddress>;
  onChange: (address: Partial<ShippingAddress>) => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  showFullAddress?: boolean; // Show all fields or just street + postal
  className?: string;
  label?: string;
  placeholder?: string;
  error?: string;
}

export function AddressAutocomplete({
  value = {},
  onChange,
  onValidationChange,
  disabled = false,
  required = false,
  showFullAddress = true,
  className,
  label = 'Address',
  placeholder = 'Start typing an address...',
  error,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<BringAddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    
    if (searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchAddresses(searchQuery);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('[AddressAutocomplete] Search error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: BringAddressSuggestion) => {
    const newAddress: Partial<ShippingAddress> = {
      streetAddress: suggestion.street,
      streetNumber: suggestion.street_number,
      postalCode: suggestion.postal_code,
      city: suggestion.city,
      municipality: suggestion.municipality,
      county: suggestion.county,
      country: suggestion.country,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    };

    onChange(newAddress);
    setQuery(formatAddress(newAddress));
    setShowSuggestions(false);
    setSuggestions([]);
    onValidationChange?.(true);
  }, [onChange, onValidationChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
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
  }, [showSuggestions, suggestions, selectedIndex, handleSelectSuggestion]);

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
    } catch (error) {
      console.error('[AddressAutocomplete] Postal lookup error:', error);
    }
  }, [value, onChange]);

  // Manual field updates
  const updateField = useCallback((field: keyof ShippingAddress, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  }, [value, onChange]);

  // Initialize query from value
  useEffect(() => {
    if (value.streetAddress && !query) {
      setQuery(formatAddress(value));
    }
  }, [value, query]);

  return (
    <div ref={wrapperRef} className={cn('space-y-3', className)}>
      {/* Main address search input */}
      <div className="relative">
        {label && (
          <Label className="text-sm text-muted-foreground mb-1.5 block">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
          {!isLoading && value.streetAddress && value.postalCode && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.postal_code}-${suggestion.street}-${index}`}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors',
                  'flex flex-col gap-0.5',
                  selectedIndex === index && 'bg-muted'
                )}
              >
                <span className="font-medium">
                  {suggestion.street}
                  {suggestion.street_number && ` ${suggestion.street_number}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {suggestion.postal_code} {suggestion.city}
                  {suggestion.municipality && `, ${suggestion.municipality}`}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>

      {/* Additional fields for full address mode */}
      {showFullAddress && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Street Address
            </Label>
            <Input
              type="text"
              value={value.streetAddress || ''}
              onChange={(e) => updateField('streetAddress', e.target.value)}
              placeholder="Street name"
              disabled={disabled}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Number
            </Label>
            <Input
              type="text"
              value={value.streetNumber || ''}
              onChange={(e) => updateField('streetNumber', e.target.value)}
              placeholder="123A"
              disabled={disabled}
              className="text-sm"
            />
          </div>
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
            <Label className="text-xs text-muted-foreground mb-1 block">
              City
            </Label>
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
      )}
    </div>
  );
}

export default AddressAutocomplete;
