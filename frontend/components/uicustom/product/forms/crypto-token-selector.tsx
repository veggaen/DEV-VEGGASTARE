'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FiTrash2, FiPlus, FiShield } from 'react-icons/fi';

export interface AcceptedTokenEntry {
  family: 'EVM' | 'SOLANA';
  symbol: string;
  decimals: number;
  tokenAddress?: string | null;
  tokenMint?: string | null;
  receiverWalletId?: string | null;
  receiverAddress?: string | null;
}

// Token metadata for presets — icon (brand color + glyph) + the network label
// shown next to each symbol so sellers see exactly what they'd accept.
interface TokenMeta extends AcceptedTokenEntry {
  network: string;
  color: string; // brand-ish accent for the icon chip
  glyph: string; // short symbol shown in the icon disc
}

// Well-known tokens surfaced by default when a seller enables web3 payments.
const PRESET_TOKENS: TokenMeta[] = [
  { family: 'EVM', symbol: 'ETH', decimals: 18, network: 'Ethereum', color: '#627EEA', glyph: 'Ξ' },
  { family: 'EVM', symbol: 'USDC', decimals: 6, tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', network: 'Ethereum', color: '#2775CA', glyph: '$' },
  { family: 'EVM', symbol: 'HEX', decimals: 8, tokenAddress: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', network: 'Ethereum / PulseChain', color: '#FF0099', glyph: 'H' },
  { family: 'EVM', symbol: 'PLS', decimals: 18, network: 'PulseChain', color: '#9945FF', glyph: '✦' },
  { family: 'SOLANA', symbol: 'SOL', decimals: 9, network: 'Solana', color: '#14F195', glyph: '◎' },
];

const CHAIN_LABELS: Record<string, string> = {
  EVM: 'EVM (Ethereum, PulseChain, Base…)',
  SOLANA: 'Solana',
};

// Look up display metadata for any token (preset or custom) by symbol+family.
function tokenMetaFor(t: AcceptedTokenEntry): { network: string; color: string; glyph: string } {
  const preset = PRESET_TOKENS.find((p) => p.family === t.family && p.symbol === t.symbol);
  if (preset) return { network: preset.network, color: preset.color, glyph: preset.glyph };
  return {
    network: t.family === 'SOLANA' ? 'Solana' : 'EVM',
    color: t.family === 'SOLANA' ? '#14F195' : '#71717a',
    glyph: t.symbol.slice(0, 1).toUpperCase(),
  };
}

// Small token icon disc — colored ring + glyph. No external image assets needed.
function TokenIcon({ color, glyph, size = 'sm' }: { color: string; glyph: string; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-7 w-7 text-[13px]' : 'h-5 w-5 text-[10px]';
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}

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

  return (
    <div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">Accept crypto</h3>
        <p className="text-sm text-muted-foreground">
          Optional. Choose which tokens buyers can pay you with directly on-chain.
        </p>
      </div>

      {/* Preset quick-select — each token shows its icon + network. Selecting a
          token gives it a quiet accent ring rather than a filled pill. */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PRESET_TOKENS.map((preset) => {
          const key = `${preset.family}:${preset.symbol}`;
          const isActive = tokenKeys.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => togglePreset(preset)}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500/[0.07] ring-1 ring-emerald-500/40 dark:bg-emerald-400/[0.06]'
                  : 'hover:-translate-y-0.5 hover:bg-muted/40'
              }`}
            >
              <TokenIcon color={preset.color} glyph={preset.glyph} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{preset.symbol}</span>
                <span className="block truncate text-xs text-muted-foreground">{preset.network}</span>
              </span>
              <span
                className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                  isActive ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-transparent group-hover:bg-border'
                }`}
              />
            </button>
          );
        })}
        {/* Custom token tile */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowCustom(!showCustom)}
          className={`flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition-all duration-200 ${
            showCustom ? 'border-emerald-500/40 text-foreground' : 'border-border/80 text-muted-foreground hover:-translate-y-0.5 hover:text-foreground'
          }`}
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current">
            <FiPlus className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium">Add custom token</span>
        </button>
      </div>

      {/* Custom token form */}
      {showCustom && (
        <div className="mt-3 space-y-2 border-l-2 border-emerald-500/30 pl-4">
          <p className="text-xs text-muted-foreground">Find your token by its chain and contract / mint address.</p>
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
            className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-500"
          >
            Add token
          </Button>
        </div>
      )}

      {/* Selected tokens list */}
      {tokens.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Accepting</p>
          {tokens.map((t, idx) => {
            const meta = tokenMetaFor(t);
            return (
              <div
                key={`${t.family}:${t.symbol}`}
                className="group flex items-center gap-2.5 py-1.5"
              >
                <TokenIcon color={meta.color} glyph={meta.glyph} />
                <span className="text-sm font-medium text-foreground">{t.symbol}</span>
                <span className="text-xs text-muted-foreground">{meta.network}</span>
                {t.tokenAddress || t.tokenMint ? (
                  <span className="font-mono text-[11px] text-muted-foreground/70">
                    {(t.tokenAddress || t.tokenMint)!.slice(0, 6)}…{(t.tokenAddress || t.tokenMint)!.slice(-4)}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeToken(idx)}
                  disabled={disabled}
                  className="ml-auto p-1 text-muted-foreground/50 transition-colors hover:text-red-500"
                  title="Remove"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer — quiet left-border line */}
      {tokens.length > 0 && (
        <p className="mt-4 border-l-2 border-amber-500/50 pl-3 text-[11px] leading-relaxed text-muted-foreground">
          <FiShield className="mr-1 inline h-3 w-3 align-text-bottom" />
          Crypto transactions are <strong className="text-foreground">irreversible</strong> and paid directly to your wallet — Veggat never custodies funds.
          For Norwegian tax, report crypto income at its NOK value on the date received (skatteetaten.no).
        </p>
      )}
    </div>
  );
}
