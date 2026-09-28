/** @fileOverview Settings use the same secure signing flow as the sidebar. @stability evolving */
'use client';
import { useAccount } from 'wagmi';
import { useWalletVerify } from '@/hooks/use-wallet-verify';
import { WalletVerificationAction } from './WalletVerificationAction';

export default function EvmWalletVerify({ enabled, onVerified }: { enabled: boolean; onVerified?: () => void }) {
  const { address, chainId, connector, isConnected } = useAccount();
  const flow = useWalletVerify({ address, chainId, connectorUid: connector?.uid, onSuccess: onVerified });
  return <section aria-label="Verify connected wallet" className="min-w-0 space-y-2 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-e1 backdrop-blur-xl">
    <div>
      <h3 className="text-sm font-semibold">Ownership</h3>
      <p className="text-xs text-muted-foreground">Sign a free message to prove the connected wallet is yours. No transaction, no gas.</p>
    </div>
    <p className={`${isConnected ? 'break-all font-mono' : 'break-words'} text-xs text-muted-foreground`}>{isConnected ? address : 'Connect an EVM wallet first.'}</p>
    <WalletVerificationAction flow={flow} disabled={!enabled || !isConnected} />
  </section>;
}
