'use client';

import React from 'react';
import { useUiPreferences, type FiatCurrency, type CryptoCurrency } from '@/components/providers/ui-preferences';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe, Bitcoin, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const FIAT_OPTIONS: { value: FiatCurrency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'NOK', label: 'Norwegian Krone', symbol: 'kr' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'SEK', label: 'Swedish Krona', symbol: 'kr' },
  { value: 'DKK', label: 'Danish Krone', symbol: 'kr' },
];

const CRYPTO_OPTIONS: { value: CryptoCurrency; label: string; symbol: string }[] = [
  { value: 'ETH', label: 'Ethereum', symbol: 'Ξ' },
  { value: 'BTC', label: 'Bitcoin', symbol: '₿' },
  { value: 'SOL', label: 'Solana', symbol: '◎' },
  { value: 'USDC', label: 'USD Coin', symbol: '$' },
  { value: 'NONE', label: 'No Crypto', symbol: '—' },
];

interface CurrencySelectorProps {
  showCrypto?: boolean;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
}

export function CurrencySelector({ 
  showCrypto = true, 
  variant = 'ghost',
  size = 'sm',
  className 
}: CurrencySelectorProps) {
  const { prefs, setPrefs } = useUiPreferences();
  
  const currentFiat = FIAT_OPTIONS.find(f => f.value === prefs.preferredFiatCurrency) ?? FIAT_OPTIONS[0];
  const currentCrypto = CRYPTO_OPTIONS.find(c => c.value === prefs.preferredCryptoCurrency) ?? CRYPTO_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          className={cn(
            "h-8 gap-1.5 text-xs font-medium transition-colors",
            "hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring",
            className
          )}
        >
          <Globe className="h-3.5 w-3.5 opacity-70" />
          <span>{currentFiat.value}</span>
          {showCrypto && prefs.preferredCryptoCurrency !== 'NONE' && (
            <>
              <span className="text-muted-foreground/60">/</span>
              <span className="text-muted-foreground">{currentCrypto.value}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className={cn(
          "w-52 p-1.5",
          "border-border/50 bg-popover/95 backdrop-blur-xl",
          "shadow-lg shadow-black/5 dark:shadow-black/20",
          "animate-in fade-in-0 zoom-in-95"
        )}
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Display Currency
        </DropdownMenuLabel>
        <div className="space-y-0.5">
          {FIAT_OPTIONS.map((opt) => {
            const isSelected = prefs.preferredFiatCurrency === opt.value;
            return (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setPrefs({ preferredFiatCurrency: opt.value })}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                  "transition-colors duration-150",
                  isSelected 
                    ? "bg-accent/60 text-accent-foreground" 
                    : "hover:bg-accent/40"
                )}
              >
                <span className="w-5 text-center text-muted-foreground">{opt.symbol}</span>
                <span className="flex-1 font-medium">{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </div>
        
        {showCrypto && (
          <>
            <DropdownMenuSeparator className="my-1.5 bg-border/50" />
            <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              <Bitcoin className="h-3 w-3" />
              Crypto Display
            </DropdownMenuLabel>
            <div className="space-y-0.5">
              {CRYPTO_OPTIONS.map((opt) => {
                const isSelected = prefs.preferredCryptoCurrency === opt.value;
                return (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setPrefs({ preferredCryptoCurrency: opt.value })}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                      "transition-colors duration-150",
                      isSelected 
                        ? "bg-accent/60 text-accent-foreground" 
                        : "hover:bg-accent/40"
                    )}
                  >
                    <span className="w-5 text-center text-muted-foreground">{opt.symbol}</span>
                    <span className="flex-1 font-medium">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Compact currency toggle for mobile/header
 */
export function CurrencyToggle({ className }: { className?: string }) {
  const { prefs, setPrefs } = useUiPreferences();
  
  const toggleCrypto = () => {
    const cryptos: CryptoCurrency[] = ['ETH', 'SOL', 'BTC', 'NONE'];
    const currentIdx = cryptos.indexOf(prefs.preferredCryptoCurrency);
    const nextIdx = (currentIdx + 1) % cryptos.length;
    setPrefs({ preferredCryptoCurrency: cryptos[nextIdx] });
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className={className}
      onClick={toggleCrypto}
      title={`Crypto: ${prefs.preferredCryptoCurrency}`}
    >
      <Bitcoin className="h-4 w-4" />
    </Button>
  );
}

export default CurrencySelector;
