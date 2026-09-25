/** @fileOverview Settings use the same secure signing flow as the sidebar. @stability evolving */
'use client';
import { useAccount } from 'wagmi';
import { useWalletVerify } from '@/hooks/use-wallet-verify';
import { WalletVerificationAction } from './WalletVerificationAction';

export default function EvmWalletVerify({ enabled, onVerified }: { enabled: boolean; onVerified?: () => void }) {
  const { address, chainId, connector, isConnected } = useAccount();
  const flow = useWalletVerify({ address, chainId, connectorUid: connector?.uid, onSuccess: onVerified });
  return <section aria-label="Verify connected wallet" className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4">
    <h3 className="text-sm font-semibold">Connected EVM wallet</h3>
    <p className={`${isConnected ? 'break-all' : 'break-words'} text-sm text-muted-foreground`}>{isConnected ? address : 'Connect an EVM wallet to verify ownership.'}</p>
    <p className="text-xs text-muted-foreground">Free signature. No transaction or gas fee.</p>
    <WalletVerificationAction flow={flow} disabled={!enabled || !isConnected} />
  </section>;
}
