'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Truck,
  MapPin,
  Package,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calculator,
  Info,
  RefreshCw,
  AlertTriangle,
  Gift,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { lookupPostalCode } from '@/lib/bring-address';

// =============================================================================
// TYPES
// =============================================================================

interface ShippingProduct {
  id: string;
  displayName: string;
  price: number;
  currency: string;
  deliveryTime?: string;
  description?: string;
}

interface ShippingEstimateResult {
  products: ShippingProduct[];
  fromPostalCode: string;
  fromCity: string;
  toPostalCode: string;
  toCity: string;
}

interface ShippingEstimateCardProps {
  /** From postal code (seller's location) */
  fromPostalCode?: string;
  /** From city name */
  fromCity?: string;
  /** Package weight in grams */
  weightGrams?: number;
  /** Package dimensions in cm */
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  /** Product price (for free shipping threshold) */
  productPrice?: number;
  /** Currency code */
  currency?: string;
  /** Free shipping threshold - if set, shows "Free shipping on orders over X" */
  freeShippingThreshold?: number;
  /** Whether free shipping is enabled */
  freeShippingEnabled?: boolean;
  /** Callback when free shipping settings change */
  onFreeShippingChange?: (enabled: boolean, threshold: number | undefined) => void;
  /** Show free shipping config options */
  showFreeShippingConfig?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ShippingEstimateCard({
  fromPostalCode,
  fromCity,
  weightGrams = 1000,
  lengthCm = 20,
  widthCm = 15,
  heightCm = 10,
  productPrice = 0,
  currency = 'NOK',
  freeShippingThreshold,
  freeShippingEnabled = false,
  onFreeShippingChange,
  showFreeShippingConfig = false,
  disabled = false,
  className,
}: ShippingEstimateCardProps) {
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [toPostalCode, setToPostalCode] = useState('');
  const [toCity, setToCity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShippingEstimateResult | null>(null);
  const [localFreeShippingEnabled, setLocalFreeShippingEnabled] = useState(freeShippingEnabled);
  const [localFreeShippingThreshold, setLocalFreeShippingThreshold] = useState<string>(
    freeShippingThreshold?.toString() || ''
  );

  // Check if we have enough info to estimate
  const hasFromAddress = !!fromPostalCode;
  const hasPackageInfo = weightGrams > 0 && lengthCm > 0 && widthCm > 0 && heightCm > 0;
  const canEstimate = hasFromAddress && hasPackageInfo && toPostalCode.length >= 4;

  // Detect user's location on mount (optional)
  useEffect(() => {
    // Could auto-detect user location here if needed
  }, []);

  // Lookup city when postal code changes
  const handlePostalCodeChange = useCallback(async (postalCode: string) => {
    setToPostalCode(postalCode);
    setResult(null);
    
    if (postalCode.length >= 4) {
      try {
        const data = await lookupPostalCode(postalCode);
        if (data) {
          setToCity(data.city);
        }
      } catch (err) {
        // Ignore errors for city lookup
      }
    } else {
      setToCity('');
    }
  }, []);

  // Fetch shipping estimates
  const fetchEstimates = useCallback(async () => {
    if (!canEstimate || !fromPostalCode) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bring-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPostalCode,
          toPostalCode,
          packages: [{
            grossWeight: weightGrams,
            length: lengthCm,
            width: widthCm,
            height: heightCm,
          }],
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to get shipping estimates');
      }
      
      const data = await response.json();
      
      // Parse the Bring API response
      if (data.consignments?.[0]?.products) {
        const products: ShippingProduct[] = data.consignments[0].products.map((p: any) => ({
          id: p.id,
          displayName: p.guiInformation?.displayName || p.id,
          price: parseFloat(p.price?.listPrice?.priceWithAdditionalServices?.amountWithVAT || '0'),
          currency: p.price?.listPrice?.priceWithAdditionalServices?.currencyCode || 'NOK',
          deliveryTime: p.expectedDelivery?.workingDays 
            ? `${p.expectedDelivery.workingDays} working days`
            : undefined,
          description: p.guiInformation?.descriptionText,
        }));
        
        setResult({
          products: products.sort((a, b) => a.price - b.price),
          fromPostalCode,
          fromCity: fromCity || '',
          toPostalCode,
          toCity,
        });
      } else {
        throw new Error('No shipping options available for this route');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get estimates');
    } finally {
      setIsLoading(false);
    }
  }, [canEstimate, fromPostalCode, fromCity, toPostalCode, toCity, weightGrams, lengthCm, widthCm, heightCm]);

  // Handle free shipping toggle
  const handleFreeShippingToggle = useCallback(() => {
    const newEnabled = !localFreeShippingEnabled;
    setLocalFreeShippingEnabled(newEnabled);
    onFreeShippingChange?.(newEnabled, newEnabled ? parseFloat(localFreeShippingThreshold) || undefined : undefined);
  }, [localFreeShippingEnabled, localFreeShippingThreshold, onFreeShippingChange]);

  // Handle threshold change
  const handleThresholdChange = useCallback((value: string) => {
    setLocalFreeShippingThreshold(value);
    if (localFreeShippingEnabled) {
      onFreeShippingChange?.(true, parseFloat(value) || undefined);
    }
  }, [localFreeShippingEnabled, onFreeShippingChange]);

  // Format price
  const formatPrice = (price: number, curr: string) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Get cheapest shipping option
  const cheapestOption = result?.products[0];

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden', className)}>
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Shipping Estimates</span>
          {cheapestOption && (
            <span className="text-xs text-muted-foreground">
              from {formatPrice(cheapestOption.price, cheapestOption.currency)}
            </span>
          )}
          {!hasFromAddress && (
            <span className="text-xs text-amber-500">Set ship-from address first</span>
          )}
          {!hasPackageInfo && hasFromAddress && (
            <span className="text-xs text-amber-500">Add package dimensions</span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4 bg-muted/5">
          {/* Shipping info summary */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>From: {fromPostalCode ? `${fromPostalCode} ${fromCity || ''}` : 'Not set'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              <span>{weightGrams}g • {lengthCm}×{widthCm}×{heightCm} cm</span>
            </div>
          </div>

          {/* Destination input */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Estimate shipping to:</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={toPostalCode}
                onChange={(e) => handlePostalCodeChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Postal code"
                className="w-24 text-sm"
                maxLength={4}
              />
              <Input
                type="text"
                value={toCity}
                readOnly
                placeholder="City"
                className="flex-1 text-sm bg-muted/20"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={fetchEstimates}
                disabled={!canEstimate || isLoading}
                className="gap-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Calculator className="h-4 w-4" />
                    Get Estimate
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/10 text-red-500 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Results */}
          {result && result.products.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Shipping options to {result.toPostalCode} {result.toCity}:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.products.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/20 hover:bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.displayName}</p>
                      {product.deliveryTime && (
                        <p className="text-xs text-muted-foreground">{product.deliveryTime}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-500">
                        {formatPrice(product.price, product.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {result.products.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{result.products.length - 5} more options
                </p>
              )}
            </div>
          )}

          {/* Free shipping config */}
          {showFreeShippingConfig && (
            <div className="pt-3 border-t border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">Free Shipping Offer</span>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs text-xs">
                        Offer free shipping on orders above a certain amount. You pay for shipping costs.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFreeShippingEnabled}
                    onChange={handleFreeShippingToggle}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              
              {localFreeShippingEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Free shipping on orders over</span>
                  <Input
                    type="number"
                    value={localFreeShippingThreshold}
                    onChange={(e) => handleThresholdChange(e.target.value)}
                    placeholder="1000"
                    className="w-24 text-sm"
                    min={0}
                  />
                  <span className="text-xs text-muted-foreground">{currency}</span>
                </div>
              )}
            </div>
          )}

          {/* Refresh button when we have results */}
          {result && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={fetchEstimates}
                disabled={isLoading}
                className="gap-1 text-xs text-muted-foreground"
              >
                <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ShippingEstimateCard;
