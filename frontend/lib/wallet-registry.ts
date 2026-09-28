/** @fileOverview Bounded, untrusted wallet display-cache parsing. @stability stable */
import { z } from 'zod';

const text = z.string().min(1).max(512);
const entrySchema = z.object({
  key: text,
  label: text,
  customLabel: z.string().max(100).optional(),
  family: z.enum(['EVM', 'SOLANA', 'BITCOIN']),
  address: z.string().min(1).max(200),
  connectorName: text,
  connectorType: text,
  connectorUid: text,
  connectorId: text,
  connectorIcon: z.string().max(32_768).optional(),
  authProvider: z.string().max(64).optional(),
  socialName: z.string().max(200).optional(),
  socialEmail: z.string().max(256).optional(),
  addedAt: z.number().finite().nonnegative(),
});

export type WalletRegistryEntry = z.infer<typeof entrySchema> & {
  /** Derived again from the current user's server records, never from storage. */
  dbWalletId?: string;
};

/** A stale/corrupt cache must not crash navigation or supply server authority. */
export function parseWalletRegistry(raw: string | null): [string, WalletRegistryEntry][] {
  if (!raw || raw.length > 262_144) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const entries = new Map<string, WalletRegistryEntry>();
    for (const candidate of value.slice(0, 100)) {
      if (!Array.isArray(candidate) || candidate.length !== 2 || typeof candidate[0] !== 'string') continue;
      const parsed = entrySchema.safeParse(candidate[1]);
      if (!parsed.success || candidate[0] !== parsed.data.key) continue;
      // Zod strips unknown fields, including dbWalletId, proof and payout flags.
      if (!entries.has(candidate[0])) entries.set(candidate[0], parsed.data);
    }
    return [...entries];
  } catch {
    return [];
  }
}
