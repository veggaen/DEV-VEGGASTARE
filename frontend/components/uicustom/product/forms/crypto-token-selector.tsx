'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FiAlertTriangle, FiTrash2, FiPlus, FiShield } from 'react-icons/fi';

export interface AcceptedTokenEntry {
  family: 'EVM' | 'SOLANA';
  symbol: string;
  decimals: number;
  tokenAddress?: string | null;
  tokenMint?: string | null;
}

// Well-known tokens for quick selection
const PRESET_TOKENS: AcceptedTokenEntry[] = [
  { family: 'EVM', symbol: 'ETH', decimals: 18 },
  { family: 'EVM', symbol: 'PLS', decimals: 18 },
  { family: 'SOLANA', symbol: 'SOL', decimals: 9 },
];

const CHAIN_LABELS: Record<string, string> = {
  EVM: 'EVM (Ethereum, PulseChain, Base…)',
  SOLANA: 'Solana',
};

interface CryptoTokenSelectorProps {
  tokens: AcceptedTokenEntry[];
  onChange: (tokens: AcceptedTokenEntry[]) => void;
  disabled?: boolean;
}

export function CryptoTokenSelector({ tokens, onChange, disabled }: CryptoTokenSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFamily, setCustomFamily] = useState<'EVM' | 'SOLANA'>('EVM');
  const [customSymbol, setCustomSymbol] = useState('');
  const [customDecimals, setCustomDecimals] = useState('18');
  const [customAddress, setCustomAddress] = useState('');

  const tokenKeys = useMemo(
    () => new Set(tokens.map((t) => `${t.family}:${t.symbol}`)),
    [tokens]
  );

  const togglePreset = (preset: AcceptedTokenEntry) => {
    const key = `${preset.family}:${preset.symbol}`;
    if (tokenKeys.has(key)) {
      onChange(tokens.filter((t) => `${t.family}:${t.symbol}` !== key));
    } else {
      onChange([...tokens, { ...preset }]);
    }
  };

  const removeToken = (idx: number) => {
    onChange(tokens.filter((_, i) => i !== idx));
  };

  const addCustom = () => {
    if (!customSymbol.trim()) return;
    const symbol = customSymbol.toUpperCase().trim();
    const key = `${customFamily}:${symbol}`;
    if (tokenKeys.has(key)) return; // already exists
    const entry: AcceptedTokenEntry = {
      family: customFamily,
      symbol,
      decimals: parseInt(customDecimals) || 18,
      tokenAddress: customFamily === 'EVM' && customAddress ? customAddress : null,
      tokenMint: customFamily === 'SOLANA' && customAddress ? customAddress : null,
    };
    onChange([...tokens, entry]);
    setCustomSymbol('');
    setCustomAddress('');
    setShowCustom(false);
  };

  const sectionStyle =
    'rounded-xl border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-white/[0.02]';
  const chipBase =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition-all cursor-pointer select-none';
  const chipActive =
    'bg-emerald-600/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20';
  const chipInactive =
    'bg-muted/30 border-border dark:border-white/10 text-muted-foreground hover:border-emerald-500/30 dark:bg-white/5';

  return (
    <div className={sectionStyle}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Accepted Crypto Tokens
        </h3>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">Optional</span>
      </div>

      {/* Preset quick-select */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESET_TOKENS.map((preset) => {
          const key = `${preset.family}:${preset.symbol}`;
          const isActive = tokenKeys.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => togglePreset(preset)}
              className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
            >
              {preset.family === 'SOLANA' ? '◎' : '⟠'} {preset.symbol}
              {isActive && <span className="text-emerald-500">✓</span>}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowCustom(!showCustom)}
          className={`${chipBase} ${chipInactive}`}
        >
          <FiPlus className="h-3.5 w-3.5" /> Custom
        </button>
      </div>

      {/* Custom token form */}
      {showCustom && (
        <div className="rounded-lg bg-muted/20 dark:bg-white/[0.02] border border-border/50 dark:border-white/5 p-3 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={customFamily}
              onValueChange={(v) => setCustomFamily(v as 'EVM' | 'SOLANA')}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EVM">{CHAIN_LABELS.EVM}</SelectItem>
                <SelectItem value="SOLANA">{CHAIN_LABELS.SOLANA}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Symbol (e.g. USDC)"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              className="h-9 text-xs"
              disabled={disabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Decimals (e.g. 18)"
              value={customDecimals}
              onChange={(e) => setCustomDecimals(e.target.value)}
              type="number"
              min="0"
              max="18"
              className="h-9 text-xs"
              disabled={disabled}
            />
            <Input
              placeholder={customFamily === 'EVM' ? 'Contract address (0x…)' : 'Token mint address'}
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              className="h-9 text-xs font-mono"
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={addCustom}
            disabled={disabled || !customSymbol.trim()}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Add Token
          </Button>
        </div>
      )}

      {/* Selected tokens list */}
      {tokens.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {tokens.map((t, idx) => (
            <div
              key={`${t.family}:${t.symbol}`}
              className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-muted/20 dark:bg-white/[0.02] border border-border/30 dark:border-white/5"
            >
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-500 font-medium">{t.symbol}</span>
                <span className="text-zinc-400">•</span>
                <span className="text-zinc-500">{CHAIN_LABELS[t.family] ?? t.family}</span>
                <span className="text-zinc-400">({t.decimals}d)</span>
              </span>
              <button
                type="button"
                onClick={() => removeToken(idx)}
                disabled={disabled}
                className="text-red-400 hover:text-red-500 p-0.5"
              >
                <FiTrash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Warning box */}
      {tokens.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-2.5 flex gap-2">
          <FiAlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <div className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed space-y-1">
            <p className="font-medium flex items-center gap-1">
              <FiShield className="h-3 w-3" /> Crypto Payment Disclaimer
            </p>
            <p>
              Cryptocurrency transactions are <strong>irreversible</strong>. Ensure you provide the correct
              receiver wallet. VeggaStare does not custody funds — payments go directly to the seller&apos;s wallet.
            </p>
            <p>
              For Norwegian tax purposes, crypto income must be reported at the NOK value on the date of receipt.
              See <em>skatteetaten.no</em> for current rules.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
