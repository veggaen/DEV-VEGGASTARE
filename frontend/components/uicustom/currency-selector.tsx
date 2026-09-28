'use client';

import React from 'react';
import { useUiPreferences, type FiatCurrency, type CryptoCurrency } from '@/components/providers/ui-preferences';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe, Bitcoin, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientReady } from '@/hooks/use-client-ready';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';

export const FIAT_CURRENCIES: { code: FiatCurrency; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
];

export const CRYPTO_CURRENCIES: { code: CryptoCurrency; name: string; symbol: string }[] = [
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ' },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿' },
  { code: 'SOL', name: 'Solana', symbol: '◎' },
  { code: 'PLS', name: 'PulseChain', symbol: 'PLS' },
  { code: 'USDC', name: 'USD Coin', symbol: '$' },
  { code: 'NONE', name: 'No Crypto', symbol: '—' },
];

// Convenience aliases for internal use
const FIAT_OPTIONS = FIAT_CURRENCIES.map(c => ({ value: c.code, label: c.name, symbol: c.symbol }));
const CRYPTO_OPTIONS = CRYPTO_CURRENCIES.map(c => ({ value: c.code, label: c.name, symbol: c.symbol }));

// Hook for currency management
export function useCurrency() {
  const { prefs, setPrefs } = useUiPreferences();
  
  return {
    currency: prefs.preferredFiatCurrency,
    setCurrency: (code: FiatCurrency) => setPrefs({ preferredFiatCurrency: code }),
    cryptoCurrency: prefs.preferredCryptoCurrency,
    setCryptoCurrency: (code: CryptoCurrency) => setPrefs({ preferredCryptoCurrency: code }),
  };
}

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
  const [open, setOpen] = React.useState(false);
  const clientReady = useClientReady();
  const rates = useCurrencyRates();
  
  const currentFiat = FIAT_OPTIONS.find(f => f.value === prefs.preferredFiatCurrency) ?? FIAT_OPTIONS[0];
  const currentCrypto = CRYPTO_OPTIONS.find(c => c.value === prefs.preferredCryptoCurrency) ?? CRYPTO_OPTIONS[0];
  const selectedAvailable = Number.isFinite(rates.fiatRates[currentFiat.value]) && (!showCrypto || currentCrypto.value === 'NONE' || Number.isFinite(rates.cryptoPrices[currentCrypto.value]));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          disabled={!clientReady}
          aria-label={`Display currency: ${currentFiat.value}${showCrypto && currentCrypto.value !== 'NONE' ? ` (${currentCrypto.value})` : ''}`}
          className={cn(
            "min-h-11 min-w-11 gap-1.5 touch-manipulation text-xs font-medium",
            "hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring",
            className
          )}
        >
          <Globe className="h-3.5 w-3.5 opacity-70" aria-hidden />
          <span>{currentFiat.value}</span>
          {showCrypto && prefs.preferredCryptoCurrency !== 'NONE' && (
            <>
              <span className="text-muted-foreground">({currentCrypto.value})</span>
            </>
          )}
          <ChevronDown className="size-3 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className={cn(
          "w-64 scroll-pb-40 p-1.5 motion-reduce:animate-none",
          "border-border/50 bg-popover/95 backdrop-blur-xl",
          "shadow-lg shadow-black/5 dark:shadow-black/20",
          "duration-150"
        )}
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Display Currency
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup aria-label="Fiat currency" value={prefs.preferredFiatCurrency} onValueChange={value => setPrefs({ preferredFiatCurrency: value as FiatCurrency })} className="space-y-0.5">
          {FIAT_OPTIONS.map((opt) => {
            const isSelected = prefs.preferredFiatCurrency === opt.value;
            return (
              <DropdownMenuRadioItem
                key={opt.value}
                value={opt.value}
                onSelect={event => event.preventDefault()}
                textValue={opt.label}
                className={cn(
                  "flex min-h-11 touch-manipulation items-center gap-2 rounded-md pl-8 pr-2 text-sm cursor-pointer",
                  isSelected 
                    ? "bg-accent/60 text-accent-foreground" 
                    : "hover:bg-accent/40"
                )}
              >
                <span className="w-5 text-center text-muted-foreground" aria-hidden>{opt.symbol}</span>
                <span className="flex-1 font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground" aria-hidden>{opt.value}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        
        {showCrypto && (
          <>
            <DropdownMenuSeparator className="my-1.5 bg-border/50" />
            <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              <Bitcoin className="h-3 w-3" aria-hidden />
              Crypto Display
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup aria-label="Crypto display" value={prefs.preferredCryptoCurrency} onValueChange={value => setPrefs({ preferredCryptoCurrency: value as CryptoCurrency })} className="space-y-0.5">
              {CRYPTO_OPTIONS.map((opt) => {
                const isSelected = prefs.preferredCryptoCurrency === opt.value;
                return (
                  <DropdownMenuRadioItem
                    key={opt.value}
                    value={opt.value}
                    textValue={opt.label}
                    onSelect={event => event.preventDefault()}
                    className={cn(
                      "flex min-h-11 touch-manipulation items-center gap-2 rounded-md pl-8 pr-2 text-sm cursor-pointer",
                      isSelected 
                        ? "bg-accent/60 text-accent-foreground" 
                        : "hover:bg-accent/40"
                    )}
                  >
                    <span className="w-5 text-center text-muted-foreground" aria-hidden>{opt.symbol}</span>
                    <span className="flex-1 font-medium">{opt.label}</span>
                    {opt.value !== 'NONE' && <span className="text-xs text-muted-foreground" aria-hidden>{opt.value}</span>}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </>
        )}
        <div className="sticky bottom-0 -mx-1.5 -mb-1.5 mt-2 border-t border-border bg-popover p-2">
          <p className="px-2 pb-2 text-xs leading-relaxed text-muted-foreground">Display estimates. Choose how to pay at checkout.</p>
          <p role="status" className="px-2 pb-2 text-xs leading-relaxed text-muted-foreground">{rates.isLoading ? 'Updating conversion rates…' : rates.error ?? (!selectedAvailable ? 'Selected conversion unavailable. Refresh or choose another currency.' : rates.isFiatStale || (showCrypto && currentCrypto.value !== 'NONE' && rates.isCryptoStale) ? 'Some estimates use last available rates.' : 'Current reference rates.')}</p>
          <div className="grid grid-cols-2 gap-2">
            <DropdownMenuItem disabled={rates.isLoading} className="min-h-11 cursor-pointer justify-center rounded-md" onSelect={event => { event.preventDefault(); void rates.refreshRates(); }}>Refresh rates</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 cursor-pointer justify-center rounded-md bg-accent font-medium" onSelect={() => setOpen(false)}>Done</DropdownMenuItem>
          </div>
        </div>
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
    const cryptos: CryptoCurrency[] = CRYPTO_CURRENCIES.map(option => option.code);
    const currentIdx = cryptos.indexOf(prefs.preferredCryptoCurrency);
    const nextIdx = (currentIdx + 1) % cryptos.length;
    setPrefs({ preferredCryptoCurrency: cryptos[nextIdx] });
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className={cn('min-h-11 min-w-11 touch-manipulation', className)}
      onClick={toggleCrypto}
      title={`Crypto: ${prefs.preferredCryptoCurrency}`}
      aria-label={`Change crypto display, currently ${prefs.preferredCryptoCurrency}`}
    >
      <Bitcoin className="h-4 w-4" aria-hidden />
    </Button>
  );
}

export default CurrencySelector;
